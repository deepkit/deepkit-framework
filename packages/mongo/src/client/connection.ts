/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, asyncOperation } from '@deepkit/core';
import { Host } from './host.js';
import { createConnection, Socket } from 'net';
import { connect as createTLSConnection, TLSSocket } from 'tls';
import { Command } from './command/command.js';
import { stringifyType, Type, uuid } from '@deepkit/type';
import { BSONBinarySerializer, getBSONSerializer, getBSONSizer, Writer } from '@deepkit/bson';
import { HandshakeCommand } from './command/handshake.js';
import { MongoClientConfig } from './config.js';
import { MongoError } from './error.js';

// @ts-ignore
import * as turbo from 'turbo-net';
import { DatabaseTransaction } from '@deepkit/orm';
import { CommitTransactionCommand } from './command/commitTransaction.js';
import { AbortTransactionCommand } from './command/abortTransaction.js';

export enum MongoConnectionStatus {
    pending = 'pending',
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

export interface ConnectionRequest {
    writable?: boolean;
    nearest?: boolean;
}

export class MongoConnectionPool {
    protected connectionId: number = 0;
    /**
     * Connections, might be in any state, not necessarily connected.
     */
    public connections: MongoConnection[] = [];

    protected queue: ((connection: MongoConnection) => void)[] = [];

    protected nextConnectionClose: Promise<boolean> = Promise.resolve(true);

    constructor(protected config: MongoClientConfig,
                protected serializer: BSONBinarySerializer) {
    }

    protected async waitForAllConnectionsToConnect(throws: boolean = false): Promise<void> {
        const promises: Promise<any>[] = [];
        for (const connection of this.connections) {
            if (connection.connectingPromise) {
                promises.push(connection.connectingPromise);
            }
        }

        if (promises.length) {
            if (throws) {
                await Promise.all(promises);
            } else {
                await Promise.allSettled(promises);
            }
        }
    }

    public async connect() {
        await this.ensureHostsConnected(true);
    }

    public close() {
        //import to work on the copy, since Connection.onClose modifies this.connections.
        const connections = this.connections.slice(0);
        for (const connection of connections) {
            connection.close();
        }
    }

    public async ensureHostsConnected(throws: boolean = false) {
        //make sure each host has at least one connection
        //getHosts automatically updates hosts (mongodb-srv) and returns new one,
        //so we don't need any interval to automatically update it.
        const hosts = await this.config.getHosts();
        for (const host of hosts) {
            if (host.connections.length > 0) continue;
            this.newConnection(host);
        }

        await this.waitForAllConnectionsToConnect(throws);
    }

    protected findHostForRequest(hosts: Host[], request: ConnectionRequest): Host {
        //todo, handle request.nearest
        for (const host of hosts) {
            if (request.writable && host.isWritable()) return host;
            if (!request.writable && host.isReadable()) return host;
        }

        throw new MongoError(`Could not find host for connection request. (writable=${request.writable}, hosts=${hosts.length})`);
    }

    protected createAdditionalConnectionForRequest(request: ConnectionRequest): MongoConnection {
        const hosts = this.config.hosts;
        const host = this.findHostForRequest(hosts, request);

        return this.newConnection(host);
    }

    protected newConnection(host: Host): MongoConnection {
        const connection = new MongoConnection(this.connectionId++, host, this.config, this.serializer, (connection) => {
            arrayRemoveItem(host.connections, connection);
            arrayRemoveItem(this.connections, connection);
            //onClose does not automatically reconnect. Only new commands re-establish connections.
        }, (connection) => {
            this.release(connection);
        });
        host.connections.push(connection);
        this.connections.push(connection);
        return connection;
    }

    protected release(connection: MongoConnection) {
        if (this.queue.length) {
            const waiter = this.queue.shift();
            if (waiter) {
                waiter(connection);
                return;
            }
        }

        connection.reserved = false;
        // console.log('release', connection.id, JSON.stringify(this.config.options.maxIdleTimeMS));
        connection.cleanupTimeout = setTimeout(() => {
            if (this.connections.length <= this.config.options.minPoolSize) {
                return;
            }

            connection.close();
        }, this.config.options.maxIdleTimeMS);
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    async getConnection(request: ConnectionRequest = {}): Promise<MongoConnection> {
        await this.ensureHostsConnected(true);

        for (const connection of this.connections) {
            if (!connection.isConnected()) continue;
            if (connection.reserved) continue;

            if (request.nearest) throw new Error('Nearest not implemented yet');

            if (request.writable && !connection.host.isWritable()) continue;

            if (!request.writable) {
                if (connection.host.isSecondary() && !this.config.options.secondaryReadAllowed) continue;
                if (!connection.host.isReadable()) continue;
            }

            connection.reserved = true;
            if (connection.cleanupTimeout) {
                clearTimeout(connection.cleanupTimeout);
                connection.cleanupTimeout = undefined;
            }

            return connection;
        }

        if (this.connections.length <= this.config.options.maxPoolSize) {
            const connection = await this.createAdditionalConnectionForRequest(request);
            connection.reserved = true;
            return connection;
        }

        return asyncOperation((resolve) => {
            this.queue.push(resolve);
        });
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

    applyTransaction(cmd: any) {
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
        this.lsid = { id: uuid() };
        this.txnNumber = MongoDatabaseTransaction.txnNumber++;
        // const res = await this.connection.execute(new StartSessionCommand());
        // this.lsid = res.id;
    }

    async commit() {
        if (!this.connection) return;
        if (this.ended) throw new Error('Transaction ended already');

        await this.connection.execute(new CommitTransactionCommand());
        this.ended = true;
        this.connection.release();
    }

    async rollback() {
        if (!this.connection) return;
        if (this.ended) throw new Error('Transaction ended already');
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
    public lastCommand?: { command: Command, promise?: Promise<any> };

    public activeCommands: number = 0;
    public executedCommands: number = 0;
    public activeTransaction: boolean = false;
    public reserved: boolean = false;
    public cleanupTimeout: any;

    protected socket: Socket | TLSSocket;

    public transaction?: MongoDatabaseTransaction;

    responseParser: ResponseParser;

    protected boundSendMessage = this.sendMessage.bind(this);

    constructor(
        public id: number,
        public readonly host: Host,
        protected config: MongoClientConfig,
        protected serializer: BSONBinarySerializer,
        protected onClose: (connection: MongoConnection) => void,
        protected onRelease: (connection: MongoConnection) => void,
    ) {
        const responseParser = this.responseParser = new ResponseParser(this.onResponse.bind(this));

        if (this.config.options.ssl === true) {
            const options: { [name: string]: any } = {
                host: host.hostname,
                port: host.port,
                timeout: config.options.connectTimeoutMS,
                servername: host.hostname
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
            this.socket.on('data', (data) => this.responseParser.feed(data));
        } else {
            this.socket = createConnection({
                host: host.hostname,
                port: host.port,
                timeout: config.options.connectTimeoutMS
            });

            this.socket.on('data', (data) => this.responseParser.feed(data));

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

        this.socket.on('close', () => {
            this.status = MongoConnectionStatus.disconnected;
            onClose(this);
        });

        //important to catch it, so it doesn't bubble up
        this.connect().catch(() => {
            this.socket.end();
        });
    }

    isConnected() {
        return this.status === MongoConnectionStatus.connected;
    }

    isConnecting() {
        return this.status === MongoConnectionStatus.connecting;
    }

    close() {
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

        if (!this.lastCommand) throw new Error(`Got a server response without active command`);

        this.lastCommand.command.handleResponse(message);
    }

    /**
     * Puts a command on the queue and executes it when queue is empty.
     * A promises is return that is resolved with the  when executed successfully, or rejected
     * when timed out, parser error, or any other error.
     */
    public async execute<T extends Command>(command: T): Promise<ReturnType<T['execute']>> {
        if (this.status === MongoConnectionStatus.pending) await this.connect();
        if (this.status === MongoConnectionStatus.disconnected) throw new Error('Disconnected');

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
            this.socket.write(buffer);
        } catch (error) {
            console.log('failed sending message', message, 'for type', stringifyType(type));
            throw error;
        }
    }

    async connect(): Promise<void> {
        if (this.status === MongoConnectionStatus.disconnected) throw new Error('Connection disconnected');
        if (this.status !== MongoConnectionStatus.pending) return;

        this.status = MongoConnectionStatus.connecting;

        this.connectingPromise = asyncOperation(async (resolve, reject) => {
            this.socket.on('error', (error) => {
                this.connectingPromise = undefined;
                this.status = MongoConnectionStatus.disconnected;
                reject(error);
            });

            if (this.socket.destroyed) {
                this.status = MongoConnectionStatus.disconnected;
                this.connectingPromise = undefined;
                resolve();
            }

            if (await this.execute(new HandshakeCommand())) {
                this.status = MongoConnectionStatus.connected;
                this.socket.setTimeout(this.config.options.socketTimeoutMS);
                this.connectingPromise = undefined;
                resolve();
            } else {
                this.status = MongoConnectionStatus.disconnected;
                this.connectingPromise = undefined;
                reject(new MongoError('Could not complete handshake 🤷‍️'));
            }
        });

        return this.connectingPromise;
    }
}

export class ResponseParser {
    protected currentMessage?: Uint8Array;
    protected currentMessageSize: number = 0;

    constructor(
        protected readonly onMessage: (response: Uint8Array) => void
    ) {
    }

    public feed(data: Uint8Array, bytes?: number) {
        if (!data.byteLength) return;
        if (!bytes) bytes = data.byteLength;

        if (!this.currentMessage) {
            if (data.byteLength < 4) {
                //not enough data to read the header. Wait for next onData
                return;
            }
            this.currentMessage = data.byteLength === bytes ? data : data.slice(0, bytes);
            this.currentMessageSize = readUint32LE(data);
        } else {
            this.currentMessage = Buffer.concat([this.currentMessage, data.byteLength === bytes ? data : data.slice(0, bytes)]);
            if (!this.currentMessageSize) {
                if (this.currentMessage.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    return;
                }
                this.currentMessageSize = readUint32LE(this.currentMessage);
            }
        }

        let currentSize = this.currentMessageSize;
        let currentBuffer = this.currentMessage;

        while (currentBuffer) {
            if (currentSize > currentBuffer.byteLength) {
                //important to copy, since the incoming might change its data
                this.currentMessage = new Uint8Array(currentBuffer);
                // this.currentMessage = currentBuffer;
                this.currentMessageSize = currentSize;
                //message not completely loaded, wait for next onData
                return;
            }

            if (currentSize === currentBuffer.byteLength) {
                //current buffer is exactly the message length
                this.currentMessageSize = 0;
                this.currentMessage = undefined;
                this.onMessage(currentBuffer);
                return;
            }

            if (currentSize < currentBuffer.byteLength) {
                //we have more messages in this buffer. read what is necessary and hop to next loop iteration
                const message = currentBuffer.slice(0, currentSize);
                this.onMessage(message);

                currentBuffer = currentBuffer.slice(currentSize);
                if (currentBuffer.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    this.currentMessage = currentBuffer;
                    return;
                }

                const nextCurrentSize = readUint32LE(currentBuffer);
                if (nextCurrentSize <= 0) throw new Error('message size wrong');
                currentSize = nextCurrentSize;
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}
