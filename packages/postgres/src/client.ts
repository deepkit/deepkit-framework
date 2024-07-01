import { connect, createConnection, Socket } from 'net';
import { arrayRemoveItem, asyncOperation, CompilerContext, decodeUTF8, formatError } from '@deepkit/core';
import { DatabaseError, DatabaseTransaction, SelectorState } from '@deepkit/orm';
import {
    getSerializeFunction,
    getTypeJitContainer,
    isPropertyType,
    ReceiveType,
    ReflectionKind,
    resolveReceiveType,
    Type,
    TypeClass,
    TypeObjectLiteral,
} from '@deepkit/type';
import { connect as createTLSConnection, TLSSocket } from 'tls';
import { Host, PostgresClientConfig } from './config.js';
import { DefaultPlatform, PreparedEntity } from '@deepkit/sql';

export class PostgresError extends DatabaseError {

}

export class PostgresConnectionError extends PostgresError {

}

export interface Result {
    rows: any[];
    rowCount: number;
}

function readUint32BE(data: Uint8Array, offset: number = 0): number {
    return data[offset + 3] + (data[offset + 2] * 2 ** 8) + (data[offset + 1] * 2 ** 16) + (data[offset] * 2 ** 24);
}

function readUint16BE(data: Uint8Array, offset: number = 0): number {
    return data[offset + 1] + (data[offset] * 2 ** 8);
}

function buildDeserializerForType(type: Type): (message: Uint8Array) => any {
    if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) {
        throw new Error('Invalid type for deserialization');
    }

    const context = new CompilerContext();
    const lines: string[] = [];
    const props: string[] = [];
    context.set({
        DataView,
        decodeUTF8,
        readUint32BE,
        parseJson: JSON.parse,
    });

    for (const property of type.types) {
        const varName = context.reserveVariable();
        if (!isPropertyType(property)) continue;
        const field = property.type;

        if (field.kind === ReflectionKind.number) {
            lines.push(`
            length = readUint32BE(data, offset);
            ${varName} = length === 4 ? view.getFloat32(offset + 4) : view.getFloat64(offset + 4);
            offset += 4 + length;
            `);
        }
        if (field.kind === ReflectionKind.boolean) {
            lines.push(`
            ${varName} = data[offset + 4] === 1;
            offset += 4 + 1;
            `);
        }
        if (field.kind === ReflectionKind.string) {
            lines.push(`
            length = readUint32BE(data, offset);
            ${varName} = decodeUTF8(data, offset + 4, offset + 4 + length);
            offset += 4 + length;
            `);
        }
        if (field.kind === ReflectionKind.class || field.kind === ReflectionKind.union
            || field.kind === ReflectionKind.array || field.kind === ReflectionKind.objectLiteral) {
            lines.push(`
            length = readUint32BE(data, offset);
            ${varName} = parseJson(decodeUTF8(data, offset + 4 + 1, offset + 4 + length));
            offset += 4 + length;
            `);
        }
        props.push(`${String(property.name)}: ${varName},`);
    }

    const code = `
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 1 + 4 + 2; // Skip type, length, and field count
    let length = 0;
    ${lines.join('\n')}

    result.push({
        ${props.join('\n')}
    });
    `;
    return context.build(code, 'data', 'result');
}

function buildDeserializer(selector: SelectorState): (message: Uint8Array) => any {
    const context = new CompilerContext();
    const lines: string[] = [];
    const props: string[] = [];
    context.set({
        DataView,
        decodeUTF8,
        readUint32BE,
        parseJson: JSON.parse,
    });

    for (const field of selector.schema.getProperties()) {
        const varName = context.reserveVariable();

        if (field.type.kind === ReflectionKind.number) {
            lines.push(`
            length = readUint32BE(data, offset);
            ${varName} = length === 4 ? view.getFloat32(offset + 4) : view.getFloat64(offset + 4);
            offset += 4 + length;
            `);
        }
        if (field.type.kind === ReflectionKind.boolean) {
            lines.push(`
            ${varName} = data[offset + 4] === 1;
            offset += 4 + 1;
            `);
        }
        if (field.type.kind === ReflectionKind.string) {
            lines.push(`
            length = readUint32BE(data, offset);
            // ${varName} = decodeUTF8(data, offset + 4, offset + 4 + length);
            ${varName} = '';
            offset += 4 + length;
            `);
        }
        if (field.type.kind === ReflectionKind.class || field.type.kind === ReflectionKind.union
            || field.type.kind === ReflectionKind.array || field.type.kind === ReflectionKind.objectLiteral) {
            lines.push(`
            length = readUint32BE(data, offset);
            ${varName} = parseJson(decodeUTF8(data, offset + 4 + 1, offset + 4 + length));
            offset += 4 + length;
            `);
        }
        props.push(`${field.name}: ${varName},`);
    }

    const code = `
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 1 + 4 + 2; // Skip type, length, and field count
    let length = 0;
    ${lines.join('\n')}

    result.push({
        ${props.join('\n')}
    });
    `;
    return context.build(code, 'data', 'result');
}

export class PostgresClientPrepared {
    created = false;

    cache?: Buffer;
    deserialize: (message: Uint8Array) => any;

    constructor(
        public client: PostgresClientConnection,
        public sql: string,
        public selector: SelectorState,
        private statementName: string,
    ) {
        const serializer = this.selector.schema && this.selector.select.length === 0;
        this.deserialize = serializer
            ? buildDeserializer(this.selector)
            : () => {
            };
    }

    execute(params: any[]): Promise<Result> {
        // console.log('execute statement', this.statementName, this.sql.slice(0, 100), params.slice(0, 10))   ;
        return asyncOperation<any>((resolve, reject) => {
            if (!this.created) {
                const oids = params.map(param => {
                    if (typeof param === 'number') return 23;
                    if (typeof param === 'boolean') return 16;
                    return 0; // Text
                });

                const message = sendParse(this.statementName, this.sql, oids);
                this.client.write(message);
                this.created = true;
            }

            if (!this.cache) {
                this.cache = Buffer.concat([
                    sendBind('ab', this.statementName, params),
                    sendExecute('ab', 0),
                    syncMessage,
                ]);
            }

            // this.client.write(this.cache);
            //
            // const rows: any[] = [];
            // this.deserialize(empty); //reset state machine
            // this.client.deserialize = (message) => {
            //     try {
            //         const row = this.deserialize(message);
            //         rows.push(row);
            //     } catch (e) {
            //         console.log('e', e);
            //         reject(e);
            //     }
            // };
            // this.client.ready = () => {
            //     resolve({ rows, rowCount: rows.length });
            // };
            // this.client.error = reject;
        });
    }
}

type Client = ReturnType<typeof connect>;

function int32Buffer(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUint32BE(value);
    return buffer;
}

function int16Buffer(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUint16BE(value);
    return buffer;
}

function sendParse(statementName: string, query: string, paramTypeOids: any[]) {
    const nameBuffer = Buffer.from(statementName + '\0', 'utf8');
    const queryBuffer = Buffer.from(query + '\0', 'utf8');
    const typeCountBuffer = int16Buffer(paramTypeOids.length);
    const typesBuffer = Buffer.concat(paramTypeOids.map(oid => int32Buffer(oid)));

    const message = Buffer.concat([
        Buffer.from('P'), // Parse message
        Buffer.from([0, 0, 0, 1]),
        nameBuffer,
        queryBuffer,
        typeCountBuffer,
        typesBuffer,
    ]);
    message.writeUint32BE(message.length - 1, 1);

    return message;
}

function sendBind(portalName: string, statementName: string, parameters: any[]) {
    const portalBuffer = Buffer.from(portalName + '\0', 'utf8');
    const statementBuffer = Buffer.from(statementName + '\0', 'utf8');

    const paramCountBuffer = int16Buffer(parameters.length);

    const paramBuffers = Buffer.concat(parameters.map(param => {
        const paramBuffer = Buffer.from(param + '', 'utf8');
        const paramLengthBuffer = int32Buffer(paramBuffer.length);
        return Buffer.concat([paramLengthBuffer, paramBuffer]);
    }));

    const message = Buffer.concat([
        Buffer.from('B'), // Bind message
        Buffer.from([0, 0, 0, 1]),
        portalBuffer,
        statementBuffer,

        Buffer.from([0, 1, 0, 0]), // (1, 1) = (amount, text)
        // Buffer.from([0, 1, 0, 1]), // (1, 1) = (amount, binary), Int16 + (Int16[C])

        paramCountBuffer, //Int16
        paramBuffers, //(Int32, Bytes)[]
        Buffer.from([0, 1, 0, 1]), // Result column format codes (1, 1) = (amount, binary), Int16 + (Int16[C])
    ]);
    message.writeUint32BE(message.length - 1, 1);

    return message;
}

function getSimpleQueryBuffer(query: string) {
    const queryBuffer = Buffer.from(query + '\0', 'utf8');
    const message = Buffer.concat([
        Buffer.from('Q'), // Query message
        int32Buffer(queryBuffer.length + 4),
        queryBuffer,
    ]);
    return message;
}

function sendExecute(portalName: string, maxRows: number) {
    const portalBuffer = Buffer.from(portalName + '\0', 'utf8');
    const maxRowsBuffer = int32Buffer(maxRows);

    const message = Buffer.concat([
        Buffer.from('E'), // Execute message
        Buffer.from([0, 0, 0, 1]),
        portalBuffer,
        maxRowsBuffer,
    ]);
    message.writeUint32BE(message.length - 1, 1);
    return message;
}

const syncMessage = Buffer.from('S\0\0\0\x04');

export function readMessageSize(buffer: Uint8Array | ArrayBuffer, offset: number = 0): number {
    return 1 + (buffer[offset + 4] + (buffer[offset + 3] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 1] * 2 ** 24));
}

export class ResponseParser {
    protected currentMessage?: Uint8Array;
    protected currentMessageSize: number = 0;

    constructor(
        protected readonly onMessage: (response: Uint8Array) => void,
    ) {
    }

    public feed(data: Uint8Array, bytes?: number) {
        if (!data.byteLength) return;
        if (!bytes) bytes = data.byteLength;

        // console.log('got chunk', data.length);
        if (!this.currentMessage) {
            if (data.byteLength < 5) {
                //not enough data to read the header. Wait for next onData
                return;
            }
            this.currentMessage = data.byteLength === bytes ? data : data.subarray(0, bytes);
            this.currentMessageSize = readMessageSize(data);
        } else {
            this.currentMessage = Buffer.concat([this.currentMessage, data.byteLength === bytes ? data : data.subarray(0, bytes)]);
            if (!this.currentMessageSize) {
                if (this.currentMessage.byteLength < 5) {
                    //not enough data to read the header. Wait for next onData
                    return;
                }
                this.currentMessageSize = readMessageSize(this.currentMessage);
            }
        }

        let currentSize = this.currentMessageSize;
        let currentBuffer = this.currentMessage;

        while (currentBuffer) {
            if (currentSize > currentBuffer.byteLength) {
                //important to copy, since the incoming might change its data
                this.currentMessage = currentBuffer;
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
                // const message = currentBuffer.subarray(0, currentSize);
                // console.log('onMessage', currentSize, message.length)
                this.onMessage(currentBuffer);

                currentBuffer = currentBuffer.subarray(currentSize);
                // currentBuffer = new Uint8Array(currentBuffer.buffer, currentBuffer.byteOffset + currentSize);
                if (currentBuffer.byteLength < 5) {
                    //not enough data to read the header. Wait for next onData
                    this.currentMessage = currentBuffer;
                    this.currentMessageSize = 0;
                    return;
                }

                const nextCurrentSize = readMessageSize(currentBuffer);
                if (nextCurrentSize <= 0) throw new Error('message size wrong');
                currentSize = nextCurrentSize;
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}

// /**
//  * @reflection never
//  */
// export class PostgresClient {
//     connectionPromise?: Promise<void>;
//     client?: ReturnType<typeof connect>;
//
//     deserialize: (message: Uint8Array) => void = () => {
//     };
//     ready?: (value: any) => void;
//     error?: (value: any) => void;
//
//     statementId = 0;
//
//     responseParser: ResponseParser;
//
//     constructor(public config: PostgresConfig) {
//         this.responseParser = new ResponseParser(this.onResponse.bind(this));
//     }
//
//     onResponse(data: Uint8Array) {
//         switch (data[0]) {
//             case 0x45: // E
//                 const length = readUint32BE(data, 1);
//                 const error = Buffer.from(data).toString('utf8', 5, length);
//                 if (this.error) this.error(error);
//                 break;
//             case 0x44: // D
//                 this.deserialize(data);
//                 break;
//             case 0x5A: // Z
//                 if (this.ready) this.ready({ rows: [], rowCount: 0 });
//                 break;
//         }
//     }
//
//     // onResponse(data: Uint8Array) {
//     //     // const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
//     //     // const length = view.getUint32(offset + 1);
//     //     // const length = readUint32BE(data, 1);
//     //
//     //     // console.log(`response: ${String.fromCharCode(data[0])}, buffer: ${data.length}, length: ${length}`);
//     //
//     //     const type = String.fromCharCode(data[0]);
//     //     if (type === 'R') {
//     //         // const authType = view.getUint32(offset + 5);
//     //         // console.log(`Authentication Type: ${authType}`);
//     //     } else if (type === 'S') {
//     //         // const content = data.subarray(offset + 5, offset + length);
//     //         // const [param, value] = content.toString().split('\0');
//     //         // console.log(`Parameter: ${param}, Value: ${value}`);
//     //     } else if (type === 'K') {
//     //         // const pid = view.getUint32(offset + 5);
//     //         // const secret = view.getUint32(offset + 9);
//     //         // console.log(`PID: ${pid}, Secret: ${secret}`);
//     //     } else if (type === 'Z') {
//     //         // console.log('Ready for query');
//     //         if (this.ready) this.ready({ rows: [], rowCount: 0 });
//     //     } else if (type === 'E') {
//     //         const length = readUint32BE(data, 1);
//     //         const error = Buffer.from(data).toString('utf8', 5, length);
//     //         // console.log('Error:', error);
//     //         if (this.error) this.error(error);
//     //     } else if (type === 'C') {
//     //         // const commandTag = Buffer.from(data).toString('utf8', offset + 5, offset + length);
//     //         // console.log('Command Complete:', commandTag);
//     //     } else if (type === '2') {
//     //         // console.log('Bind Complete');
//     //     } else if (type === '1') {
//     //         // console.log('Parse Complete');
//     //     } else if (type === 'D') {
//     //         // const columnValues = view.getUint16(offset + 5);
//     //         // console.log('Data Row:', columnValues);
//     //         // for (let i = 0; i < columnValues; i++) {
//     //         //     const length = view.getUint32(offset + 7);
//     //         //     const value = Buffer.from(data).toString('utf8', offset + 11, offset + 11 + length);
//     //         //     console.log(`Column ${i} (${length}): ${value}`,  Buffer.from(data).toString('hex', offset + 11, offset + 11 + length));
//     //         //     offset += 4 + length;
//     //         // }
//     //         this.deserialize(data);
//     //
//     //         // const endOfMessage = offset + length;
//     //         // let fieldOffset = offset + 5; // Skip type and length
//     //
//     //         // while (fieldOffset < endOfMessage) {
//     //         //     const fieldLength = data.readInt32BE(fieldOffset);
//     //         //     const fieldValue = data.toString('utf8', fieldOffset + 4, fieldOffset + 4 + fieldLength);
//     //         //     console.log(`Field: ${fieldValue}`);
//     //         //     fieldOffset += 4 + fieldLength;
//     //         // }
//     //     } else if (type === 'N') {
//     //         // const endOfMessage = offset + length;
//     //         // let fieldOffset = offset + 5; // Skip type and length
//     //         // console.log('Notice Response:');
//     //         // while (fieldOffset < endOfMessage) {
//     //         //     const fieldType = String.fromCharCode(data[fieldOffset]);
//     //         //     const fieldValue = Buffer.from(data).toString('utf8', fieldOffset + 1, endOfMessage).split('\0')[0];
//     //         //     console.log(`${fieldType}: ${fieldValue}`);
//     //         //     fieldOffset += 1 + Buffer.byteLength(fieldValue) + 1; // Move past the field type, value, and null terminator
//     //         // }
//     //     } else {
//     //         console.log('Unknown message type:', type);
//     //     }
//     // }
//
//     protected async doConnect(): Promise<void> {
//         const client = this.client = connect({
//             port: this.config.port || 5432,
//             host: this.config.host || 'localhost',
//         }, () => {
//             const parameters = 'user\0postgres\0database\0postgres\0\0';
//             const protocolVersion = Buffer.from([0x00, 0x03, 0x00, 0x00]); // Version 3.0
//             const totalLength = Buffer.alloc(4);
//             totalLength.writeInt32BE(Buffer.byteLength(parameters) + protocolVersion.length + 4);
//
//             const startupMessage = Buffer.concat([totalLength, protocolVersion, Buffer.from(parameters)]);
//             client.write(startupMessage);
//         });
//
//         client.setNoDelay(true);
//         // client.setKeepAlive(true, 0);
//
//         return asyncOperation<void>((resolve, reject) => {
//             this.ready = resolve;
//             this.error = reject;
//             client.on('data', (data) => {
//                 this.responseParser.feed(data);
//             });
//
//             client.on('end', () => {
//                 console.log('Disconnected from server');
//             });
//         });
//     }
//
//     connect() {
//         if (this.client) return;
//         if (!this.connectionPromise) {
//             this.connectionPromise = this.doConnect();
//         }
//
//         return this.connectionPromise;
//     }
//
//     async query(sql: string, params: any[]): Promise<Result> {
//         await this.connect();
//         return asyncOperation<any>((resolve, reject) => {
//             // const queryString = `${sql}\0`;
//             // const length = Buffer.alloc(4);
//             // length.writeInt32BE(Buffer.byteLength(queryString) + 4); // Length + size of length field
//             // const queryMessage = Buffer.concat([Buffer.from([0x51]), length, Buffer.from(queryString)]);
//             // console.log('Sending query:', sql, params);
//             // this.client!.write(queryMessage);
//
//             const oids = params.map(param => {
//                 if (typeof param === 'number') return 23;
//                 if (typeof param === 'boolean') return 16;
//                 return 0; // Text
//             });
//
//             this.deserialize = (message) => {
//             };
//             this.ready = resolve;
//             this.error = reject;
//
//             // console.log('query', sql.slice(0, 100), params.slice(0, 10));
//             const statement = `s${this.statementId++}`;
//             const message = Buffer.concat([
//                 sendParse(this.client!, statement, sql, oids),
//                 sendBind(this.client!, 'ab', statement, params),
//                 sendExecute(this.client!, 'ab', 0),
//                 syncMessage,
//             ]);
//             this.client!.write(message);
//
//             // resolve({ rows: [], rowCount: 0 });
//         });
//     }
//
//     async prepare(sql: string, selector: SelectorState): Promise<PostgresClientPrepared> {
//         await this.connect();
//         const statement = `s${this.statementId++}`;
//         return new PostgresClientPrepared(this, sql, selector, statement);
//     }
// }

export enum ConnectionStatus {
    pending = 'pending',
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

export interface ConnectionRequest {
    readonly: boolean;
    nearest: boolean;
}

export const enum HostType {
    primary,
    secondary,
}

export type TransactionTypes = 'REPEATABLE READ' | 'READ COMMITTED' | 'SERIALIZABLE';

export class PostgresDatabaseTransaction extends DatabaseTransaction {
    connection?: PostgresClientConnection;

    setTransaction?: TransactionTypes;

    /**
     * This is the default for mysql databases.
     */
    repeatableRead(): this {
        this.setTransaction = 'REPEATABLE READ';
        return this;
    }

    readCommitted(): this {
        this.setTransaction = 'READ COMMITTED';
        return this;
    }

    serializable(): this {
        this.setTransaction = 'SERIALIZABLE';
        return this;
    }

    async begin() {
        if (!this.connection) return;
        const set = this.setTransaction ? 'SET TRANSACTION ISOLATION LEVEL ' + this.setTransaction + ';' : '';
        // await this.connection.run(set + 'START TRANSACTION');
    }

    async commit() {
        if (!this.connection) return;
        if (this.ended) throw new Error('Transaction ended already');

        // await this.connection.run('COMMIT');
        this.ended = true;
        this.connection.release();
    }

    async rollback() {
        if (!this.connection) return;

        if (this.ended) throw new Error('Transaction ended already');
        // await this.connection.run('ROLLBACK');
        this.ended = true;
        this.connection.release();
    }
}

type Deserializer = (message: Uint8Array) => any;

function noopDeserializer(message: Uint8Array) {
}

export abstract class Command<T> {
    current?: { resolve: Function, reject: Function, deserializer: Deserializer };

    public write: (buffer: Uint8Array) => void = () => void 0;

    public sendAndWait(message: Uint8Array, deserializer: Deserializer = noopDeserializer): Promise<void> {
        this.write(message);
        return asyncOperation((resolve, reject) => {
            this.current = {
                resolve,
                reject,
                deserializer,
            };
        });
    }

    public async query<T>(sql: string, type?: ReceiveType<T>) {
        let deserializer: any = () => {
        };

        if (type) {
            type = resolveReceiveType(type);
            const jit = getTypeJitContainer(type);
            deserializer = jit.sqlQueryDeserializer;
            if (!deserializer) {
                deserializer = jit.sqlQueryDeserializer = buildDeserializerForType(type);
            }
        }
        const buffer = getSimpleQueryBuffer(sql);

        const rows: any[] = [];
        await this.sendAndWait(buffer, (buffer) => {
            deserializer(buffer, rows);
        });
        return rows[0];
    }

    abstract execute(host: Host, connection: PostgresClientConnection, transaction?: PostgresDatabaseTransaction): Promise<T>;

    needsWritableHost(): boolean {
        return false;
    }

    handleResponse(response: Uint8Array): void {
        switch (response[0]) {
            case 0x45: { // E
                const length = readUint32BE(response, 1);
                const error = decodeUTF8(response, 5, length);
                this.current!.reject(error);
                break;
            }
            case 0x44: { // D
                this.current!.deserializer(response);
                // const columns = readUint16BE(response, 5);
                // let offset = 1 + 4 + 2;
                // console.log('columns', columns);
                // for (let i = 0; i < columns; i++) {
                //     const length = readUint32BE(response, offset);
                //     console.log('column', i, length, Buffer.from(response).toString('hex', offset, offset + length));
                //     offset += 4 + length;
                // }
                break;
            }
            case 0x5A: {// Z
                this.current!.resolve();
                break;
            }
            default: {
                // console.log('unhandled', String.fromCharCode(response[0]), response);
            }
        }
    }
}

export class InsertCommand extends Command<number> {
    constructor(
        public platform: DefaultPlatform,
        public prepared: PreparedEntity,
        public items: any[],
    ) {
        super();
    }

    async execute(host: Host, client: PostgresClientConnection, transaction?: PostgresDatabaseTransaction) {
        // build SQL
        // command: parse
        // command: bind
        // command: execute
        // command: sync

        const names: string[] = [];
        const placeholder = new this.platform.placeholderStrategy;
        const scopeSerializer = getSerializeFunction(this.prepared.type, this.platform.serializer.serializeRegistry);

        for (const property of this.prepared.fields) {
            if (property.autoIncrement) continue;
            names.push(property.columnNameEscaped);
        }

        const placeholders: string[] = [];
        const params: any[] = [];
        for (const item of this.items) {
            const converted = scopeSerializer(item);
            const values: string[] = [];
            for (const property of this.prepared.fields) {
                if (property.autoIncrement) continue;
                values.push(placeholder.getPlaceholder());
                params.push(converted[property.name]);
            }
            placeholders.push(values.join(', '));
        }

        const sql = `INSERT INTO ${this.prepared.tableNameEscaped} (${names.join(', ')})
                VALUES (${placeholders.join('), (')})`;

        const statement = '';

        const message = Buffer.concat([
            sendParse(statement, sql, []),
            sendBind('', statement, params),
            sendExecute('', 0),
            syncMessage,
        ]);
        await this.sendAndWait(message);

        // parse data rows: auto-incremented columns

        return 0;
    }
}

export class FindCommand<T> extends Command<T[]> {
    cache?: Buffer;
    deserialize: (message: Uint8Array, rows: any[]) => any;
    created = false;

    constructor(
        public sql: string,
        public prepared: PreparedEntity,
        public selector: SelectorState,
        private statementName: string,
    ) {
        super();
        const serializer = this.selector.select.length === 0;
        this.deserialize = serializer
            ? buildDeserializer(this.selector)
            : () => {
                //todo more complex deserializer
            };
        console.log('new FindCommand');
    }

    setParameters(params: any[]) {
        if (!params.length) return;
        this.cache = Buffer.concat([
            sendBind('ab', this.statementName, params),
            sendExecute('ab', 0),
            syncMessage,
        ]);
    }

    async execute(host: Host, connection: PostgresClientConnection, transaction?: PostgresDatabaseTransaction) {
        if (!this.created) {
            const message = sendParse(this.statementName, this.sql, []);
            this.write(message);
            this.created = true;
        }

        if (!this.cache) {
            this.cache = Buffer.concat([
                sendBind('ab', this.statementName, this.selector.params),
                sendExecute('ab', 0),
                syncMessage,
            ]);
        }

        const rows: any[] = [];
        await this.sendAndWait(this.cache, (data) => this.deserialize(data, rows));
        return rows;
    }
}

type InRecorveryResponse = { inRecovery: boolean };

class SelectCommand extends Command<boolean> {
    constructor(
        private sql: string,
        private type?: TypeClass | TypeObjectLiteral,
    ) {
        super();
    }

    async execute(host: Host, connection: PostgresClientConnection, transaction?: PostgresDatabaseTransaction) {
        const res = await this.query(this.sql, this.type);
        return true;
    }
}

class HandshakeCommand extends Command<boolean> {
    host?: Host;

    async execute(host: Host, connection: PostgresClientConnection, transaction?: PostgresDatabaseTransaction) {
        this.host = host;
        const parameters = 'user\0postgres\0database\0postgres\0\0';
        const protocolVersion = Buffer.from([0x00, 0x03, 0x00, 0x00]); // Version 3.0
        const totalLength = Buffer.alloc(4);
        totalLength.writeInt32BE(Buffer.byteLength(parameters) + protocolVersion.length + 4);

        const startupMessage = Buffer.concat([totalLength, protocolVersion, Buffer.from(parameters)]);
        await this.sendAndWait(startupMessage);
        return true;
    }

    handleResponse(response: Uint8Array): void {
        switch (response[0]) {
            // S
            case 0x53: {
                if (!this.host) break;
                const length = readUint32BE(response, 1);
                const firstNull = response.indexOf(0, 5);
                const name = decodeUTF8(response, 5, firstNull);
                const value = decodeUTF8(response, firstNull + 1, length);
                this.host.parameters[name] = value;
                if (name === 'in_hot_standby' && value === 'on') {
                    this.host.setType(HostType.secondary);
                }
                return;
            }
        }

        super.handleResponse(response);
    }
}

export class PostgresStats {
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

export class PostgresConnectionPool {
    protected connectionId: number = 0;
    /**
     * Connections, might be in any state, not necessarily connected.
     */
    public connections: PostgresClientConnection[] = [];

    protected cacheHints: { [key: string]: PostgresClientConnection } = {};

    protected queue: { resolve: (connection: PostgresClientConnection) => void, request: ConnectionRequest }[] = [];

    protected lastError?: Error;

    constructor(
        protected config: PostgresClientConfig,
        protected stats: PostgresStats,
    ) {
    }

    protected async waitForAllConnectionsToConnect(throws: boolean = false): Promise<void> {
        const promises: Promise<any>[] = [];
        for (const connection of this.connections) {
            if (connection.connectingPromise) {
                promises.push(connection.connectingPromise);
            }
        }

        if (!promises.length) return;
        // try {
        if (throws) {
            await Promise.all(promises);
        } else {
            await Promise.allSettled(promises);
        }
        // } catch (error: any) {
        //     throw new PostgresConnectionError(`Failed to connect: ${formatError(error)}`, { cause: error });
        // }
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

    protected ensureHostsConnectedPromise?: Promise<void>;

    public async ensureHostsConnected(throws: boolean = false) {
        if (this.ensureHostsConnectedPromise) return this.ensureHostsConnectedPromise;
        //make sure each host has at least one connection
        const hosts = await this.config.getHosts();
        for (const host of hosts) {
            if (host.connections.length > 0) continue;
            this.newConnection(host);
        }

        return this.ensureHostsConnectedPromise = asyncOperation(async (resolve) => {
            await this.waitForAllConnectionsToConnect(throws);
            resolve(undefined);
        }).then(() => {
            this.ensureHostsConnectedPromise = undefined;
        });
    }

    protected findHostForRequest(hosts: Host[], request: ConnectionRequest): Host {
        //todo, handle request.nearest
        for (const host of hosts) {
            if (!request.readonly && host.isWritable()) return host;
            if (request.readonly && host.isReadable()) return host;
        }

        throw new PostgresConnectionError(`Could not find host for connection request. (readonly=${request.readonly}, hosts=${hosts.length}). Last Error: ${this.lastError}`);
    }

    protected createAdditionalConnectionForRequest(request: ConnectionRequest): PostgresClientConnection {
        const hosts = this.config.hosts;
        const host = this.findHostForRequest(hosts, request);

        return this.newConnection(host);
    }

    protected newConnection(host: Host): PostgresClientConnection {
        this.stats.connectionsCreated++;
        const connection = new PostgresClientConnection(this.connectionId++, host, this.config, (connection) => {
            arrayRemoveItem(host.connections, connection);
            arrayRemoveItem(this.connections, connection);
            //onClose does not automatically reconnect. Only new commands re-establish connections.
        }, (connection) => {
            this.release(connection);
        }, (bytesSent) => {
            this.stats.bytesSent += bytesSent;
        }, (bytesReceived) => {
            this.stats.bytesReceived += bytesReceived;
        });
        host.connections.push(connection);
        this.connections.push(connection);
        return connection;
    }

    protected release(connection: PostgresClientConnection) {
        for (let i = 0; i < this.queue.length; i++) {
            const waiter = this.queue[i];
            if (!this.matchRequest(connection, waiter.request)) continue;

            this.stats.connectionsReused++;
            this.queue.splice(i, 1);
            waiter.resolve(connection);
            //we don't set reserved/set cleanupTimeout,
            //since the connection is already reserved and the timeout
            //is only set when the connection actually is starting idling.
            return;
        }

        connection.reserved = false;
        connection.cleanupTimeout = setTimeout(() => {
            if (this.connections.length <= this.config.options.minPoolSize) {
                return;
            }

            connection.close();
        }, this.config.options.maxIdleTimeMS);
    }

    protected matchRequest(connection: PostgresClientConnection, request: ConnectionRequest): boolean {
        if (!request.readonly && !connection.host.isWritable()) return false;

        if (!request.readonly) {
            if (connection.host.isSecondary() && !this.config.options.secondaryReadAllowed) return false;
            if (!connection.host.isReadable()) return false;
        }

        return true;
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    async getConnection(
        request: Partial<ConnectionRequest> = {},
        cacheHint?: string,
    ): Promise<PostgresClientConnection> {
        const r = Object.assign({ readonly: false, nearest: false }, request) as ConnectionRequest;

        if (cacheHint) {
            const connection = this.cacheHints[cacheHint];
            if (connection && connection.isConnected() && !connection.reserved) {
                this.stats.connectionsReused++;
                connection.reserved = true;
                if (connection.cleanupTimeout) {
                    clearTimeout(connection.cleanupTimeout);
                    connection.cleanupTimeout = undefined;
                }

                return connection;
            }
        }

        await this.ensureHostsConnected(true);

        for (const connection of this.connections) {
            if (!connection.isConnected()) continue;
            if (connection.reserved) continue;

            if (request.nearest) throw new PostgresConnectionError('Nearest not implemented yet');

            if (!this.matchRequest(connection, r)) continue;

            this.stats.connectionsReused++;
            connection.reserved = true;
            if (connection.cleanupTimeout) {
                clearTimeout(connection.cleanupTimeout);
                connection.cleanupTimeout = undefined;
            }

            if (cacheHint) this.cacheHints[cacheHint] = connection;
            return connection;
        }

        if (this.connections.length < this.config.options.maxPoolSize) {
            const connection = this.createAdditionalConnectionForRequest(r);
            connection.reserved = true;
            if (cacheHint) this.cacheHints[cacheHint] = connection;
            return connection;
        }

        return asyncOperation((resolve) => {
            this.stats.connectionsQueued++;
            this.queue.push({
                resolve: (connection) => {
                    if (cacheHint) this.cacheHints[cacheHint] = connection;
                    resolve(connection);
                }, request: r,
            });
        });
    }
}

export class PostgresClientConnection {
    protected messageId: number = 0;
    status: ConnectionStatus = ConnectionStatus.pending;
    public bufferSize: number = 2.5 * 1024 * 1024;

    cache: { [key: string]: Command<unknown> } = {};

    released: boolean = false;

    public connectingPromise?: Promise<void>;
    public lastCommand?: { command: Command<unknown>, promise?: Promise<any> };

    public activeCommands: number = 0;
    public executedCommands: number = 0;
    public activeTransaction: boolean = false;
    public reserved: boolean = false;
    public cleanupTimeout: any;

    protected socket: Socket | TLSSocket;

    public transaction?: PostgresDatabaseTransaction;

    responseParser: ResponseParser;
    error?: Error;

    bytesReceived: number = 0;
    bytesSent: number = 0;

    statementId: number = 0;

    protected boundWrite = this.write.bind(this);

    constructor(
        public id: number,
        public readonly host: Host,
        protected config: PostgresClientConfig,
        protected onClose: (connection: PostgresClientConnection) => void,
        protected onRelease: (connection: PostgresClientConnection) => void,
        protected onSent: (bytes: number) => void,
        protected onReceived: (bytes: number) => void,
    ) {
        this.responseParser = new ResponseParser(this.onResponse.bind(this));

        if (this.config.options.ssl === true) {
            const options: { [name: string]: any } = {
                host: host.hostname,
                port: host.port,
                timeout: config.options.connectTimeoutMS,
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
                timeout: config.options.connectTimeoutMS,
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

        //important to catch it, so it doesn't bubble up
        this.connect().catch((error) => {
            this.error = error;
            this.socket.end();
            onClose(this);
        });
    }

    getCache(key: string): Command<unknown> | undefined {
        return this.cache[key];
    }

    setCache(key: string, command: Command<unknown>) {
        this.cache[key] = command;
    }

    isConnected() {
        return this.status === ConnectionStatus.connected;
    }

    isConnecting() {
        return this.status === ConnectionStatus.connecting;
    }

    close() {
        this.status = ConnectionStatus.disconnected;
        this.socket.end();
    }

    run(sql: string): Promise<any> {
        return this.execute(new SelectCommand(sql));
    }

    query(sql: string, params): any {
        //todo this is not possible since we don't know the parameters types
    }

    prepare(sql: string, selector: SelectorState): PostgresClientPrepared {
        return new PostgresClientPrepared(this, sql, selector, 's' + this.statementId++);
    }

    public release() {
        //connections attached to a transaction are not automatically released.
        //only with commit/rollback actions
        if (this.transaction && !this.transaction.ended) return;

        if (this.transaction) this.transaction = undefined;
        this.released = true;
        this.onRelease(this);
    }

    /**
     * When a full message from the server was received.
     */
    protected onResponse(message: Uint8Array) {
        if (!this.lastCommand) throw new PostgresError(`Got a server response without active command`);
        this.lastCommand.command.handleResponse(message);
    }

    /**
     * Puts a command on the queue and executes it when queue is empty.
     * A promise is return that is resolved when executed successfully, or rejected
     * when timed out, parser error, or any other error.
     */
    public async execute<T extends Command<unknown>>(command: T): Promise<ReturnType<T['execute']>> {
        if (this.status === ConnectionStatus.pending) await this.connect();
        if (this.status === ConnectionStatus.disconnected) throw new PostgresError('Disconnected');

        if (this.lastCommand && this.lastCommand.promise) {
            await this.lastCommand.promise;
        }

        this.lastCommand = { command };
        this.activeCommands++;
        this.executedCommands++;
        command.write = this.boundWrite;
        try {
            this.lastCommand.promise = command.execute(this.host, this, this.transaction);
            return await this.lastCommand.promise;
        } finally {
            this.lastCommand = undefined;
            this.activeCommands--;
        }
    }

    write(message: Uint8Array) {
        this.socket.write(message);
        this.bytesSent += message.byteLength;
        this.onSent(message.byteLength);
    }

    async connect(): Promise<void> {
        if (this.status === ConnectionStatus.disconnected) throw new PostgresConnectionError('Connection disconnected');
        if (this.status !== ConnectionStatus.pending) return;

        this.status = ConnectionStatus.connecting;

        this.connectingPromise = asyncOperation(async (resolve, reject) => {
            this.socket.once('close', (hadErrors) => {
                this.onClose(this);
                if (this.status !== ConnectionStatus.connecting) return;
                this.status = ConnectionStatus.disconnected;
                reject(new PostgresConnectionError('Connection closed while connecting'));
            });

            this.socket.once('lookup', (error) => {
                if (this.status !== ConnectionStatus.connecting) return;

                if (error) {
                    this.connectingPromise = undefined;
                    this.status = ConnectionStatus.disconnected;
                    reject(new PostgresConnectionError(formatError(error), { cause: error }));
                }
            });

            this.socket.once('error', (error) => {
                if (this.status !== ConnectionStatus.connecting) return;
                this.connectingPromise = undefined;
                this.status = ConnectionStatus.disconnected;
                reject(new PostgresConnectionError(formatError(error), { cause: error }));
            });

            if (this.socket.destroyed) {
                this.status = ConnectionStatus.disconnected;
                this.connectingPromise = undefined;
                resolve();
            }

            this.socket.once('ready', async () => {
                if (await this.execute(new HandshakeCommand())) {
                    this.status = ConnectionStatus.connected;
                    this.socket.setTimeout(this.config.options.socketTimeoutMS);
                    this.connectingPromise = undefined;
                    resolve();
                } else {
                    this.status = ConnectionStatus.disconnected;
                    this.connectingPromise = undefined;
                    reject(new PostgresConnectionError('Connection error: Could not complete handshake 🤷‍️'));
                }
            });
        });

        return this.connectingPromise;
    }
}

export class PostgresClient {
    pool: PostgresConnectionPool;
    stats: PostgresStats = new PostgresStats();
    config: PostgresClientConfig;

    constructor(options: PostgresClientConfig | string) {
        this.config = 'string' === typeof options ? new PostgresClientConfig(options) : options;
        this.pool = new PostgresConnectionPool(this.config, this.stats);
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    async getConnection(request: Partial<ConnectionRequest> = {}, transaction?: PostgresDatabaseTransaction): Promise<PostgresClientConnection> {
        if (transaction && transaction.connection) return transaction.connection;
        const connection = await this.pool.getConnection(request);

        //todo check if this is correct and align with mongo
        if (transaction) {
            transaction.connection = connection;
            connection.transaction = transaction;
            try {
                await transaction.begin();
            } catch (error) {
                transaction.ended = true;
                connection.release();
                throw new Error('Could not start transaction: ' + error);
            }
        }
        return connection;
    }
}
