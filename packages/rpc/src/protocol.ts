/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer, getBSONSizer, Writer } from '@deepkit/bson';
import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { RpcAction, RpcError, rpcError } from './model.js';

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
 * - routeType is <src><dest><port>, when RouteSourceDest
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
}

export enum BodyFlag {
    Observable,
    Subject,
    BehaviourSubject,
    ProgressTracker,

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
    | MessageFlag.TypeError;

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
export const routeParamSize = 16 + 16 + 1;
export const contextIdSize = 2;
export const actionIdSize = 2;

export function getRouteTypeOffset(flags: MessageFlag): number {
    return flagSize;
}

const offsetsContextType = [
    /* 0b0 */ flagSize, // no direct route
    /* 0b1 */ flagSize + routeParamSize, // direct route
];

export function getContextIdOffset(flags: MessageFlag): number {
    // we need only the route bit to determine the offset
    return offsetsContextType[(flags & 0b10) >>> 1];
}

const offsetsActionType = [
    /* 0b00 */ flagSize, // no direct route, no context
    /* 0b01 */ flagSize + routeParamSize, // direct route, no context

    /* 0b10 */ flagSize + contextIdSize, // no direct route, context
    /* 0b11 */ flagSize + routeParamSize + contextIdSize, // direct route, context
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

    get actionType(): MessageFlag.TypeAction | MessageFlag.TypeAck {
        return this.flags & 0b110000;
    }

    debug() {
        return {
            type: this.type,
            typeString: RpcAction[this.type],
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
        return new Error;
        // return rpcDecodeError(error);
    }

    isError(): boolean {
        return false;
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

function noop(message: Uint8Array) {
}

export class ContextDispatcher {
    private contexts = new Array<(msg: Uint8Array) => void>(200).fill(noop);
    private freeSlots: number[] = []; // Stack for free slots
    private currentSlot = 1;

    current(): number {
        return this.freeSlots.length ? this.freeSlots[0] : this.currentSlot;
    }

    create(cb: (message: Uint8Array) => void): number {
        const context = this.freeSlots.pop() || this.currentSlot++;
        if (context >= this.contexts.length) {
            this.contexts.push(...new Array(2000).fill(noop));
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

function writeUint32LE(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
    buffer[offset + 2] = (value >> 16) & 0xff;
    buffer[offset + 3] = (value >> 24) & 0xff;
}

export function writeUint16LE(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
}

export function readUint16LE(buffer: Uint8Array, offset: number): number {
    return buffer[offset] + (buffer[offset + 1] << 8);
}

export function getRandomAddress(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}

export function writeDirectRoute(message: Uint8Array, src: Uint8Array, dst: Uint8Array, port: number) {
    // write src to pos 1
    message.set(src, 1);
    // write dst to pos 17
    message.set(dst, 17);
    message[33] = port;
}

export function writeContext(message: Uint8Array, context: number) {
    const offset = isRouteFlag(message[0], MessageFlag.RouteDirect) ? 1 + 16 + 16 + 1 : 1;
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

export function getRouteDirectSrc(buffer: Uint8Array): Uint8Array {
    return buffer.subarray(1, 17);
}

export function getRouteDirectDst(buffer: Uint8Array): Uint8Array {
    return buffer.subarray(17, 33);
}

export function getRouteDirectPort(buffer: Uint8Array): number {
    return buffer[33];
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

export function readUint32LE(buffer: Uint8Array, offset: number = 0): number {
    return buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
}

// export interface EncodedError {
//     classType: string;
//     message: string;
//     stack: string;
//     properties?: { [name: string]: any };
// }

// export function rpcEncodeError(error: Error | string): EncodedError {
//     let classType = '';
//     let stack = '';
//     let properties: { [name: string]: any } | undefined;
//
//     if ('string' !== typeof error) {
//         const schema = ReflectionClass.from(error['constructor'] as ClassType<typeof error>);
//         stack = error.stack || '';
//         if (schema.name) {
//             classType = schema.name;
//             if (schema.getProperties().length) {
//                 properties = serialize(error, undefined, undefined, undefined, schema.type);
//             }
//         }
//     }
//
//     return {
//         classType,
//         properties,
//         stack,
//         message: 'string' === typeof error ? error : error.message || '',
//     };
// }

// export function rpcDecodeError(error: EncodedError): Error {
//     if (error.classType) {
//         const entity = typeSettings.registeredEntities[error.classType];
//         if (!entity) {
//             throw new RpcError(`Could not find an entity named ${error.classType} for an error thrown. ` +
//                 `Make sure the class is loaded and correctly defined using @entity.name(${JSON.stringify(error.classType)})`);
//         }
//         const schema = ReflectionClass.from(entity);
//         if (error.properties) {
//             const e = deserialize(error.properties, undefined, undefined, undefined, schema.type) as Error;
//             e.stack = error.stack + '\nat ___SERVER___';
//             return e;
//         }
//
//         const classType = schema.getClassType()! as ClassType<Error>;
//         return new classType(error.message);
//     }
//
//     const e = new RpcError(error.message);
//     e.stack = error.stack + '\nat ___SERVER___';
//
//     return e;
// }
//
// export function createErrorMessage(error: any, ...args: any[]): Uint8Array {
//     const extracted = rpcEncodeError(error);
//
//     return createBuffer(0);
//     // return createRpcMessage(id, RpcTypes.Error, extracted, routeType, typeOf<rpcError>());
// }
