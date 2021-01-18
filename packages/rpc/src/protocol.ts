/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { getBSONDecoder, getBSONSerializer, getBSONSizer, Writer } from '@deepkit/bson';
import { ClassType } from '@deepkit/core';
import { ClassSchema, getClassSchema, getGlobalStore, jsonSerializer } from '@deepkit/type';
import { rpcChunk, rpcError, RpcTypes } from './model';
import { SingleProgress } from './writer';

export const enum RpcMessageRouteType {
    client = 0,
    server = 1,
    sourceDest = 2,
    peer = 3,
}

// export class RpcMessageRoute {
//     public peerId?: string;

//     public source?: string;
//     public destination?: string;

//     constructor(
//         public type: RpcMessageRouteType = 0,
//     ) {
//     }
// }

/*
 * A message is binary data and has the following structure:
 *
 * <size> <version> <id> <route>[<routeConfig>] <composite> <messageBody>
 *
 * size: uint32 //total message size
 * version: uint8
 * id: uint32 //message id
 * 
 * //type of routing: 
 * //0=client (context from client -> server), //client initiated a message context (message id created on client)
 * //1=server (context from server -> client), //server initiated a message context (message id created on server)
 * //2=sourceDest //route this message to a specific client using its client id
 * //4=peer //route this message to a client using a peer alias (the peer alias needs to be registered). replies will be rewritten to sourceDest
 * 
 * //when route=0
 * routeConfig: not defined
 * 
 * //when route=1
 * routeConfig: not defined
 * 
 * //when route=2
 * routeConfig: <source><destination>, each 16 bytes, uuid v4
 * 
 * //when route=3
 * routeConfig: <source><peerId> //where source=uuid v4, and peerId=ascii string (terminated by \0)
 * 
 * composite: uint8 //when 1 then there are multiple messageBody, each prefixed with uint32 for their size
 * 
 * composite=0 then messageBody=<type><body>:
 *   type: uint8 (256 types supported) //supported type
 *   body: BSON|any //arbitrary payload passed to type
 * 
 * composite=1 then messageBody=<size><type><body>:
 *   size: uint32
 *   type: uint8 (256 types supported) //supported type
 *   body: BSON|any //arbitrary payload passed to type
 * 
 */
export class RpcMessage {
    protected peerId?: string;
    protected source?: string;
    protected destination?: string;

    constructor(
        public id: number,
        public composite: boolean,
        public type: number,
        public routeType: RpcMessageRouteType,
        public bodyOffset: number,
        public bodySize: number,
        public buffer?: Uint8Array,
    ) {
    }

    getBuffer(): Uint8Array {
        if (!this.buffer) throw new Error('No buffer');
        return this.buffer;
    }

    getPeerId(): string {
        if (!this.buffer) throw new Error('No buffer');
        if (this.routeType !== RpcMessageRouteType.peer) throw new Error(`Message is not routed via peer, but ${this.routeType}`);
        if (this.peerId) return this.peerId;
        this.peerId = '';
        for (let offset = 10 + 16, c: number = this.buffer[offset]; c !== 0; offset++, c = this.buffer[offset]) {
            this.peerId += String.fromCharCode(c);
        }

        return this.peerId;
    }

    getSource(): Uint8Array {
        if (!this.buffer) throw new Error('No buffer');
        if (this.routeType !== RpcMessageRouteType.sourceDest && this.routeType !== RpcMessageRouteType.peer) throw new Error(`Message is not routed via sourceDest, but ${this.routeType}`);
        return this.buffer.slice(4 + 1 + 4 + 1, 4 + 1 + 4 + 1 + 16);
    }

    getDestination(): Uint8Array {
        if (!this.buffer) throw new Error('No buffer');
        if (this.routeType !== RpcMessageRouteType.sourceDest) throw new Error(`Message is not routed via sourceDest, but ${this.routeType}`);
        return this.buffer.slice(4 + 1 + 4 + 1 + 16, 4 + 1 + 4 + 1 + 16 + 16);
    }

    getError(): Error {
        if (!this.buffer) throw new Error('No buffer');
        const error = getBSONDecoder(rpcError)(this.buffer, this.bodyOffset);
        return rpcDecodeError(error);
    }

    isError(): boolean {
        return this.type === RpcTypes.Error;
    }

    parseBody<T>(schema: ClassSchema<T>): T {
        if (!this.bodySize) throw new Error('Message has no body');
        if (!this.buffer) throw new Error('No buffer');
        if (this.composite) throw new Error('Composite message can not be read directly');
        return getBSONDecoder(schema)(this.buffer, this.bodyOffset);
    }

    getBodies(): RpcMessage[] {
        if (!this.composite) throw new Error('Not a composite message');

        const messages: RpcMessage[] = [];
        const buffer = this.getBuffer();
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const totalSize = view.getUint32(0, true);
        let offset = this.bodyOffset;

        while (offset < totalSize) {
            const bodySize = view.getUint32(offset, true);
            offset += 4;
            const type = view.getUint8(offset++);

            messages.push(new RpcMessage(this.id, false, type, this.routeType, offset, bodySize, buffer));
            offset += bodySize;
        }

        return messages;
    }
}

export class ErroredRpcMessage extends RpcMessage {
    constructor(
        public id: number,
        public error: Error,
    ) {
        super(id, false, RpcTypes.Error, 0, 0, 0);
    }

    getError(): Error {
        return this.error;
    }
}

export function readRpcMessage(buffer: Uint8Array): RpcMessage {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const size = view.getUint32(0, true);
    if (size !== buffer.byteLength) throw new Error(`Message buffer size wrong. Message size=${size}, buffer size=${buffer.byteLength}`);

    const id = view.getUint32(5, true);

    let offset = 9;
    const routeType = buffer[offset++];

    if (routeType === RpcMessageRouteType.peer) {
        offset += 16; //<source>
        while (buffer[offset++] !== 0); //feed until \0 byte
    } else if (routeType === RpcMessageRouteType.sourceDest) {
        offset += 16 + 16; //uuid is each 16 bytes
    }

    const composite = buffer[offset++] === 1;
    const type = buffer[offset++];

    return new RpcMessage(id, composite, type, routeType, offset, size - offset, buffer);
}

export function createBuffer(size: number): Uint8Array {
    return 'undefined' !== typeof Buffer ? Buffer.allocUnsafe(size) : new Uint8Array(size);
}

export interface RpcCreateMessageDef<T> {
    type: number;
    schema?: ClassSchema<T>;
    body?: T
}

export function createRpcCompositeMessage<T>(
    id: number,
    type: number,
    messages: RpcCreateMessageDef<any>[],
    routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
): Uint8Array {
    let bodySize = 0;
    for (const message of messages) {
        bodySize += 4 + 1 + (message.schema && message.body ? getBSONSizer(message.schema)(message.body) : 0);
    }

    //<size> <version> <messageId> <routeType>[routeData] <isComposite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(routeType);
    writer.writeByte(1);
    writer.writeByte(type);

    for (const message of messages) {
        writer.writeUint32(message.schema && message.body ? getBSONSizer(message.schema)(message.body) : 0);
        writer.writeByte(message.type); //type

        if (message.schema && message.body) {
            //BSON object contain already their size at the beginning
            getBSONSerializer(message.schema)(message.body, writer);
        }
    }

    return writer.buffer;
}

export function createRpcCompositeMessageSourceDest<T>(
    id: number,
    source: Uint8Array,
    destination: Uint8Array,
    type: number,
    messages: RpcCreateMessageDef<any>[],
): Uint8Array {
    let bodySize = 0;
    for (const message of messages) {
        bodySize += 4 + 1 + (message.schema && message.body ? getBSONSizer(message.schema)(message.body) : 0);
    }

    //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + (16 + 16) + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(RpcMessageRouteType.sourceDest);
    if (source.byteLength !== 16) throw new Error(`Source invalid byteLength of ${source.byteLength}`);
    if (destination.byteLength !== 16) throw new Error(`Destination invalid byteLength of ${destination.byteLength}`);
    writer.writeBuffer(source);
    writer.writeBuffer(destination);
    writer.writeByte(1); //composite=true
    writer.writeByte(type);

    for (const message of messages) {
        writer.writeUint32(message.schema && message.body ? getBSONSizer(message.schema)(message.body) : 0);
        writer.writeByte(message.type); //type

        if (message.schema && message.body) {
            //BSON object contain already their size at the beginning
            getBSONSerializer(message.schema)(message.body, writer);
        }
    }

    return writer.buffer;
}

export function createRpcMessage<T>(
    id: number, type: number,
    schema?: ClassSchema<T>, body?: T,
    routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
): Uint8Array {
    const bodySize = schema && body ? getBSONSizer(schema)(body) : 0;
    //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(routeType);
    writer.writeByte(0); //composite=false
    writer.writeByte(type);

    if (schema && body) getBSONSerializer(schema)(body, writer);

    return writer.buffer;
}

export function createRpcMessageForBody<T>(
    id: number, type: number,
    body: Uint8Array,
    routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
): Uint8Array {
    const bodySize = body.byteLength;
    //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(routeType);
    writer.writeByte(0); //composite=false
    writer.writeByte(type);

    writer.writeBuffer(body);

    return writer.buffer;
}

export function createRpcMessagePeer<T>(
    id: number, type: number,
    source: Uint8Array,
    peerId: string,
    schema?: ClassSchema<T>, body?: T,
): Uint8Array {
    const bodySize = schema && body ? getBSONSizer(schema)(body) : 0;
    //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + (16 + peerId.length + 1) + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(RpcMessageRouteType.peer);
    if (source.byteLength !== 16) throw new Error(`Source invalid byteLength of ${source.byteLength}`);
    writer.writeBuffer(source);
    writer.writeAsciiString(peerId);
    writer.writeNull();

    writer.writeByte(0); //composite=false
    writer.writeByte(type);

    if (schema && body) getBSONSerializer(schema)(body, writer);

    return writer.buffer;
}

export function createRpcMessageSourceDest<T>(
    id: number, type: number,
    source: Uint8Array,
    destination: Uint8Array,
    schema?: ClassSchema<T>, body?: T,
): Uint8Array {
    const bodySize = schema && body ? getBSONSizer(schema)(body) : 0;
    //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
    const messageSize = 4 + 1 + 4 + 1 + (16 + 16) + 1 + 1 + bodySize;

    const writer = new Writer(createBuffer(messageSize));
    writer.writeUint32(messageSize);
    writer.writeByte(1); //version
    writer.writeUint32(id);

    writer.writeByte(RpcMessageRouteType.sourceDest);
    if (source.byteLength !== 16) throw new Error(`Source invalid byteLength of ${source.byteLength}`);
    if (destination.byteLength !== 16) throw new Error(`Destination invalid byteLength of ${destination.byteLength}`);
    writer.writeBuffer(source);
    writer.writeBuffer(destination);

    writer.writeByte(0); //composite=false
    writer.writeByte(type);

    if (schema && body) getBSONSerializer(schema)(body, writer);

    return writer.buffer;
}

export class RpcMessageReader {
    protected chunks = new Map<number, { loaded: number, buffers: Uint8Array[] }>();
    protected progress = new Map<number, SingleProgress>();
    protected chunkAcks = new Map<number, Function>();
    protected bufferReader = new RpcBufferReader(this.gotMessage.bind(this));

    constructor(
        protected readonly onMessage: (response: RpcMessage) => void,
        protected readonly onChunk?: (id: number) => void,
    ) {
    }

    public onChunkAck(id: number, callback: Function) {
        this.chunkAcks.set(id, callback);
    }

    public registerProgress(id: number, progress: SingleProgress) {
        this.progress.set(id, progress);
    }

    public feed(buffer: Uint8Array) {
        this.bufferReader.feed(buffer);
    }

    protected gotMessage(buffer: Uint8Array) {
        const message = readRpcMessage(buffer);
        // console.log('reader got', message.id, RpcTypes[message.type]);

        if (message.type === RpcTypes.ChunkAck) {
            const ack = this.chunkAcks.get(message.id);
            if (ack) ack();
        } else if (message.type === RpcTypes.Chunk) {
            const progress = this.progress.get(message.id);

            const body = message.parseBody(rpcChunk);
            let chunks = this.chunks.get(body.id);
            if (!chunks) {
                chunks = { buffers: [], loaded: 0 };
                this.chunks.set(body.id, chunks);
            }
            chunks.buffers.push(body.v);
            chunks.loaded += body.v.byteLength;
            if (this.onChunk) this.onChunk(message.id);
            if (progress) progress.set(body.total, chunks.loaded);

            if (chunks.loaded === body.total) {
                //we're done
                this.progress.delete(message.id);
                this.chunks.delete(body.id);
                this.chunkAcks.delete(body.id);
                let offset = 0;
                const newBuffer = createBuffer(body.total);
                for (const buffer of chunks.buffers) {
                    newBuffer.set(buffer, offset);
                    offset += buffer.byteLength;
                }
                this.onMessage(readRpcMessage(newBuffer));
            }
        } else {
            this.onMessage(message);
        }
    }
}

export class RpcBufferReader {
    protected currentMessage?: Uint8Array;
    protected currentMessageSize: number = 0;

    constructor(
        protected readonly onMessage: (response: Uint8Array) => void,
    ) {
    }

    public emptyBuffer(): boolean {
        return this.currentMessage === undefined;
    }

    public feed(data: Uint8Array) {
        if (!data.byteLength) return;

        if (!this.currentMessage) {
            this.currentMessage = data;
            this.currentMessageSize = new DataView(data.buffer, this.currentMessage.byteOffset).getUint32(0, true);
        } else {
            this.currentMessage = Buffer.concat([this.currentMessage, data]);
            if (!this.currentMessageSize) {
                if (this.currentMessage.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    return;
                }
                this.currentMessageSize = new DataView(this.currentMessage.buffer, this.currentMessage.byteOffset).getUint32(0, true);
            }
        }

        let currentSize = this.currentMessageSize;
        let currentBuffer = this.currentMessage;

        while (currentBuffer) {
            if (currentSize > currentBuffer.byteLength) {
                this.currentMessage = currentBuffer;
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
                const nextCurrentSize = new DataView(currentBuffer.buffer, currentBuffer.byteOffset, currentBuffer.byteLength).getUint32(0, true);
                // const nextCurrentSize = new DataView(currentBuffer.buffer, currentBuffer.byteOffset).getUint32(0, true);
                if (nextCurrentSize <= 0) throw new Error('message size wrong');
                currentSize = nextCurrentSize;
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}

export interface EncodedError {
    classType: string;
    message: string;
    stack: string;
    properties?: { [name: string]: any };
}

export function rpcEncodeError(error: Error | string): EncodedError {
    let classType = '';
    let stack = '';
    let properties: { [name: string]: any } | undefined;

    if ('string' !== typeof error) {
        const schema = getClassSchema(error['constructor'] as ClassType<typeof error>);
        stack = error.stack || '';
        if (schema.name) {
            classType = schema.name;
            if (schema.getClassProperties().size) {
                properties = jsonSerializer.for(schema).serialize(error);
            }
        }
    }

    return {
        classType,
        properties,
        stack,
        message: 'string' === typeof error ? error : error.message,
    }
}

export function rpcDecodeError(error: EncodedError): Error {
    if (error.classType) {
        const entity = getGlobalStore().RegisteredEntities[error.classType];
        if (!entity) {
            throw new Error(`Could not find an entity named ${error.classType} for an error thrown. ` +
                `Make sure the class is loaded and correctly defined using @entity.name(${JSON.stringify(error.classType)})`);
        }
        const classType = getClassSchema(entity).classType!;
        if (error.properties) {
            const e = jsonSerializer.for(getClassSchema(entity)).deserialize(error.properties);
            e.stack = error.stack + '\nat ___SERVER___';
            return e;
        }

        return new classType(error.message);
    }

    const e = new Error(error.message);
    e.stack = error.stack + '\nat ___SERVER___';

    return e;
}
