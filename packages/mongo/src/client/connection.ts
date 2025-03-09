/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, asyncOperation, formatError } from '@deepkit/core';
import { Host } from './host.js';
import { createConnection, Socket } from 'net';
import { connect as createTLSConnection, TLSSocket } from 'tls';
import { Command, TransactionalMessage } from './command/command.js';
import { stringifyType, Type, uuid } from '@deepkit/type';
import { BSONBinarySerializer, BsonStreamReader, getBSONSerializer, getBSONSizer, Writer } from '@deepkit/bson';
import { HandshakeCommand } from './command/handshake.js';
import { MongoClientConfig } from './config.js';
import { MongoConnectionError, MongoError } from './error.js';
import { DatabaseTransaction } from '@deepkit/orm';
import { CommitTransactionCommand } from './command/commitTransaction.js';
import { AbortTransactionCommand } from './command/abortTransaction.js';
import { EventDispatcher, EventTokenSync } from '@deepkit/event';
import { IsMasterCommand } from './command/ismaster';
import { Logger } from '@deepkit/logger';

export enum MongoConnectionStatus {
    pending = 'pending',
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
    error = 'error',
}

export interface ConnectionRequest {
    /**
     * When set to true, connections to a primary are returned.
     *
     * Is set to true automatically when a write operation is executed.
     *
     * Default is false.
     */
    writable: boolean;

    readPreference: 'primary' | 'secondary' | 'nearest' | 'primaryPreferred' | 'secondaryPreferred';
}

export class MongoStats {
    /**
     * How many connections have been created.
     */
    connectionsCreated: number = 0;

    /**
     * How many connections have been reused.
     */
    connectionsReused: number = 0;

    /**
     * How many connection requests were queued because pool was full.
     */
    connectionsQueued: number = 0;

    bytesReceived: number = 0;
    bytesSent: number = 0;
}

export const onMongoTopologyChange = new EventTokenSync('mongo.topologyChange');


export class MongoConnectionPool {
    protected connectionId: number = 0;

    /**
     * Connections, might be in any state, not necessarily connected.
     */
    public connections: MongoConnection[] = [];

    protected queue: {
        resolve: (connection: MongoConnection) => void,
        reject: (error: Error) => void,
        request: ConnectionRequest,
        time: number
    }[] = [];

    protected lastError?: Error;

    protected lastTopologyChange: Date = new Date(1000, 0);

    constructor(
        protected config: MongoClientConfig,
        protected serializer: BSONBinarySerializer,
        protected stats: MongoStats,
        public logger: Logger,
        public eventDispatcher: EventDispatcher,
    ) {
    }

    // protected async waitForAllConnectionsToConnect(throws: boolean = false): Promise<void> {
    //     const promises: Promise<any>[] = [];
    //     for (const connection of this.connections) {
    //         if (connection.connectingPromise) {
    //             promises.push(connection.connectingPromise);
    //         }
    //     }
    //
    //     if (!promises.length) return;
    //     try {
    //         if (throws) {
    //             await Promise.all(promises);
    //         } else {
    //             await Promise.allSettled(promises);
    //         }
    //     } catch (error: any) {
    //         throw new MongoConnectionError(`Failed to connect: ${formatError(error)}`, { cause: error });
    //     }
    // }

    protected connectPromise?: Promise<void>;
    protected connectPromiseHandles?: { resolve: () => void, reject: (error: Error) => void };

    public async connect() {
        if (this.isConnected()) return;

        if (this.connectPromise) {
            await this.connectPromise;
            return;
        }

        // wait for topology change: we need at least one secondary or primary online
        return this.connectPromise = asyncOperation<void>((resolve, reject) => {
            this.connectPromiseHandles = { resolve, reject };
            this.findTopology();
        });
    }

    protected onTopologyProgress(status: 'start' | 'host' | 'done' | 'fail', error?: Error) {
        // when a new host's type was detected

        // todo: we need to have a state that shows the progress of topology discovery
        //  that is, if the progress ended, we need to
        //  - reject connectPromise
        //  - reject all pending queue requests

        console.log('onTopologyProgress', status);
        if (status === 'done') {
            const queue = this.queue.splice(0, this.queue.length);
            for (const waiter of queue) {
                const host = this.findHostForRequest(waiter.request);
                if (host) {
                    const connection = this.getConnectionForHost(host);
                    if (connection) {
                        waiter.resolve(connection);
                        continue;
                    }
                }

                const error = new MongoConnectionError(
                    `Could not find host for connection request. (readPreference=${waiter.request.readPreference}, topology=${this.config.getTopology()})`,
                );
                waiter.reject(error);
            }

            if (this.connectPromiseHandles) {
                if (this.isConnected()) {
                    this.connectPromiseHandles.resolve();
                } else {
                    this.connectPromiseHandles.reject(new MongoConnectionError('Connection failed: could not find any primary or secondary host'));
                }
                this.connectPromiseHandles = undefined;
                this.connectPromise = undefined;
            }
        }
    }

    /**
     * Returns true when at least one primary or secondary host is connected.
     */
    public isConnected(): boolean {
        for (const host of this.config.hosts) {
            if (host.countTotalConnections() > 0 && (host.isReadable() || host.isWritable())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true when at least one connection is writable.
     */
    public isWritable(): boolean {
        for (const connection of this.connections) {
            if (connection.host.isWritable()) return true;
        }

        return false;
    }

    public getConnectedConnections(): MongoConnection[] {
        return this.connections.filter(v => v.isConnected());
    }

    public close() {
        //import to work on the copy, since Connection.onClose modifies this.connections.
        const connections = this.connections.slice(0);
        for (const connection of connections) {
            connection.close();
        }
    }

    protected scanHost(host: Host): void {
        this._scanHost(host).then((error) => {
            this.onTopologyProgress('host');

            // check if we are done
            let done = true;
            for (const host of this.config.hosts) {
                if (host.lastScan.getTime() >= this.lastTopologyChange.getTime()) continue;
                done = false;
            }
            if (done) {
                this.onTopologyProgress('done');
            }
        }).catch((error) => {
            this.logger.log('Mongo scanHost error', error);
        });
    }

    protected async _scanHost(host: Host): Promise<void> {
        let connection = this.getConnectionForHost(host);
        if (!connection) {
            // we force create a connection to this host, ignoring limits
            // as we don't want to wait for busy connections to be released.
            connection = this.createConnection(host);
        }

        try {
            connection.reserved = true;
            console.log('scan host', host.hostname);
            await connection.connect();
            const data = await connection.execute(new IsMasterCommand());
            console.log('data', host.hostname, data);
        } catch (error) {
            console.log('scan error', error);
            host.status = 'scan(): ' + formatError(error);
        } finally {
            host.lastScan = new Date;
            connection.release();
        }
    }

    /**
     * Creates a queue of tasks for each host to find out the topology.
     * If a new host is found, the task list increases, until no new hosts are found.
     */
    protected findTopology(): boolean {
        if (Date.now() - this.lastTopologyChange.getTime() < 1000 * 60) return true;
        this.lastTopologyChange = new Date();

        this.config.getHosts().then((hosts) => {
            for (const host of hosts) {
                this.scanHost(host);
            }
        }).catch((error) => {
            this.onTopologyProgress('fail', error);
        });
        return false;
    }

    protected findHostForRequest(request: ConnectionRequest): Host | undefined {
        let bestHost: Host | undefined = undefined;
        let bestLatency = Infinity;
        let bestBusyConnections = Infinity;
        let bestFreeConnections = -1;
        let hasPrimary = false;
        let hasSecondary = false;

        const tags = this.config.options.getReadPreferenceTags();

        for (const host of this.config.hosts) {
            if (!host.isUsable()) continue;
            const isPrimary = host.isWritable();
            const isSecondary = host.isReadable();
            if (request.writable && isPrimary) return host;

            if (tags.length) {
                let found = false;
                for (const tag of tags) {
                    // todo this is wrong since "tag sets" means {}[]
                    if (host.tags[tag.key] === tag.value) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;
            }

            if (this.config.options.maxStalenessSeconds && host.staleness > this.config.options.maxStalenessSeconds) continue;

            const busyConnections = host.countReservedConnections();
            const freeConnections = host.countFreeConnections();
            const latency = host.latency;

            if (request.readPreference === 'primary' && !isPrimary) continue;
            if (request.readPreference === 'secondary' && !isSecondary) continue;

            hasPrimary = hasPrimary || isPrimary;
            hasSecondary = hasSecondary || isSecondary;

            let selectHost = false;

            if (request.readPreference === 'primaryPreferred' && isPrimary) {
                return host;
            }
            if (request.readPreference === 'secondaryPreferred' && isSecondary) {
                selectHost = true;
            }
            if (request.readPreference === 'nearest') {
                if (latency < bestLatency) {
                    bestLatency = latency;
                    selectHost = true;
                }
            }
            if (!selectHost) {
                if (busyConnections < bestBusyConnections) {
                    bestBusyConnections = busyConnections;
                    selectHost = true;
                } else if (busyConnections === bestBusyConnections && freeConnections > bestFreeConnections) {
                    bestFreeConnections = freeConnections;
                    selectHost = true;
                }
            }

            if (selectHost) {
                bestHost = host;
            }
        }

        return bestHost;
    }

    protected createConnection(host: Host): MongoConnection {
        this.stats.connectionsCreated++;
        const connection = new MongoConnection(this.connectionId++, host, this.config, this.serializer, (connection) => {
            arrayRemoveItem(host.connections, connection);
            arrayRemoveItem(this.connections, connection);
            // onClose does not automatically reconnect. Only new commands re-establish connections.
        }, (connection) => {
            this.release(connection);
        }, (bytesSent) => {
            this.stats.bytesSent += bytesSent;
        }, (bytesReceived) => {
            this.stats.bytesReceived += bytesReceived;
        });
        connection.connect().catch((error) => {
            host.status = 'connect(): ' + formatError(error);
        });
        host.connections.push(connection);
        this.connections.push(connection);
        return connection;
    }

    // protected matchRequest(host: Host, request: ConnectionRequest): boolean {
    //     if (!host.isUsable()) return false;
    //     if (request.writable && !connection.host.isWritable()) return false;
    //     if (request.readPreference === 'primary' && !connection.host.isWritable()) return false;
    //     if (request.readPreference === 'secondary' && !connection.host.isReadable()) return false;
    //     return true;
    // }

    protected release(connection: MongoConnection) {
        for (let i = 0; i < this.queue.length; i++) {
            const waiter = this.queue[i];

            // check if timed out
            if (this.config.options.connectionAcquisitionTimeout && Date.now() - waiter.time > this.config.options.connectionAcquisitionTimeout) {
                this.queue.splice(i, 1);
                waiter.reject(new MongoConnectionError(`Connection acquisition timed out after ${Date.now() - waiter.time}ms (max ${this.config.options.connectionAcquisitionTimeout}ms)`));
                continue;
            }

            if (waiter.request.writable && !connection.host.isWritable()) continue;
            if (waiter.request.readPreference === 'primary' && !connection.host.isWritable()) continue;
            if (waiter.request.readPreference === 'secondary' && !connection.host.isReadable()) continue;
            if (!connection.host.isUsable()) continue;

            // todo this needs to change, we just need findHost again
            // if (!this.matchRequest(connection, waiter.request)) continue;

            this.stats.connectionsReused++;
            this.queue.splice(i, 1);
            waiter.resolve(connection);
            //we don't set reserved/set cleanupTimeout,
            //since the connection is already reserved and the timeout
            //is only set when the connection actually starting idling.
            return;
        }

        connection.reserved = false;
        connection.cleanupTimeout = setTimeout(() => {
            if (this.connections.length <= this.config.options.minPoolSize) {
                return;
            }

            connection.close();
        }, this.config.options.maxIdleTime);
    }

    protected applyRequestDefaults(request: Partial<ConnectionRequest>): ConnectionRequest {
        if (request.writable === undefined) request.writable = false;
        if (!request.readPreference) {
            request.readPreference = this.config.options.readPreference || 'primary';
        }
        return request as ConnectionRequest;
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    async getConnection(partialRequest: Partial<ConnectionRequest> = {}): Promise<MongoConnection> {
        const request = this.applyRequestDefaults(partialRequest);
        const up2date = this.findTopology();

        // todo: we should wait here if we know topology changed
        //  and we have to ask all hosts first.

        const host = this.findHostForRequest(request);

        if (!host && up2date) {
            throw new MongoConnectionError(
                `Could not find host for connection request. (readPreference=${request.readPreference}, topology=${this.config.getTopology()})`,
            );
        }

        if (host) {
            const connection = this.getConnectionForHost(host);
            if (connection) return connection;

            if (host.connections.length < this.config.options.maxPoolSize) {
                const connection = this.createConnection(host);
                connection.reserved = true;
                return connection;
            }
        }

        return asyncOperation((resolve, reject) => {
            this.stats.connectionsQueued++;
            this.queue.push({ resolve, reject, request, time: Date.now() });
        });
    }

    protected getConnectionForHost(host: Host): MongoConnection | undefined {
        for (const connection of host.connections) {
            if (!connection.isConnected()) continue;
            if (connection.reserved) continue;

            this.stats.connectionsReused++;
            connection.reserved = true;
            if (connection.cleanupTimeout) {
                clearTimeout(connection.cleanupTimeout);
                connection.cleanupTimeout = undefined;
            }

            return connection;
        }
        return;
    }
}

export function readUint32LE(buffer: Uint8Array | ArrayBuffer, offset: number = 0): number {
    return buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
}

export class MongoDatabaseTransaction extends DatabaseTransaction {
    static txnNumber: bigint = 0n;

    connection?: MongoConnection;
    lsid?: { id: string };
    txnNumber: bigint = 0n;
    started: boolean = false;

    applyTransaction(cmd: TransactionalMessage) {
        if (!this.lsid) return;
        cmd.lsid = this.lsid;
        cmd.txnNumber = this.txnNumber;
        cmd.autocommit = false;
        if (!this.started && !cmd.abortTransaction && !cmd.commitTransaction) {
            this.started = true;
            cmd.startTransaction = true;
        }
    }

    async begin() {
        if (!this.connection) return;
        // see https://github.com/mongodb/specifications/blob/master/source/sessions/driver-sessions.rst
        this.lsid = { id: uuid() };
        this.txnNumber = MongoDatabaseTransaction.txnNumber++;
        // const res = await this.connection.execute(new StartSessionCommand());
        // this.lsid = res.id;
    }

    async commit() {
        if (!this.connection) return;
        if (this.ended) throw new MongoError('Transaction ended already');

        await this.connection.execute(new CommitTransactionCommand());
        this.ended = true;
        this.connection.release();
    }

    async rollback() {
        if (!this.connection) return;
        if (this.ended) throw new MongoError('Transaction ended already');
        if (!this.started) return;

        await this.connection.execute(new AbortTransactionCommand());
        this.ended = true;
        this.connection.release();
    }
}

export class MongoConnection {
    protected messageId: number = 0;
    status: MongoConnectionStatus = MongoConnectionStatus.pending;
    public bufferSize: number = 2.5 * 1024 * 1024;

    public connectingPromise?: Promise<void>;
    public lastCommand?: { command: Command<unknown>, promise?: Promise<any> };

    public activeCommands: number = 0;
    public executedCommands: number = 0;
    public activeTransaction: boolean = false;
    public reserved: boolean = false;
    public cleanupTimeout: any;

    protected socket: Socket | TLSSocket;

    public transaction?: MongoDatabaseTransaction;

    responseParser: BsonStreamReader;
    error?: Error;

    bytesReceived: number = 0;
    bytesSent: number = 0;
    closed: boolean = false;

    protected boundSendMessage = this.sendMessage.bind(this);

    constructor(
        public id: number,
        public readonly host: Host,
        protected config: MongoClientConfig,
        protected serializer: BSONBinarySerializer,
        protected onClose: (connection: MongoConnection) => void,
        protected onRelease: (connection: MongoConnection) => void,
        protected onSent: (bytes: number) => void,
        protected onReceived: (bytes: number) => void,
    ) {
        this.responseParser = new BsonStreamReader(this.onResponse.bind(this));

        if (this.config.options.ssl === true) {
            const options: { [name: string]: any } = {
                host: host.hostname,
                port: host.port,
                timeout: config.options.socketTimeout,
                servername: host.hostname,
            };
            const optional = {
                ca: config.options.tlsCAFile,
                key: config.options.tlsCertificateKeyFile || config.options.tlsCertificateFile,
                cert: config.options.tlsCertificateFile,
                passphrase: config.options.tlsCertificateKeyFilePassword,

                rejectUnauthorized: config.options.rejectUnauthorized,
                crl: config.options.tlsCRLFile,
                checkServerIdentity: config.options.checkServerIdentity ? undefined : () => undefined,
            };
            for (const i in optional) {
                if (optional[i]) options[i] = optional[i];
            }

            this.socket = createTLSConnection(options);
            this.socket.on('data', (data) => {
                this.bytesReceived += data.byteLength;
                this.onReceived(data.byteLength);
                this.responseParser.feed(data);
            });
        } else {
            this.socket = createConnection({
                host: host.hostname,
                port: host.port,
                timeout: config.options.socketTimeout,
            });

            this.socket.on('data', (data) => {
                this.bytesReceived += data.byteLength;
                this.onReceived(data.byteLength);
                this.responseParser.feed(data);
            });

            // const socket = this.socket = turbo.connect(host.port, host.hostname);
            // // this.socket.setNoDelay(true);
            // const buffer = Buffer.allocUnsafe(this.bufferSize);
            //
            // function read() {
            //     socket.read(buffer, onRead);
            // }
            //
            // function onRead(err: any, buf: Buffer, bytes: number) {
            //     if (!bytes) return;
            //     responseParser.feed(buf, bytes);
            //     read();
            // }
            //
            // read();
        }
        this.connectingPromise = asyncOperation(async (resolve, reject) => {
            this.socket.on('timeout', () => {
                this.socket.destroy(new Error('Socket timeout'));
            });

            this.socket.on('close', () => {
                // console.log('close', this.id);
                if (this.status !== MongoConnectionStatus.error) {
                    this.status = MongoConnectionStatus.disconnected;
                    this.closed = true;
                    this.onClose(this);
                    reject(new MongoConnectionError('Connection closed'));
                }
            });

            this.socket.on('error', (error) => {
                // console.log('error', this.id, error);
                this.connectingPromise = undefined;
                this.status = MongoConnectionStatus.error;
                this.closed = true;
                this.error = new MongoConnectionError(`Connection failed ${formatError(error.message)}`);
                reject(this.error);
            });

            if (this.socket.destroyed) {
                this.status = MongoConnectionStatus.disconnected;
                this.connectingPromise = undefined;
                resolve();
            }

            if (await this.execute(new HandshakeCommand())) {
                this.status = MongoConnectionStatus.connected;
                this.socket.setTimeout(this.config.options.socketTimeout);
                this.connectingPromise = undefined;
                resolve();
            } else {
                this.status = MongoConnectionStatus.error;
                this.error = new MongoError('Connection error: Could not complete handshake 🤷‍️');
                this.connectingPromise = undefined;
                reject(this.error);
            }
        });
    }

    isConnected() {
        return this.status === MongoConnectionStatus.connected;
    }

    isConnecting() {
        return this.status === MongoConnectionStatus.connecting;
    }

    close() {
        console.log('external close');
        this.status = MongoConnectionStatus.disconnected;
        this.socket.end();
    }

    public release() {
        //connections attached to a transaction are not automatically released.
        //only with commit/rollback actions
        if (this.transaction && !this.transaction.ended) return;

        if (this.transaction) this.transaction = undefined;
        this.onRelease(this);
    }

    /**
     * When a full message from the server was received.
     */
    protected onResponse(response: Uint8Array) {
        //we remove the header for the command
        const size = readUint32LE(response);
        const offset = 16 + 4 + 1; //MSG response
        // const offset = 16 + 4 + 8 + 4 + 4; //QUERY_REPLY
        const message = response.slice(offset, size);

        if (!this.lastCommand) throw new MongoError(`Got a server response without active command`);

        this.lastCommand.command.handleResponse(message);
    }

    /**
     * Puts a command on the queue and executes it when queue is empty.
     * A promises is return that is resolved with the  when executed successfully, or rejected
     * when timed out, parser error, or any other error.
     */
    public async execute<T extends Command<unknown>>(command: T): Promise<ReturnType<T['execute']>> {
        await this.connectingPromise;
        // if (this.status === MongoConnectionStatus.pending) await this.connect();
        // if (this.status === MongoConnectionStatus.disconnected) throw new MongoError('Disconnected');

        if (this.lastCommand && this.lastCommand.promise) {
            await this.lastCommand.promise;
        }

        this.lastCommand = { command };
        this.activeCommands++;
        this.executedCommands++;
        command.sender = this.boundSendMessage;
        try {
            this.lastCommand.promise = command.execute(this.config, this.host, this.transaction);
            return await this.lastCommand.promise;
        } finally {
            this.lastCommand = undefined;
            this.activeCommands--;
        }
    }

    protected sendMessage<T>(type: Type, message: T) {
        //todo: check if we can just reuse an older buffer, or maybe we cache the buffer to commands
        const messageSerializer = getBSONSerializer(this.serializer, type);
        const messageSizer = getBSONSizer(this.serializer, type);

        const buffer = Buffer.allocUnsafe(16 + 4 + 1 + messageSizer(message));
        // const buffer = Buffer.alloc(16 + 4 + 10 + 1 + 4 + 4 + calculateObjectSize(message));

        const writer = new Writer(buffer);

        //header, 16 bytes
        const messageId = ++this.messageId;
        writer.writeInt32(10); //messageLength, 4
        writer.writeInt32(messageId); //requestID, 4
        writer.writeInt32(0); //responseTo, 4
        writer.writeInt32(2013); //OP_MSG, 4
        // writer.writeInt32(2004); //OP_QUERY, 4

        //OP_MSG, 5 bytes
        writer.writeUint32(0); //message flags, 4
        writer.writeByte(0); //kind 0, 1

        // //OP_QUERY, 5 bytes
        // writer.writeUint32(0); //message flags, 4
        // writer.writeAsciiString('admin.$cmd'); //collection name, 10
        // writer.writeByte(0); //null, 1
        // writer.writeInt32(0); //skip, 4
        // writer.writeInt32(1); //return, 4

        try {
            const section = messageSerializer(message);
            // console.log('send', this.id, message);
            writer.writeBuffer(section);

            const messageLength = writer.offset;
            writer.offset = 0;
            writer.writeInt32(messageLength);

            //detect backPressure
            this.bytesSent += buffer.byteLength;
            this.onSent(buffer.byteLength);
            this.socket.write(buffer);
        } catch (error) {
            console.log('failed sending message', message, 'for type', stringifyType(type));
            throw error;
        }
    }

    async connect(): Promise<void> {
        return this.connectingPromise;
    }
}
