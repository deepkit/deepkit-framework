import {asyncOperation, ClassType} from '@deepkit/core';
import {Host} from './host';
import {createConnection, Socket} from 'net';
import {connect as createTLSConnection, TLSSocket} from 'tls';
import {Command} from './command/command';
import {ClassSchema} from '@deepkit/marshal';
import {getBSONSerializer, getBSONSizer, Writer} from '@deepkit/marshal-bson';
import {HandshakeCommand} from './command/handshake';
import {MongoClientConfig} from './client';
import {MongoError} from './error';
import {calculateObjectSize, serialize} from 'bson';

export enum MongoConnectionStatus {
    pending = 'pending',
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

export class MongoConnection {
    protected messageId: number = 0;
    status: MongoConnectionStatus = MongoConnectionStatus.pending;

    public connectingPromise?: Promise<void>;
    public lastCommand?: { command: Command };

    public activeCommands: number = 0;
    public executedCommands: number = 0;
    public activeTransaction: boolean = false;

    protected socket: Socket | TLSSocket;

    responseParser: ResponseParser;

    constructor(
        public readonly host: Host,
        protected config: MongoClientConfig,
        protected onClose: (connection: MongoConnection) => void
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
        this.socket.end();
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
    // @singleStack()
    public async execute<T extends Command>(command: T): Promise<ReturnType<T['execute']>> {
        this.lastCommand = {command};
        this.activeCommands++;
        command.sender = this.sendMessage.bind(this);
        try {
            return await command.execute(this.config, this.host);
        } finally {
            this.activeCommands--;
        }
    }

    protected sendMessage<T>(schema: ClassType<T> | ClassSchema<T> | undefined, message: T) {
        const messageSerializer = schema === undefined ? serialize : getBSONSerializer(schema);
        const messageSizer = schema === undefined ? calculateObjectSize : getBSONSizer(schema);

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

    /**
     * Indicates that this connection was picked for work. Extend the timeout + 1minute to make sure it
     * doesnt immediately disconnect due to idle timeout issues.
     */
    youGotPicked() {
        //todo, increase idle timeout
    }

    connect(): Promise<void> {
        if (this.connectingPromise) return this.connectingPromise;

        if (this.status === MongoConnectionStatus.disconnected) throw new Error('Connection disconnected');

        this.status = MongoConnectionStatus.connecting;

        this.connectingPromise = asyncOperation(async (resolve, reject) => {
            this.socket.on('error', (error) => {
                reject(error);
            });

            if (!this.socket.destroyed) {
                if (await this.execute(new HandshakeCommand())) {
                    this.status = MongoConnectionStatus.connected;
                    this.socket.setTimeout(this.config.options.socketTimeoutMS);
                    resolve();
                } else {
                    reject(new MongoError('Could not complete handshake 🤷‍️'));
                }
            }
            this.connectingPromise = undefined;
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
                currentBuffer = currentBuffer.slice(currentSize + 1);
                if (currentBuffer.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    this.currentMessage = currentBuffer;
                    return;
                }
                currentSize = new DataView(currentBuffer.buffer, currentBuffer.byteOffset).getInt32(0, true);
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}