/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BsonStreamReader, deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer, getBSONSizer, Writer } from '@deepkit/bson';
import { bufferConcat, ClassType, createBuffer } from '@deepkit/core';
import type { SingleProgress } from './progress.js';
import { deserialize, ReceiveType, ReflectionClass, resolveReceiveType, serialize, Type, typeSettings } from '@deepkit/type';
import { rpcChunk, rpcError, RpcError, RpcTypes } from './model.js';

export interface BodyDecoder<T> {
    type: Type;

    (buffer: Uint8Array, offset: number): T;
}

export function createBodyDecoder<T>(type?: ReceiveType<T>): BodyDecoder<T> {
    type = resolveReceiveType(type);
    const deserialize = getBSONDeserializer<T>(undefined, type);
    const fn = (buffer: Uint8Array, offset: number) => {
        return deserialize(buffer, offset);
    };
    fn.type = type;
    return fn;
}

export interface BodyEncoder<T> {
    type: Type;

    size(value: T): number;

    write(value: T, buffer: Uint8Array, offset: number): void;
}


export function createBodyEncoder<T>(type?: ReceiveType<T>): BodyEncoder<T> {
    type = resolveReceiveType(type);
    const serialize = getBSONSerializer(undefined, type);
    const sizer = getBSONSizer(undefined, type);

    return {
        type,
        size: sizer,
        write(value: T, buffer: Uint8Array, offset: number): void {
            serialize(value, { writer: new Writer(buffer, offset) });
        },
    };
}

/**
 */

/**
 * Message encoding is:
 *
 * <header> [body]
 *
 * header: <flag> [routeType] [contextId] [type] [action]
 *
 * - routeType is not set, when RouteClient or RouteServer
 * - routeType is <src><dest><port>, when RouteSourceDest
 *
 * - contextId is not set per default
 * - contextId is a 32bit unsigned integer, when ContextExisting or TypeChunk or TypeChunkAck
 *
 * - type is not set per default
 * - type is a 8bit unsigned integer, when TypeOther
 *
 * - action is not set, when type is not action
 * - action is a 16bit unsigned integer, when TypeAction
 * - action is a 32bit unsigned integer, when TypeBigAction
 *
 * - body is parsed when message size is bigger than the header size (remaining bytes)
 *
 * // simple action without parameters
 * [(client | ContextNew | TypeAction), action] -> [(client | ContextExisting | TypeAck), contextId]
 *
 * // simple action without parameters
 * [(server | ContextNew | TypeAction), action] -> [(server | ContextExisting | TypeAck), contextId]
 *
 * // simple action without parameters
 * [(server | ContextNew | TypeAction), action] -> [(server | ContextExisting | TypeAck), contextId]
 * [(sourceDestination | ContextExisting | TypeAction), action] -> [(server | ContextExisting | TypeAck), contextId]
 *
 * // simple action without parameters, no response need
 * [(client | NoContext | TypeAction), action] -> []
 *
 * // big action (2 bytes to encode action id)
 * [(client | NoContext | TypeBigAction), action1, action2] -> []
 *
 * // simple action with parameters
 * [(client | ContextNew | TypeAction), action, parameters] -> [(client | ContextExisting | TypeAck), contextId]
 *
 * // chunk ack
 * [(TypeChunkAck), contextId]
 *
 * // chunk
 * [(TypeChunk), contextId]
 *
 * we have 1 byte for the flags to encode the following:
 * 2 bits: routeType
 * 2 bit: new context/existing context/no context
 * 3 bit: OtherAction/TypeAction/TypeBigAction/TypeAck/TypeChunk/TypeChunkAck
 */
export enum MessageFlag {
    // 2 bits for routeType (position 0-1)
    RouteClient = 0b00 << 0,   // 00
    RouteServer = 0b01 << 0,   // 01
    RouteDirect = 0b10 << 0, // 10

    // 2 bits for contextType (position 2-3)
    ContextNone = 0b00 << 2,   // 00
    ContextNew = 0b01 << 2,    // 01
    ContextExisting = 0b10 << 2, // 10

    // 3 bits for actionType (position 4-6)
    TypeOther = 0b000 << 4,     // 000
    TypeAction = 0b001 << 4,    // 001
    TypeBigAction = 0b010 << 4, // 010
    TypeAck = 0b011 << 4,       // 011
    TypeChunk = 0b100 << 4,     // 100
    TypeChunkAck = 0b101 << 4,  // 101
    TypeError = 0b110 << 4,     // 110
}

export enum BodyFlag {
    BigBody,
    Observable,
    Subject,
    BehaviourSubject,
    ProgressTracker,

    Reserved = 10,
    // anything above 10 is the body size (tuple of values),
    // 11 means 1 value, 12 means 2 values, ...
}

export type RouteFlag = MessageFlag.RouteClient | MessageFlag.RouteServer | MessageFlag.RouteDirect;

export type ContextFlag = MessageFlag.ContextNone | MessageFlag.ContextNew | MessageFlag.ContextExisting;

export type TypeFlag =
    MessageFlag.TypeOther
    | MessageFlag.TypeAction
    | MessageFlag.TypeBigAction
    | MessageFlag.TypeAck
    | MessageFlag.TypeChunk
    | MessageFlag.TypeChunkAck;

export function isRouteFlag(flags: MessageFlag, routeType: RouteFlag): boolean {
    return (flags & 0b11) === routeType;
}

export function isContextFlag(flags: MessageFlag, contextType: ContextFlag): boolean {
    return (flags & 0b1100) === contextType;
}

export function isTypeFlag(flags: MessageFlag, type: TypeFlag): boolean {
    return (flags & 0b1110000) === type;
}

export function setRouteFlag(flags: MessageFlag, routeType: RouteFlag): MessageFlag {
    return (flags & ~0b11) | routeType;
}

export function setContextFlag(flags: MessageFlag, contextType: ContextFlag): MessageFlag {
    return (flags & ~0b1100) | contextType;
}

export function setTypeFlag(flags: MessageFlag, type: TypeFlag): MessageFlag {
    return (flags & ~0b1110000) | type;
}

/**
 * ContextId is a 32bit unsigned integer.
 */
export function getContextId(buffer: Uint8Array, offset: number): number {
    return buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
}

export class RpcMessage {
    protected source?: string;
    protected destination?: string;

    constructor(
        public flags: MessageFlag,
        public contextId: number,
        public type: number,
        public action: number = 0,
        public bodyOffset: number = 0,
        public bodySize: number = 0,
        public buffer?: Uint8Array,
    ) {
    }

    get routeType(): MessageFlag.RouteClient | MessageFlag.RouteServer | MessageFlag.RouteDirect {
        return this.flags & 0b11;
    }

    get contextType(): MessageFlag.ContextNone | MessageFlag.ContextNew | MessageFlag.ContextExisting {
        return this.flags & 0b1100;
    }

    get actionType(): MessageFlag.TypeOther | MessageFlag.TypeAction | MessageFlag.TypeBigAction | MessageFlag.TypeAck {
        return this.flags & 0b110000;
    }

    debug() {
        return {
            type: this.type,
            typeString: RpcTypes[this.type],
            id: this.contextId,
            date: new Date,
            body: this.bodySize ? this.parseGenericBody() : undefined,
        };
    }

    getBuffer(): Uint8Array {
        if (!this.buffer) throw new RpcError('No buffer');
        return this.buffer;
    }

    getSource(): Uint8Array {
        if (!this.buffer) throw new RpcError('No buffer');
        if (!isRouteFlag(this.flags, MessageFlag.RouteDirect)) throw new RpcError(`Message is not routed via RouteDirect`);
        return this.buffer.subarray(4 + 1, 4 + 1 + 16);
    }

    getDestination(): Uint8Array {
        if (!this.buffer) throw new RpcError('No buffer');
        if (!isRouteFlag(this.flags, MessageFlag.RouteDirect)) throw new RpcError(`Message is not routed via RouteDirect`);
        return this.buffer.subarray(4 + 1 + 16, 4 + 1 + 16 + 16);
    }

    getError(): Error {
        if (!this.buffer) throw new RpcError('No buffer');
        const error = getBSONDeserializer<rpcError>()(this.buffer, this.bodyOffset);
        return rpcDecodeError(error);
    }

    isError(): boolean {
        return this.type === RpcTypes.Error;
    }

    parseGenericBody(): object {
        if (!this.bodySize) throw new RpcError('Message has no body');
        if (!this.buffer) throw new RpcError('No buffer');

        return deserializeBSONWithoutOptimiser(this.buffer, this.bodyOffset);
    }

    parseBody<T>(type?: ReceiveType<T>): T {
        if (!this.bodySize) throw new RpcError('Message has no body');
        if (!this.buffer) throw new RpcError('No buffer');
        // console.log('parseBody raw', deserializeBSONWithoutOptimiser(this.buffer, this.bodyOffset));
        return getBSONDeserializer<T>(undefined, type)(this.buffer, this.bodyOffset);
    }

    decodeBody<T>(decoder: BodyDecoder<T>): T {
        if (!this.bodySize) throw new RpcError('Message has no body');
        if (!this.buffer) throw new RpcError('No buffer');
        return decoder(this.buffer, this.bodyOffset);
    }
}

// export function readBinaryRpcMessage(buffer: Uint8Array): RpcMessage {
//     const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
//     const size = view.getUint32(0, true);
//     if (size !== buffer.byteLength) {
//         let message = `Message buffer size wrong. Message size=${size}, buffer size=${buffer.byteLength}.`;
//         let hex = '';
//         for (let i = 0; i < buffer.byteLength; i++) {
//             hex += buffer[i].toString(16).padStart(2, '0');
//         }
//         message += ' Buffer hex: '
//             + hex.substr(0, 500) + (hex.length > 500 ? '...' : '');
//         throw new RpcError(message);
//     }
//
//     const id = view.getUint32(5, true);
//
//     let offset = 9;
//     const routeType = buffer[offset++];
//
//     if (routeType === RpcMessageRouteType.peer) {
//         offset += 16; //<source>
//         while (buffer[offset++] !== 0) ; //feed until \0 byte
//     } else if (routeType === RpcMessageRouteType.sourceDest) {
//         offset += 16 + 16; //uuid is each 16 bytes
//     }
//
//     const composite = buffer[offset++] === 1;
//     const type = buffer[offset++];
//
//     return new RpcMessage(id, composite, type, routeType, offset, size - offset, buffer);
// }

// export interface RpcCreateMessageDef<T> {
//     type: number;
//     schema?: Type;
//     body?: T;
// }

// export function createRpcCompositeMessage<T>(
//     id: number,
//     type: number,
//     messages: RpcCreateMessageDef<any>[],
//     routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
// ): RpcMessageDefinition {
//     return {
//         id,
//         type,
//         routeType,
//         composite: messages,
//     };
// }

// export function serializeBinaryRpcCompositeMessage(message: RpcMessageDefinition): Uint8Array {
//     if (!message.composite) throw new RpcError('No messages set');
//
//     let bodySize = 0;
//     for (const sub of message.composite) {
//         bodySize += 4 + 1 + (sub.schema && sub.body ? getBSONSizer(undefined, sub.schema)(sub.body) : 0);
//     }
//
//     //<size> <version> <messageId> <routeType>[routeData] <isComposite> <type> <body...>
//     const messageSize = 4 + 1 + 4 + 1 + 1 + 1 + bodySize;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(message.id);
//
//     writer.writeByte(message.routeType);
//     writer.writeByte(1);
//     writer.writeByte(message.type);
//
//     for (const sub of message.composite) {
//         writer.writeUint32(sub.schema && sub.body ? getBSONSizer(undefined, sub.schema)(sub.body) : 0);
//         writer.writeByte(sub.type); //type
//
//         if (sub.schema && sub.body) {
//             //BSON object contain already their size at the beginning
//             getBSONSerializer(undefined, sub.schema)(sub.body, { writer });
//         }
//     }
//
//     return writer.buffer;
// }

// export function createRpcCompositeMessageSourceDest(
//     id: number,
//     source: Uint8Array,
//     destination: Uint8Array,
//     type: number,
//     messages: RpcCreateMessageDef<any>[],
// ): RpcMessageDefinition {
//     return {
//         id,
//         type,
//         routeType: RpcMessageRouteType.sourceDest,
//         composite: messages,
//         source,
//         destination,
//     };
// }
//
// export function serializeBinaryRpcCompositeMessageSourceDest(message: RpcMessageDefinition): Uint8Array {
//     if (!message.composite) throw new RpcError('No messages set');
//     if (!message.source) throw new RpcError('No source set');
//     if (!message.destination) throw new RpcError('No destination set');
//
//     let bodySize = 0;
//     for (const sub of message.composite) {
//         bodySize += 4 + 1 + (sub.schema && sub.body ? getBSONSizer(undefined, sub.schema)(sub.body) : 0);
//     }
//
//     //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
//     const messageSize = 4 + 1 + 4 + 1 + (16 + 16) + 1 + 1 + bodySize;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(message.id);
//
//     writer.writeByte(RpcMessageRouteType.sourceDest);
//     if (message.source.byteLength !== 16) throw new RpcError(`Source invalid byteLength of ${message.source.byteLength}`);
//     if (message.destination.byteLength !== 16) throw new RpcError(`Destination invalid byteLength of ${message.destination.byteLength}`);
//     writer.writeBuffer(message.source);
//     writer.writeBuffer(message.destination);
//     writer.writeByte(1); //composite=true
//     writer.writeByte(message.type);
//
//     for (const sub of message.composite) {
//         writer.writeUint32(sub.schema && sub.body ? getBSONSizer(undefined, sub.schema)(sub.body) : 0);
//         writer.writeByte(sub.type); //type
//
//         if (sub.schema && sub.body) {
//             //BSON object contain already their size at the beginning
//             getBSONSerializer(undefined, sub.schema)(sub.body, { writer });
//         }
//     }
//
//     return writer.buffer;
// }
//
// export interface RpcMessageDefinition {
//     id: number;
//     type: number;
//     routeType: RouteType;
//     composite?: RpcCreateMessageDef<any>[];
//     peerId?: string;
//     source?: Uint8Array;
//     destination?: Uint8Array;
//     body?: {
//         type: Type;
//         body: any;
//     };
// }
//
// export function createRpcMessage<T>(
//     id: number,
//     type: number,
//     body?: T,
//     routeType: RouteType = MessageFlag.RouteClient,
//     schema?: ReceiveType<T>,
// ): RpcMessageDefinition {
//     return {
//         id,
//         type,
//         routeType,
//         body: body && {
//             type: resolveReceiveType(schema),
//             body,
//         },
//     };
// }

// export function serializeBinaryRpcMessage(message: RpcMessageDefinition): Uint8Array {
//     // if (message.composite) {
//     //     if (message.routeType === RpcMessageRouteType.sourceDest) {
//     //         return serializeBinaryRpcCompositeMessageSourceDest(message);
//     //     }
//     //     return serializeBinaryRpcCompositeMessage(message);
//     // }
//
//     // if (message.routeType === RpcMessageRouteType.peer) {
//     //     return serializeBinaryRpcMessagePeer(message);
//     // }
//     //
//     // if (message.routeType === RpcMessageRouteType.sourceDest) {
//     //     return serializeBinaryRpcMessageSourceDest(message);
//     // }
//
//     return serializeBinaryRpcMessageSingleBody(message);
// }

// export function serializeBinaryRpcMessageSingleBody(message: RpcMessageDefinition): Uint8Array {
//     const bodySize = message.body ? getBSONSizer(undefined, message.body.type)(message.body.body) : 0;
//     //<flags>
//     const messageSize = 4 + 1 + 4 + 1 + 1 + 1 + bodySize;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(message.id);
//
//     writer.writeByte(message.routeType);
//     writer.writeByte(0); //composite=false
//     writer.writeByte(message.type);
//
//     if (message.body) {
//         const offset = writer.offset;
//         const serializer = getBSONSerializer(undefined, message.body.type);
//         serializer(message.body.body, { writer });
//     }
//
//     return writer.buffer;
// }

export function createRpcMessageContextExistingFactory<T>(type: number, routeType: RouteFlag, schema?: ReceiveType<T>) {
    const header = Buffer.allocUnsafe(1);
    let flag: MessageFlag = routeType | MessageFlag.ContextExisting | MessageFlag.TypeOther;
    if (type === RpcTypes.Ack) {
        flag |= MessageFlag.TypeAck;
    }
    header[0] = flag;
    return;
}

// variations: context=existing, context=new, context=none, route=client, route=server, route=sourceDest, route=peer, type=other, type=action, type=bigAction, type=ack, type=chunk, type=chunkAck

export function getHeaderSize(flags: MessageFlag): number {
    return 1 + (isRouteFlag(flags, MessageFlag.RouteDirect)
        ? 16 + 16 : 0) + (isContextFlag(flags, MessageFlag.ContextExisting)
        ? 4 : 0) + (isTypeFlag(flags, MessageFlag.TypeOther)
        ? 1 : isTypeFlag(flags, MessageFlag.TypeAction)
            ? 2 : isTypeFlag(flags, MessageFlag.TypeBigAction) ? 4 : 0);
}

function writeUint32(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = (value >> 24) & 0xff;
    buffer[offset + 1] = (value >> 16) & 0xff;
    buffer[offset + 2] = (value >> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
}

function writeUint16(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = (value >> 8) & 0xff;
    buffer[offset + 1] = value & 0xff;
}

export function createRpcMessage<T>(
    routeType: MessageFlag,
    contextType: ContextFlag,
    typeFlag: TypeFlag,
    options: {
        src?: number;
        dst?: number;
        port?: number;
        contextId?: number;
        action?: number;
        type?: number;
        body?: T;
        bodyEncoder?: BodyEncoder<T>;
    },
): Uint8Array {
    // Construct the 1-byte header
    const flag = routeType | contextType | typeFlag;
    const header = createBuffer(getHeaderSize(flag));
    let offset = 0;
    header[offset++] = flag;

    // Encode src (4 bytes) and dst (4 bytes) (Only for RouteDirect)
    if (isRouteFlag(flag, MessageFlag.RouteDirect)) {
        if (options.src === undefined || options.dst === undefined || options.port === undefined) {
            throw new Error('RouteDirect requires src, dst, and port');
        }
        writeUint32(header, offset, options.src);
        offset += 4;
        writeUint32(header, offset, options.dst);
        offset += 4;
        writeUint16(header, offset, options.port);
        offset += 2;
    }

    // Encode context ID (4 bytes) (Only for ContextExisting)
    if (isContextFlag(flag, MessageFlag.ContextExisting)) {
        if (options.contextId === undefined) {
            throw new Error('ContextExisting requires contextId');
        }
        writeUint32(header, offset, options.contextId);
        offset += 4;
    }

    // Encode action field (variable size)
    if (isTypeFlag(flag, MessageFlag.TypeOther)) {
        if (options.type === undefined) {
            throw new Error('TypeOther requires an 8-bit type');
        }
        header[offset++] = options.type & 0xff; // 1 byte
    } else if (isTypeFlag(flag, MessageFlag.TypeAction)) {
        if (options.action === undefined) {
            throw new Error('TypeAction requires a 16-bit action');
        }
        writeUint16(header, offset, options.action);
        offset += 2; // 2 bytes
    } else if (isTypeFlag(flag, MessageFlag.TypeBigAction)) {
        if (options.action === undefined) {
            throw new Error('TypeBigAction requires a 32-bit action');
        }
        writeUint32(header, offset, options.action);
        offset += 4; // 4 bytes
    }

    // Encode additional data if provided
    // if (options.data) {
    //     const dataBytes = serializeData(options.data);
    //     const finalBuffer = new Uint8Array(header.length + dataBytes.length);
    //     finalBuffer.set(header);
    //     finalBuffer.set(dataBytes, header.length);
    //     return finalBuffer;
    // }

    return header;
}

/**
 * When RouteDirect, the src/dst are flipped to convert the message to a reply.
 */
export function replyRoute(buffer: Uint8Array): void {
    if (isRouteFlag(buffer[0], MessageFlag.RouteDirect)) {
        const src = buffer.subarray(1, 5);
        const dst = buffer.subarray(5, 9);
        buffer.set(dst, 1);
        buffer.set(src, 5);
    }
}

export function readBinaryRpcMessage(buffer: Uint8Array): RpcMessage {
    const flags = buffer[0];
    let offset = 1;

    if (isRouteFlag(flags, MessageFlag.RouteDirect)) {
        offset += 16 + 16 + 2;
    }

    let id = 0;
    if (isContextFlag(flags, MessageFlag.ContextExisting)) {
        id = getContextId(buffer, offset);
        offset += 4;
    }

    let type = RpcTypes.Ack;
    let action = 0;

    if (flags & MessageFlag.TypeOther) {
        offset += 1;
        type = buffer[offset];
    } else if (flags & MessageFlag.TypeAction) {
        offset += 2;
        type = RpcTypes.Action;
        action = buffer[offset] + (buffer[offset + 1] << 8);
    } else if (flags & MessageFlag.TypeBigAction) {
        offset += 4;
        type = RpcTypes.Action;
        action = buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16) + (buffer[offset + 3] << 24);
    }

    return new RpcMessage(flags, id, type, action, offset, buffer.length - offset, buffer);
}


// export function createRpcMessagePeer<T>(
//     id: number, type: number,
//     source: Uint8Array,
//     peerId: string,
//     body?: T,
//     schema?: ReceiveType<T>,
// ): RpcMessageDefinition {
//     return {
//         id,
//         type,
//         routeType: RpcMessageRouteType.peer,
//         source,
//         peerId,
//         body: body && {
//             type: resolveReceiveType(schema),
//             body,
//         },
//     };
// }

// export function serializeBinaryRpcMessagePeer(message: RpcMessageDefinition): Uint8Array {
//     if (!message.peerId) throw new RpcError('No peerId set');
//     if (!message.source) throw new RpcError('No source set');
//
//     const bodySize = message.body ? getBSONSizer(undefined, message.body.type)(message.body.body) : 0;
//     //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
//     const messageSize = 4 + 1 + 4 + 1 + (16 + message.peerId.length + 1) + 1 + 1 + bodySize;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(message.id);
//
//     writer.writeByte(RpcMessageRouteType.peer);
//     if (message.source.byteLength !== 16) throw new RpcError(`Source invalid byteLength of ${message.source.byteLength}`);
//     writer.writeBuffer(message.source);
//     writer.writeAsciiString(message.peerId);
//     writer.writeNull();
//
//     writer.writeByte(0); //composite=false
//     writer.writeByte(message.type);
//
//     if (message.body) getBSONSerializer(undefined, message.body.type)(message.body.body, { writer });
//
//     return writer.buffer;
// }

// export function createRpcMessageSourceDest<T>(
//     id: number,
//     type: number,
//     source: Uint8Array,
//     destination: Uint8Array,
//     body?: T,
//     schema?: ReceiveType<T>,
// ): RpcMessageDefinition {
//     return {
//         id,
//         type,
//         routeType: RpcMessageRouteType.sourceDest,
//         source,
//         destination,
//         body: body && {
//             type: resolveReceiveType(schema),
//             body,
//         },
//     };
// }

// export function serializeBinaryRpcMessageSourceDest(message: RpcMessageDefinition): Uint8Array {
//     if (!message.source) throw new RpcError('No source set');
//     if (!message.destination) throw new RpcError('No destination set');
//
//     const bodySize = message.body ? getBSONSizer(undefined, message.body.type)(message.body.body) : 0;
//     //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
//     const messageSize = 4 + 1 + 4 + 1 + (16 + 16) + 1 + 1 + bodySize;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(message.id);
//
//     writer.writeByte(RpcMessageRouteType.sourceDest);
//     if (message.source.byteLength !== 16) throw new RpcError(`Source invalid byteLength of ${message.source.byteLength}`);
//     if (message.destination.byteLength !== 16) throw new RpcError(`Destination invalid byteLength of ${message.destination.byteLength}`);
//     writer.writeBuffer(message.source);
//     writer.writeBuffer(message.destination);
//
//     writer.writeByte(0); //composite=false
//     writer.writeByte(message.type);
//
//     if (message.body) getBSONSerializer(undefined, message.body.type)(message.body.body, { writer });
//
//     return writer.buffer;
// }

// export function createRpcMessageSourceDestForBody<T>(
//     id: number, type: number,
//     source: Uint8Array,
//     destination: Uint8Array,
//     body: Uint8Array,
// ): Uint8Array {
//     //<size> <version> <messageId> <routeType>[routeData] <composite> <type> <body...>
//     const messageSize = 4 + 1 + 4 + 1 + (16 + 16) + 1 + 1 + body.byteLength;
//
//     const writer = new Writer(createBuffer(messageSize));
//     writer.writeUint32(messageSize);
//     writer.writeByte(1); //version
//     writer.writeUint32(id);
//
//     writer.writeByte(RpcMessageRouteType.sourceDest);
//     if (source.byteLength !== 16) throw new RpcError(`Source invalid byteLength of ${source.byteLength}`);
//     if (destination.byteLength !== 16) throw new RpcError(`Destination invalid byteLength of ${destination.byteLength}`);
//     writer.writeBuffer(source);
//     writer.writeBuffer(destination);
//
//     writer.writeByte(0); //composite=false
//     writer.writeByte(type);
//
//     writer.writeBuffer(body);
//
//     return writer.buffer;
// }

function createAckReply(message: RpcMessage): Uint8Array {
    if (!message.buffer) throw new RpcError('Cannot create reply, no buffer given');
    if (!message.contextId) throw new RpcError('Cannot create reply, no context id given');

    // todo reuse cached reply buffer

    // reuse router flags
    const flags = message.routeType | MessageFlag.ContextExisting;

    const reply = createBuffer(getHeaderSize(flags));
    setTypeFlag(reply[0], MessageFlag.TypeAck);
    let offset = 1;
    if (isRouteFlag(reply[0], MessageFlag.RouteDirect)) {
        offset += 16 + 16 + 2;
        for (let i = 0; i < 16; i++) {
            reply[offset + i] = message.buffer[offset + i];
        }
    }

    writeUint32(reply, offset, message.contextId);
    offset += 4;
    return reply;
}

export class ContextId {
    id: number = 0;

    next() {
        // start context with 1, 0 is no context
        return ++this.id;
    }
}

export class RpcBinaryMessageReader {
    protected chunks = new Map<number, { loaded: number, buffers: Uint8Array[] }>();
    protected progress = new Map<number, SingleProgress>();
    protected chunkAcks = new Map<number, Function>();
    protected streamReader = new BsonStreamReader(this.gotMessage.bind(this));

    constructor(
        protected context: ContextId,
        protected readonly onMessage: (response: RpcMessage) => void,
        protected readonly onChunk: (message: Uint8Array) => void,
    ) {
    }

    public onChunkAck(id: number, callback: Function) {
        this.chunkAcks.set(id, callback);
    }

    public registerProgress(id: number, progress: SingleProgress) {
        this.progress.set(id, progress);
    }

    public feed(buffer: Uint8Array, bytes?: number) {
        this.streamReader.feed(buffer, bytes);
    }

    protected gotMessage(buffer: Uint8Array) {
        const message = readBinaryRpcMessage(buffer);

        if (isContextFlag(buffer[0], MessageFlag.ContextNew)) {
            message.contextId = this.context.next();
        }

        if (isTypeFlag(buffer[0], MessageFlag.TypeChunkAck)) {
            const id = getContextId(buffer, 1);
            const ack = this.chunkAcks.get(id);
            if (ack) ack();
        } else if (isTypeFlag(buffer[0], MessageFlag.TypeChunk)) {
            const id = getContextId(buffer, 1);
            const progress = this.progress.get(id);

            const body = message.parseBody<rpcChunk>();
            let chunks = this.chunks.get(body.id);
            if (!chunks) {
                chunks = { buffers: [], loaded: 0 };
                this.chunks.set(body.id, chunks);
            }
            chunks.buffers.push(body.v);
            chunks.loaded += body.v.byteLength;
            if (this.onChunk) this.onChunk(createAckReply(message));
            if (progress) progress.set(body.total, chunks.loaded);

            if (chunks.loaded === body.total) {
                //we're done
                this.progress.delete(id);
                this.chunks.delete(body.id);
                this.chunkAcks.delete(body.id);
                const newBuffer = bufferConcat(chunks.buffers, body.total);
                const packedMessage = readBinaryRpcMessage(newBuffer);
                this.onMessage(packedMessage);
            }
        } else {
            const progress = this.progress.get(message.contextId);
            if (progress) {
                progress.set(buffer.byteLength, buffer.byteLength);
                this.progress.delete(message.contextId);
            }
            this.onMessage(message);
        }
    }
}

export function readUint32LE(buffer: Uint8Array, offset: number = 0): number {
    return buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
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
        const schema = ReflectionClass.from(error['constructor'] as ClassType<typeof error>);
        stack = error.stack || '';
        if (schema.name) {
            classType = schema.name;
            if (schema.getProperties().length) {
                properties = serialize(error, undefined, undefined, undefined, schema.type);
            }
        }
    }

    return {
        classType,
        properties,
        stack,
        message: 'string' === typeof error ? error : error.message || '',
    };
}

export function rpcDecodeError(error: EncodedError): Error {
    if (error.classType) {
        const entity = typeSettings.registeredEntities[error.classType];
        if (!entity) {
            throw new RpcError(`Could not find an entity named ${error.classType} for an error thrown. ` +
                `Make sure the class is loaded and correctly defined using @entity.name(${JSON.stringify(error.classType)})`);
        }
        const schema = ReflectionClass.from(entity);
        if (error.properties) {
            const e = deserialize(error.properties, undefined, undefined, undefined, schema.type) as Error;
            e.stack = error.stack + '\nat ___SERVER___';
            return e;
        }

        const classType = schema.getClassType()! as ClassType<Error>;
        return new classType(error.message);
    }

    const e = new RpcError(error.message);
    e.stack = error.stack + '\nat ___SERVER___';

    return e;
}

export function createErrorMessage(error: any, ...args: any[]): Uint8Array {
    const extracted = rpcEncodeError(error);

    return createBuffer(0);
    // return createRpcMessage(id, RpcTypes.Error, extracted, routeType, typeOf<rpcError>());
}
