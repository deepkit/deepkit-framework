/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {arrayRemoveItem, asyncOperation, ClassType, sleep} from '@deepkit/core';
import {Host} from './host';
import {createConnection, Socket} from 'net';
import {connect as createTLSConnection, TLSSocket} from 'tls';
import {Command} from './command/command';
import {ClassSchema} from '@deepkit/type';
import {getBSONSerializer, getBSONSizer, Writer} from '@deepkit/bson';
import {HandshakeCommand} from './command/handshake';
import {MongoClientConfig} from './client';
import {MongoError} from './error';
import bson from 'bson';

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
    protected connections: MongoConnection[] = [];

    protected nextConnectionClose: Promise<boolean> = Promise.resolve(true);

    constructor(protected config: MongoClientConfig) {
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
            if (host.connections.length) continue;
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

    protected async createAdditionalConnectionForRequest(request: ConnectionRequest) {
        const hosts = await this.config.getHosts();
        const host = this.findHostForRequest(hosts, request);
        if (!host) throw new MongoError(`Could not find host for connection request. (writable=${request.writable}, hosts=${hosts.length})`);

        return this.newConnection(host);
    }

    protected newConnection(host: Host) {
        const connection = new MongoConnection(this.connectionId++, host, this.config, (connection) => {
            arrayRemoveItem(host.connections, connection);
            arrayRemoveItem(this.connections, connection);
            //onClose does not automatically reconnect. Only new commands re-establish connections.
        }, (connection) => {
            this.release(connection);
        });
        host.connections.push(connection);
        this.connections.push(connection);
        // console.log('newConnection', connection.id);
        return connection;
    }

    protected release(connection: MongoConnection) {
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
    async getConnection(request: ConnectionRequest): Promise<MongoConnection> {
        do {
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

            if (this.connections.length < this.config.options.maxPoolSize) {
                const connection = await this.createAdditionalConnectionForRequest(request);
                connection.reserved = true;
                return connection;
            }

            await sleep(0.1);
        } while (true);
    }
}

export class MongoConnection {
    protected messageId: number = 0;
    status: MongoConnectionStatus = MongoConnectionStatus.pending;

    public connectingPromise?: Promise<void>;
    public lastCommand?: { command: Command, promise?: Promise<any> };

    public activeCommands: number = 0;
    public executedCommands: number = 0;
    public activeTransaction: boolean = false;
    public reserved: boolean = false;
    public cleanupTimeout: any;

    protected socket: Socket | TLSSocket;

    responseParser: ResponseParser;

    constructor(
        public id: number,
        public readonly host: Host,
        protected config: MongoClientConfig,
        protected onClose: (connection: MongoConnection) => void,
        protected onRelease: (connection: MongoConnection) => void,
    ) {
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
        } else {
            this.socket = createConnection({
                host: host.hostname,
                port: host.port,
                timeout: config.options.connectTimeoutMS
            });
        }

        this.socket.on('close', () => {
            this.status = MongoConnectionStatus.disconnected;
            onClose(this);
        });

        this.responseParser = new ResponseParser(this.onResponse.bind(this), this.socket);

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
        this.onRelease(this);
    }

    /**
     * When a full message from the server was received.
     */
    protected onResponse(response: Buffer) {
        //we remove the header for the command
        const view = new DataView(response.buffer, response.byteOffset);
        const size = view.getInt32(0, true);
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

        this.lastCommand = {command};
        this.activeCommands++;
        this.executedCommands++;
        command.sender = this.sendMessage.bind(this);
        try {
            this.lastCommand.promise = command.execute(this.config, this.host);
            return await this.lastCommand.promise;
        } finally {
            this.lastCommand = undefined;
            this.activeCommands--;
        }
    }

    protected sendMessage<T>(schema: ClassType<T> | ClassSchema<T> | undefined, message: T) {
        const messageSerializer = schema === undefined ? bson.serialize : getBSONSerializer(schema);
        const messageSizer = schema === undefined ? bson.calculateObjectSize : getBSONSizer(schema);

        const buffer = Buffer.alloc(16 + 4 + 1 + messageSizer(message));
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

        const section = messageSerializer(message);
        // const section = serialize(message);
        writer.writeBuffer(section);

        const messageLength = writer.offset;
        writer.offset = 0;
        writer.writeInt32(messageLength);

        //detect backPressure
        this.socket.write(buffer);
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
    protected currentMessage?: Buffer;
    protected currentMessageSize: number = 0;

    constructor(
        protected readonly onResponse: (response: Buffer) => void,
        protected readonly socket?: Socket
    ) {
        if (this.socket) {
            this.socket.on('data', this.feed.bind(this));
        }
    }

    public feed(data: Buffer) {
        if (!this.currentMessage) {
            this.currentMessage = data;
            this.currentMessageSize = new DataView(data.buffer, this.currentMessage.byteOffset).getInt32(0, true);
        } else {
            this.currentMessage = Buffer.concat([this.currentMessage, data]);
            if (!this.currentMessageSize) {
                if (this.currentMessage.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    return;
                }
                this.currentMessageSize = new DataView(this.currentMessage.buffer, this.currentMessage.byteOffset).getInt32(0, true);
            }
        }

        let currentSize = this.currentMessageSize;
        let currentBuffer = this.currentMessage;

        while (currentBuffer) {
            if (currentSize > currentBuffer.byteLength) {
                //message not completely loaded, wait for next onData
                return;
            }

            if (currentSize === currentBuffer.byteLength) {
                //current buffer is exactly the message length
                this.onResponse(currentBuffer);
                this.currentMessageSize = 0;
                this.currentMessage = undefined;
                return;
            }

            if (currentSize < currentBuffer.byteLength) {
                //we have more messages in this buffer. read what is necessary and hop to next loop iteration
                const message = currentBuffer.slice(0, currentSize);
                this.onResponse(message);
                currentBuffer = currentBuffer.slice(currentSize);
                if (currentBuffer.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    this.currentMessage = currentBuffer;
                    return;
                }
                const nextCurrentSize = currentBuffer.readUInt32LE(0);
                // const nextCurrentSize = new DataView(currentBuffer.buffer, currentBuffer.byteOffset).getUint32(0, true);
                if (nextCurrentSize <= 0) throw new Error('message size wrong');
                currentSize = nextCurrentSize;
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}
