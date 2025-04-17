/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { getBSONDeserializer, getBSONSerializer, getBSONSizer, readUint32LE, Writer, writeUint32LE } from '@deepkit/bson';
import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';

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
 * header: <flag> [routeType] [contextId] [action]
 *
 * - routeType is not set, when RouteClient or RouteServer
 * - routeType is <src><dest><port>, when RouteDirect (<4bytes><4bytes><2bytes>)
 *
 * - contextId is not set per default
 * - contextId is a 16bit unsigned integer, when ContextExisting or TypeChunk or TypeChunkAck
 *
 * - action is not set, when type is not action
 * - action is a 32bit unsigned integer, when TypeAction
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
 * 2 bits: new context/existing context/no context
 * 3 bits: OtherAction/TypeAction/TypeBigAction/TypeAck/TypeChunk/TypeChunkAck
 */
export enum MessageFlag {
    // 2 bits for routeType (position 0-1)
    RouteClient = 0b00000_00,
    RouteServer = 0b00000_01,
    RouteDirect = 0b00000_10,

    // 2 bits for contextType (position 2-3)
    ContextNone = 0b000_00_00,
    ContextNew = 0b000_01_00,

    ContextExisting = 0b000_10_00,
    ContextEnd = 0b000_11_00,

    // 3 bits for type (position 4-6)
    TypeAck = 0b000_0000,
    TypeError = 0b001_0000,
    TypeChunk = 0b010_0000,
    TypeAction = 0b011_0000,
    TypeSchema = 0b100_0000,
    TypeResult = 0b101_0000,
    TypeChannel = 0b110_0000,
}

export enum ChannelSubType {
    None = 0,
    Observable,
    Subject,
    BehaviorSubject,
    ProgressTracker,
    ReadableStream,
    WritableStream,
    TransformStream,
    Signal,

    Reserved = 10,
    // anything above 10 is the body size (tuple of values),
    // 11 means 1 value, 12 means 2 values, ...
}

export type RouteFlag = MessageFlag.RouteClient | MessageFlag.RouteServer | MessageFlag.RouteDirect;

export type ContextFlag = MessageFlag.ContextNone | MessageFlag.ContextNew | MessageFlag.ContextExisting | MessageFlag.ContextEnd;

export type TypeFlag =
    | MessageFlag.TypeAction
    | MessageFlag.TypeAck
    | MessageFlag.TypeChunk
    | MessageFlag.TypeError
    | MessageFlag.TypeSchema
    | MessageFlag.TypeResult
    | MessageFlag.TypeChannel;


export function isRouteFlag(flags: MessageFlag, routeType: RouteFlag): boolean {
    return (flags & 0b11) === routeType;
}

export function isContextFlag(flags: MessageFlag, contextType: ContextFlag): boolean {
    return (flags & 0b1100) === contextType;
}

export function hasContext(flags: MessageFlag): boolean {
    //either MessageFlag.ContextEnd or MessageFlag.ContextExisting
    return (flags & 0b1000) !== 0;
}

export function isTypeFlag(flags: MessageFlag, type: TypeFlag): boolean {
    return (flags & 0b1110000) === type;
}

export function setRouteFlag(message: Uint8Array, routeType: RouteFlag): void {
    message[0] = (message[0] & 0b1111_1100) | routeType;
}

export function setContextFlag(message: Uint8Array, contextType: ContextFlag): void {
    message[0] = (message[0] & 0b1111_0011) | contextType;
}

export function setTypeFlag(message: Uint8Array, type: TypeFlag): void {
    message[0] = (message[0] & 0b1000_1111) | type;
}

export const flagSize = 1;
export const routeDirectParamsSize = 4 + 4 + 2;
export const contextIdSize = 2;
export const actionIdSize = 2;

export function getRouteTypeOffset(flags: MessageFlag): number {
    return flagSize;
}

const offsetsContextType = [
    /* 0b0 */ flagSize, // no direct route
    /* 0b1 */ flagSize + routeDirectParamsSize, // direct route
];

export function getContextIdOffset(flags: MessageFlag): number {
    // we need only the route bit to determine the offset
    return offsetsContextType[(flags & 0b10) >>> 1];
}

const offsetsActionType = [
    /* 0b00 */ flagSize, // no direct route, no context
    /* 0b01 */ flagSize + routeDirectParamsSize, // direct route, no context

    /* 0b10 */ flagSize + contextIdSize, // no direct route, context
    /* 0b11 */ flagSize + routeDirectParamsSize + contextIdSize, // direct route, context
];

export function getActionOffset(flags: MessageFlag): number {
    // we need to now the direct route bit, the context bit
    // directRoute = 0b00000_10
    // ContextExisting = 0b000_10_00
    // ContextEnd = 0b000_11_00
    const index = ((flags & 0b10) >>> 1) + ((flags & 0b10_00) >>> 2);
    return offsetsActionType[index];
}

export function getAction(buffer: Uint8Array): number {
    const offset = getActionOffset(buffer[0]);
    return readUint16LE(buffer, offset);
}

/**
 * ContextId is a 16bit unsigned integer.
 */
export function getContextId(buffer: Uint8Array): number {
    const offset = getContextIdOffset(buffer[0]);
    return readUint16LE(buffer, offset);
}

function noop(message: Uint8Array) {
}

type ApplyCallback = (message: Uint8Array) => void;

function createArray(): Array<ApplyCallback> {
    return [
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
        noop, noop, noop, noop, noop, noop, noop, noop, noop, noop,
    ];
}

export class ContextDispatcher {
    private contexts: ApplyCallback[] = createArray();
    private freeSlots: number[] = []; // Stack for free slots
    private currentSlot = 1;

    current(): number {
        return this.freeSlots.length ? this.freeSlots[0] : this.currentSlot;
    }

    create(cb: ApplyCallback): number {
        const context = this.freeSlots.pop() || this.currentSlot++;
        if (context >= this.contexts.length) {
            this.contexts.push(...createArray());
        }
        this.contexts[context] = cb;
        return context;
    }

    dispatch(id: number, message: Uint8Array) {
        this.contexts[id](message);
    }

    release(id: number) {
        this.contexts[id] = noop;
        this.freeSlots.push(id);
    }
}

export function writeUint16LE(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
}

export function readUint16LE(buffer: Uint8Array, offset: number): number {
    return buffer[offset] + (buffer[offset + 1] << 8);
}

export function getRandomAddress(): number {
    // random 2 byte address
    return Math.floor(Math.random() * 0xFFFF);
}

export function writeDirectRoute(message: Uint8Array, src: number, dst: number, port: number) {
    writeUint32LE(message, 1, src);
    writeUint32LE(message, 5, dst);
    writeUint32LE(message, 9, port);
}

export function writeContext(message: Uint8Array, context: number) {
    const offset = isRouteFlag(message[0], MessageFlag.RouteDirect) ? flagSize + routeDirectParamsSize : flagSize;
    writeUint16LE(message, offset, context);
}

export function writeContextNoRoute(message: Uint8Array, context: number) {
    writeUint16LE(message, 1, context);
}

export function writeAction(message: Uint8Array, id: number) {
    const offset = getActionOffset(message[0]);
    setTypeFlag(message, MessageFlag.TypeAction);
    writeUint16LE(message, offset, id);
}

export function getBodyOffset(buffer: Uint8Array): number {
    const offset = getActionOffset(buffer[0]);
    if (isTypeFlag(buffer[0], MessageFlag.TypeAction)) return offset + actionIdSize;
    return offset;
}

export function getRouteDirectSrc(buffer: Uint8Array): number {
    return readUint32LE(buffer, 1);
}

export function getRouteDirectDst(buffer: Uint8Array): number {
    return readUint32LE(buffer, 5);
}

// [_, ____, ____, __]
// [0, 1234, 5678, 9_]
export function getRouteDirectPort(buffer: Uint8Array): number {
    return readUint16LE(buffer, 9);
}

export function debugMessage(buffer: Uint8Array): string {
    if (buffer.byteLength < 1) return 'empty message';
    const route = isRouteFlag(buffer[0], MessageFlag.RouteDirect) ? 'route-direct' : isRouteFlag(buffer[0], MessageFlag.RouteClient) ? 'route-client' : 'route-server';
    let context = '';
    if (isContextFlag(buffer[0], MessageFlag.ContextNone)) context = 'context-none';
    if (isContextFlag(buffer[0], MessageFlag.ContextNew)) context = 'context-new';
    if (isContextFlag(buffer[0], MessageFlag.ContextExisting)) context = 'context-existing: ' + getContextId(buffer);
    if (isContextFlag(buffer[0], MessageFlag.ContextEnd)) context = 'context-end: ' + getContextId(buffer);

    let action = '';
    if (isTypeFlag(buffer[0], MessageFlag.TypeAck)) action = 'ack';
    if (isTypeFlag(buffer[0], MessageFlag.TypeAction)) action = 'action: ' + getAction(buffer);
    if (isTypeFlag(buffer[0], MessageFlag.TypeChunk)) action = 'chunk';
    if (isTypeFlag(buffer[0], MessageFlag.TypeError)) action = 'error';
    if (isTypeFlag(buffer[0], MessageFlag.TypeSchema)) action = 'schema';
    if (isTypeFlag(buffer[0], MessageFlag.TypeResult)) action = 'result';
    if (isTypeFlag(buffer[0], MessageFlag.TypeChannel)) action = 'channel';

    return `flags: ${buffer[0].toString(2).padStart(8, '0')} ${route} ${context} ${action} size: ${buffer.byteLength}`;
}

// export function createRpcMessage<T>(
//     routeType: MessageFlag,
//     contextType: ContextFlag,
//     typeFlag: TypeFlag,
//     options: {
//         src?: number;
//         dst?: number;
//         port?: number;
//         contextId?: number;
//         action?: number;
//         type?: number;
//         body?: T;
//         bodyEncoder?: BodyEncoder<T>;
//     },
// ): Uint8Array {
//     // Construct the 1-byte header
//     const flag = routeType | contextType | typeFlag;
//     const header = createBuffer(getHeaderSize(flag));
//     let offset = 0;
//     header[offset++] = flag;
//
//     // Encode src (4 bytes) and dst (4 bytes) (Only for RouteDirect)
//     if (isRouteFlag(flag, MessageFlag.RouteDirect)) {
//         if (options.src === undefined || options.dst === undefined || options.port === undefined) {
//             throw new Error('RouteDirect requires src, dst, and port');
//         }
//         writeUint32LE(header, offset, options.src);
//         offset += 4;
//         writeUint32LE(header, offset, options.dst);
//         offset += 4;
//         writeUint16LE(header, offset, options.port);
//         offset += 2;
//     }
//
//     // Encode context ID (4 bytes) (Only for ContextExisting)
//     if (isContextFlag(flag, MessageFlag.ContextExisting)) {
//         if (options.contextId === undefined) {
//             throw new Error('ContextExisting requires contextId');
//         }
//         writeUint16LE(header, offset, options.contextId);
//         offset += 2;
//     }
//
//     // Encode action field (variable size)
//     if (isTypeFlag(flag, MessageFlag.TypeOther)) {
//         if (options.type === undefined) {
//             throw new Error('TypeOther requires an 8-bit type');
//         }
//         header[offset++] = options.type & 0xff; // 1 byte
//     } else if (isTypeFlag(flag, MessageFlag.TypeAction)) {
//         if (options.action === undefined) {
//             throw new Error('TypeAction requires a 16-bit action');
//         }
//         writeUint16LE(header, offset, options.action);
//         offset += 2; // 2 bytes
//     } else if (isTypeFlag(flag, MessageFlag.TypeBigAction)) {
//         if (options.action === undefined) {
//             throw new Error('TypeBigAction requires a 32-bit action');
//         }
//         writeUint32LE(header, offset, options.action);
//         offset += 4; // 4 bytes
//     }
//
//     // Encode additional data if provided
//     // if (options.data) {
//     //     const dataBytes = serializeData(options.data);
//     //     const finalBuffer = new Uint8Array(header.length + dataBytes.length);
//     //     finalBuffer.set(header);
//     //     finalBuffer.set(dataBytes, header.length);
//     //     return finalBuffer;
//     // }
//
//     return header;
// }

// export function readBinaryRpcMessage(buffer: Uint8Array) {
//     const flags = buffer[0];
//     let offset = 1;
//
//     if (isRouteFlag(flags, MessageFlag.RouteDirect)) {
//         offset += 16 + 16 + 2;
//     }
//
//     let id = 0;
//     if (isContextFlag(flags, MessageFlag.ContextExisting)) {
//         id = getContextId(buffer, offset);
//         offset += 2;
//     }
//
//     let type = RpcTypes.Ack;
//     let action = 0;
//
//     if (flags & MessageFlag.TypeOther) {
//         offset += 1;
//         type = buffer[offset];
//     } else if (flags & MessageFlag.TypeAction) {
//         type = RpcTypes.Action;
//         action = buffer[offset] + (buffer[offset + 1] << 8);
//         offset += 1;
//     } else if (flags & MessageFlag.TypeBigAction) {
//         type = RpcTypes.Action;
//         action = buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16) + (buffer[offset + 3] << 24);
//         offset += 2;
//     }
//
//     return {
//         flags,
//         contextId: id,
//         type,
//         action,
//         bodyOffset: offset,
//     };
// }


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

// function createAckReply(message: RpcMessage): Uint8Array {
//     if (!message.buffer) throw new RpcError('Cannot create reply, no buffer given');
//     if (!message.contextId) throw new RpcError('Cannot create reply, no context id given');
//
//     // todo reuse cached reply buffer
//
//     // reuse router flags
//     const flags = message.routeType | MessageFlag.ContextExisting;
//
//     const reply = createBuffer(getHeaderSize(flags));
//     setTypeFlag(reply, MessageFlag.TypeAck);
//     let offset = 1;
//     if (isRouteFlag(reply[0], MessageFlag.RouteDirect)) {
//         offset += 16 + 16 + 2;
//         for (let i = 0; i < 16; i++) {
//             reply[offset + i] = message.buffer[offset + i];
//         }
//     }
//
//     writeUint32LE(reply, offset, message.contextId);
//     offset += 4;
//     return reply;
// }
