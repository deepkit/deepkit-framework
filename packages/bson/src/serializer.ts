/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, VarRef, arg, fn } from '@deepkit/core';
import {
    BinaryBigIntType,
    NamingStrategy,
    ReceiveType,
    ReflectionClass,
    ReflectionKind,
    Type,
    TypeArray,
    TypeClass,
    TypeEnum,
    TypeIndexSignature,
    TypeLiteral,
    TypeNumber,
    TypeObjectLiteral,
    TypePromise,
    TypeProperty,
    TypePropertySignature,
    TypeRegexp,
    TypeRest,
    TypeTuple,
    TypeTupleMember,
    TypeUnion,
    UNION_LITERAL_THRESHOLD,
    binaryBigIntAnnotation,
    binaryTypes,
    detectDiscriminator,
    embeddedAnnotation,
    excludedAnnotation,
    hasCircularReference,
    hasDefaultValue,
    isAllLiterals,
    isBinaryBigIntType,
    isCustomTypeClass,
    isGlobalTypeClass,
    isMongoIdType,
    isOptional,
    isPropertyMemberType,
    isReferenceType,
    isUUIDType,
    memberNameToString,
    resolveReceiveType,
    resolveTypeMembers,
} from '@deepkit/type';
import type { DiscriminatorInfo } from '@deepkit/type';
import { TypeNumberBrand } from '@deepkit/type-spec';

import { BSONBuildState, PropertyName } from './context.js';
import { BSONError, CircularReferenceError, TypeNotSerializableError } from './errors.js';
import {
    BSONType,
    BSON_BINARY_SUBTYPE_DEFAULT,
    BSON_BINARY_SUBTYPE_UUID,
    INT32_MAX,
    INT32_MIN,
    UUID_BYTE_LENGTH,
} from './types.js';

/**
 * Lookup table for hex char code → nibble value (0-15).
 * Branchless hex conversion: hexTable[charCode] gives the numeric value.
 * Supports '0'-'9' (48-57), 'A'-'F' (65-70), 'a'-'f' (97-102).
 */
const hexTable = new Uint8Array(128);
for (let i = 0; i < 10; i++) hexTable[48 + i] = i; // '0'-'9'
for (let i = 0; i < 6; i++) hexTable[65 + i] = 10 + i; // 'A'-'F'
for (let i = 0; i < 6; i++) hexTable[97 + i] = 10 + i; // 'a'-'f'

/**
 * TextEncoder for UTF-8 string encoding.
 * Using encodeInto() avoids intermediate allocations.
 */
const textEncoder = new TextEncoder();

/**
 * Check if a number fits in int32 range.
 * Used by JIT to determine whether to use INT or DOUBLE encoding.
 * @internal
 */
export function isInt32(n: number): boolean {
    return Number.isInteger(n) && n >= INT32_MIN && n <= INT32_MAX;
}

/**
 * Type for the inner serialize function that takes buffer params directly.
 * Returns the new offset after writing.
 */
type SerializeFn = (buffer: Uint8Array, view: DataView, offset: number, data: any) => number;

// BSONBuildState is now imported from context.ts

/**
 * Write UTF-8 encoded string to buffer.
 * Called from JIT-generated code as a helper. Keeping complex logic in helper
 * functions (rather than inlining into JIT) reduces generated code size,
 * avoiding L1 icache thrashing. See writeObjectIdBranchless for details.
 * @internal
 */
export function writeStringUTF8(buffer: Uint8Array, offset: number, str: string): number {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) {
            buffer[offset++] = code;
        } else if (code < 0x800) {
            buffer[offset++] = 0xc0 | (code >> 6);
            buffer[offset++] = 0x80 | (code & 0x3f);
        } else if (code >= 0xd800 && code < 0xdc00) {
            // Surrogate pair
            const lo = str.charCodeAt(++i);
            const cp = 0x10000 + ((code - 0xd800) << 10) + (lo - 0xdc00);
            buffer[offset++] = 0xf0 | (cp >> 18);
            buffer[offset++] = 0x80 | ((cp >> 12) & 0x3f);
            buffer[offset++] = 0x80 | ((cp >> 6) & 0x3f);
            buffer[offset++] = 0x80 | (cp & 0x3f);
        } else if (code >= 0xdc00 && code < 0xe000) {
            // Skip low surrogate (already handled by high surrogate)
        } else {
            buffer[offset++] = 0xe0 | (code >> 12);
            buffer[offset++] = 0x80 | ((code >> 6) & 0x3f);
            buffer[offset++] = 0x80 | (code & 0x3f);
        }
    }
    return offset;
}

/**
 * Cache for serializer functions.
 */
const serializerCache = new WeakMap<Type, (data: any) => SerializeResult>();

/**
 * Shared buffer for serialization (avoids allocation per call).
 * Grows as needed.
 */
let sharedBuffer = new Uint8Array(1024 * 1024); // 1MB initial
let sharedView = new DataView(sharedBuffer.buffer);

/**
 * Get or create a BSON serializer for the given type.
 *
 * Returns a function that serializes data and returns [buffer, size] tuple.
 * The buffer is shared - valid only until next serialize call.
 * Use `buffer.slice(0, size)` if you need to retain the data.
 *
 * @example
 * const serialize = getBSONSerializer<{ name: string }>();
 * const [buffer, size] = serialize({ name: 'Peter' });
 * // Use buffer.subarray(0, size) or buffer.slice(0, size) as needed
 */
export function getBSONSerializer<T>(receiveType?: ReceiveType<T>): (data: T) => SerializeResult {
    const type = resolveReceiveType(receiveType);

    let serializer = serializerCache.get(type);
    if (serializer) return serializer;

    serializer = createSerializer(type);
    serializerCache.set(type, serializer);
    return serializer;
}

/**
 * Result tuple returned by zero-copy serializers.
 * [0] = buffer containing the data
 * [1] = size of the serialized data
 *
 * The buffer is shared - valid only until next serialize call.
 * Use buffer.slice(0, size) if you need to retain the data.
 */
export type SerializeResult = [buffer: Uint8Array, size: number];

/**
 * Create a serializer function for the given type.
 * Returns [buffer, size] tuple for zero-copy access.
 */
function createSerializer(type: Type): (data: any) => SerializeResult {
    // Handle union of object types (e.g., { a: number } | { a: number; b: string })
    if (type.kind === ReflectionKind.union) {
        return createUnionSerializer(type as TypeUnion);
    }

    if (type.kind !== ReflectionKind.objectLiteral && type.kind !== ReflectionKind.class) {
        throw new TypeNotSerializableError(ReflectionKind[type.kind]);
    }

    // Build the JIT serializer that takes (buffer, view, offset, data) => newOffset
    const ctx = new BSONBuildState();
    const serializeFn = buildObjectSerializer(type as TypeObjectLiteral, ctx);

    // Return a wrapper that manages the shared buffer
    // Fresh tuple is faster than pre-allocated due to V8 escape analysis
    return (data: any): SerializeResult => {
        try {
            return [sharedBuffer, serializeFn(sharedBuffer, sharedView, 0, data)];
        } catch (e) {
            // Clear stale entries from circular reference tracking on error.
            // Without this, a throw mid-serialization leaves the global Set
            // with stale entries, causing false-positive cycle detection on
            // subsequent calls.
            if (globalCircularSet) globalCircularSet.clear();
            throw e;
        }
    };
}

/**
 * Create a serializer for a union of object types.
 * Picks the best matching member by checking which member's properties
 * best match the data's own property keys.
 */
function createUnionSerializer(type: TypeUnion): (data: any) => SerializeResult {
    const objectMembers = type.types.filter(
        (t): t is TypeObjectLiteral | TypeClass =>
            t.kind === ReflectionKind.objectLiteral || t.kind === ReflectionKind.class,
    );

    if (objectMembers.length === 0) {
        throw new TypeNotSerializableError(ReflectionKind[type.kind]);
    }

    // Pre-build serializers for each member
    const memberSerializers = objectMembers.map(member => {
        const ctx = new BSONBuildState();
        const serializeFn = buildObjectSerializer(member, ctx);
        const props = member.types
            .filter(
                (t): t is TypeProperty | TypePropertySignature =>
                    t.kind === ReflectionKind.propertySignature || t.kind === ReflectionKind.property,
            )
            .map(p => String(p.name));
        const required = member.types
            .filter(
                (t): t is TypeProperty | TypePropertySignature =>
                    (t.kind === ReflectionKind.propertySignature || t.kind === ReflectionKind.property) &&
                    !isOptional(t),
            )
            .map(p => String(p.name));
        return { serializeFn, props, required };
    });

    return (data: any): SerializeResult => {
        const dataKeys = Object.keys(data);
        let bestIndex = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < memberSerializers.length; i++) {
            const { props, required } = memberSerializers[i];
            let matchCount = 0;
            for (const name of props) {
                if (dataKeys.includes(name)) matchCount++;
            }
            let missingRequired = 0;
            for (const name of required) {
                if (!dataKeys.includes(name) && data[name] === undefined) missingRequired++;
            }
            const score = matchCount * 10 - missingRequired * 100;
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        try {
            return [sharedBuffer, memberSerializers[bestIndex].serializeFn(sharedBuffer, sharedView, 0, data)];
        } catch (e) {
            if (globalCircularSet) globalCircularSet.clear();
            throw e;
        }
    };
}

/**
 * Serialize object properties (both fixed properties and index signature).
 * This is the core property serialization logic shared by:
 * - buildObjectSerializer (root document)
 * - serializeNestedObject (embedded document)
 * - serializeCustomClass (class instance)
 * - getExtractedSerializer (recursive types)
 */
function serializeObjectProperties(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    data: Ref<any>,
    properties: (TypeProperty | TypePropertySignature)[],
    indexSignature: TypeIndexSignature | undefined,
    ctx: BSONBuildState,
): void {
    // Serialize each fixed property
    for (const prop of properties) {
        // Skip excluded properties
        if (excludedAnnotation.isExcluded(prop.type, 'bson')) continue;

        const jsPropName = memberNameToString(prop.name); // JS property name for object access
        const propType = prop.type;

        // Handle Embedded<T> — flatten sub-properties into parent document
        const embedded = embeddedAnnotation.getFirst(propType);
        if (embedded && (propType.kind === ReflectionKind.class || propType.kind === ReflectionKind.objectLiteral)) {
            const prefix = embedded.prefix ?? '';
            const embeddedMembers = resolveTypeMembers(propType as TypeClass | TypeObjectLiteral);
            const propValue = b.get(data, jsPropName);

            for (const member of embeddedMembers) {
                if (!isPropertyMemberType(member)) continue;
                const subProp = member as TypeProperty | TypePropertySignature;
                const subPropName = memberNameToString(subProp.name);
                const bsonName = prefix + subPropName;
                const subValue = b.get(propValue, subPropName);
                const subCtx = ctx.forProperty(bsonName);

                if (isOptional(subProp) || hasDefaultValue(subProp)) {
                    b.if_(b.not(b.isNullish(subValue)), () => {
                        serializeValue(b, buffer, view, o, bsonName, subProp.type, subValue, subCtx);
                    });
                } else {
                    serializeValue(b, buffer, view, o, bsonName, subProp.type, subValue, subCtx);
                }
            }
            continue;
        }

        const bsonPropName = ctx.getPropertyName(prop); // Serialized name (may differ via @MapName)
        const propValue = b.get(data, jsPropName);
        const propCtx = ctx.forProperty(bsonPropName);

        // Check if property is optional (handles both `prop?: T` and `prop: T | undefined`)
        if (isOptional(prop)) {
            // Undefined semantics: check if property exists in object
            // - Property not present (key not in obj): skip entirely
            // - Property present but undefined/null: serialize as null
            // - Property present with value: serialize value
            const propExists = b.call((obj: any, key: string) => key in obj, data, b.lit(jsPropName));
            b.if_(propExists, () => {
                b.if_(
                    b.isNullish(propValue),
                    () => {
                        // Property exists but is undefined/null → serialize as null
                        serializeNull(b, buffer, view, o, bsonPropName);
                    },
                    () => {
                        serializeValue(b, buffer, view, o, bsonPropName, propType, propValue, propCtx);
                    },
                );
            });
        } else if (hasDefaultValue(prop)) {
            // Non-optional with default: skip if value is undefined/null.
            // The deserializer will apply the default value.
            b.if_(b.not(b.isNullish(propValue)), () => {
                serializeValue(b, buffer, view, o, bsonPropName, propType, propValue, propCtx);
            });
        } else {
            serializeValue(b, buffer, view, o, bsonPropName, propType, propValue, propCtx);
        }
    }

    // Handle index signature: iterate over remaining keys
    if (indexSignature) {
        // Use JS property names for the skip check (we read from JS object)
        // Only include non-excluded properties in fixedKeys
        const fixedKeys = new Set(
            properties.filter(p => !excludedAnnotation.isExcluded(p.type, 'bson')).map(p => memberNameToString(p.name)),
        );
        const valueType = indexSignature.type;
        // For index signatures, use a generic path since key is runtime
        const indexCtx = ctx.forIndex('key');
        // Get all keys and loop over them
        // Check if the value type allows undefined
        const allowsUndefined = isOptional(valueType);

        // Get all keys and loop over them
        const keys = b.let(b.call<string[]>(Object.keys, data), 'keys');

        b.loop(keys, key => {
            // Skip fixed properties (already serialized)
            if (fixedKeys.size > 0) {
                // Build condition: key !== 'prop1' && key !== 'prop2' && ...
                const fixedKeyArray = Array.from(fixedKeys);
                let condition = b.neq(key, b.lit(fixedKeyArray[0]));
                for (let i = 1; i < fixedKeyArray.length; i++) {
                    condition = b.and(condition, b.neq(key, b.lit(fixedKeyArray[i])));
                }
                b.if_(condition, () => {
                    const value = b.get(data, key);
                    if (allowsUndefined) {
                        // Type allows undefined: write BSON NULL for undefined/null values
                        serializeValue(b, buffer, view, o, key, valueType, value, indexCtx);
                    } else {
                        // Skip undefined values (type doesn't allow undefined)
                        b.if_(b.neq(value, b.lit(undefined)), () => {
                            serializeValue(b, buffer, view, o, key, valueType, value, indexCtx);
                        });
                    }
                });
            } else {
                // No fixed properties, serialize all keys
                const value = b.get(data, key);
                if (allowsUndefined) {
                    serializeValue(b, buffer, view, o, key, valueType, value, indexCtx);
                } else {
                    b.if_(b.neq(value, b.lit(undefined)), () => {
                        serializeValue(b, buffer, view, o, key, valueType, value, indexCtx);
                    });
                }
            }
        });
    }
}

/**
 * Build a JIT function that serializes an object.
 * Signature: (buffer: Uint8Array, view: DataView, offset: number, data: any) => number
 */
function buildObjectSerializer(type: TypeObjectLiteral | TypeClass, ctx: BSONBuildState): SerializeFn {
    // Track root type in typeStack.
    // We don't throw for recursive types - they're valid (e.g., tree structures).
    // The depth tracking in nested serializers handles code generation limits.
    const trackingType = !ctx.isCircular(type);
    if (trackingType) {
        ctx.pushType(type);
    }

    try {
        return fn(
            arg<Uint8Array>('buffer'),
            arg<DataView>('view'),
            arg<number>('offset'),
            arg<any>('data'),
            (b: Builder, buffer: Ref<Uint8Array>, view: Ref<DataView>, offset: Ref<number>, data: Ref<any>) => {
                // Use mutable variable for offset
                const o = b.var_(offset, 'o');

                // Root object circular reference tracking:
                // Add the root object to the global seen set so nested circular
                // references back to root are detected.
                const isCircularType = hasCircularReference(type);
                const seen = isCircularType ? getCircularSet() : undefined;
                if (isCircularType) {
                    b.exec(b.call(circularEnter, data, b.lit(seen!)));
                }

                // Save start offset for backfilling document size
                const start = b.let(b.getVar(o), 'start');

                // Reserve 4 bytes for document size (write placeholder)
                // Inline: view.setInt32(offset, 0, true)
                b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(4)));

                // Get properties based on type kind
                const properties =
                    type.kind === ReflectionKind.class
                        ? type.types.filter((t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static)
                        : type.types.filter(
                              (t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature,
                          );

                // Get index signature if present
                const indexSignature = type.types.find(
                    (t): t is TypeIndexSignature => t.kind === ReflectionKind.indexSignature,
                );

                // Serialize properties using shared helper
                serializeObjectProperties(b, buffer, view, o, data, properties, indexSignature, ctx);

                // Write document terminator (0x00)
                b.set(buffer, b.getVar(o), b.lit(0));
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));

                // Backfill document size at start
                // Inline: view.setInt32(start, size, true)
                const size = b.sub(b.getVar(o), start);
                b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));

                // Remove root object from seen set
                if (isCircularType) {
                    b.exec(b.call(circularExit, data, b.lit(seen!)));
                }

                // Return final offset
                return b.getVar(o);
            },
        );
    } finally {
        // Remove from type stack after building
        if (trackingType) {
            ctx.popType(type);
        }
    }
}

/**
 * Serialize a value with the given name (property or array index).
 * Core dispatch function used by both object properties and array elements.
 */
function serializeValue(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: Type,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Check for special annotated string types first (UUID, MongoId)
    if (isUUIDType(type)) {
        serializeUUID(b, buffer, view, o, name, value);
        return;
    }
    if (isMongoIdType(type)) {
        serializeMongoId(b, buffer, view, o, name, value);
        return;
    }

    switch (type.kind) {
        case ReflectionKind.string:
            serializeString(b, buffer, view, o, name, value);
            break;
        case ReflectionKind.number:
            serializeNumber(b, buffer, view, o, name, type as TypeNumber, value);
            break;
        case ReflectionKind.boolean:
            serializeBoolean(b, buffer, view, o, name, value);
            break;
        case ReflectionKind.bigint: {
            const binaryBigInt = binaryBigIntAnnotation.getFirst(type);
            if (binaryBigInt !== undefined) {
                serializeBinaryBigIntValue(b, buffer, view, o, name, value, binaryBigInt === BinaryBigIntType.signed);
            } else {
                serializeBigInt(b, buffer, view, o, name, value);
            }
            break;
        }
        case ReflectionKind.null:
        case ReflectionKind.undefined:
            serializeNull(b, buffer, view, o, name);
            break;
        case ReflectionKind.class:
            serializeClass(b, buffer, view, o, name, type as TypeClass, value, ctx);
            break;
        case ReflectionKind.objectLiteral:
            serializeNestedObject(b, buffer, view, o, name, type as TypeObjectLiteral, value, ctx);
            break;
        case ReflectionKind.array:
            serializeArray(b, buffer, view, o, name, type as TypeArray, value, ctx);
            break;
        case ReflectionKind.regexp:
            serializeRegExp(b, buffer, view, o, name, type as TypeRegexp, value);
            break;
        case ReflectionKind.literal:
            serializeLiteral(b, buffer, view, o, name, type as TypeLiteral, value, ctx);
            break;
        case ReflectionKind.tuple:
            serializeTuple(b, buffer, view, o, name, type as TypeTuple, value, ctx);
            break;
        case ReflectionKind.enum:
            serializeEnum(b, buffer, view, o, name, type as TypeEnum, value, ctx);
            break;
        case ReflectionKind.union:
            serializeUnion(b, buffer, view, o, name, type as TypeUnion, value, ctx);
            break;
        case ReflectionKind.promise:
            // Unwrap promise type and serialize the inner type
            serializeValue(b, buffer, view, o, name, (type as TypePromise).type, value, ctx);
            break;
        case ReflectionKind.any:
        case ReflectionKind.unknown:
            // Runtime type detection for any/unknown
            serializeAny(b, buffer, view, o, name, value, ctx);
            break;
        default:
            throw new TypeNotSerializableError(ReflectionKind[type.kind]);
    }
}

/**
 * Serialize `any` or `unknown` type using a runtime function call.
 * Since we don't know the structure at compile time, we delegate to runtime.
 */
function serializeAny(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // For `any` type, we call a runtime helper that handles all type detection
    // This avoids infinite recursion at JIT build time
    // Convert name to runtime value: string becomes literal, Ref stays as-is
    const nameArg = typeof name === 'string' ? b.lit(name) : name;
    b.setVar(o, b.call(serializeAnyPropertyRuntime, buffer, view, b.getVar(o), nameArg, value));
}

/**
 * Runtime serialization of a property with `any` type.
 * Writes: type byte + name (cstring) + value
 * @internal
 *
 * @returns New offset after writing (unchanged if value is undefined)
 */
export function serializeAnyPropertyRuntime(
    buffer: Uint8Array,
    view: DataView,
    offset: number,
    name: string | number,
    value: any,
): number {
    // Skip undefined values (matches official BSON library behavior)
    if (value === undefined) {
        return offset;
    }

    if (value === null) {
        buffer[offset++] = BSONType.NULL;
        offset = writeName(buffer, offset, name);
        return offset;
    }

    const typeofValue = typeof value;

    if (typeofValue === 'string') {
        buffer[offset++] = BSONType.STRING;
        offset = writeName(buffer, offset, name);
        // Write string length + 1 (for null terminator)
        const strBytes = textEncoder.encode(value);
        view.setInt32(offset, strBytes.length + 1, true);
        offset += 4;
        buffer.set(strBytes, offset);
        offset += strBytes.length;
        buffer[offset++] = 0; // null terminator
        return offset;
    }

    if (typeofValue === 'number') {
        if (Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX) {
            buffer[offset++] = BSONType.INT;
            offset = writeName(buffer, offset, name);
            view.setInt32(offset, value, true);
            return offset + 4;
        } else {
            buffer[offset++] = BSONType.DOUBLE;
            offset = writeName(buffer, offset, name);
            view.setFloat64(offset, value, true);
            return offset + 8;
        }
    }

    if (typeofValue === 'boolean') {
        buffer[offset++] = BSONType.BOOLEAN;
        offset = writeName(buffer, offset, name);
        buffer[offset++] = value ? 1 : 0;
        return offset;
    }

    if (typeofValue === 'bigint') {
        buffer[offset++] = BSONType.LONG;
        offset = writeName(buffer, offset, name);
        view.setBigInt64(offset, value, true);
        return offset + 8;
    }

    // Object types
    if (value instanceof Date) {
        buffer[offset++] = BSONType.DATE;
        offset = writeName(buffer, offset, name);
        view.setBigInt64(offset, BigInt(value.getTime()), true);
        return offset + 8;
    }

    if (Array.isArray(value)) {
        buffer[offset++] = BSONType.ARRAY;
        offset = writeName(buffer, offset, name);
        return serializeAnyArrayRuntime(buffer, view, offset, value);
    }

    if (value instanceof RegExp) {
        buffer[offset++] = BSONType.REGEX;
        offset = writeName(buffer, offset, name);
        return writeRegExpData(buffer, offset, value);
    }

    // Plain object
    buffer[offset++] = BSONType.OBJECT;
    offset = writeName(buffer, offset, name);
    return serializeAnyObjectRuntime(buffer, view, offset, value);
}

/**
 * Write property name as cstring.
 */
function writeName(buffer: Uint8Array, offset: number, name: string | number): number {
    if (typeof name === 'number') {
        return writeIndexCString(buffer, offset, name);
    } else {
        offset = writeStringUTF8(buffer, offset, name);
        buffer[offset++] = 0; // null terminator
        return offset;
    }
}

/**
 * Runtime serialization of an array with `any` elements.
 */
function serializeAnyArrayRuntime(buffer: Uint8Array, view: DataView, offset: number, value: any[]): number {
    const start = offset;

    // Reserve 4 bytes for document size
    offset += 4;

    // Serialize each element with numeric index as key
    for (let i = 0; i < value.length; i++) {
        offset = serializeAnyPropertyRuntime(buffer, view, offset, i, value[i]);
    }

    // Write terminator
    buffer[offset++] = 0;

    // Backfill size
    view.setInt32(start, offset - start, true);

    return offset;
}

/**
 * Runtime serialization of an object with `any` properties.
 * @internal
 */
export function serializeAnyObjectRuntime(
    buffer: Uint8Array,
    view: DataView,
    offset: number,
    value: Record<string, any>,
): number {
    const start = offset;

    // Reserve 4 bytes for document size
    offset += 4;

    // Serialize each property
    for (const key of Object.keys(value)) {
        offset = serializeAnyPropertyRuntime(buffer, view, offset, key, value[key]);
    }

    // Write terminator
    buffer[offset++] = 0;

    // Backfill size
    view.setInt32(start, offset - start, true);

    return offset;
}

// PropertyName is now imported from context.ts

/**
 * Write a name as cstring using batched writes for compile-time known names.
 * This is the core name-writing logic shared by writeHeader variants.
 */
function writeNameJIT(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
): void {
    if (typeof name === 'string') {
        // Total name bytes = name length + null (1) = name.length + 1
        const totalNameBytes = name.length + 1;

        if (totalNameBytes <= 4) {
            // Short names: batch using setUint32 (write extra garbage that gets overwritten)
            // Pack: name[0] | (name[1] << 8) | (name[2] << 16) | (null << 24)
            let packed = 0;
            for (let i = 0; i < name.length; i++) {
                packed |= name.charCodeAt(i) << (i * 8);
            }
            // Null terminator in remaining byte(s)
            b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(packed), b.lit(true)));
            b.setVar(o, b.add(b.getVar(o), b.lit(totalNameBytes)));
        } else if (totalNameBytes <= 6) {
            // Medium names: individual byte writes
            for (let i = 0; i < name.length; i++) {
                b.set(buffer, b.getVar(o), b.lit(name.charCodeAt(i)));
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));
            }
            b.set(buffer, b.getVar(o), b.lit(0)); // null terminator
            b.setVar(o, b.add(b.getVar(o), b.lit(1)));
        } else {
            // Long names: batch into 8-byte writes using setBigInt64
            const nameBytes: number[] = [];
            for (let i = 0; i < name.length; i++) {
                nameBytes.push(name.charCodeAt(i));
            }
            nameBytes.push(0); // null terminator

            let i = 0;
            // Write 8 bytes at a time using setBigInt64
            while (i + 8 <= nameBytes.length) {
                const low =
                    BigInt(nameBytes[i]) |
                    (BigInt(nameBytes[i + 1]) << 8n) |
                    (BigInt(nameBytes[i + 2]) << 16n) |
                    (BigInt(nameBytes[i + 3]) << 24n);
                const high =
                    BigInt(nameBytes[i + 4]) |
                    (BigInt(nameBytes[i + 5]) << 8n) |
                    (BigInt(nameBytes[i + 6]) << 16n) |
                    (BigInt(nameBytes[i + 7]) << 24n);
                const i64 = low | (high << 32n);
                b.exec(b.method(view, 'setBigInt64', b.getVar(o), b.lit(i64), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                i += 8;
            }
            // Remaining 4-7 bytes: use setUint32
            if (i + 4 <= nameBytes.length) {
                const u32 =
                    nameBytes[i] | (nameBytes[i + 1] << 8) | (nameBytes[i + 2] << 16) | (nameBytes[i + 3] << 24);
                b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(u32), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                i += 4;
            }
            // Remaining 1-3 bytes
            const remaining = nameBytes.length - i;
            if (remaining > 0) {
                const u32 =
                    (nameBytes[i] || 0) |
                    ((nameBytes[i + 1] || 0) << 8) |
                    ((nameBytes[i + 2] || 0) << 16) |
                    ((nameBytes[i + 3] || 0) << 24);
                b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(u32), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(remaining)));
            }
        }
    } else {
        // Runtime name: Ref<number> (array index) or Ref<string> (index signature)
        b.setVar(o, b.call<number>(writeNameCString, buffer, b.getVar(o), name));
    }
}

/**
 * Write property header (type byte + name cstring).
 * Handles all three name types:
 * - string: batched u32 writes for compile-time known names
 * - Ref<number>: optimized index cstring for array elements
 * - Ref<string>: UTF-8 cstring for index signatures
 *
 * @param followedByFixedValue - When true and name is short (<=2 chars), pack type+name into single setUint32
 */
function writeHeader(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    typeCode: number,
    name: PropertyName,
    followedByFixedValue: boolean = false,
): void {
    if (typeof name === 'string') {
        // Total bytes = type (1) + name length + null (1) = name.length + 2
        const totalBytes = name.length + 2;

        if (totalBytes <= 4 && followedByFixedValue) {
            // Optimization: when followed by a fixed-size value (setInt32, setFloat64, etc.),
            // we can use setUint32 for the header. If totalBytes < 4, the extra garbage byte(s)
            // will be overwritten by the next DataView write. This is 26-66% faster than individual bytes.
            // Pack header: type | (name[0] << 8) | (name[1] << 16) | (null << 24)
            let packed = typeCode;
            for (let i = 0; i < name.length; i++) {
                packed |= name.charCodeAt(i) << ((i + 1) * 8);
            }
            // Null terminator in remaining byte(s) - packed will have 0s in upper bytes
            b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(packed), b.lit(true)));
            b.setVar(o, b.add(b.getVar(o), b.lit(totalBytes)));
        } else if (totalBytes <= 6) {
            // Short names without fixed value following: individual byte writes
            b.set(buffer, b.getVar(o), b.lit(typeCode));
            b.setVar(o, b.add(b.getVar(o), b.lit(1)));
            writeNameJIT(b, buffer, view, o, name);
        } else {
            // Long names: batch type + name into 8-byte writes using setBigInt64
            const bytes = [typeCode];
            for (let i = 0; i < name.length; i++) {
                bytes.push(name.charCodeAt(i));
            }
            bytes.push(0); // null terminator

            let i = 0;
            // Write 8 bytes at a time using setBigInt64
            while (i + 8 <= bytes.length) {
                const low =
                    BigInt(bytes[i]) |
                    (BigInt(bytes[i + 1]) << 8n) |
                    (BigInt(bytes[i + 2]) << 16n) |
                    (BigInt(bytes[i + 3]) << 24n);
                const high =
                    BigInt(bytes[i + 4]) |
                    (BigInt(bytes[i + 5]) << 8n) |
                    (BigInt(bytes[i + 6]) << 16n) |
                    (BigInt(bytes[i + 7]) << 24n);
                const i64 = low | (high << 32n);
                b.exec(b.method(view, 'setBigInt64', b.getVar(o), b.lit(i64), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                i += 8;
            }
            // Remaining 4-7 bytes: use setUint32
            if (i + 4 <= bytes.length) {
                const u32 = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
                b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(u32), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                i += 4;
            }
            // Remaining 1-3 bytes
            const remaining = bytes.length - i;
            if (remaining > 0) {
                const u32 =
                    (bytes[i] || 0) |
                    ((bytes[i + 1] || 0) << 8) |
                    ((bytes[i + 2] || 0) << 16) |
                    ((bytes[i + 3] || 0) << 24);
                b.exec(b.method(view, 'setUint32', b.getVar(o), b.lit(u32), b.lit(true)));
                b.setVar(o, b.add(b.getVar(o), b.lit(remaining)));
            }
        }
    } else {
        // Runtime name: write type byte first, then name via helper
        b.set(buffer, b.getVar(o), b.lit(typeCode));
        b.setVar(o, b.add(b.getVar(o), b.lit(1)));
        writeNameJIT(b, buffer, view, o, name);
    }
}

/**
 * Write name-only header (reserves type byte position for backfill).
 * Used by serializeNumber which determines type at runtime.
 * Returns the type byte position for backfilling.
 */
function writeHeaderWithTypeBackfill(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
): Ref<number> {
    // Reserve type byte position
    const typePos = b.let(b.getVar(o), 'typePos');
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Write name using shared helper
    writeNameJIT(b, buffer, view, o, name);

    return typePos;
}

/**
 * Write a name as cstring. Handles both numeric indices and string keys.
 * For numeric indices (0-999), uses optimized fast path.
 * For strings, writes UTF-8 encoded bytes.
 * @internal
 */
export function writeNameCString(buffer: Uint8Array, offset: number, name: number | string): number {
    if (typeof name === 'number') {
        return writeIndexCString(buffer, offset, name);
    }
    // String key: write UTF-8 + null terminator
    offset = writeStringUTF8(buffer, offset, name);
    buffer[offset++] = 0;
    return offset;
}

/**
 * Write the body of a BSON string (length + UTF-8 bytes + null terminator).
 * Used after the header (type byte + name) has already been written.
 * This helper is reused for string values, enum strings, and mixed literals.
 */
function serializeStringBody(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    value: Ref<string>,
): void {
    // Write string value: length (int32) + bytes + null terminator
    const lengthPos = b.let(b.getVar(o), 'strLenPos');
    b.setVar(o, b.add(b.getVar(o), b.lit(4))); // Skip 4 bytes for length

    const stringStart = b.let(b.getVar(o), 'strStart');
    b.setVar(o, b.call<number>(writeStringUTF8, buffer, b.getVar(o), value));

    // Write null terminator
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill string length (includes null terminator)
    const stringLen = b.sub(b.getVar(o), stringStart);
    b.exec(b.method(view, 'setInt32', lengthPos, stringLen, b.lit(true)));
}

/**
 * Serialize a string property.
 * Uses helper function for UTF-8 encoding (benchmarks show 20-50% faster than inline).
 */
function serializeString(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<string>,
): void {
    writeHeader(b, buffer, view, o, BSONType.STRING, name);
    serializeStringBody(b, buffer, view, o, value);
}

/**
 * Serialize a number property.
 *
 * Fast paths (no runtime check, ~2x faster):
 * - integer, int8, int16, int32, uint8, uint16 → BSON int32
 * - float, float32, float64, uint32 → BSON double
 *
 * Compatible path (with runtime check):
 * - plain number → check isInt32, use INT or DOUBLE accordingly
 */
function serializeNumber(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeNumber,
    value: Ref<number>,
): void {
    const brand = type.brand;

    // Fast path: explicitly typed integers → BSON int32
    if (brand !== undefined && brand >= TypeNumberBrand.integer && brand <= TypeNumberBrand.uint16) {
        serializeInt32(b, buffer, view, o, name, value);
        return;
    }

    // Fast path: explicitly typed floats or uint32 → BSON double
    if (brand !== undefined && (brand >= TypeNumberBrand.uint32 || brand === TypeNumberBrand.float)) {
        serializeDouble(b, buffer, view, o, name, value);
        return;
    }

    // Compatible path: plain number → inline int32 check
    // Write the name cstring once, then branch only on type byte + value.
    const typePos = writeHeaderWithTypeBackfill(b, buffer, view, o, name);

    // (value | 0) === value is the fastest way to check if a number is int32
    b.if_(
        b.eq(b.bitOr(value, b.lit(0)), value),
        () => {
            b.set(buffer, typePos, b.lit(BSONType.INT));
            b.exec(b.method(view, 'setInt32', b.getVar(o), value, b.lit(true)));
            b.setVar(o, b.add(b.getVar(o), b.lit(4)));
        },
        () => {
            b.set(buffer, typePos, b.lit(BSONType.DOUBLE));
            b.exec(b.method(view, 'setFloat64', b.getVar(o), value, b.lit(true)));
            b.setVar(o, b.add(b.getVar(o), b.lit(8)));
        },
    );
}

/**
 * Serialize as BSON int32 (fast path, no runtime check).
 * BSON int32: type (0x10) + name (cstring) + value (4 bytes, little-endian)
 */
function serializeInt32(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<number>,
): void {
    writeHeader(b, buffer, view, o, BSONType.INT, name, true); // followed by setInt32
    b.exec(b.method(view, 'setInt32', b.getVar(o), value, b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));
}

/**
 * Serialize as BSON double (fast path, no runtime check).
 * BSON double: type (0x01) + name (cstring) + value (8 bytes, little-endian float64)
 */
function serializeDouble(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<number>,
): void {
    writeHeader(b, buffer, view, o, BSONType.DOUBLE, name, true); // followed by setFloat64
    b.exec(b.method(view, 'setFloat64', b.getVar(o), value, b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(8)));
}

/**
 * Serialize a boolean property.
 * BSON boolean: type (1) + name (cstring) + value (1 byte: 0x00 or 0x01)
 */
function serializeBoolean(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<boolean>,
): void {
    writeHeader(b, buffer, view, o, BSONType.BOOLEAN, name, true); // followed by fixed 1-byte value
    b.set(buffer, b.getVar(o), b.ternary(value, b.lit(1), b.lit(0)));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));
}

/**
 * Serialize a bigint property as BSON int64.
 * BSON int64: type (1) + name (cstring) + value (8 bytes, little-endian)
 */
function serializeBigInt(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<bigint>,
): void {
    writeHeader(b, buffer, view, o, BSONType.LONG, name, true); // followed by setBigInt64
    b.exec(b.method(view, 'setBigInt64', b.getVar(o), value, b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(8)));
}

/**
 * Write a BinaryBigInt value as BSON BINARY (unsigned).
 * Format: 4-byte size + 1-byte subtype (0x00) + N-byte big-endian hex data.
 */
function writeBinaryBigInt(buffer: Uint8Array, view: DataView, offset: number, value: bigint): number {
    let hex = value.toString(16);
    if (hex[0] === '-') hex = hex.slice(1);
    if (hex === '0') {
        view.setInt32(offset, 0, true);
        offset += 4;
        buffer[offset++] = BSON_BINARY_SUBTYPE_DEFAULT;
        return offset;
    }
    if (hex.length % 2) hex = '0' + hex;
    const size = hex.length / 2;
    view.setInt32(offset, size, true);
    offset += 4;
    buffer[offset++] = BSON_BINARY_SUBTYPE_DEFAULT;
    for (let i = 0; i < size; i++) {
        buffer[offset + i] = (hexTable[hex.charCodeAt(i * 2)] << 4) | hexTable[hex.charCodeAt(i * 2 + 1)];
    }
    return offset + size;
}

/**
 * Write a SignedBinaryBigInt value as BSON BINARY.
 * Format: 4-byte size + 1-byte subtype (0x00) + 1-byte signum (0x00=positive, 0xFF=negative) + N-byte big-endian hex data.
 */
function writeSignedBinaryBigInt(buffer: Uint8Array, view: DataView, offset: number, value: bigint): number {
    let hex = value.toString(16);
    let negative = false;
    if (hex[0] === '-') {
        negative = true;
        hex = hex.slice(1);
    }
    if (hex === '0') {
        view.setInt32(offset, 0, true);
        offset += 4;
        buffer[offset++] = BSON_BINARY_SUBTYPE_DEFAULT;
        return offset;
    }
    if (hex.length % 2) hex = '0' + hex;
    const dataSize = hex.length / 2;
    view.setInt32(offset, 1 + dataSize, true); // signum byte + data
    offset += 4;
    buffer[offset++] = BSON_BINARY_SUBTYPE_DEFAULT;
    buffer[offset++] = negative ? 255 : 0;
    for (let i = 0; i < dataSize; i++) {
        buffer[offset + i] = (hexTable[hex.charCodeAt(i * 2)] << 4) | hexTable[hex.charCodeAt(i * 2 + 1)];
    }
    return offset + dataSize;
}

/**
 * Serialize a bigint property as BSON BINARY for BinaryBigInt/SignedBinaryBigInt types.
 */
function serializeBinaryBigIntValue(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<bigint>,
    signed: boolean,
): void {
    writeHeader(b, buffer, view, o, BSONType.BINARY, name);
    const writer = signed ? writeSignedBinaryBigInt : writeBinaryBigInt;
    b.setVar(o, b.call(writer, buffer, view, b.getVar(o), value));
}

/**
 * Serialize a null property.
 * BSON null: type (1) + name (cstring) - no value bytes
 */
function serializeNull(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
): void {
    writeHeader(b, buffer, view, o, BSONType.NULL, name);
}

/**
 * Serialize a class type property.
 * Supports: Date, Uint8Array, Map, Set, and custom classes.
 */
function serializeClass(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeClass,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    if (type.classType === Date) {
        serializeDate(b, buffer, view, o, name, value);
        return;
    }
    // Fast path: Uint8Array is fully inlined (no extern call - 50x faster)
    if (type.classType === Uint8Array) {
        serializeUint8Array(b, buffer, view, o, name, value);
        return;
    }
    if (binaryTypes.includes(type.classType)) {
        serializeBinary(b, buffer, view, o, name, value);
        return;
    }
    if (type.classType === Map) {
        serializeMap(b, buffer, view, o, name, type, value, ctx);
        return;
    }
    if (type.classType === Set) {
        serializeSet(b, buffer, view, o, name, type, value, ctx);
        return;
    }
    // Reference type: serialize only the primary key
    if (isReferenceType(type)) {
        serializeReference(b, buffer, view, o, name, type, value, ctx);
        return;
    }
    // Custom class: serialize like objectLiteral using type's properties
    serializeCustomClass(b, buffer, view, o, name, type, value, ctx);
}

/**
 * Serialize a reference type (FK relationship).
 * References are serialized as just their primary key value.
 */
function serializeReference(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeClass,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    const clazz = ReflectionClass.from(type.classType);
    const pkProperty = clazz.getPrimary();

    if (!pkProperty) {
        // No primary key - fall back to full serialization
        serializeCustomClass(b, buffer, view, o, name, type, value, ctx);
        return;
    }

    const pkName = pkProperty.getName();
    const pkType = pkProperty.type;

    // Get the primary key value from the reference
    const pkValue = value.get(pkName);

    // Serialize only the primary key
    serializeValue(b, buffer, view, o, name, pkType, pkValue, ctx);
}

/**
 * Serialize a Date property as BSON date.
 * BSON date: type (0x09) + name (cstring) + value (8 bytes, int64 ms since epoch)
 * Fully inlined for maximum performance - no function calls.
 */
function serializeDate(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<Date>,
): void {
    writeHeader(b, buffer, view, o, BSONType.DATE, name, true); // followed by setUint32

    // Get milliseconds timestamp
    const ms = b.let(b.method(value, 'getTime'), 'ms');

    // Write as two 32-bit integers (little-endian) to avoid BigInt allocation
    // Low 32 bits: ms >>> 0
    b.exec(b.method(view, 'setUint32', b.getVar(o), b.ushr(ms, b.lit(0)), b.lit(true)));
    // High 32 bits: Math.floor(ms / 0x100000000)
    // Note: Must use Math.floor (not |0) for correct handling of negative timestamps (pre-1970)
    b.exec(
        b.method(
            view,
            'setInt32',
            b.add(b.getVar(o), b.lit(4)),
            b.call<number>(Math.floor, b.div(ms, b.lit(0x100000000))),
            b.lit(true),
        ),
    );
    b.setVar(o, b.add(b.getVar(o), b.lit(8)));
}

/**
 * Serialize a UUID property as BSON binary.
 * BSON binary: type (0x05) + name (cstring) + length (4 bytes) + subtype (1 byte) + data (16 bytes)
 */
function serializeUUID(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<string>,
): void {
    writeHeader(b, buffer, view, o, BSONType.BINARY, name, true); // followed by setInt32

    // Write binary length (16 bytes for UUID)
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(UUID_BYTE_LENGTH), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // Write binary subtype (0x04 for UUID)
    b.set(buffer, b.getVar(o), b.lit(BSON_BINARY_SUBTYPE_UUID));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Write 16 bytes using branchless lookup table helper
    b.setVar(o, b.call<number>(writeUUIDBranchless, buffer, b.getVar(o), value));
}

/**
 * Serialize a MongoId property as BSON ObjectId.
 * BSON ObjectId: type (0x07) + name (cstring) + value (12 bytes)
 */
function serializeMongoId(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<string>,
): void {
    writeHeader(b, buffer, view, o, BSONType.OID, name);
    b.setVar(o, b.call<number>(writeObjectIdBranchless, buffer, b.getVar(o), value));
}

/**
 * Write ObjectId hex string as 12 bytes using branchless lookup table.
 *
 * Uses a loop: V8 TurboFan optimizes loop-indexed array access better than
 * unrolled code with many index expressions. The loop also has smaller code
 * size, avoiding icache pressure.
 * @internal
 */
export function writeObjectIdBranchless(buffer: Uint8Array, offset: number, oid: string): number {
    if (oid.length !== 24)
        throw new BSONError(`Invalid ObjectId hex string: expected 24 characters, got ${oid.length}`, 'DK-B070');
    for (let i = 0; i < 12; i++) {
        buffer[offset + i] = (hexTable[oid.charCodeAt(i * 2)] << 4) | hexTable[oid.charCodeAt(i * 2 + 1)];
    }
    return offset + 12;
}

/**
 * Write UUID hex string (with dashes) as 16 bytes using branchless lookup table.
 * Loop for same optimization reasons as writeObjectIdBranchless.
 * @internal
 */
const uuidPositions = [0, 2, 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 28, 30, 32, 34];
export function writeUUIDBranchless(buffer: Uint8Array, offset: number, uuid: string): number {
    if (uuid.length !== 36)
        throw new BSONError(`Invalid UUID string: expected 36 characters, got ${uuid.length}`, 'DK-B070');
    for (let i = 0; i < 16; i++) {
        const p = uuidPositions[i];
        buffer[offset + i] = (hexTable[uuid.charCodeAt(p)] << 4) | hexTable[uuid.charCodeAt(p + 1)];
    }
    return offset + 16;
}

/**
 * Serialize a Uint8Array property - fully inlined for maximum performance.
 * BSON binary: type (0x05) + name (cstring) + length (4 bytes) + subtype (1 byte) + data
 *
 * Inlining avoids extern function call overhead which costs ~50x performance.
 */
function serializeUint8Array(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<Uint8Array>,
): void {
    writeHeader(b, buffer, view, o, BSONType.BINARY, name, true); // followed by setInt32

    // Get length once
    const len = b.let(b.get(value, 'length'), 'len');

    // Write length (int32)
    b.exec(b.method(view, 'setInt32', b.getVar(o), len, b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // Write subtype (0x00 for generic binary)
    b.set(buffer, b.getVar(o), b.lit(BSON_BINARY_SUBTYPE_DEFAULT));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Copy data: buffer.set(value, offset)
    b.exec(b.method(buffer, 'set', value, b.getVar(o)));
    b.setVar(o, b.add(b.getVar(o), len));
}

/**
 * Serialize a binary property (ArrayBuffer, other TypedArrays).
 * Uses helper function for type detection.
 * BSON binary: type (0x05) + name (cstring) + length (4 bytes) + subtype (1 byte) + data
 */
function serializeBinary(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    value: Ref<ArrayBufferView | ArrayBuffer>,
): void {
    writeHeader(b, buffer, view, o, BSONType.BINARY, name);
    b.setVar(o, b.call<number>(writeBinaryData, buffer, view, b.getVar(o), value));
}

/**
 * Write binary data to buffer.
 * Optimized to avoid creating intermediate views when possible.
 * @internal
 */
export function writeBinaryData(
    buffer: Uint8Array,
    view: DataView,
    offset: number,
    data: ArrayBufferView | ArrayBuffer,
): number {
    // Get byte length and source
    let byteLength: number;
    let source: Uint8Array;

    if (data instanceof Uint8Array) {
        // Fast path: Uint8Array can be used directly
        byteLength = data.length;
        source = data;
    } else if (data instanceof ArrayBuffer) {
        byteLength = data.byteLength;
        source = new Uint8Array(data);
    } else {
        // TypedArray - need to create view
        byteLength = data.byteLength;
        source = new Uint8Array(data.buffer, data.byteOffset, byteLength);
    }

    // Write length (int32)
    view.setInt32(offset, byteLength, true);
    offset += 4;

    // Write subtype (0x00 for generic binary)
    buffer[offset++] = BSON_BINARY_SUBTYPE_DEFAULT;

    // Copy data
    buffer.set(source, offset);
    return offset + byteLength;
}

/**
 * Serialize a RegExp property.
 * BSON regex: type (0x0B) + name (cstring) + pattern (cstring) + options (cstring)
 * Options must be alphabetically sorted: i, m, s, u, x
 */
function serializeRegExp(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeRegexp,
    value: Ref<RegExp>,
): void {
    writeHeader(b, buffer, view, o, BSONType.REGEX, name);
    b.setVar(o, b.call<number>(writeRegExpData, buffer, b.getVar(o), value));
}

/**
 * Cache for extracted recursive serializers at module level.
 * This ensures each recursive type gets exactly one serializer function.
 */
const extractedSerializerCache = new WeakMap<Type, SerializeFn>();

/**
 * Runtime circular reference tracking.
 * Uses a single global Set<object> for cycle detection across all types.
 * This correctly handles cross-type cycles like User→Image→User.
 */
let globalCircularSet: Set<object> | undefined;

function getCircularSet(): Set<object> {
    if (!globalCircularSet) {
        globalCircularSet = new Set();
    }
    return globalCircularSet;
}

/**
 * Runtime helper: enter circular reference tracking.
 * Returns false if the value is already being serialized (circular reference).
 */
function circularEnter(value: any, seen: Set<object>): boolean {
    if (value !== null && typeof value === 'object') {
        if (seen.has(value)) return false;
        seen.add(value);
    }
    return true;
}

/**
 * Runtime helper: exit circular reference tracking.
 */
function circularExit(value: any, seen: Set<object>): void {
    if (value !== null && typeof value === 'object') {
        seen.delete(value);
    }
}

/**
 * Get or build an extracted serializer for a recursive type.
 * Uses a wrapper function set in the cache BEFORE building to handle
 * self-referential types (the wrapper captures the real function once built).
 */
function getExtractedSerializer(type: TypeObjectLiteral | TypeClass): SerializeFn {
    const existing = extractedSerializerCache.get(type);
    if (existing) {
        return existing;
    }

    // Create a holder for the real serializer function.
    // The wrapper is set in the cache immediately so recursive calls find it.
    const holder: { fn: SerializeFn | undefined } = { fn: undefined };
    const wrapper: SerializeFn = (buffer, view, offset, data) => holder.fn!(buffer, view, offset, data);
    extractedSerializerCache.set(type, wrapper);

    // Build the real serializer function
    holder.fn = fn(
        arg<Uint8Array>('buffer'),
        arg<DataView>('view'),
        arg<number>('offset'),
        arg<any>('data'),
        (ib: Builder, ibuffer: Ref<Uint8Array>, iview: Ref<DataView>, ioffset: Ref<number>, idata: Ref<any>) => {
            const io = ib.var_(ioffset, 'o');
            const start = ib.let(ib.getVar(io), 'start');

            // Reserve 4 bytes for document size
            ib.exec(ib.method(iview, 'setInt32', ib.getVar(io), ib.lit(0), ib.lit(true)));
            ib.setVar(io, ib.add(ib.getVar(io), ib.lit(4)));

            // Create fresh context for inner serialization, but mark the current
            // type as being processed so recursive references are detected.
            const innerCtx = new BSONBuildState();
            innerCtx.pushType(type);

            // Get properties based on type kind
            const properties =
                type.kind === ReflectionKind.class
                    ? type.types.filter((t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static)
                    : type.types.filter((t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature);

            const indexSignature = type.types.find(
                (t): t is TypeIndexSignature => t.kind === ReflectionKind.indexSignature,
            );

            // Serialize properties using shared helper
            serializeObjectProperties(ib, ibuffer, iview, io, idata, properties, indexSignature, innerCtx);

            // Write terminator and backfill size
            ib.set(ibuffer, ib.getVar(io), ib.lit(0));
            ib.setVar(io, ib.add(ib.getVar(io), ib.lit(1)));
            const size = ib.sub(ib.getVar(io), start);
            ib.exec(ib.method(iview, 'setInt32', start, size, ib.lit(true)));

            return ib.getVar(io);
        },
    );

    // Return the wrapper (holder.fn is now set, so wrapper will delegate to it)
    return wrapper;
}

/**
 * Build an extracted serializer call for a recursive type.
 * Uses a pre-built serializer function from the cache.
 */
function buildExtractedSerializerCall(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    type: TypeObjectLiteral | TypeClass,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Get the pre-built serializer for this recursive type
    const extractedSerializer = getExtractedSerializer(type);

    // Emit call to the extracted function
    b.setVar(o, b.call<number>(extractedSerializer, buffer, view, b.getVar(o), value));
}

/**
 * Serialize a nested object property.
 * BSON embedded document: type (0x03) + name (cstring) + document
 * The nested structure is fully inlined in JIT — no recursion at runtime.
 */
function serializeNestedObject(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeObjectLiteral,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Check if we should extract to a separate function:
    // - Circular reference (type already in stack)
    // - Depth exceeded (prevent code bloat)
    if (ctx.shouldExtract(type) || hasCircularReference(type)) {
        if (hasCircularReference(type)) {
            // Runtime cycle detection: skip if this object is already being serialized.
            // Use hasCircularReference (not isCircular) to catch circular refs through
            // arrays and cross-type cycles (e.g. User→Image[]→User) that may not
            // appear directly in the build-time typeStack.
            const seen = getCircularSet();
            b.if_(b.call(circularEnter, value, b.lit(seen)), () => {
                writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);
                buildExtractedSerializerCall(b, buffer, view, o, type, value, ctx);
                b.exec(b.call(circularExit, value, b.lit(seen)));
            });
        } else {
            writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);
            buildExtractedSerializerCall(b, buffer, view, o, type, value, ctx);
        }
        return;
    }

    // Track this type to detect recursion
    ctx.pushType(type);

    try {
        writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true); // followed by setInt32

        // Save start offset for backfilling document size
        const start = b.let(b.getVar(o), 'nestedStart');

        // Reserve 4 bytes for document size
        b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
        b.setVar(o, b.add(b.getVar(o), b.lit(4)));

        // Get fixed properties from nested type
        const properties = type.types.filter(
            (t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature,
        );

        // Get index signature if present
        const indexSignature = type.types.find(
            (t): t is TypeIndexSignature => t.kind === ReflectionKind.indexSignature,
        );

        // Serialize properties using shared helper
        serializeObjectProperties(b, buffer, view, o, value, properties, indexSignature, ctx);

        // Write document terminator (0x00)
        b.set(buffer, b.getVar(o), b.lit(0));
        b.setVar(o, b.add(b.getVar(o), b.lit(1)));

        // Backfill document size
        const size = b.sub(b.getVar(o), start);
        b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
    } finally {
        ctx.popType(type);
    }
}

/**
 * Serialize an array property.
 * BSON array: type (0x04) + name (cstring) + document (with "0", "1", ... keys)
 */
function serializeArray(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeArray,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    writeHeader(b, buffer, view, o, BSONType.ARRAY, name, true); // followed by setInt32

    // Save start offset for backfilling document size
    const start = b.let(b.getVar(o), 'arrStart');

    // Reserve 4 bytes for document size
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    const elemType = type.type;
    const elemCtx = ctx.forIndex('i');

    // Loop over array elements - pass idx as Ref<number> (runtime name)
    b.loop(value, (elem, idx) => {
        serializeValue(b, buffer, view, o, idx, elemType, elem, elemCtx);
    });

    // Write document terminator (0x00)
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill document size
    const size = b.sub(b.getVar(o), start);
    b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
}

/**
 * Write array index as cstring (number → ASCII digits + null terminator).
 * Fast path for indices 0-999 avoids string conversion.
 * @internal
 */
export function writeIndexCString(buffer: Uint8Array, offset: number, idx: number): number {
    if (idx < 10) {
        buffer[offset] = 48 + idx;
        buffer[offset + 1] = 0;
        return offset + 2;
    }
    if (idx < 100) {
        buffer[offset] = 48 + ((idx / 10) | 0);
        buffer[offset + 1] = 48 + (idx % 10);
        buffer[offset + 2] = 0;
        return offset + 3;
    }
    if (idx < 1000) {
        buffer[offset] = 48 + ((idx / 100) | 0);
        buffer[offset + 1] = 48 + (((idx / 10) | 0) % 10);
        buffer[offset + 2] = 48 + (idx % 10);
        buffer[offset + 3] = 0;
        return offset + 4;
    }
    // General path
    const str = '' + idx;
    for (let i = 0; i < str.length; i++) {
        buffer[offset++] = str.charCodeAt(i);
    }
    buffer[offset++] = 0;
    return offset;
}

/**
 * Serialize a Map based on key type:
 * - Map<string, V> → BSON object {key1: v1, key2: v2, ...}
 * - Map<number, V> → BSON object {"0": v1, "1": v2, ...}
 * - Other key types → BSON array of tuples [[k1, v1], [k2, v2], ...]
 */
function serializeMap(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeClass,
    value: Ref<Map<any, any>>,
    ctx: BSONBuildState,
): void {
    // Get key and value types from Map's type arguments
    const keyType = type.arguments?.[0];
    const valueType = type.arguments?.[1];

    if (!keyType || !valueType) {
        throw new BSONError('Map type must have key and value type arguments', 'DK-B060');
    }

    // Check if key type is string or number (can use BSON object)
    const isObjectKey = keyType.kind === ReflectionKind.string || keyType.kind === ReflectionKind.number;

    if (isObjectKey) {
        serializeMapAsObject(b, buffer, view, o, name, keyType, valueType, value, ctx);
    } else {
        serializeMapAsTuples(b, buffer, view, o, name, keyType, valueType, value, ctx);
    }
}

/**
 * Serialize Map as BSON object (for string/number keys).
 * Iterates directly over Map entries without Array.from allocation.
 */
function serializeMapAsObject(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    keyType: Type,
    valueType: Type,
    value: Ref<Map<any, any>>,
    ctx: BSONBuildState,
): void {
    writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);

    // Save start offset for backfilling document size
    const start = b.let(b.getVar(o), 'mapStart');

    // Reserve 4 bytes for document size
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    const valueCtx = ctx.forIndex('mapValue');

    // Iterate directly over Map entries (no Array.from allocation)
    b.forOf(
        value as Ref<Map<any, any>>,
        (key, val) => {
            // Convert key to string for property name
            const keyStr = keyType.kind === ReflectionKind.number ? b.add(b.lit(''), key) : key;

            // Serialize with key as property name (runtime string)
            serializeValue(b, buffer, view, o, keyStr, valueType, val, valueCtx);
        },
        'mapKey',
        'mapVal',
    );

    // Write document terminator (0x00)
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill document size
    const size = b.sub(b.getVar(o), start);
    b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
}

/**
 * Serialize Map as BSON array of [key, value] tuples (for complex keys).
 * Iterates directly over Map entries without Array.from allocation.
 */
function serializeMapAsTuples(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    keyType: Type,
    valueType: Type,
    value: Ref<Map<any, any>>,
    ctx: BSONBuildState,
): void {
    writeHeader(b, buffer, view, o, BSONType.ARRAY, name, true);

    // Save start offset for backfilling document size
    const start = b.let(b.getVar(o), 'mapStart');

    // Reserve 4 bytes for document size
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // Manual index counter for BSON array keys
    const idx = b.var_(b.lit(0), 'tupleIdx');

    const keyCtx = ctx.forIndex('tupleKey');
    const valueCtx = ctx.forIndex('tupleValue');

    // Iterate directly over Map entries (no Array.from allocation)
    b.forOf(
        value as Ref<Map<any, any>>,
        (key, val) => {
            // Each entry is a [key, value] tuple, serialize as BSON array
            writeHeader(b, buffer, view, o, BSONType.ARRAY, b.getVar(idx), true);

            // Save start for tuple document
            const tupleStart = b.let(b.getVar(o), 'tupleStart');
            b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
            b.setVar(o, b.add(b.getVar(o), b.lit(4)));

            // Serialize key at index "0"
            serializeValue(b, buffer, view, o, b.lit(0), keyType, key, keyCtx);

            // Serialize value at index "1"
            serializeValue(b, buffer, view, o, b.lit(1), valueType, val, valueCtx);

            // Write tuple terminator and backfill size
            b.set(buffer, b.getVar(o), b.lit(0));
            b.setVar(o, b.add(b.getVar(o), b.lit(1)));
            const tupleSize = b.sub(b.getVar(o), tupleStart);
            b.exec(b.method(view, 'setInt32', tupleStart, tupleSize, b.lit(true)));

            // Increment index
            b.setVar(idx, b.add(b.getVar(idx), b.lit(1)));
        },
        'mapKey',
        'mapVal',
    );

    // Write document terminator (0x00)
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill document size
    const size = b.sub(b.getVar(o), start);
    b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
}

/**
 * Serialize a Set as BSON array.
 * Set<T> → [v1, v2, v3, ...]
 * Iterates directly over Set values without Array.from allocation.
 */
function serializeSet(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeClass,
    value: Ref<Set<any>>,
    ctx: BSONBuildState,
): void {
    writeHeader(b, buffer, view, o, BSONType.ARRAY, name, true);

    // Save start offset for backfilling document size
    const start = b.let(b.getVar(o), 'setStart');

    // Reserve 4 bytes for document size
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // Get element type from Set's type arguments
    const elemType = type.arguments?.[0];

    if (!elemType) {
        throw new BSONError('Set type must have element type argument', 'DK-B060');
    }

    // Manual index counter for BSON array keys
    const idx = b.var_(b.lit(0), 'setIdx');
    const elemCtx = ctx.forIndex('setElem');

    // Iterate directly over Set values (no Array.from allocation)
    b.forOf(
        value as Ref<Iterable<any>>,
        elem => {
            serializeValue(b, buffer, view, o, b.getVar(idx), elemType, elem, elemCtx);
            b.setVar(idx, b.add(b.getVar(idx), b.lit(1)));
        },
        'setElem',
    );

    // Write document terminator (0x00)
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill document size
    const size = b.sub(b.getVar(o), start);
    b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
}

/**
 * Serialize a custom class as BSON embedded document.
 * Uses the class's type properties (same as objectLiteral).
 */
function serializeCustomClass(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeClass,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Check if we should extract to a separate function:
    // - Circular reference (type already in stack)
    // - Depth exceeded (prevent code bloat)
    if (ctx.shouldExtract(type) || hasCircularReference(type)) {
        if (hasCircularReference(type)) {
            const seen = getCircularSet();
            b.if_(b.call(circularEnter, value, b.lit(seen)), () => {
                writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);
                buildExtractedSerializerCall(b, buffer, view, o, type, value, ctx);
                b.exec(b.call(circularExit, value, b.lit(seen)));
            });
        } else {
            writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);
            buildExtractedSerializerCall(b, buffer, view, o, type, value, ctx);
        }
        return;
    }

    // Track this type to detect recursion
    ctx.pushType(type);

    try {
        writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);

        // Save start offset for backfilling document size
        const start = b.let(b.getVar(o), 'classStart');

        // Reserve 4 bytes for document size
        b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
        b.setVar(o, b.add(b.getVar(o), b.lit(4)));

        // Get properties from class type (TypeProperty, not TypePropertySignature)
        const properties = type.types.filter((t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static);

        // Serialize properties using shared helper (classes don't have index signatures)
        serializeObjectProperties(b, buffer, view, o, value, properties, undefined, ctx);

        // Write document terminator (0x00)
        b.set(buffer, b.getVar(o), b.lit(0));
        b.setVar(o, b.add(b.getVar(o), b.lit(1)));

        // Backfill document size
        const size = b.sub(b.getVar(o), start);
        b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
    } finally {
        ctx.popType(type);
    }
}

/**
 * Write RegExp pattern and options to buffer.
 *
 * Note: For compatibility with the official bson-js library, we map JavaScript's
 * 'g' (global) flag to 's' in BSON. The dotAll flag ('s') is NOT preserved.
 * This matches the official library's behavior, even though it's semantically confusing.
 * @internal
 */
export function writeRegExpData(buffer: Uint8Array, offset: number, regex: RegExp): number {
    // Write pattern as cstring
    offset = writeStringUTF8(buffer, offset, regex.source);
    buffer[offset++] = 0; // null terminator

    // Write options as cstring in bson-js compatible order: i, s, m
    // For compatibility with official bson-js:
    // - 'g' (global) maps to 's'
    // - 's' (dotAll) is NOT preserved
    // - 'u' (unicode) is NOT preserved
    // Options are ASCII only, no UTF-8 encoding needed
    if (regex.ignoreCase) buffer[offset++] = 105; // 'i'
    if (regex.global) buffer[offset++] = 115; // 's' (Note: 'g' → 's' for bson-js compatibility)
    if (regex.multiline) buffer[offset++] = 109; // 'm'
    buffer[offset++] = 0; // null terminator

    return offset;
}

/**
 * Serialize a literal type property.
 * The BSON type is determined by the JavaScript type of the literal value:
 * - string → BSON string
 * - number → BSON int32 or double
 * - boolean → BSON boolean
 * - bigint → BSON int64
 * - symbol → not supported (throws)
 * - RegExp → BSON regex
 */
function serializeLiteral(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeLiteral,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    const literal = type.literal;

    if (typeof literal === 'string') {
        serializeString(b, buffer, view, o, name, value);
    } else if (typeof literal === 'number') {
        // Use the same int32/double logic as plain numbers
        // For literal numbers, we know the value at compile time
        if (Number.isInteger(literal) && literal >= INT32_MIN && literal <= INT32_MAX) {
            serializeInt32(b, buffer, view, o, name, value);
        } else {
            serializeDouble(b, buffer, view, o, name, value);
        }
    } else if (typeof literal === 'boolean') {
        serializeBoolean(b, buffer, view, o, name, value);
    } else if (typeof literal === 'bigint') {
        serializeBigInt(b, buffer, view, o, name, value);
    } else if (literal instanceof RegExp) {
        serializeRegExp(b, buffer, view, o, name, { kind: ReflectionKind.regexp } as TypeRegexp, value);
    } else if (typeof literal === 'symbol') {
        throw new TypeNotSerializableError('symbol literal');
    } else {
        throw new TypeNotSerializableError(`literal (${typeof literal})`);
    }
}

/**
 * Find the rest element in a tuple type.
 * Returns { index, type } where index is the position of the rest element,
 * and type is the element type (e.g., `number` for `...number[]`).
 * Returns { index: -1 } if no rest element.
 */
function findTupleRest(tupleType: TypeTuple): { index: number; type?: Type } {
    for (let i = 0; i < tupleType.types.length; i++) {
        if (tupleType.types[i].type.kind === ReflectionKind.rest) {
            return { index: i, type: (tupleType.types[i].type as TypeRest).type };
        }
    }
    return { index: -1 };
}

/**
 * Serialize a tuple as BSON array.
 * Unlike Array<T>, tuples have fixed positions with potentially different types.
 * Supports rest elements: [string, ...number[], boolean]
 * BSON array: type (0x04) + name (cstring) + document (with "0", "1", ... keys)
 */
function serializeTuple(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeTuple,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    writeHeader(b, buffer, view, o, BSONType.ARRAY, name, true);

    // Save start offset for backfilling document size
    const start = b.let(b.getVar(o), 'tupleStart');

    // Reserve 4 bytes for document size
    b.exec(b.method(view, 'setInt32', b.getVar(o), b.lit(0), b.lit(true)));
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // Check for rest element
    const rest = findTupleRest(type);
    const restIndex = rest.index;
    const restType = rest.type;

    if (restIndex === -1) {
        // No rest element: serialize each tuple element with its specific type
        for (let i = 0; i < type.types.length; i++) {
            const member = type.types[i];
            const elemType = member.type;
            const elemValue = b.get(value, b.lit(i));
            const indexStr = String(i);
            const elemCtx = ctx.forProperty(`[${i}]`);

            if (member.optional) {
                // Optional tuple elements: skip if undefined
                b.if_(b.neq(elemValue, b.lit(undefined)), () => {
                    serializeValue(b, buffer, view, o, indexStr, elemType, elemValue, elemCtx);
                });
            } else {
                serializeValue(b, buffer, view, o, indexStr, elemType, elemValue, elemCtx);
            }
        }
    } else {
        // Has rest element: [fixed..., ...rest[], fixed...]
        const afterRestCount = type.types.length - restIndex - 1;

        // Track output index separately from input index
        const outputIdx = b.var_(b.lit(0), 'outputIdx');

        // 1. Serialize elements before rest (indices 0 to restIndex-1)
        for (let i = 0; i < restIndex; i++) {
            const member = type.types[i];
            const elemType = member.type;
            const elemValue = b.get(value, b.lit(i));
            const indexStr = String(i);
            const elemCtx = ctx.forProperty(`[${i}]`);

            if (member.optional) {
                b.if_(b.neq(elemValue, b.lit(undefined)), () => {
                    serializeValue(b, buffer, view, o, indexStr, elemType, elemValue, elemCtx);
                    b.setVar(outputIdx, b.add(b.getVar(outputIdx), b.lit(1)));
                });
            } else {
                serializeValue(b, buffer, view, o, indexStr, elemType, elemValue, elemCtx);
                b.setVar(outputIdx, b.add(b.getVar(outputIdx), b.lit(1)));
            }
        }

        // 2. Serialize rest elements (from restIndex to length - afterRestCount)
        if (restType) {
            // Calculate rest end index: value.length - afterRestCount
            const restEnd = b.sub(b.get(value, 'length'), b.lit(afterRestCount));
            const restCtx = ctx.forIndex('rest');

            // Loop from restIndex to restEnd, accessing value[inputIdx]
            b.forRange(
                b.lit(restIndex),
                restEnd,
                (inputIdx, elem) => {
                    // Use outputIdx for BSON key, which tracks actual output position
                    serializeValue(b, buffer, view, o, b.getVar(outputIdx), restType, elem!, restCtx);
                    b.setVar(outputIdx, b.add(b.getVar(outputIdx), b.lit(1)));
                },
                { arr: value, indexName: 'restIdx', elemName: 'restElem' },
            );
        }

        // 3. Serialize elements after rest (access from end of array)
        for (let i = 0; i < afterRestCount; i++) {
            const memberIdx = restIndex + 1 + i;
            const member = type.types[memberIdx];
            const elemType = member.type;
            // Access from end: value[value.length - (afterRestCount - i)]
            const offset = afterRestCount - i;
            const inputIdx = b.let(b.sub(b.get(value, 'length'), b.lit(offset)), 'afterRestIdx');
            const elemValue = b.get(value, inputIdx);
            const elemCtx = ctx.forProperty(`[${memberIdx}]`);

            if (member.optional) {
                b.if_(b.neq(elemValue, b.lit(undefined)), () => {
                    serializeValue(b, buffer, view, o, b.getVar(outputIdx), elemType, elemValue, elemCtx);
                    b.setVar(outputIdx, b.add(b.getVar(outputIdx), b.lit(1)));
                });
            } else {
                serializeValue(b, buffer, view, o, b.getVar(outputIdx), elemType, elemValue, elemCtx);
                b.setVar(outputIdx, b.add(b.getVar(outputIdx), b.lit(1)));
            }
        }
    }

    // Write document terminator (0x00)
    b.set(buffer, b.getVar(o), b.lit(0));
    b.setVar(o, b.add(b.getVar(o), b.lit(1)));

    // Backfill document size
    const size = b.sub(b.getVar(o), start);
    b.exec(b.method(view, 'setInt32', start, size, b.lit(true)));
}

/**
 * Serialize an enum value.
 * TypeScript enums can have string or number values.
 * - Number enum values → BSON int32 (if in range) or double
 * - String enum values → BSON string
 *
 * At runtime, enum values are already resolved to their primitive values,
 * so we just need to serialize based on the actual value type.
 */
function serializeEnum(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeEnum,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Check if all enum values are of the same type
    const values = type.values;
    const allNumbers = values.every(v => typeof v === 'number');
    const allStrings = values.every(v => typeof v === 'string');

    if (allNumbers) {
        // Fast path: all numeric enum → serialize as number
        // Check if all values fit in int32
        const allInt32 = values.every(
            v => typeof v === 'number' && Number.isInteger(v) && v >= INT32_MIN && v <= INT32_MAX,
        );
        if (allInt32) {
            serializeInt32(b, buffer, view, o, name, value);
        } else {
            serializeDouble(b, buffer, view, o, name, value);
        }
    } else if (allStrings) {
        // Fast path: all string enum → serialize as string
        serializeString(b, buffer, view, o, name, value);
    } else {
        // Mixed enum: need runtime check
        // Write header with type backfill since we don't know the type at compile time
        const typePos = writeHeaderWithTypeBackfill(b, buffer, view, o, name);

        b.if_(
            b.isType(value, 'number'),
            () => {
                // Number value: check int32 fit at runtime
                b.if_(
                    b.eq(b.bitOr(value, b.lit(0)), value),
                    () => {
                        b.set(buffer, typePos, b.lit(BSONType.INT));
                        b.exec(b.method(view, 'setInt32', b.getVar(o), value, b.lit(true)));
                        b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                    },
                    () => {
                        b.set(buffer, typePos, b.lit(BSONType.DOUBLE));
                        b.exec(b.method(view, 'setFloat64', b.getVar(o), value, b.lit(true)));
                        b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                    },
                );
            },
            () => {
                // String value
                b.set(buffer, typePos, b.lit(BSONType.STRING));
                serializeStringBody(b, buffer, view, o, value);
            },
        );
    }
}

/**
 * Check if a union is a simple nullable type: T | null or T | undefined.
 * Returns the non-null/undefined type if true, undefined otherwise.
 */
function getSimpleNullableType(type: TypeUnion): Type | undefined {
    if (type.types.length !== 2) return undefined;

    const nullishTypes = type.types.filter(t => t.kind === ReflectionKind.null || t.kind === ReflectionKind.undefined);
    if (nullishTypes.length !== 1) return undefined;

    const nonNullish = type.types.find(t => t.kind !== ReflectionKind.null && t.kind !== ReflectionKind.undefined);
    return nonNullish;
}

/**
 * Serialize a union type.
 *
 * Strategy selection (in order of preference):
 * 1. Simple nullable: T | null, T | undefined → check nullish, serialize T or null
 * 2. Discriminated union: { kind: 'a' } | { kind: 'b' } → O(1) switch on discriminator
 * 3. Literal set: 'a' | 'b' | 'c' | 'd' | 'e' (5+) → O(1) Set.has() validation
 * 4. Scored matching: complex unions → runtime type checking with priority
 */
function serializeUnion(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeUnion,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // === PHASE 1: Simple nullable check (T | null, T | undefined) ===
    const simpleType = getSimpleNullableType(type);
    if (simpleType) {
        serializeSimpleNullable(b, buffer, view, o, name, simpleType, value, ctx);
        return;
    }

    // === PHASE 2: Discriminated union (O(1) switch) ===
    const disc = detectDiscriminator(type);
    if (disc) {
        serializeDiscriminatedUnion(b, buffer, view, o, name, type, disc, value, ctx);
        return;
    }

    // === PHASE 3: Literal set optimization (O(1) Set.has) ===
    if (isAllLiterals(type) && type.types.length >= UNION_LITERAL_THRESHOLD) {
        serializeLiteralSetUnion(b, buffer, view, o, name, type, value, ctx);
        return;
    }

    // === PHASE 4: Scored union resolution ===
    serializeScoredUnion(b, buffer, view, o, name, type, value, ctx);
}

/**
 * Serialize a simple nullable type: T | null or T | undefined.
 * Checks if value is nullish, serializes null if so, otherwise serializes as T.
 */
function serializeSimpleNullable(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    nonNullType: Type,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.or(b.eq(value, b.lit(null)), b.eq(value, b.lit(undefined))),
        () => {
            serializeNull(b, buffer, view, o, name);
        },
        () => {
            serializeValue(b, buffer, view, o, name, nonNullType, value, ctx);
        },
    );
}

/**
 * Serialize a discriminated union using O(1) switch on discriminator property.
 * Example: { kind: 'a', data: string } | { kind: 'b', count: number }
 */
function serializeDiscriminatedUnion(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeUnion,
    disc: DiscriminatorInfo,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    const discValue = b.get(value, disc.property);

    const cases: Array<[any, () => void]> = [];

    for (const [literal, memberType] of disc.valueToMember) {
        cases.push([
            literal,
            () => {
                // Serialize the value using the matched member type
                serializeValue(b, buffer, view, o, name, memberType, value, ctx);
            },
        ]);
    }

    b.switch_(discValue, cases, () => {
        // Default case: throw error for unknown discriminator
        b.exec(
            b.call(
                (prop: string, val: any, path: string) => {
                    throw new BSONError(
                        `Unknown discriminator value '${val}' for property '${prop}' at path: ${path}`,
                        'DK-B040',
                    );
                },
                b.lit(disc.property),
                discValue,
                b.lit(ctx.getPath()),
            ),
        );
    });
}

/**
 * Serialize a literal union using Set.has() for O(1) validation.
 * Example: 'a' | 'b' | 'c' | 'd' | 'e' (5+ literals)
 */
function serializeLiteralSetUnion(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeUnion,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    const literals = type.types.map(t => (t as TypeLiteral).literal);
    const literalSet = new Set(literals);

    // Validate that value is in the set
    const hasCheck = b.call((set: Set<any>, val: any) => set.has(val), b.lit(literalSet), value);

    b.if_(b.not(hasCheck), () => {
        b.exec(
            b.call(
                (val: any, allowed: any[], path: string) => {
                    throw new BSONError(
                        `Value '${val}' is not a valid union member at path: ${path}. Allowed: ${allowed.join(', ')}`,
                        'DK-B040',
                    );
                },
                value,
                b.lit(literals),
                b.lit(ctx.getPath()),
            ),
        );
    });

    // Check if all literals are the same type
    const types = new Set(literals.map(l => typeof l));

    if (types.size === 1) {
        // All same type: use optimized path
        const firstLiteral = literals[0];
        if (typeof firstLiteral === 'string') {
            serializeString(b, buffer, view, o, name, value);
        } else if (typeof firstLiteral === 'number') {
            if (literals.every(l => typeof l === 'number' && Number.isInteger(l) && l >= INT32_MIN && l <= INT32_MAX)) {
                serializeInt32(b, buffer, view, o, name, value);
            } else {
                serializeDouble(b, buffer, view, o, name, value);
            }
        } else if (typeof firstLiteral === 'boolean') {
            serializeBoolean(b, buffer, view, o, name, value);
        } else if (typeof firstLiteral === 'bigint') {
            serializeBigInt(b, buffer, view, o, name, value);
        } else {
            throw new TypeNotSerializableError(`literal union (${typeof firstLiteral})`);
        }
    } else {
        // Mixed types: need runtime type check
        const typePos = writeHeaderWithTypeBackfill(b, buffer, view, o, name);

        // Check types in priority order: bigint, number, boolean, string
        const hasBigint = literals.some(l => typeof l === 'bigint');
        const hasNumber = literals.some(l => typeof l === 'number');
        const hasBoolean = literals.some(l => typeof l === 'boolean');
        const hasString = literals.some(l => typeof l === 'string');

        if (hasBigint) {
            b.if_(
                b.isType(value, 'bigint'),
                () => {
                    b.set(buffer, typePos, b.lit(BSONType.LONG));
                    b.exec(b.method(view, 'setBigInt64', b.getVar(o), value, b.lit(true)));
                    b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                },
                () =>
                    serializeMixedLiteralRemainder(
                        b,
                        buffer,
                        view,
                        o,
                        typePos,
                        value,
                        hasNumber,
                        hasBoolean,
                        hasString,
                    ),
            );
        } else {
            serializeMixedLiteralRemainder(b, buffer, view, o, typePos, value, hasNumber, hasBoolean, hasString);
        }
    }
}

/**
 * Helper for mixed literal serialization (non-bigint types).
 */
function serializeMixedLiteralRemainder(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    typePos: Ref<number>,
    value: Ref<any>,
    hasNumber: boolean,
    hasBoolean: boolean,
    hasString: boolean,
): void {
    if (hasNumber) {
        b.if_(
            b.isType(value, 'number'),
            () => {
                // Use int32 check for numbers
                b.if_(
                    b.eq(b.bitOr(value, b.lit(0)), value),
                    () => {
                        b.set(buffer, typePos, b.lit(BSONType.INT));
                        b.exec(b.method(view, 'setInt32', b.getVar(o), value, b.lit(true)));
                        b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                    },
                    () => {
                        b.set(buffer, typePos, b.lit(BSONType.DOUBLE));
                        b.exec(b.method(view, 'setFloat64', b.getVar(o), value, b.lit(true)));
                        b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                    },
                );
            },
            () => serializeMixedLiteralBoolOrString(b, buffer, view, o, typePos, value, hasBoolean, hasString),
        );
    } else {
        serializeMixedLiteralBoolOrString(b, buffer, view, o, typePos, value, hasBoolean, hasString);
    }
}

/**
 * Helper for mixed literal serialization (boolean or string).
 */
function serializeMixedLiteralBoolOrString(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    typePos: Ref<number>,
    value: Ref<any>,
    hasBoolean: boolean,
    hasString: boolean,
): void {
    if (hasBoolean) {
        b.if_(
            b.isType(value, 'boolean'),
            () => {
                b.set(buffer, typePos, b.lit(BSONType.BOOLEAN));
                b.set(buffer, b.getVar(o), b.ternary(value, b.lit(1), b.lit(0)));
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));
            },
            () => {
                if (hasString) {
                    b.set(buffer, typePos, b.lit(BSONType.STRING));
                    serializeStringBody(b, buffer, view, o, value);
                }
            },
        );
    } else if (hasString) {
        b.set(buffer, typePos, b.lit(BSONType.STRING));
        serializeStringBody(b, buffer, view, o, value);
    }
}

/**
 * Get priority for a type in union matching.
 * Lower number = higher priority (checked first).
 */
function getTypePriority(type: Type): number {
    // Check for annotated string types first (MongoId, UUID)
    // These need to be checked BEFORE plain string
    if (isMongoIdType(type)) return 4; // MongoId before string
    if (isUUIDType(type)) return 4; // UUID before string

    switch (type.kind) {
        case ReflectionKind.null:
        case ReflectionKind.undefined:
            return 0; // Check nullish first
        case ReflectionKind.bigint:
            return 1;
        case ReflectionKind.number:
            return 2;
        case ReflectionKind.boolean:
            return 3;
        case ReflectionKind.literal:
            const lit = (type as TypeLiteral).literal;
            if (lit === null) return 0;
            if (typeof lit === 'bigint') return 1;
            if (typeof lit === 'number') return 2;
            if (typeof lit === 'boolean') return 3;
            if (typeof lit === 'string') return 10;
            return 5;
        case ReflectionKind.class:
            // Built-in global classes (Date, RegExp, Map, Set, TypedArrays) before custom classes
            if (isGlobalTypeClass(type)) return 4;
            // Custom classes
            return 6;
        case ReflectionKind.objectLiteral:
            return 6;
        case ReflectionKind.array:
        case ReflectionKind.tuple:
            return 7;
        case ReflectionKind.enum:
            return 8;
        case ReflectionKind.string:
            return 10; // String is a fallback (can match anything via toString)
        default:
            return 5;
    }
}

/**
 * Validate MongoId format: exactly 24 hex characters.
 */
function isValidMongoId(val: string): boolean {
    return typeof val === 'string' && val.length === 24 && /^[0-9a-fA-F]{24}$/.test(val);
}

/**
 * Validate UUID format: 8-4-4-4-12 hex pattern with dashes.
 */
function isValidUUID(val: string): boolean {
    return (
        typeof val === 'string' &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(val)
    );
}

/**
 * Generate a type check expression for a union member.
 */
function getTypeCheck(member: Type, value: Ref<any>, b: Builder): Ref<boolean> | undefined {
    // Handle annotated string types (MongoId, UUID)
    if (isMongoIdType(member)) {
        // MongoId: string type with MongoId annotation - validate format
        return b.and(b.isType(value, 'string'), b.call(isValidMongoId, value));
    }
    if (isUUIDType(member)) {
        // UUID: string type with UUID annotation - validate format
        return b.and(b.isType(value, 'string'), b.call(isValidUUID, value));
    }

    switch (member.kind) {
        case ReflectionKind.null:
            return b.eq(value, b.lit(null));
        case ReflectionKind.undefined:
            return b.eq(value, b.lit(undefined));
        case ReflectionKind.string:
            return b.isType(value, 'string');
        case ReflectionKind.number:
            return b.isType(value, 'number');
        case ReflectionKind.boolean:
            return b.isType(value, 'boolean');
        case ReflectionKind.bigint:
            return b.isType(value, 'bigint');
        case ReflectionKind.literal:
            return b.eq(value, b.lit((member as TypeLiteral).literal));
        case ReflectionKind.class:
            // For built-in classes (Date, RegExp, Map, Set, TypedArrays, etc.), use instanceof
            if (isGlobalTypeClass(member)) {
                return b.isInstance(value, (member as TypeClass).classType);
            }
            // Custom class: accept instance OR plain object with matching properties
            return b.or(
                b.isInstance(value, (member as TypeClass).classType),
                b.and(b.isType(value, 'object'), b.and(b.not(b.isNull(value)), b.not(b.call(Array.isArray, value)))),
            );
        case ReflectionKind.array:
            return b.call(Array.isArray, value);
        case ReflectionKind.tuple:
            return b.call(Array.isArray, value);
        case ReflectionKind.objectLiteral:
            return b.and(b.isType(value, 'object'), b.and(b.not(b.isNull(value)), b.not(b.call(Array.isArray, value))));
        case ReflectionKind.regexp:
            return b.isInstance(value, RegExp);
        case ReflectionKind.enum:
            // Enum values are already their primitive form at runtime
            // Check against all valid enum values
            const enumType = member as TypeEnum;
            const enumSet = new Set(enumType.values);
            return b.call((set: Set<any>, val: any) => set.has(val), b.lit(enumSet), value);
        default:
            return undefined;
    }
}

/**
 * Serialize a union using runtime type checking with priority-based matching.
 * Used for complex unions that don't fit simpler patterns.
 */
function serializeScoredUnion(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: TypeUnion,
    value: Ref<any>,
    ctx: BSONBuildState,
): void {
    // Sort members by priority (lower = checked first)
    const sortedMembers = [...type.types].sort((a, c) => getTypePriority(a) - getTypePriority(c));

    // Track if we've matched
    const matched = b.var_(false, 'unionMatched');

    // Pre-check: null/undefined coercion.
    // If union has null or undefined, both null and undefined values serialize as BSON NULL.
    const hasNullish = type.types.some(t => t.kind === ReflectionKind.null || t.kind === ReflectionKind.undefined);
    if (hasNullish) {
        b.if_(b.or(b.eq(value, b.lit(null)), b.eq(value, b.lit(undefined))), () => {
            serializeNull(b, buffer, view, o, name);
            b.setVar(matched, b.lit(true));
        });
    }

    // Try each member in priority order
    for (const member of sortedMembers) {
        b.if_(b.not(b.getVar(matched)), () => {
            const check = getTypeCheck(member, value, b);
            if (check) {
                b.if_(check, () => {
                    serializeValue(b, buffer, view, o, name, member, value, ctx);
                    b.setVar(matched, b.lit(true));
                });
            }
        });
    }

    // If no member matched, throw error
    b.if_(b.not(b.getVar(matched)), () => {
        b.exec(
            b.call(
                (val: any, types: string[], path: string) => {
                    throw new BSONError(
                        `Cannot serialize value to union at path: ${path}. No member matched. Value: ${JSON.stringify(val)}, Expected: ${types.join(' | ')}`,
                        'DK-B040',
                    );
                },
                value,
                b.lit(sortedMembers.map(m => ReflectionKind[m.kind])),
                b.lit(ctx.getPath()),
            ),
        );
    });
}
