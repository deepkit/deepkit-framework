/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, VarRef, arg, fn, fnJITTop } from '@deepkit/core';
import {
    BinaryBigIntType,
    FastDate,
    ReceiveType,
    ReflectionClass,
    ReflectionKind,
    Type,
    TypeArray,
    TypeClass,
    TypeEnum,
    TypeIndexSignature,
    TypeLiteral,
    TypeMethod,
    TypeObjectLiteral,
    TypePromise,
    TypeProperty,
    TypePropertySignature,
    TypeRest,
    TypeTemplateLiteral,
    TypeTuple,
    TypeTupleMember,
    TypeUnion,
    binaryBigIntAnnotation,
    binaryTypes,
    createReference,
    embeddedAnnotation,
    excludedAnnotation,
    getDeepConstructorProperties,
    hasDefaultValue,
    isMongoIdType,
    isOptional,
    isPropertyMemberType,
    isReferenceType,
    isUUIDType,
    memberNameToString,
    nodeBufferToArrayBuffer,
    resolveReceiveType,
    resolveTypeMembers,
} from '@deepkit/type';

import { BSONBuildState } from './context.js';
import { BSONError, TypeNotSerializableError } from './errors.js';

/**
 * 65536-entry hex lookup table for fast ObjectId/UUID conversion.
 * Maps 2-byte pairs to 4 hex chars, halving the number of string concatenations.
 */
import { hexTable, hexTable2 } from './model.js';
import { parseValueAny } from './parser.js';
import {
    decodeUTF8,
    readBSONString,
    readBSONStringDirect,
    readBytesAsHex,
    readBytesAsUUID,
    readCString,
    readDouble,
    readInt64,
    readInt64AsNumber,
    skipValue,
} from './reader.js';
import { BSONDeserializer, BSONType, BSON_BINARY_SUBTYPE_DEFAULT, BSON_BINARY_SUBTYPE_UUID } from './types.js';

// ============================================================================
// Sentinel for unset properties
// ============================================================================

const UNSET = Symbol('UNSET');

/**
 * Convert NaN to 0 (for DOUBLE → number deserialization).
 */
function nanToZero(v: number): number {
    return Number.isNaN(v) ? 0 : v;
}

/**
 * Build an inline int32 little-endian read expression from buffer bytes.
 * Generates: buffer[o] | (buffer[o+1] << 8) | (buffer[o+2] << 16) | (buffer[o+3] << 24)
 * Avoids DataView overhead for the most common numeric read.
 */
function inlineInt32Read(b: Builder, buffer: Ref<Uint8Array>, offset: Ref<number>): Ref<number> {
    return b.bitOr(
        b.bitOr(b.at(buffer, offset), b.shl(b.at(buffer, b.add(offset, b.lit(1))), b.lit(8))),
        b.bitOr(
            b.shl(b.at(buffer, b.add(offset, b.lit(2))), b.lit(16)),
            b.shl(b.at(buffer, b.add(offset, b.lit(3))), b.lit(24)),
        ),
    );
}

/**
 * Read int32 little-endian from buffer bytes (runtime helper for fallback paths).
 */
function readInt32LE(b: Uint8Array, o: number): number {
    return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
}

/**
 * Read 12-byte ObjectId as hex string using 2-byte lookup table.
 * 6 concatenations instead of 12.
 */
function readObjectIdHex(buffer: Uint8Array, offset: number): string {
    return (
        hexTable2[(buffer[offset] << 8) | buffer[offset + 1]] +
        hexTable2[(buffer[offset + 2] << 8) | buffer[offset + 3]] +
        hexTable2[(buffer[offset + 4] << 8) | buffer[offset + 5]] +
        hexTable2[(buffer[offset + 6] << 8) | buffer[offset + 7]] +
        hexTable2[(buffer[offset + 8] << 8) | buffer[offset + 9]] +
        hexTable2[(buffer[offset + 10] << 8) | buffer[offset + 11]]
    );
}

// ============================================================================
// Shape Learning Infrastructure
// ============================================================================
// MongoDB returns fields in arbitrary order. Shape-learning detects the actual
// field order at runtime and generates JIT code optimized for that order.
// This provides ~60% speedup compared to the generic while-loop deserializer.

interface ShapeFieldInfo {
    name: string;
    nameBytes: number[];
    bsonType: number;
}

interface LearnedShape {
    fields: ShapeFieldInfo[];
    signature: string; // Quick comparison key
}

/**
 * Learn field order from a BSON document.
 * Returns field names, their byte representations, and BSON types.
 */
function learnShape(buffer: Uint8Array, offset: number): LearnedShape {
    const fields: ShapeFieldInfo[] = [];
    const docSize =
        buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    if (docSize < 5 || offset + docSize > buffer.length) {
        return { fields, signature: '' }; // malformed — return empty shape, will fallback to slow path
    }
    const end = offset + docSize - 1;
    let o = offset + 4;

    while (o < end) {
        const bsonType = buffer[o++];
        if (bsonType === 0) break;

        const nameBytes: number[] = [];
        while (o < end && buffer[o] !== 0) nameBytes.push(buffer[o++]);
        if (o >= end) break; // malformed BSON
        o++; // skip null terminator

        const name = String.fromCharCode(...nameBytes);
        fields.push({ name, nameBytes, bsonType });

        // Skip value based on type
        o = skipBsonValueForShapeLearning(buffer, o, bsonType);
    }

    return {
        fields,
        signature: fields.map(f => f.name).join('\x00'),
    };
}

/**
 * Skip a BSON value during shape learning.
 */
function skipBsonValueForShapeLearning(buffer: Uint8Array, offset: number, bsonType: number): number {
    switch (bsonType) {
        case BSONType.DOUBLE:
            return offset + 8;
        case BSONType.STRING: {
            const len =
                buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
            if (len < 0) throw new BSONError('Invalid BSON string: negative length', 'DK-B020');
            return offset + 4 + len;
        }
        case BSONType.OBJECT:
        case BSONType.ARRAY: {
            const size =
                buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
            if (size < 5) throw new BSONError('Invalid BSON document: size too small', 'DK-B020');
            return offset + size;
        }
        case BSONType.BINARY: {
            const len =
                buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
            if (len < 0) throw new BSONError('Invalid BSON binary: negative length', 'DK-B020');
            return offset + 5 + len;
        }
        case BSONType.UNDEFINED:
            return offset;
        case BSONType.OID:
            return offset + 12;
        case BSONType.BOOLEAN:
            return offset + 1;
        case BSONType.DATE:
            return offset + 8;
        case BSONType.NULL:
            return offset;
        case BSONType.REGEX: {
            const bufLen = buffer.length;
            while (offset < bufLen && buffer[offset++] !== 0); // pattern
            while (offset < bufLen && buffer[offset++] !== 0); // flags
            return offset;
        }
        case BSONType.INT:
            return offset + 4;
        case BSONType.TIMESTAMP:
            return offset + 8;
        case BSONType.LONG:
            return offset + 8;
        case BSONType.DECIMAL128:
            return offset + 16;
        default:
            throw new BSONError(`Unknown BSON type during shape learning: ${bsonType}`, 'DK-B010');
    }
}

/**
 * Type info for generating shape-optimized JIT.
 */
interface TypeFieldInfo {
    jsName: string;
    bsonName: string;
    type: Type;
    optional: boolean;
    hasDefault: boolean;
    defaultFn?: () => any;
}

/**
 * Extract field info from a type.
 */
function getTypeFieldInfo(type: TypeObjectLiteral | TypeClass, ctx: BSONBuildState): TypeFieldInfo[] {
    const fields: TypeFieldInfo[] = [];
    const props =
        type.kind === ReflectionKind.class
            ? (type as TypeClass).types.filter(
                  (t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static,
              )
            : (type as TypeObjectLiteral).types.filter(
                  (t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature,
              );

    for (const prop of props) {
        const jsName = memberNameToString(prop.name);
        const bsonName = ctx.getPropertyName(prop);
        fields.push({
            jsName,
            bsonName,
            type: prop.type,
            optional: isOptional(prop),
            hasDefault: hasDefaultValue(prop),
            defaultFn: (prop as TypeProperty).default,
        });
    }

    return fields;
}

/**
 * Trampoline for calling nested shape handles from Builder-generated code.
 * Needed because handle.fn is swapped at runtime as new shapes are learned,
 * so we can't capture a direct function reference.
 */
function callNestedHandle(handle: NestedShapeHandle, buf: Uint8Array, offset: number): [any, number] {
    return handle.fn(buf, offset);
}

/**
 * Check if a BSON type is directly compatible with a TypeScript type.
 * Returns false for any combination that requires coercion (slow path handles that).
 */
function isBsonTypeCompatible(bsonType: number, tf: TypeFieldInfo): boolean {
    const type = tf.type;

    // References always need slow path (create reference wrapper objects)
    if (isReferenceType(type)) return false;

    // Unions: check compatibility based on union structure
    if (type.kind === ReflectionKind.union) {
        const members = (type as TypeUnion).types;
        const nonNullish = members.filter(t => t.kind !== ReflectionKind.null && t.kind !== ReflectionKind.undefined);

        // Simple nullable (T | null | undefined): delegate to the non-null member
        if (nonNullish.length === 1) {
            return isBsonTypeCompatible(bsonType, { ...tf, type: nonNullish[0] });
        }

        // Multi-object union: compatible with OBJECT if all non-null members are plain objects
        if (bsonType === BSONType.OBJECT) {
            return nonNullish.every(
                t =>
                    t.kind === ReflectionKind.objectLiteral ||
                    (t.kind === ReflectionKind.class &&
                        !isReferenceType(t) &&
                        !binaryTypes.includes((t as TypeClass).classType as any) &&
                        (t as TypeClass).classType !== Date &&
                        (t as TypeClass).classType !== RegExp &&
                        (t as TypeClass).classType !== Map &&
                        (t as TypeClass).classType !== Set),
            );
        }

        return false;
    }

    // Literal types are compatible if their underlying value type matches the BSON type
    if (type.kind === ReflectionKind.literal) {
        const val = (type as TypeLiteral).literal;
        switch (bsonType) {
            case BSONType.STRING:
                return typeof val === 'string';
            case BSONType.INT:
            case BSONType.DOUBLE:
                return typeof val === 'number';
            case BSONType.BOOLEAN:
                return typeof val === 'boolean';
            default:
                return false;
        }
    }

    switch (bsonType) {
        case BSONType.INT:
        case BSONType.DOUBLE:
            return type.kind === ReflectionKind.number;
        case BSONType.STRING:
            // UUID/MongoId need validation — force slow path
            if (isUUIDType(type) || isMongoIdType(type)) return false;
            return type.kind === ReflectionKind.string;
        case BSONType.BOOLEAN:
            return type.kind === ReflectionKind.boolean;
        case BSONType.DATE:
            return type.kind === ReflectionKind.class && (type as TypeClass).classType === Date;
        case BSONType.LONG:
            return type.kind === ReflectionKind.bigint;
        case BSONType.OID:
            return type.kind === ReflectionKind.string || isMongoIdType(type);
        case BSONType.NULL:
            return false; // Null coercion always needs slow path
        case BSONType.OBJECT:
            if (type.kind === ReflectionKind.class) {
                const ct = (type as TypeClass).classType;
                // Map/Set need slow path — shape fast path reads BSON objects as plain properties
                if (ct === Map || ct === Set) return false;
            }
            return (
                (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) &&
                !isReferenceType(type)
            );
        case BSONType.ARRAY:
            return type.kind === ReflectionKind.array;
        case BSONType.BINARY:
            return isUUIDType(type);
        default:
            return false;
    }
}

/**
 * Build a shape-specific deserializer using the Builder API.
 *
 * Creates per-field reader functions (nested for V8 inlining) that validate
 * field names byte-by-byte and read values for the expected BSON type.
 * Returns BAILOUT on any shape mismatch.
 *
 * @param nested - If true, returns [value, newOffset] instead of just value.
 * @param classType - If provided, result will be an instance of this class.
 */
/**
 * Emit inlined value reading for a shape field directly into the parent Builder.
 * Writes to outVal/outOff VarRefs instead of a shared tuple.
 * Returns true if the value was handled, false if the type needs BAILOUT.
 */
function buildShapeValueReadInline(
    b: Builder,
    buf: Ref<Uint8Array>,
    d: Ref<number>,
    bsonType: number,
    tf: TypeFieldInfo,
    outVal: VarRef<any>,
    outOff: VarRef<number>,
    nestedHandles: Map<string, NestedShapeHandle>,
    fieldIndex: number,
    BAILOUT: symbol,
): void {
    // Union types: unwrap and dispatch based on union structure
    if (tf.type.kind === ReflectionKind.union) {
        const members = (tf.type as TypeUnion).types;
        const nonNullish = members.filter(t => t.kind !== ReflectionKind.null && t.kind !== ReflectionKind.undefined);

        // Simple nullable (T | null): shape already tells us the bsonType is NOT null,
        // so just generate inline read for the non-null member
        if (nonNullish.length === 1) {
            buildShapeValueReadInline(
                b,
                buf,
                d,
                bsonType,
                { ...tf, type: nonNullish[0] },
                outVal,
                outOff,
                nestedHandles,
                fieldIndex,
                BAILOUT,
            );
            return;
        }

        // Multi-object union: dispatch via createMultiObjectUnionDispatcher
        if (bsonType === BSONType.OBJECT) {
            const dispatcher = createMultiObjectUnionDispatcher(nonNullish, describeUnion(tf.type as TypeUnion));
            const result = b.let(b.call(dispatcher, buf, d), 'unionObjResult');
            b.setVar(outVal, b.at(result, b.lit(0)));
            b.setVar(outOff, b.at(result, b.lit(1)));
            return;
        }

        // Other union/bsonType combos: bail out to slow path
        b.return_(b.lit(BAILOUT));
        return;
    }

    // Literal types: return the compile-time literal value, skip BSON data
    if (tf.type.kind === ReflectionKind.literal) {
        const litVal = (tf.type as TypeLiteral).literal;
        b.setVar(outVal, b.lit(litVal));
        // Skip value based on BSON type
        switch (bsonType) {
            case BSONType.STRING: {
                const strLen = b.let(inlineInt32Read(b, buf, d), 'litSl');
                b.setVar(outOff, b.add(d, b.add(b.lit(4), strLen)));
                break;
            }
            case BSONType.INT:
                b.setVar(outOff, b.add(d, b.lit(4)));
                break;
            case BSONType.DOUBLE:
                b.setVar(outOff, b.add(d, b.lit(8)));
                break;
            case BSONType.BOOLEAN:
                b.setVar(outOff, b.add(d, b.lit(1)));
                break;
            default:
                b.return_(b.lit(BAILOUT));
        }
        return;
    }

    switch (bsonType) {
        case BSONType.INT:
            b.setVar(outVal, inlineInt32Read(b, buf, d));
            b.setVar(outOff, b.add(d, b.lit(4)));
            break;

        case BSONType.DOUBLE: {
            const dv = b.let(b.call(readDouble, buf, d), 'dv');
            // NaN coercion needs slow path
            b.if_(b.neq(dv, dv), () => {
                b.return_(b.lit(BAILOUT));
            });
            b.setVar(outVal, dv);
            b.setVar(outOff, b.add(d, b.lit(8)));
            break;
        }

        case BSONType.STRING: {
            const strLen = b.let(b.sub(inlineInt32Read(b, buf, d), b.lit(1)), 'sl');
            const strStart = b.let(b.add(d, b.lit(4)), 'ss');
            b.setVar(outVal, b.call(decodeUTF8, buf, strStart, strLen));
            b.setVar(outOff, b.add(strStart, b.add(strLen, b.lit(1))));
            break;
        }

        case BSONType.BOOLEAN:
            b.setVar(outVal, b.eq(b.at(buf, d), b.lit(1)));
            b.setVar(outOff, b.add(d, b.lit(1)));
            break;

        case BSONType.DATE:
            if (tf.type.kind === ReflectionKind.class && (tf.type as TypeClass).classType === Date) {
                b.setVar(outVal, b.new_(FastDate, b.call(readInt64AsNumber, buf, d)));
                b.setVar(outOff, b.add(d, b.lit(8)));
            } else {
                b.return_(b.lit(BAILOUT));
            }
            break;

        case BSONType.LONG:
            b.setVar(outVal, b.call(readInt64, buf, d));
            b.setVar(outOff, b.add(d, b.lit(8)));
            break;

        case BSONType.OID:
            b.setVar(outVal, b.call(readObjectIdHex, buf, d));
            b.setVar(outOff, b.add(d, b.lit(12)));
            break;

        case BSONType.OBJECT: {
            const fieldType = tf.type;
            if (fieldType.kind === ReflectionKind.objectLiteral || fieldType.kind === ReflectionKind.class) {
                const nestedHandle = getNestedShapeHandle(fieldType as TypeObjectLiteral | TypeClass);
                nestedHandles.set(`f${fieldIndex}`, nestedHandle);

                const nr = b.let(b.call(callNestedHandle, b.lit(nestedHandle), buf, d), 'nr');
                b.setVar(outVal, b.at(nr, b.lit(0)));
                b.setVar(outOff, b.at(nr, b.lit(1)));
            } else {
                b.return_(b.lit(BAILOUT));
            }
            break;
        }

        case BSONType.ARRAY: {
            const fieldType = tf.type;
            if (fieldType.kind === ReflectionKind.array) {
                const elemType = (fieldType as TypeArray).type;
                if (elemType.kind === ReflectionKind.objectLiteral || elemType.kind === ReflectionKind.class) {
                    const elemHandle = getNestedShapeHandle(elemType as TypeObjectLiteral | TypeClass);
                    nestedHandles.set(`arr${fieldIndex}`, elemHandle);

                    const arrSz = b.let(inlineInt32Read(b, buf, d), 'arrSz');
                    const arrEnd = b.let(b.sub(b.add(d, arrSz), b.lit(1)), 'arrEnd');
                    const ao = b.var_(b.add(d, b.lit(4)), 'ao');
                    const arr = b.let(b.arr(), 'arr');
                    const ok = b.var_(b.lit(true), 'ok');

                    b.while_(b.lt(b.getVar(ao), arrEnd), () => {
                        const et = b.let(b.at(buf, b.getVar(ao)), 'et');
                        b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                        b.if_(b.eq(et, b.lit(0)), () => b.break_());
                        // Skip index cstring
                        b.while_(b.neq(b.at(buf, b.getVar(ao)), b.lit(0)), () => {
                            b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                        });
                        b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                        // Deserialize element
                        b.if_(
                            b.eq(et, b.lit(BSONType.OBJECT)),
                            () => {
                                const er = b.let(b.call(callNestedHandle, b.lit(elemHandle), buf, b.getVar(ao)), 'er');
                                b.exec(b.method(arr, 'push', b.at(er, b.lit(0))));
                                b.setVar(ao, b.at(er, b.lit(1)));
                            },
                            () => {
                                b.setVar(ok, b.lit(false));
                                b.break_();
                            },
                        );
                    });

                    b.if_(
                        b.getVar(ok),
                        () => {
                            b.setVar(outVal, arr);
                            b.setVar(outOff, b.add(arrEnd, b.lit(1)));
                        },
                        () => {
                            b.return_(b.lit(BAILOUT));
                        },
                    );
                } else if (
                    elemType.kind === ReflectionKind.string ||
                    elemType.kind === ReflectionKind.number ||
                    elemType.kind === ReflectionKind.boolean
                ) {
                    // Primitive array — inline element reads
                    const arrSz = b.let(inlineInt32Read(b, buf, d), 'arrSz');
                    const arrEnd = b.let(b.sub(b.add(d, arrSz), b.lit(1)), 'arrEnd');
                    const ao = b.var_(b.add(d, b.lit(4)), 'ao');
                    const arr = b.let(b.arr(), 'arr');
                    const ok = b.var_(b.lit(true), 'ok');

                    b.while_(b.lt(b.getVar(ao), arrEnd), () => {
                        const et = b.let(b.at(buf, b.getVar(ao)), 'et');
                        b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                        b.if_(b.eq(et, b.lit(0)), () => b.break_());
                        // Skip index cstring
                        b.while_(b.neq(b.at(buf, b.getVar(ao)), b.lit(0)), () => {
                            b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                        });
                        b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));

                        if (elemType.kind === ReflectionKind.string) {
                            b.if_(
                                b.eq(et, b.lit(BSONType.STRING)),
                                () => {
                                    const strLen = b.let(
                                        b.sub(inlineInt32Read(b, buf, b.getVar(ao)), b.lit(1)),
                                        'strLen',
                                    );
                                    b.setVar(ao, b.add(b.getVar(ao), b.lit(4)));
                                    b.exec(
                                        b.method(arr, 'push', b.call(readBSONStringDirect, buf, b.getVar(ao), strLen)),
                                    );
                                    b.setVar(ao, b.add(b.getVar(ao), b.add(strLen, b.lit(1))));
                                },
                                () => {
                                    b.setVar(ok, b.lit(false));
                                    b.break_();
                                },
                            );
                        } else if (elemType.kind === ReflectionKind.number) {
                            b.if_(
                                b.eq(et, b.lit(BSONType.INT)),
                                () => {
                                    b.exec(b.method(arr, 'push', inlineInt32Read(b, buf, b.getVar(ao))));
                                    b.setVar(ao, b.add(b.getVar(ao), b.lit(4)));
                                },
                                () => {
                                    b.if_(
                                        b.eq(et, b.lit(BSONType.DOUBLE)),
                                        () => {
                                            b.exec(b.method(arr, 'push', b.call(readDouble, buf, b.getVar(ao))));
                                            b.setVar(ao, b.add(b.getVar(ao), b.lit(8)));
                                        },
                                        () => {
                                            b.setVar(ok, b.lit(false));
                                            b.break_();
                                        },
                                    );
                                },
                            );
                        } else if (elemType.kind === ReflectionKind.boolean) {
                            b.if_(
                                b.eq(et, b.lit(BSONType.BOOLEAN)),
                                () => {
                                    b.exec(b.method(arr, 'push', b.eq(b.at(buf, b.getVar(ao)), b.lit(1))));
                                    b.setVar(ao, b.add(b.getVar(ao), b.lit(1)));
                                },
                                () => {
                                    b.setVar(ok, b.lit(false));
                                    b.break_();
                                },
                            );
                        }
                    });

                    b.if_(
                        b.getVar(ok),
                        () => {
                            b.setVar(outVal, arr);
                            b.setVar(outOff, b.add(arrEnd, b.lit(1)));
                        },
                        () => {
                            b.return_(b.lit(BAILOUT));
                        },
                    );
                } else {
                    b.return_(b.lit(BAILOUT));
                }
            } else {
                b.return_(b.lit(BAILOUT));
            }
            break;
        }

        case BSONType.BINARY:
            if (isUUIDType(tf.type)) {
                // Binary: 4 bytes length + 1 byte subtype + 16 bytes UUID data
                b.setVar(outVal, b.call(readBytesAsUUID, buf, b.add(d, b.lit(5))));
                b.setVar(outOff, b.add(d, b.lit(21)));
            } else {
                b.return_(b.lit(BAILOUT));
            }
            break;

        default:
            b.return_(b.lit(BAILOUT));
            break;
    }
}

function buildShapeJit(
    shape: LearnedShape,
    typeFields: TypeFieldInfo[],
    BAILOUT: symbol,
    nested: boolean,
    classType?: TypeClass,
): ((buf: Uint8Array, off: number) => any) | null {
    const fieldMap = new Map<string, TypeFieldInfo>();
    for (const f of typeFields) fieldMap.set(f.bsonName, f);

    // All shape fields must exist in the type, and BSON types must be compatible
    for (const sf of shape.fields) {
        const tf = fieldMap.get(sf.name);
        if (!tf) return null;
        if (!isBsonTypeCompatible(sf.bsonType, tf)) return null;
    }

    const nestedHandles = new Map<string, NestedShapeHandle>();

    return fn(
        arg<Uint8Array>('buf'),
        arg<number>('offset'),
        (b: Builder, buf: Ref<Uint8Array>, offset: Ref<number>) => {
            // Main function body — all field reads inlined (no per-field function calls, no shared tuple)
            const ds = b.let(inlineInt32Read(b, buf, offset), 'ds');
            const end = b.let(b.add(offset, b.sub(ds, b.lit(1))), 'end');
            const o = b.var_<number>(b.add(offset, b.lit(4)), 'o');

            // Inline field reading directly: check name+type, read value, BAILOUT on mismatch
            const fieldVars = new Map<string, VarRef<any>>();
            for (let i = 0; i < shape.fields.length; i++) {
                const sf = shape.fields[i];
                const tf = fieldMap.get(sf.name)!;
                const nameBytes = sf.nameBytes;
                const fieldDataOffset = 2 + nameBytes.length; // type(1) + name + null(1)

                // Bounds check
                b.if_(b.gte(b.getVar(o), end), () => {
                    b.return_(b.lit(BAILOUT));
                });

                // Combined type byte + name bytes + null terminator check
                let check: Ref<boolean> = b.eq(b.at(buf, b.getVar(o)), b.lit(sf.bsonType));
                for (let j = 0; j < nameBytes.length; j++) {
                    check = b.and(check, b.eq(b.at(buf, b.add(b.getVar(o), b.lit(1 + j))), b.lit(nameBytes[j])));
                }
                check = b.and(check, b.eq(b.at(buf, b.add(b.getVar(o), b.lit(1 + nameBytes.length))), b.lit(0)));

                b.if_(b.not(check), () => {
                    b.return_(b.lit(BAILOUT));
                });

                // Data offset (after type byte + name + null terminator)
                const d = b.let(b.add(b.getVar(o), b.lit(fieldDataOffset)), 'd');

                // Declare field value variable
                const fv = b.var_<any>(b.lit(undefined), `_f${i}`);

                // Inline value read — writes directly to fv and o
                buildShapeValueReadInline(b, buf, d, sf.bsonType, tf, fv, o, nestedHandles, i, BAILOUT);

                fieldVars.set(sf.name, fv);
            }

            // Extra fields check
            b.if_(b.neq(b.at(buf, b.getVar(o)), b.lit(0)), () => {
                b.return_(b.lit(BAILOUT));
            });

            // Build result object (class instance or plain object)
            let obj: Ref<any>;
            let skipFields: Set<string> | undefined;

            if (classType) {
                const deepCtorProps = getDeepConstructorProperties(classType);
                if (deepCtorProps.length > 0) {
                    skipFields = new Set(deepCtorProps.map(p => String(p.name)));

                    const ctorMethod = classType.types.find(
                        (t): t is TypeMethod => t.kind === ReflectionKind.method && t.name === 'constructor',
                    );

                    if (ctorMethod && ctorMethod.parameters) {
                        const args: Ref<any>[] = [];
                        for (const param of ctorMethod.parameters) {
                            if (
                                param.kind === ReflectionKind.parameter &&
                                (param.visibility !== undefined || param.readonly === true)
                            ) {
                                const tf = typeFields.find(f => f.jsName === param.name);
                                const fv = tf ? fieldVars.get(tf.bsonName) : undefined;
                                args.push(fv ? b.getVar(fv) : b.lit(undefined));
                            } else {
                                args.push(b.lit(undefined));
                            }
                        }
                        obj = b.let(b.new_(classType.classType, ...args), 'result');
                    } else {
                        obj = b.let(b.call(Object.create, b.lit(classType.classType.prototype)), 'result');
                    }
                } else {
                    obj = b.let(b.call(Object.create, b.lit(classType.classType.prototype)), 'result');
                }
            } else {
                obj = b.let(b.emptyObj(), 'result');
            }

            for (const tf of typeFields) {
                if (skipFields?.has(tf.jsName)) continue;
                const fv = fieldVars.get(tf.bsonName);
                if (fv) {
                    b.set(obj, b.lit(tf.jsName), b.getVar(fv));
                } else if (tf.hasDefault && tf.defaultFn) {
                    b.set(obj, b.lit(tf.jsName), b.call(tf.defaultFn));
                } else if (tf.optional) {
                    // skip
                } else {
                    b.return_(b.lit(BAILOUT));
                }
            }

            if (nested) {
                return b.arr(obj, b.add(offset, ds));
            }
            return obj;
        },
    );
}

/**
 * Build a shape dispatcher using the Builder API.
 *
 * Checks the first byte of the first field name and dispatches to the
 * appropriate shape JIT. Falls back to onBailout for unknown shapes.
 */
function buildShapeDispatcher(
    learnedShapes: { firstByte: number; jit: Function }[],
    BAILOUT: symbol,
    slowPath: Function,
    onBailout: Function,
): Function {
    if (learnedShapes.length === 0) return onBailout;

    return fn(
        arg<Uint8Array>('buf'),
        arg<number>('offset', 0),
        (b: Builder, buf: Ref<Uint8Array>, offset: Ref<number>) => {
            const firstByte = b.let(b.at(buf, b.add(offset, b.lit(5))), 'fb');

            for (const shape of learnedShapes) {
                b.if_(b.eq(firstByte, b.lit(shape.firstByte)), () => {
                    const r = b.let(b.call(shape.jit, buf, offset), 'r');
                    b.if_(b.neq(r, b.lit(BAILOUT)), () => {
                        b.return_(r);
                    });
                    b.return_(b.call(slowPath, buf, offset));
                });
            }

            return b.call(onBailout, buf, offset);
        },
    );
}

// ============================================================================
// Cache
// ============================================================================

const deserializerCache = new WeakMap<Type, BSONDeserializer<any>>();

/** Internal handle used by the multi-shape dispatcher. */
interface DeserializerHandle {
    fn: (buffer: Uint8Array, offset?: number) => any;
}

/**
 * Get or create a JIT-compiled BSON deserializer for the given type.
 *
 * Uses multi-shape learning: learns field orderings on first calls and generates
 * optimized JIT code for each shape. Handles multiple shapes (e.g., MongoDB's
 * arbitrary field ordering) via a dispatcher.
 *
 * @example
 * const deserialize = getBSONDeserializer<{ name: string, age: number }>();
 * const result = deserialize(bsonBuffer);
 */
export function getBSONDeserializer<T>(receiveType?: ReceiveType<T>): BSONDeserializer<T> {
    const type = resolveReceiveType(receiveType);
    let d = deserializerCache.get(type);
    if (d) return d;
    d = createDeserializer(type);
    deserializerCache.set(type, d);
    return d;
}

// ============================================================================
// Runtime Helpers (called from JIT code)
// ============================================================================

/**
 * Read a string value from BSON, coercing from other types if needed.
 * Returns [value, newOffset].
 * @internal Called by JIT-generated code.
 */
export function readStringValue(buffer: Uint8Array, offset: number, bsonType: number): [string, number] {
    switch (bsonType) {
        case BSONType.STRING:
            return readBSONString(buffer, offset);
        case BSONType.INT: {
            const v = readInt32LE(buffer, offset);
            return [String(v), 4];
        }
        case BSONType.DOUBLE: {
            const v = readDouble(buffer, offset);
            return [String(v), 8];
        }
        case BSONType.BOOLEAN:
            return [buffer[offset] === 1 ? 'true' : 'false', 1];
        case BSONType.NULL:
        case BSONType.UNDEFINED:
            return ['', 0];
        case BSONType.LONG: {
            const v = readInt64(buffer, offset);
            return [String(v), 8];
        }
        case BSONType.OID:
            return [readBytesAsHex(buffer, offset, 12), 12];
        default: {
            const bsonName = bsonTypeNames[bsonType] || `0x${bsonType.toString(16)}`;
            throw new BSONError(`Cannot convert bson type ${bsonName} to string`, 'DK-B030');
        }
    }
}

/**
 * Read a number value from BSON, coercing from other types if needed.
 * Returns [value, newOffset].
 * @internal Called by JIT-generated code.
 */
export function readNumberValue(buffer: Uint8Array, offset: number, bsonType: number): [number, number] {
    switch (bsonType) {
        case BSONType.INT:
            return [readInt32LE(buffer, offset), 4];
        case BSONType.DOUBLE: {
            const v = readDouble(buffer, offset);
            return [Number.isNaN(v) ? 0 : v, 8];
        }
        case BSONType.LONG: {
            const v = readInt64(buffer, offset);
            return [Number(v), 8];
        }
        case BSONType.BOOLEAN:
            return [buffer[offset] === 1 ? 1 : 0, 1];
        case BSONType.STRING: {
            const [s, consumed] = readBSONString(buffer, offset);
            return [Number(s) || 0, consumed];
        }
        case BSONType.NULL:
        case BSONType.UNDEFINED:
            return [0, 0];
        default:
            return [0, skipValue(buffer, offset, bsonType) - offset];
    }
}

/**
 * Read a boolean value from BSON, coercing from other types if needed.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readBooleanValue(buffer: Uint8Array, offset: number, bsonType: number): [boolean, number] {
    switch (bsonType) {
        case BSONType.BOOLEAN:
            return [buffer[offset] === 1, 1];
        case BSONType.INT:
            return [readInt32LE(buffer, offset) !== 0, 4];
        case BSONType.DOUBLE:
            return [readDouble(buffer, offset) !== 0, 8];
        case BSONType.LONG:
            return [readInt64(buffer, offset) !== 0n, 8];
        case BSONType.STRING: {
            // Non-empty string is truthy, empty string is falsy
            const [s, consumed] = readBSONString(buffer, offset);
            return [s.length > 0, consumed];
        }
        case BSONType.NULL:
        case BSONType.UNDEFINED:
            return [false, 0];
        default:
            return [false, skipValue(buffer, offset, bsonType) - offset];
    }
}

/**
 * Read a bigint value from BSON.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readBigIntValue(buffer: Uint8Array, offset: number, bsonType: number): [bigint, number] {
    switch (bsonType) {
        case BSONType.LONG:
            return [readInt64(buffer, offset), 8];
        case BSONType.INT:
            return [BigInt(readInt32LE(buffer, offset)), 4];
        case BSONType.DOUBLE: {
            const v = readDouble(buffer, offset);
            return [BigInt(Math.trunc(v)), 8];
        }
        case BSONType.BOOLEAN:
            return [buffer[offset] === 1 ? 1n : 0n, 1];
        case BSONType.STRING: {
            const [s, consumed] = readBSONString(buffer, offset);
            return [BigInt(s), consumed];
        }
        case BSONType.NULL:
        case BSONType.UNDEFINED:
            return [0n, 0];
        default:
            return [0n, skipValue(buffer, offset, bsonType) - offset];
    }
}

/** Maximum BSON binary size for BigInt to prevent CPU exhaustion (16MB = BSON document limit). */
const MAX_BIGINT_BINARY_SIZE = 16 * 1024 * 1024;

/**
 * Read an unsigned BinaryBigInt from BSON BINARY.
 * Format: 4-byte size + 1-byte subtype + N-byte big-endian hex data.
 * Returns [value, bytesConsumed].
 */
function readBinaryBigInt(buffer: Uint8Array, offset: number): [bigint, number] {
    const size = readInt32LE(buffer, offset);
    if (size === 0) return [0n, 5]; // 4 bytes size + 1 byte subtype
    if (size < 0 || size > MAX_BIGINT_BINARY_SIZE)
        throw new BSONError('Invalid BinaryBigInt: size out of bounds', 'DK-B020');
    let hex = '';
    for (let i = 0; i < size; i++) {
        hex += hexTable[buffer[offset + 5 + i]]; // skip 4-byte size + 1-byte subtype
    }
    return [BigInt('0x' + hex), 5 + size];
}

/**
 * Read a SignedBinaryBigInt from BSON BINARY.
 * Format: 4-byte size + 1-byte subtype + 1-byte signum (0=positive, 255=negative) + N-byte big-endian hex data.
 * Returns [value, bytesConsumed].
 */
function readSignedBinaryBigInt(buffer: Uint8Array, offset: number): [bigint, number] {
    const size = readInt32LE(buffer, offset);
    if (size === 0) return [0n, 5];
    if (size < 0 || size > MAX_BIGINT_BINARY_SIZE)
        throw new BSONError('Invalid SignedBinaryBigInt: size out of bounds', 'DK-B020');
    const signum = buffer[offset + 5]; // first data byte after size(4)+subtype(1)
    let hex = '';
    for (let i = 1; i < size; i++) {
        hex += hexTable[buffer[offset + 5 + i]];
    }
    const value = hex.length > 0 ? BigInt('0x' + hex) : 0n;
    return [signum === 255 ? -value : value, 5 + size];
}

/**
 * Read a Date value from BSON.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readDateValue(buffer: Uint8Array, offset: number, bsonType: number): [Date, number] {
    switch (bsonType) {
        case BSONType.DATE:
            return [new Date(Number(readInt64(buffer, offset))), 8];
        case BSONType.LONG:
            return [new Date(Number(readInt64(buffer, offset))), 8];
        case BSONType.INT:
            return [new Date(readInt32LE(buffer, offset)), 4];
        case BSONType.DOUBLE: {
            const v = readDouble(buffer, offset);
            return [new Date(v), 8];
        }
        case BSONType.STRING: {
            const [s, consumed] = readBSONString(buffer, offset);
            return [new Date(s), consumed];
        }
        case BSONType.NULL:
        case BSONType.UNDEFINED:
            return [new Date(0), 0];
        default:
            return [new Date(0), skipValue(buffer, offset, bsonType) - offset];
    }
}

/**
 * Read a UUID value from BSON BINARY subtype 4.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readUUIDValue(buffer: Uint8Array, offset: number, bsonType: number): [string, number] {
    if (bsonType === BSONType.BINARY) {
        const length = readInt32LE(buffer, offset);
        const subtype = buffer[offset + 4];
        if (subtype === BSON_BINARY_SUBTYPE_UUID && length === 16) {
            return [readBytesAsUUID(buffer, offset + 5), 4 + 1 + length];
        }
        return ['', 4 + 1 + length];
    }
    if (bsonType === BSONType.STRING) {
        const [s, consumed] = readBSONString(buffer, offset);
        return [validateUUID(s, bsonType), consumed];
    }
    throw new BSONError(`Cannot convert ${bsonTypeNames[bsonType] || bsonType} to UUID`, 'DK-B030');
}

/**
 * Read a MongoId (ObjectId) value from BSON.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readMongoIdValue(buffer: Uint8Array, offset: number, bsonType: number): [string, number] {
    if (bsonType === BSONType.OID) {
        return [readBytesAsHex(buffer, offset, 12), 12];
    }
    if (bsonType === BSONType.STRING) {
        const [s, consumed] = readBSONString(buffer, offset);
        return [validateMongoId(s, bsonType), consumed];
    }
    // For non-string types, try to convert and validate
    if (bsonType === BSONType.INT) {
        const v = readInt32LE(buffer, offset);
        throw new BSONError(`Cannot convert ${v} to MongoId.`, 'DK-B030');
    }
    throw new BSONError(`Cannot convert bson type ${bsonTypeNames[bsonType] || bsonType} to MongoId.`, 'DK-B030');
}

/**
 * Read a RegExp value from BSON.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readRegExpValue(buffer: Uint8Array, offset: number, bsonType: number): [RegExp, number] {
    if (bsonType === BSONType.REGEX) {
        const [pattern, patternLen] = readCString(buffer, offset);
        const [flags, flagsLen] = readCString(buffer, offset + patternLen);
        return [new RegExp(pattern, flags.replace(/s/g, 'g')), patternLen + flagsLen];
    }
    if (bsonType === BSONType.STRING) {
        const [s, consumed] = readBSONString(buffer, offset);
        try {
            return [new RegExp(s), consumed];
        } catch {
            return [new RegExp(''), consumed];
        }
    }
    const consumed = skipValue(buffer, offset, bsonType) - offset;
    return [new RegExp(''), consumed];
}

/**
 * Read a Uint8Array value from BSON BINARY.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readBinaryValue(buffer: Uint8Array, offset: number, bsonType: number): [Uint8Array, number] {
    if (bsonType === BSONType.BINARY) {
        const length = readInt32LE(buffer, offset);
        if (length < 0) throw new BSONError('Invalid BSON binary: negative length', 'DK-B020');
        const dataOffset = offset + 5; // 4 bytes length + 1 byte subtype
        // Use Uint8Array constructor to avoid returning Node.js Buffer
        return [new Uint8Array(buffer.buffer, buffer.byteOffset + dataOffset, length), 4 + 1 + length];
    }
    const consumed = skipValue(buffer, offset, bsonType) - offset;
    return [new Uint8Array(0), consumed];
}

/**
 * Read an ArrayBuffer value from BSON BINARY.
 * Returns [value, bytesConsumed].
 * @internal Called by JIT-generated code.
 */
export function readArrayBufferValue(buffer: Uint8Array, offset: number, bsonType: number): [ArrayBuffer, number] {
    if (bsonType === BSONType.BINARY) {
        const length = readInt32LE(buffer, offset);
        const dataOffset = offset + 5;
        const slice = buffer.slice(dataOffset, dataOffset + length);
        return [nodeBufferToArrayBuffer(slice), 4 + 1 + length];
    }
    const consumed = skipValue(buffer, offset, bsonType) - offset;
    return [new ArrayBuffer(0), consumed];
}

/**
 * Skip a cstring (null-terminated) field name.
 * Returns the offset after the null terminator.
 * @internal Called by JIT-generated code.
 */
export function skipCString(buffer: Uint8Array, offset: number): number {
    const len = buffer.length;
    while (offset < len && buffer[offset] !== 0) offset++;
    if (offset >= len) throw new BSONError('Unexpected end of buffer while reading field name', 'DK-B020');
    return offset + 1;
}

/**
 * Validate a string value against a template literal pattern.
 * Returns the validated string or throws.
 */
function validateTemplateLiteral(value: string, pattern: RegExp, typeName: string): string {
    if (pattern.test(value)) return value;
    throw new BSONError(`Cannot convert ${value} to ${typeName}`, 'DK-B030');
}

/**
 * Validate a MongoId string (must be 24 hex characters).
 */
function validateMongoId(value: string, bsonType: number): string {
    if (/^[0-9a-fA-F]{24}$/.test(value)) return value;
    throw new BSONError(`Cannot convert ${value} to MongoId.`, 'DK-B030');
}

/**
 * Validate a UUID string (must be uuid format).
 */
function validateUUID(value: string, bsonType: number): string {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
    throw new BSONError(`Cannot convert ${value} to UUID`, 'DK-B030');
}

/**
 * Try to validate a UUID string, returning undefined on failure (for union contexts).
 */
function tryValidateUUID(value: string): string | undefined {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
    return undefined;
}

/**
 * Try to validate a MongoId string, returning undefined on failure (for union contexts).
 */
function tryValidateMongoId(value: string): string | undefined {
    if (/^[0-9a-fA-F]{24}$/.test(value)) return value;
    return undefined;
}

/**
 * Create a reference instance from a primary key value.
 */
function createReferenceFromPk(type: TypeClass, pkValue: unknown): unknown {
    const reflection = ReflectionClass.from(type.classType);
    const pk = reflection.getPrimary();
    return createReference(type.classType, { [pk.getName()]: pkValue });
}

/**
 * Read value from BSON and deserialize as the primary key type of a reference.
 */
function deserializeReferencePk(
    buffer: Uint8Array,
    offset: number,
    bsonType: number,
    type: TypeClass,
): [unknown, number] {
    const reflection = ReflectionClass.from(type.classType);
    const pk = reflection.getPrimary();
    const pkType = pk.getType();
    // Deserialize the primary key value
    switch (pkType.kind) {
        case ReflectionKind.number: {
            const result = readNumberValue(buffer, offset, bsonType);
            return [createReference(type.classType, { [pk.getName()]: result[0] }), result[1]];
        }
        case ReflectionKind.string: {
            const result = readStringValue(buffer, offset, bsonType);
            return [createReference(type.classType, { [pk.getName()]: result[0] }), result[1]];
        }
        default: {
            // For other pk types (bigint, etc.), try number
            const result = readNumberValue(buffer, offset, bsonType);
            return [createReference(type.classType, { [pk.getName()]: result[0] }), result[1]];
        }
    }
}

// ============================================================================
// Extracted Deserializer Cache (for recursive types)
// ============================================================================

type DeserializeFn = (buffer: Uint8Array, offset: number) => [any, number];

const extractedDeserializerCache = new WeakMap<Type, DeserializeFn>();

function getExtractedDeserializer(type: TypeObjectLiteral | TypeClass): DeserializeFn {
    const existing = extractedDeserializerCache.get(type);
    if (existing) return existing;

    // Create wrapper immediately for recursive references
    const holder: { fn: DeserializeFn | undefined } = { fn: undefined };
    const wrapper: DeserializeFn = (buffer, offset) => holder.fn!(buffer, offset);
    extractedDeserializerCache.set(type, wrapper);

    // Build the real deserializer
    holder.fn = fn(
        arg<Uint8Array>('buffer'),
        arg<number>('offset'),
        (ib: Builder, ibuffer: Ref<Uint8Array>, ioffset: Ref<number>) => {
            const innerCtx = new BSONBuildState();
            innerCtx.pushType(type);
            return buildDocumentBody(ib, ibuffer, ioffset, type, innerCtx);
        },
    );

    return wrapper;
}

// ============================================================================
// Nested Shape Handle (for nested object types)
// ============================================================================
// Shape-learning for nested objects. Returns [value, newOffset] so the outer
// JIT knows where to continue reading.

/**
 * Handle for nested shape-learning deserialization.
 * Returns [value, newOffset] to allow the outer JIT to continue.
 */
interface NestedShapeHandle {
    fn: (buffer: Uint8Array, offset: number) => [any, number];
}

const nestedShapeHandleCache = new WeakMap<Type, NestedShapeHandle>();

/**
 * Get a shape-learning handle for a nested object type.
 *
 * Unlike getExtractedDeserializer (base JIT ~7M ops/sec), this uses
 * shape learning for ~30M+ ops/sec on nested objects.
 */
function getNestedShapeHandle(type: TypeObjectLiteral | TypeClass): NestedShapeHandle {
    const existing = nestedShapeHandleCache.get(type);
    if (existing) return existing;

    // Create handle immediately for recursive references
    const handle: NestedShapeHandle = { fn: null as any };
    nestedShapeHandleCache.set(type, handle);

    // Get type info and create slow path
    const ctx = new BSONBuildState();
    const typeFields = getTypeFieldInfo(type, ctx);

    // Slow path wraps base deserializer
    const baseDeserializer = getExtractedDeserializer(type);
    const slowPath = baseDeserializer;

    // Learned shapes for this type
    const learnedShapes: { firstByte: number; jit: (buf: Uint8Array, off: number) => any }[] = [];
    const failedFirstBytes = new Set<number>(); // firstBytes where buildShapeJit returned null
    const BAILOUT = Symbol('BAILOUT');

    // Generate dispatcher JIT using Builder API
    function regenerateDispatcher(): void {
        if (learnedShapes.length === 0) {
            handle.fn = initialLearner;
            return;
        }
        handle.fn = buildShapeDispatcher(learnedShapes, BAILOUT, slowPath, onBailout) as any;
    }

    function onBailout(buf: Uint8Array, offset: number): [any, number] {
        const firstByte = buf[offset + 5];

        // Already tried this firstByte and JIT generation failed — go straight to slow path
        if (failedFirstBytes.has(firstByte)) {
            return slowPath(buf, offset);
        }

        const existing = learnedShapes.find(s => s.firstByte === firstByte);
        if (existing) {
            return slowPath(buf, offset);
        }

        const shape = learnShape(buf, offset);
        const nestedClassType = type.kind === ReflectionKind.class ? (type as TypeClass) : undefined;
        const jit = buildShapeJit(shape, typeFields, BAILOUT, true, nestedClassType);
        if (jit) {
            learnedShapes.push({ firstByte, jit });
            regenerateDispatcher();
            const result = jit(buf, offset);
            if (result !== BAILOUT) return result as [any, number];
            return slowPath(buf, offset);
        }

        // Record this firstByte as unlearnable — don't retry learnShape on every call
        failedFirstBytes.add(firstByte);
        return slowPath(buf, offset);
    }

    function initialLearner(buffer: Uint8Array, offset: number): [any, number] {
        return onBailout(buffer, offset);
    }

    handle.fn = initialLearner;
    return handle;
}

// ============================================================================
// JIT Builder Functions
// ============================================================================

/**
 * Create the base (slow-path) deserializer using the Builder API.
 * This handles all edge cases including coercion, complex types, and arbitrary field order.
 */
function createBaseDeserializer(type: TypeObjectLiteral | TypeClass, ctx: BSONBuildState): BSONDeserializer<any> {
    return fn(
        arg<Uint8Array>('buffer'),
        arg<number>('offset', 0),
        (b: Builder, buffer: Ref<Uint8Array>, offset: Ref<number>) => {
            return buildDocumentBody(b, buffer, offset, type, ctx, true);
        },
    );
}

/**
 * Create a top-level deserializer for a type.
 *
 * Uses shape-learning for ~60% speedup on common cases:
 * - On first call, learns field order from BSON document
 * - Generates JIT code optimized for that specific field order
 * - Falls back to slow-path for complex types or shape mismatches
 */
function createDeserializer(type: Type): BSONDeserializer<any> {
    // Handle union of objects at top level (e.g., { a: string } | { b: number })
    if (type.kind === ReflectionKind.union) {
        return createUnionOfObjectsDeserializer(type as TypeUnion);
    }

    if (type.kind !== ReflectionKind.objectLiteral && type.kind !== ReflectionKind.class) {
        throw new TypeNotSerializableError(ReflectionKind[type.kind]);
    }

    const objType = type as TypeObjectLiteral | TypeClass;
    const ctx = new BSONBuildState();

    // Create slow-path deserializer (handles all cases)
    const slowPath = createBaseDeserializer(objType, ctx);

    // Get type field info for shape-optimized JIT generation
    const typeFields = getTypeFieldInfo(objType, ctx);

    // Multi-shape dispatcher: learns field orderings and generates JIT per shape.
    // The handle.fn is swapped on shape mismatch to include new shapes.
    const handle: DeserializerHandle = { fn: null as any };

    // Learned shapes: array of { firstByte, jit }
    // firstByte is the first byte of the first field name (for quick dispatch)
    const learnedShapes: { firstByte: number; jit: (buf: Uint8Array, off: number) => any }[] = [];

    // Bailout sentinel - returned by shape JIT when shape doesn't match
    const BAILOUT = Symbol('BAILOUT');

    // Generate dispatcher JIT using Builder API
    function regenerateDispatcher(): void {
        if (learnedShapes.length === 0) {
            handle.fn = initialLearner;
            return;
        }
        handle.fn = buildShapeDispatcher(learnedShapes, BAILOUT, slowPath, onBailout) as any;
    }

    // Called when dispatcher can't find matching shape or shape JIT bails out
    function onBailout(buf: Uint8Array, offset: number): any {
        const shape = learnShape(buf, offset);
        const firstByte = buf[offset + 5];

        const existing = learnedShapes.find(s => s.firstByte === firstByte);
        if (existing) {
            return slowPath(buf, offset);
        }

        const topClassType = objType.kind === ReflectionKind.class ? (objType as TypeClass) : undefined;
        const jit = buildShapeJit(shape, typeFields, BAILOUT, false, topClassType);
        if (jit) {
            learnedShapes.push({ firstByte, jit });
            regenerateDispatcher();
            const result = jit(buf, offset);
            if (result !== BAILOUT) return result;
            return slowPath(buf, offset);
        }

        return slowPath(buf, offset);
    }

    // Initial learner - used before any shapes are learned
    function initialLearner(buffer: Uint8Array, offset: number = 0): any {
        return onBailout(buffer, offset);
    }

    handle.fn = initialLearner;

    // Return a simple function that delegates to the handle's current dispatcher.
    // V8 inlines this; handle.fn is swapped as new shapes are learned.
    return function deserialize(buffer: Uint8Array, offset: number = 0): any {
        return handle.fn(buffer, offset);
    };
}

/**
 * Create a deserializer for a union of object types.
 * Tries each member type and returns the first that produces a valid result.
 * Uses discriminant properties when available.
 */
function createUnionOfObjectsDeserializer(type: TypeUnion): BSONDeserializer<any> {
    // Collect object/class members
    const objectMembers = type.types.filter(
        (t): t is TypeObjectLiteral | TypeClass =>
            t.kind === ReflectionKind.objectLiteral || t.kind === ReflectionKind.class,
    );

    if (objectMembers.length === 0) {
        throw new TypeNotSerializableError(describeUnion(type));
    }

    // Build individual deserializers for each member
    const memberDeserializers = objectMembers.map(member => getBSONDeserializer(member));

    // Try to find discriminant: a property with different literal types across members
    const discriminant = findDiscriminant(objectMembers);

    if (discriminant) {
        // Fast path: use discriminant property to dispatch
        return createDiscriminantDeserializer(type, objectMembers, memberDeserializers, discriminant);
    }

    // Slow path: try each member, use the one with most matched properties
    return createTrialDeserializer(type, objectMembers, memberDeserializers);
}

/**
 * Find a discriminant property across object members.
 * Returns the property name if found, undefined otherwise.
 */
function findDiscriminant(
    members: (TypeObjectLiteral | TypeClass)[],
): { name: string; values: Map<number, any> } | undefined {
    // Get all property names from all members
    const propNames = new Set<string>();
    for (const member of members) {
        for (const t of member.types) {
            if (
                (t.kind === ReflectionKind.propertySignature || t.kind === ReflectionKind.property) &&
                !(t as TypeProperty).static &&
                typeof (t as TypePropertySignature).name === 'string'
            ) {
                propNames.add(String((t as TypePropertySignature).name));
            }
        }
    }

    // Check each property for discriminant potential
    for (const name of propNames) {
        const valueMap = new Map<number, any>(); // memberIndex → literal value
        let isDiscriminant = true;
        const seenValues = new Set<any>();

        for (let i = 0; i < members.length; i++) {
            const prop = members[i].types.find(
                (t): t is TypeProperty | TypePropertySignature =>
                    (t.kind === ReflectionKind.propertySignature || t.kind === ReflectionKind.property) &&
                    !(t as TypeProperty).static &&
                    String(t.name) === name,
            );
            if (!prop) {
                // Property doesn't exist in this member — can discriminate by existence
                continue;
            }
            if (prop.type.kind === ReflectionKind.literal) {
                const val = (prop.type as TypeLiteral).literal;
                if (seenValues.has(val)) {
                    isDiscriminant = false;
                    break;
                }
                seenValues.add(val);
                valueMap.set(i, val);
            } else {
                // Non-literal property — not a pure discriminant
                isDiscriminant = false;
                break;
            }
        }

        if (isDiscriminant && valueMap.size > 0) {
            return { name, values: valueMap };
        }
    }

    return undefined;
}

/**
 * Create a deserializer that uses a discriminant property to dispatch.
 */
function createDiscriminantDeserializer(
    type: TypeUnion,
    members: (TypeObjectLiteral | TypeClass)[],
    deserializers: BSONDeserializer<any>[],
    discriminant: { name: string; values: Map<number, any> },
): BSONDeserializer<any> {
    // Build a value → deserializer lookup
    const lookup = new Map<any, BSONDeserializer<any>>();
    for (const [idx, value] of discriminant.values) {
        lookup.set(value, deserializers[idx]);
    }

    // For members without a discriminant value, use trial deserialization
    const fallbackIndices: number[] = [];
    for (let i = 0; i < members.length; i++) {
        if (!discriminant.values.has(i)) {
            fallbackIndices.push(i);
        }
    }

    return (input: Uint8Array, offset: number = 0) => {
        let buffer: Uint8Array;
        if (Array.isArray(input)) {
            buffer = (input as unknown as [Uint8Array, number])[0];
        } else {
            buffer = input;
        }

        // Quick scan: find discriminant value in the BSON document
        const discValue = scanForFieldValue(buffer, offset, discriminant.name);
        if (discValue !== undefined) {
            const d = lookup.get(discValue);
            if (d) {
                try {
                    return d(buffer, offset);
                } catch {
                    // Discriminant matched but deserialization failed, try fallbacks
                }
            }
        }

        // Fallback: try members without discriminant values
        for (const idx of fallbackIndices) {
            try {
                return deserializers[idx](buffer, offset);
            } catch {
                continue;
            }
        }

        // Last resort: try all members
        for (const d of deserializers) {
            try {
                return d(buffer, offset);
            } catch {
                continue;
            }
        }

        throw new BSONError(`No union member matched. Expected: ${describeUnion(type)}`, 'DK-B040');
    };
}

/**
 * Count the number of fields in a BSON document without allocating strings.
 * Much cheaper than scanFieldNamesAndTypes for the common case.
 */
function countBSONFields(buffer: Uint8Array, offset: number): number {
    const docSize = readInt32LE(buffer, offset);
    if (docSize < 5 || offset + docSize > buffer.length) return 0;
    const end = offset + docSize - 1;
    let pos = offset + 4;
    let count = 0;
    while (pos < end) {
        const bsonType = buffer[pos++];
        if (bsonType === 0) break;
        count++;
        while (pos < end && buffer[pos] !== 0) pos++; // skip field name
        pos++; // null terminator
        pos = skipValue(buffer, pos, bsonType);
    }
    return count;
}

/**
 * Extract member property info for union scoring. Pre-computed once, reused per call.
 */
function extractMemberProps(members: (TypeObjectLiteral | TypeClass)[]) {
    return members.map(m => {
        const props = m.types.filter(
            (t): t is TypeProperty | TypePropertySignature =>
                t.kind === ReflectionKind.propertySignature || t.kind === ReflectionKind.property,
        );
        const literals = new Map<string, any>();
        for (const p of props) {
            if (p.type.kind === ReflectionKind.literal) {
                literals.set(String(p.name), (p.type as TypeLiteral).literal);
            }
        }
        return {
            required: props.filter(p => !isOptional(p)).map(p => String(p.name)),
            all: props.map(p => ({ name: String(p.name), type: p.type })),
            literals,
        };
    });
}

/**
 * Check if all members have unique property counts, enabling the fast field-count dispatch.
 * Returns sorted member indices (most properties first) or null if counts aren't unique.
 */
function buildFieldCountIndex(memberProps: ReturnType<typeof extractMemberProps>): number[] | null {
    const counts = memberProps.map(p => p.all.length);
    if (new Set(counts).size !== counts.length) return null;
    // Sort indices by field count descending (widest first)
    return counts.map((_, i) => i).sort((a, b) => memberProps[b].all.length - memberProps[a].all.length);
}

/**
 * Score-based dispatch: scan BSON fields, score each member, try in score order.
 * Used when field-count fast path is not applicable.
 *
 * Scoring weights aligned with packages/type/src/serializer/union.ts:
 *   property present +100, BSON type match +5, literal match +1000,
 *   literal mismatch -500, missing required -100, extra property -10
 */
function scoreAndDispatch(
    buffer: Uint8Array,
    offset: number,
    memberProps: ReturnType<typeof extractMemberProps>,
    deserializers: ((buffer: Uint8Array, offset: number) => any)[],
    unionName: string,
    literalFieldNames: Set<string>,
): any {
    const fieldInfo = scanFieldNamesAndTypes(buffer, offset);

    // Read literal field values once (reuse scanForFieldValue for each)
    const literalValues = new Map<string, any>();
    for (const name of literalFieldNames) {
        if (fieldInfo.has(name)) {
            literalValues.set(name, scanForFieldValue(buffer, offset, name));
        }
    }

    const scored: { index: number; score: number }[] = [];
    for (let i = 0; i < memberProps.length; i++) {
        const props = memberProps[i];
        let score = 0;

        for (const { name, type: propType } of props.all) {
            const bType = fieldInfo.get(name);
            if (bType !== undefined) {
                score += 100;
                if (bsonTypeMatchesType(bType, propType)) score += 5;
            }
        }

        // Literal value scoring (+1000 match, -500 mismatch)
        for (const [name, expectedValue] of props.literals) {
            const actualValue = literalValues.get(name);
            if (actualValue !== undefined) {
                if (actualValue === expectedValue) {
                    score += 1000;
                } else {
                    score -= 500;
                }
            }
        }

        for (const name of props.required) {
            if (!fieldInfo.has(name)) score -= 100;
        }

        // Extra properties penalty (-10 per extra field)
        const memberFieldNames = new Set(props.all.map(p => p.name));
        for (const key of fieldInfo.keys()) {
            if (!memberFieldNames.has(key)) score -= 10;
        }

        scored.push({ index: i, score });
    }
    scored.sort((a, b) => b.score - a.score);

    for (const { index } of scored) {
        if (scored[0].score >= 0 || index === scored[0].index) {
            try {
                return deserializers[index](buffer, offset);
            } catch {
                continue;
            }
        }
    }

    throw new BSONError(`No union member matched. Expected: ${unionName}`, 'DK-B040');
}

/**
 * Create a trial deserializer that tries each member based on property presence.
 */
function createTrialDeserializer(
    type: TypeUnion,
    members: (TypeObjectLiteral | TypeClass)[],
    deserializers: BSONDeserializer<any>[],
): BSONDeserializer<any> {
    const memberProps = extractMemberProps(members);
    const fieldCountIndex = buildFieldCountIndex(memberProps);
    const memberFieldCounts = memberProps.map(p => p.all.length);
    const unionName = describeUnion(type);
    const allLiteralFields = new Set<string>();
    for (const props of memberProps) {
        for (const [name] of props.literals) allLiteralFields.add(name);
    }

    return (input: Uint8Array, offset: number = 0) => {
        let buffer: Uint8Array;
        if (Array.isArray(input)) {
            buffer = (input as unknown as [Uint8Array, number])[0];
        } else {
            buffer = input;
        }

        if (fieldCountIndex) {
            // Fast path: count fields, try widest matching member first
            const fieldCount = countBSONFields(buffer, offset);
            for (const idx of fieldCountIndex) {
                if (memberFieldCounts[idx] <= fieldCount) {
                    try {
                        return deserializers[idx](buffer, offset);
                    } catch {
                        continue;
                    }
                }
            }
            // Fallback: try members with more fields (might succeed with defaults)
            for (const idx of fieldCountIndex) {
                if (memberFieldCounts[idx] > fieldCount) {
                    try {
                        return deserializers[idx](buffer, offset);
                    } catch {
                        continue;
                    }
                }
            }
        } else {
            return scoreAndDispatch(buffer, offset, memberProps, deserializers, unionName, allLiteralFields);
        }

        throw new BSONError(`No union member matched. Expected: ${unionName}`, 'DK-B040');
    };
}

/**
 * Scan a BSON document and return a map of field names to BSON types.
 * Only used for score-based dispatch when field-count fast path is not applicable.
 */
function scanFieldNamesAndTypes(buffer: Uint8Array, offset: number): Map<string, number> {
    const docSize = readInt32LE(buffer, offset);
    const fields = new Map<string, number>();
    if (docSize < 5 || offset + docSize > buffer.length) return fields;
    const end = offset + docSize - 1;
    let pos = offset + 4;

    while (pos < end) {
        const bsonType = buffer[pos];
        pos++;
        if (bsonType === 0) break;

        // Read field name
        const nameStart = pos;
        while (pos < end && buffer[pos] !== 0) pos++;
        const name = String.fromCharCode(...buffer.slice(nameStart, pos));
        pos++; // skip null terminator
        fields.set(name, bsonType);

        // Skip value
        pos = skipValue(buffer, pos, bsonType);
    }
    return fields;
}

/**
 * Runtime dispatcher for unions with multiple array types.
 * Reads all elements, then tries to coerce into each array type.
 * Returns [result, endOffset].
 */
function deserializeMultiArrayUnion(
    buffer: Uint8Array,
    offset: number,
    arrayTypes: Type[],
    unionName: string,
): [any[], number] {
    // Read array envelope
    const arrSize = readInt32LE(buffer, offset);
    if (arrSize < 5 || offset + arrSize > buffer.length) {
        throw new BSONError('Invalid BSON array: size out of bounds', 'DK-B020');
    }
    const arrEnd = offset + arrSize - 1;
    let pos = offset + 4;

    // Read all elements as raw values
    const rawValues: { value: any; bsonType: number }[] = [];
    while (pos < arrEnd) {
        const elemBsonType = buffer[pos];
        pos++;
        if (elemBsonType === 0) break;
        // Skip index cstring
        while (pos < arrEnd && buffer[pos] !== 0) pos++;
        pos++;
        const value = parseValueAny(buffer, pos, elemBsonType);
        rawValues.push({ value, bsonType: elemBsonType });
        pos = skipValue(buffer, pos, elemBsonType);
    }

    // Try each array type: pick the one where element BSON types best match
    const matchingTypes: Type[] = [];
    for (const arrayType of arrayTypes) {
        if (arrayType.kind === ReflectionKind.array) {
            const elemType = (arrayType as TypeArray).type;
            if (allElementsMatch(rawValues, elemType)) {
                matchingTypes.push(arrayType);
            }
        }
    }

    // If exactly one type matches by BSON type, use it
    if (matchingTypes.length === 1) {
        const elemType = (matchingTypes[0] as TypeArray).type;
        const result = rawValues.map(rv => coerceToType(rv.value, rv.bsonType, elemType));
        return [result, arrEnd + 1];
    }

    // Multiple matches (e.g., all class arrays) — use discriminant or trial deserialization
    if (matchingTypes.length > 1) {
        // Try discriminant-based dispatch on element types
        const elemTypes = matchingTypes
            .filter(t => t.kind === ReflectionKind.array)
            .map(t => (t as TypeArray).type)
            .filter(
                (t): t is TypeObjectLiteral | TypeClass =>
                    t.kind === ReflectionKind.objectLiteral || t.kind === ReflectionKind.class,
            );
        if (elemTypes.length === matchingTypes.length && rawValues.length > 0) {
            const discriminant = findDiscriminant(elemTypes);
            const firstElemOff =
                rawValues[0].bsonType === BSONType.OBJECT ? findFirstArrayElementOffset(buffer, offset) : -1;

            if (discriminant && firstElemOff >= 0) {
                const discValue = scanForFieldValue(buffer, firstElemOff, discriminant.name);
                if (discValue !== undefined) {
                    for (const [idx, val] of discriminant.values) {
                        if (val === discValue) {
                            const result = deserializeArrayElements(buffer, offset, elemTypes[idx]);
                            return [result, arrEnd + 1];
                        }
                    }
                }
            }

            // No discriminant or no match — filter by property existence, then try trial
            if (firstElemOff >= 0) {
                const elemFieldNames = scanObjectFieldNames(buffer, firstElemOff);
                // When discriminant exists, only try types that either:
                // (a) don't have the discriminant property, or (b) have matching required fields
                const candidateTypes = discriminant
                    ? elemTypes.filter((et, i) => {
                          // Skip types that have the discriminant (they should have matched above)
                          if (discriminant.values.has(i)) return false;
                          // Check that at least one required property exists in the element
                          return hasMatchingProperty(et, elemFieldNames);
                      })
                    : elemTypes.filter(et => hasMatchingProperty(et, elemFieldNames));

                for (const elemType of candidateTypes) {
                    try {
                        const result = deserializeArrayElements(buffer, offset, elemType);
                        return [result, arrEnd + 1];
                    } catch {
                        continue;
                    }
                }

                // All candidates rejected — throw
                throw new BSONError(`No union member matched. Expected: ${unionName}`, 'DK-B040');
            }
        }
    }

    // Fallback: use first type (for non-class element types)
    if (arrayTypes.length > 0 && arrayTypes[0].kind === ReflectionKind.array) {
        const elemType = (arrayTypes[0] as TypeArray).type;
        const result = rawValues.map(rv => coerceToType(rv.value, rv.bsonType, elemType));
        return [result, arrEnd + 1];
    }

    throw new BSONError(`No union member matched. Expected: ${unionName}`, 'DK-B040');
}

/**
 * Create a cached dispatcher for unions with multiple object types.
 * Called once at JIT compile time. Returns a fast runtime function.
 * Uses discriminant detection, field-count fast path, or score-based dispatch.
 */
function createMultiObjectUnionDispatcher(
    objectTypes: Type[],
    unionName: string,
): (buffer: Uint8Array, offset: number) => [any, number] {
    const objectMembers = objectTypes as (TypeObjectLiteral | TypeClass)[];
    const handles = objectMembers.map(t => getNestedShapeHandle(t));
    const discriminant = findDiscriminant(objectMembers);
    const discriminantNameBytes = discriminant ? encodePropertyName(discriminant.name) : undefined;
    const memberProps = extractMemberProps(objectMembers);
    const fieldCountIndex = buildFieldCountIndex(memberProps);
    const memberFieldCounts = memberProps.map(p => p.all.length);
    const allLiteralFields = new Set<string>();
    for (const props of memberProps) {
        for (const [name] of props.literals) allLiteralFields.add(name);
    }
    // Callable wrappers for scoreAndDispatch — handle.fn is mutated by shape learning
    const deserializerFns = handles.map(h => (buf: Uint8Array, off: number) => h.fn(buf, off));

    return (buffer: Uint8Array, offset: number): [any, number] => {
        // Discriminant fast path (pre-encoded name bytes — zero allocation)
        if (discriminant && discriminantNameBytes) {
            const discValue = scanForFieldValuePreEncoded(buffer, offset, discriminantNameBytes);
            if (discValue !== undefined) {
                for (const [idx, val] of discriminant.values) {
                    if (val === discValue) {
                        try {
                            return handles[idx].fn(buffer, offset);
                        } catch {
                            break;
                        }
                    }
                }
            }
        }

        if (fieldCountIndex) {
            // Fast path: count fields, try widest matching member first (no string allocation)
            const fieldCount = countBSONFields(buffer, offset);
            for (const idx of fieldCountIndex) {
                if (memberFieldCounts[idx] <= fieldCount) {
                    try {
                        return handles[idx].fn(buffer, offset);
                    } catch {
                        continue;
                    }
                }
            }
            // Fallback: try members with more fields
            for (const idx of fieldCountIndex) {
                if (memberFieldCounts[idx] > fieldCount) {
                    try {
                        return handles[idx].fn(buffer, offset);
                    } catch {
                        continue;
                    }
                }
            }
        } else {
            return scoreAndDispatch(buffer, offset, memberProps, deserializerFns, unionName, allLiteralFields);
        }

        throw new BSONError(`No union member matched. Expected: ${unionName}`, 'DK-B040');
    };
}

/**
 * Check if all raw values can be matched by the target element type.
 */
function allElementsMatch(rawValues: { value: any; bsonType: number }[], elemType: Type): boolean {
    for (const rv of rawValues) {
        if (!bsonTypeMatchesType(rv.bsonType, elemType)) return false;
    }
    return true;
}

/**
 * Check if a BSON type is compatible with a target Type.
 */
function bsonTypeMatchesType(bsonType: number, type: Type): boolean {
    if (type.kind === ReflectionKind.any || type.kind === ReflectionKind.unknown) return true;
    if (type.kind === ReflectionKind.union) {
        return (type as TypeUnion).types.some(t => bsonTypeMatchesType(bsonType, t));
    }
    switch (type.kind) {
        case ReflectionKind.string:
            return bsonType === BSONType.STRING;
        case ReflectionKind.number:
            return bsonType === BSONType.INT || bsonType === BSONType.DOUBLE || bsonType === BSONType.BOOLEAN;
        case ReflectionKind.boolean:
            return bsonType === BSONType.BOOLEAN;
        case ReflectionKind.bigint:
            return bsonType === BSONType.LONG;
        case ReflectionKind.null:
            return bsonType === BSONType.NULL;
        case ReflectionKind.undefined:
            return bsonType === BSONType.UNDEFINED;
        case ReflectionKind.class:
            if ((type as TypeClass).classType === Date) return bsonType === BSONType.DATE;
            if ((type as TypeClass).classType === RegExp) return bsonType === BSONType.REGEX;
            return bsonType === BSONType.OBJECT;
        case ReflectionKind.objectLiteral:
            return bsonType === BSONType.OBJECT;
        case ReflectionKind.array:
        case ReflectionKind.tuple:
            return bsonType === BSONType.ARRAY;
        default:
            return false;
    }
}

/**
 * Coerce a raw value to a target type (used by multi-array union runtime dispatch).
 */
function coerceToType(value: any, bsonType: number, type: Type): any {
    if (type.kind === ReflectionKind.union) {
        // For union element types, find the matching member and coerce
        for (const member of (type as TypeUnion).types) {
            if (bsonTypeMatchesType(bsonType, member)) {
                return coerceToType(value, bsonType, member);
            }
        }
        return value;
    }
    switch (type.kind) {
        case ReflectionKind.string:
            return String(value);
        case ReflectionKind.number:
            return Number(value);
        case ReflectionKind.boolean:
            return Boolean(value);
        case ReflectionKind.bigint:
            return BigInt(value);
        case ReflectionKind.class: {
            if (value && typeof value === 'object') {
                const cls = (type as TypeClass).classType;
                const instance = Object.create(cls.prototype);
                return Object.assign(instance, value);
            }
            return value;
        }
        default:
            return value;
    }
}

/**
 * Quickly scan a BSON document for a field value (used for discriminant dispatch).
 * Returns the primitive value of the field, or undefined if not found.
 */
function scanForFieldValue(buffer: Uint8Array, offset: number, fieldName: string): any {
    return scanForFieldValuePreEncoded(buffer, offset, encodePropertyName(fieldName));
}

/**
 * Like scanForFieldValue but with pre-encoded name bytes (zero allocation in hot path).
 */
function scanForFieldValuePreEncoded(buffer: Uint8Array, offset: number, nameBytes: number[]): any {
    const docSize = readInt32LE(buffer, offset);
    if (docSize < 5 || offset + docSize > buffer.length) return undefined;
    const end = offset + docSize - 1;
    let pos = offset + 4;

    while (pos < end) {
        const bsonType = buffer[pos];
        pos++;
        if (bsonType === 0) break;

        // Check field name
        let nameMatch = true;
        for (let i = 0; i < nameBytes.length; i++) {
            if (buffer[pos + i] !== nameBytes[i]) {
                nameMatch = false;
                break;
            }
        }
        if (nameMatch && buffer[pos + nameBytes.length] === 0) {
            pos += nameBytes.length + 1;
            // Read value based on BSON type
            return readPrimitiveValue(buffer, pos, bsonType);
        }

        // Skip name
        while (pos < end && buffer[pos] !== 0) pos++;
        pos++;
        // Skip value
        pos = skipValue(buffer, pos, bsonType);
    }
    return undefined;
}

/**
 * Scan a BSON object's field names (without reading values).
 */
function scanObjectFieldNames(buffer: Uint8Array, offset: number): Set<string> {
    const names = new Set<string>();
    const docSize = readInt32LE(buffer, offset);
    if (docSize < 5 || offset + docSize > buffer.length) return names;
    const end = offset + docSize - 1;
    let pos = offset + 4;
    while (pos < end) {
        const bsonType = buffer[pos];
        if (bsonType === 0) break;
        pos++;
        // Read field name
        let nameStart = pos;
        while (pos < end && buffer[pos] !== 0) pos++;
        const name = String.fromCharCode(...buffer.slice(nameStart, pos));
        names.add(name);
        pos++; // skip null terminator
        pos = skipValue(buffer, pos, bsonType);
    }
    return names;
}

/**
 * Check if a class/object type has at least one required property that exists in the field names set.
 */
function hasMatchingProperty(type: TypeObjectLiteral | TypeClass, fieldNames: Set<string>): boolean {
    const props =
        type.kind === ReflectionKind.class
            ? type.types.filter((t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static)
            : type.types.filter((t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature);
    for (const prop of props) {
        const name = memberNameToString(prop.name);
        if (!isOptional(prop) && fieldNames.has(name)) return true;
    }
    return false;
}

/**
 * Deserialize BSON array elements using a specific object/class element type.
 * Used by multi-array union dispatch for class arrays.
 */
function deserializeArrayElements(buffer: Uint8Array, offset: number, elemType: TypeObjectLiteral | TypeClass): any[] {
    const arrSize = readInt32LE(buffer, offset);
    const arrEnd = offset + arrSize - 1;
    let pos = offset + 4;
    const result: any[] = [];
    const elemDeser = getExtractedDeserializer(elemType);

    while (pos < arrEnd) {
        const bsonType = buffer[pos];
        if (bsonType === 0) break;
        pos++; // skip type byte
        while (buffer[pos] !== 0) pos++; // skip index cstring
        pos++; // skip null terminator
        const [val, newPos] = elemDeser(buffer, pos);
        result.push(val);
        pos = newPos;
    }

    return result;
}

/**
 * Find the byte offset of the first element in a BSON array.
 * Returns the offset of the element's document (for OBJECT elements), or -1 if empty.
 */
function findFirstArrayElementOffset(buffer: Uint8Array, offset: number): number {
    const arrSize = readInt32LE(buffer, offset);
    const arrEnd = offset + arrSize - 1;
    let pos = offset + 4;
    if (pos >= arrEnd) return -1;
    const bsonType = buffer[pos];
    if (bsonType === 0) return -1;
    pos++; // skip type byte
    // Skip index cstring (e.g., "0\0")
    while (buffer[pos] !== 0) pos++;
    pos++; // skip null terminator
    return pos;
}

/**
 * Read a primitive value from BSON at the given position.
 */
function readPrimitiveValue(buffer: Uint8Array, offset: number, bsonType: number): any {
    switch (bsonType) {
        case BSONType.STRING: {
            const [s] = readBSONString(buffer, offset);
            return s;
        }
        case BSONType.INT:
            return readInt32LE(buffer, offset);
        case BSONType.DOUBLE:
            return readDouble(buffer, offset);
        case BSONType.BOOLEAN:
            return buffer[offset] === 1;
        case BSONType.NULL:
            return null;
        default:
            return undefined;
    }
}

/**
 * Build the document scanning body. Returns a Ref to [result, endOffset] tuple.
 */
function buildDocumentBody(
    b: Builder,
    buffer: Ref<Uint8Array>,
    offsetRef: Ref<number>,
    type: TypeObjectLiteral | TypeClass,
    ctx: BSONBuildState,
    topLevel: boolean = false,
    forceWhileLoop: boolean = false,
): Ref<any> {
    // Read document size (inline byte read — no DataView needed)
    const docSize = b.let(inlineInt32Read(b, buffer, offsetRef), 'docSize');
    const end = b.let(b.add(offsetRef, b.sub(docSize, b.lit(1))), 'end');
    const o = b.var_<number>(b.add(offsetRef, b.lit(4)), 'o');

    // Get properties based on type kind
    const properties: (TypeProperty | TypePropertySignature)[] =
        type.kind === ReflectionKind.class
            ? type.types.filter((t): t is TypeProperty => t.kind === ReflectionKind.property && !t.static)
            : type.types.filter((t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature);

    // Filter excluded properties
    const activeProps = properties.filter(p => !excludedAnnotation.isExcluded(p.type, 'bson'));

    const indexSignature = type.types.find((t): t is TypeIndexSignature => t.kind === ReflectionKind.indexSignature);

    // Classify properties: simple required ones can skip the UNSET sentinel
    const propVars = new Map<
        string,
        { varRef: VarRef<any>; prop: TypeProperty | TypePropertySignature; bsonName: string; usesSentinel: boolean }
    >();

    // Track embedded properties for later reconstruction
    interface EmbeddedInfo {
        parentProp: TypeProperty | TypePropertySignature;
        prefix: string;
        embeddedType: TypeClass | TypeObjectLiteral;
        subBsonNames: string[];
    }
    const embeddedInfos: EmbeddedInfo[] = [];
    const embeddedParentNames = new Set<string>();

    for (const prop of activeProps) {
        const propType = prop.type;

        // Check for Embedded<T> annotation — expand sub-properties with prefix
        const embedded = embeddedAnnotation.getFirst(propType);
        if (embedded && (propType.kind === ReflectionKind.class || propType.kind === ReflectionKind.objectLiteral)) {
            const prefix = embedded.prefix ?? '';
            const embeddedType = propType as TypeClass | TypeObjectLiteral;
            const members = resolveTypeMembers(embeddedType);
            const subBsonNames: string[] = [];

            for (const member of members) {
                if (!isPropertyMemberType(member)) continue;
                const subProp = member as TypeProperty | TypePropertySignature;
                const subPropName = memberNameToString(subProp.name);
                const bsonName = prefix + subPropName;

                const optional = isOptional(subProp);
                const propHasDefault = hasDefaultValue(subProp);
                const typeDefault = getDefaultForType(subProp.type);
                const canSkipSentinel = !optional && !propHasDefault && typeDefault !== undefined;
                const initialValue = canSkipSentinel ? typeDefault : UNSET;
                const varRef = b.var_(initialValue, bsonName);
                propVars.set(bsonName, { varRef, prop: subProp, bsonName, usesSentinel: !canSkipSentinel });
                subBsonNames.push(bsonName);
            }

            embeddedInfos.push({ parentProp: prop, prefix, embeddedType, subBsonNames });
            embeddedParentNames.add(memberNameToString(prop.name));
            continue;
        }

        const jsName = memberNameToString(prop.name);
        const bsonName = ctx.getPropertyName(prop);
        const optional = isOptional(prop);
        const propHasDefault = hasDefaultValue(prop);
        const typeDefault = getDefaultForType(prop.type);

        // Simple required properties with known defaults skip the UNSET sentinel
        const canSkipSentinel = !optional && !propHasDefault && typeDefault !== undefined;
        const initialValue = canSkipSentinel ? typeDefault : UNSET;
        const varRef = b.var_(initialValue, jsName);
        propVars.set(bsonName, { varRef, prop, bsonName, usesSentinel: !canSkipSentinel });
    }

    // For index signatures, we need a null-prototype object to collect unknown keys.
    // Using Object.create(null) prevents prototype pollution via __proto__ keys in BSON data.
    let indexObj: Ref<any> | undefined;
    if (indexSignature) {
        indexObj = b.let(b.call(Object.create, b.lit(null)), 'indexObj');
    }

    // ═══ UNROLLED FAST PATH (Per-Field Reader Functions) ═══
    // For documents with named properties and no index signatures, generate a
    // separate reader function for each field. Each reader tries to match its
    // expected field name at the current offset and deserialize the value.
    //
    // V8 optimizes per-field functions independently, avoiding the 2.8x slowdown
    // caused by the mutable fast-flag pattern (70M → 170M ops/sec for int32x3).
    // The slow-path fallback is in a separate function to keep the main function
    // body small and V8-friendly.
    const canUnroll = !forceWhileLoop && ctx.depth === 0 && propVars.size > 0 && propVars.size <= 24 && !indexSignature;

    if (canUnroll) {
        // ── Pattern E: Delegated fallback + shared _r array ──
        // Each reader function is TINY (name match + primary BSON type inline read).
        // All complex logic (coercion, null handling) is delegated to a handleOther
        // function. This keeps readers small so V8 optimizes them aggressively.
        // A shared _r = [value, offset] array avoids per-call tuple allocation.
        const _r: [any, number] = [0, 0];

        for (const [bsonName, entry] of propVars) {
            const nameBytes = encodePropertyName(bsonName);

            const initialValue = entry.usesSentinel ? UNSET : getDefaultForType(entry.prop.type);
            const propType = entry.prop.type;
            const typeIsNullish = typeIncludesNull(propType) || isOptional(propType);
            const optional = isOptional(entry.prop);
            const propHasDefault = hasDefaultValue(entry.prop);
            const propCtx = ctx.forProperty(bsonName);

            // Determine the "core" type for primary BSON type inline read.
            // For unions like `string | null`, strip null/undefined to find the core type.
            let coreType: Type = propType;
            if (propType.kind === ReflectionKind.union) {
                const nonNullish = (propType as TypeUnion).types.filter(
                    t => t.kind !== ReflectionKind.null && t.kind !== ReflectionKind.undefined,
                );
                if (nonNullish.length === 1) coreType = nonNullish[0];
            }

            // Determine primary BSON type for inline fast path in the reader.
            // Skip primary inline for annotated types (UUID, MongoId, references) —
            // these need validation/conversion that only the full deserializeValueInto handles.
            let primaryBsonType: number | undefined;
            let primaryAdvance: number | undefined;
            const hasSpecialAnnotation =
                isUUIDType(coreType) ||
                isMongoIdType(coreType) ||
                isReferenceType(coreType) ||
                (coreType.kind === ReflectionKind.class &&
                    binaryTypes.includes((coreType as TypeClass).classType as any));
            if (!hasSpecialAnnotation) {
                if (coreType.kind === ReflectionKind.number) {
                    primaryBsonType = BSONType.INT;
                    primaryAdvance = 4;
                } else if (coreType.kind === ReflectionKind.string) {
                    primaryBsonType = BSONType.STRING;
                    // String advance is variable — handled inline
                } else if (coreType.kind === ReflectionKind.boolean) {
                    primaryBsonType = BSONType.BOOLEAN;
                    primaryAdvance = 1;
                } else if (coreType.kind === ReflectionKind.bigint) {
                    primaryBsonType = BSONType.LONG;
                    primaryAdvance = 8;
                } else if (coreType.kind === ReflectionKind.class && (coreType as TypeClass).classType === Date) {
                    primaryBsonType = BSONType.DATE;
                    primaryAdvance = 8;
                }
            }

            // ── handleOther: contains ALL complex logic (null handling, coercion, deserializeValueInto) ──
            const handleOther = fn(
                arg<Uint8Array>('buffer'),
                arg<number>('o'),
                arg<number>('ft'),
                (hb: Builder, hbuffer: Ref<Uint8Array>, hOffset: Ref<number>, hft: Ref<number>) => {
                    const ho = hb.var_<number>(hOffset, 'ho');
                    const val = hb.var_<any>(hb.lit(initialValue), 'val');

                    if ((optional || propHasDefault) && !typeIsNullish) {
                        hb.if_(
                            hb.or(hb.eq(hft, hb.lit(BSONType.NULL)), hb.eq(hft, hb.lit(BSONType.UNDEFINED))),
                            () => {
                                if (optional) {
                                    // Explicitly-set null/undefined → preserve as undefined
                                    // (distinguishes from "property not present" which stays UNSET → default)
                                    hb.setVar(val, hb.lit(undefined));
                                }
                                // If only propHasDefault but not optional: leave at UNSET → default
                            },
                            () => {
                                deserializeValueInto(hb, hbuffer, ho, hft, propType, val, propCtx);
                            },
                        );
                    } else if (
                        !typeIsNullish &&
                        (propType.kind === ReflectionKind.objectLiteral || propType.kind === ReflectionKind.class)
                    ) {
                        hb.if_(
                            hb.or(hb.eq(hft, hb.lit(BSONType.NULL)), hb.eq(hft, hb.lit(BSONType.UNDEFINED))),
                            () => {
                                hb.throw_(hb.call(makeBsonConversionError, hft, hb.lit(describeType(propType))));
                            },
                            () => {
                                deserializeValueInto(hb, hbuffer, ho, hft, propType, val, propCtx);
                            },
                        );
                    } else {
                        deserializeValueInto(hb, hbuffer, ho, hft, propType, val, propCtx);
                    }

                    // Write results to shared _r array
                    hb.set(hb.lit(_r), hb.lit(0) as any, hb.getVar(val));
                    hb.set(hb.lit(_r), hb.lit(1) as any, hb.getVar(ho));
                    hb.return_();
                },
            );

            // ── reader: TINY function — name match + primary type inline + delegate ──
            const reader = fn(
                arg<Uint8Array>('buffer'),
                arg<number>('o'),
                arg<number>('end'),
                (rb: Builder, rbuffer: Ref<Uint8Array>, oArg: Ref<number>, rend: Ref<number>) => {
                    rb.if_(rb.lt(oArg, rend), () => {
                        const ft = rb.let(rb.at(rbuffer, oArg), 'ft');

                        // Check: not terminator AND name bytes match AND null terminator
                        let check: Ref<boolean> = rb.neq(ft, rb.lit(0));
                        for (let i = 0; i < nameBytes.length; i++) {
                            check = rb.and(
                                check,
                                rb.eq(rb.at(rbuffer, rb.add(oArg, rb.lit(1 + i))), rb.lit(nameBytes[i])),
                            );
                        }
                        check = rb.and(
                            check,
                            rb.eq(rb.at(rbuffer, rb.add(oArg, rb.lit(1 + nameBytes.length))), rb.lit(0)),
                        );

                        rb.if_(check, () => {
                            // Match! Advance past type byte + name + null terminator
                            const dataOffset = rb.let(rb.add(oArg, rb.lit(1 + nameBytes.length + 1)), 'do');

                            if (primaryBsonType !== undefined) {
                                // Inline primary BSON type read (keeps reader body TINY)
                                rb.if_(rb.eq(ft, rb.lit(primaryBsonType)), () => {
                                    if (primaryBsonType === BSONType.INT) {
                                        // Int32: inline byte read
                                        rb.set(rb.lit(_r), rb.lit(0) as any, inlineInt32Read(rb, rbuffer, dataOffset));
                                        rb.set(rb.lit(_r), rb.lit(1) as any, rb.add(dataOffset, rb.lit(4)));
                                        rb.return_();
                                    } else if (primaryBsonType === BSONType.STRING) {
                                        // String: read length, then string data
                                        const strLen = rb.let(
                                            rb.sub(inlineInt32Read(rb, rbuffer, dataOffset), rb.lit(1)),
                                            'strLen',
                                        );
                                        const strStart = rb.let(rb.add(dataOffset, rb.lit(4)), 'strStart');
                                        rb.set(
                                            rb.lit(_r),
                                            rb.lit(0) as any,
                                            rb.call(readBSONStringDirect, rbuffer, strStart, strLen),
                                        );
                                        rb.set(
                                            rb.lit(_r),
                                            rb.lit(1) as any,
                                            rb.add(strStart, rb.add(strLen, rb.lit(1))),
                                        );
                                        rb.return_();
                                    } else if (primaryBsonType === BSONType.BOOLEAN) {
                                        // Boolean: single byte
                                        rb.set(
                                            rb.lit(_r),
                                            rb.lit(0) as any,
                                            rb.eq(rb.at(rbuffer, dataOffset), rb.lit(1)),
                                        );
                                        rb.set(rb.lit(_r), rb.lit(1) as any, rb.add(dataOffset, rb.lit(1)));
                                        rb.return_();
                                    } else if (primaryBsonType === BSONType.LONG) {
                                        // BigInt: 8-byte int64
                                        rb.set(rb.lit(_r), rb.lit(0) as any, rb.call(readInt64, rbuffer, dataOffset));
                                        rb.set(rb.lit(_r), rb.lit(1) as any, rb.add(dataOffset, rb.lit(8)));
                                        rb.return_();
                                    } else if (primaryBsonType === BSONType.DATE) {
                                        // Date: 8-byte int64 → FastDate
                                        rb.set(
                                            rb.lit(_r),
                                            rb.lit(0) as any,
                                            rb.new_(FastDate, rb.call(readInt64AsNumber, rbuffer, dataOffset)),
                                        );
                                        rb.set(rb.lit(_r), rb.lit(1) as any, rb.add(dataOffset, rb.lit(8)));
                                        rb.return_();
                                    }
                                });
                            }

                            // Non-primary type: delegate to handleOther
                            rb.exec(rb.call(handleOther, rbuffer, dataOffset, ft));
                            rb.return_();
                        });
                    });

                    // No match: write default value and current offset
                    rb.set(rb.lit(_r), rb.lit(0) as any, rb.lit(initialValue));
                    rb.set(rb.lit(_r), rb.lit(1) as any, oArg);
                },
            );

            // In main function: call reader (void), then read results from shared _r array
            b.exec(b.call(reader, buffer, b.getVar(o), end));
            b.setVar(entry.varRef, b.at(b.lit(_r), b.lit(0)));
            b.setVar(o, b.at(b.lit(_r), b.lit(1)));
        }

        // Post-validation: if the byte at current offset is not the BSON terminator (0x00),
        // some fields were out of order or extra fields exist — use slow path.
        // Use fnJITTop to force a SEPARATE compilation unit — having the massive slow-path
        // while-loop in the same IIFE scope drops performance from 170M to 64M.
        const slowPathFn = fnJITTop(
            arg<Uint8Array>('buffer'),
            arg<number>('offset'),
            (sb: Builder, sbuffer: Ref<Uint8Array>, soffset: Ref<number>) => {
                return buildDocumentBody(
                    sb,
                    sbuffer,
                    soffset,
                    type,
                    new BSONBuildState({ namingStrategy: ctx.namingStrategy }),
                    true,
                    true,
                );
            },
        );

        // Early return to slow path if fields were out of order or extra fields exist.
        // Using early return (not a conditional variable) keeps the main function body
        // simple for V8 TurboFan — avoids 2.6x penalty from conditional result building.
        // Note: canUnroll requires ctx.depth===0, which only happens at topLevel=true.
        b.if_(b.neq(b.at(buffer, b.getVar(o)), b.lit(0)), () => {
            b.return_(b.call(slowPathFn, buffer, offsetRef));
        });
    } else {
        // No fast path — while-loop only (index signatures, too many properties, etc.)
        b.while_(b.lt(b.getVar(o), end), () => {
            const bsonType = b.let(b.at(buffer, b.getVar(o)), 'type');
            b.setVar(o, b.add(b.getVar(o), b.lit(1)));
            b.if_(b.eq(bsonType, b.lit(0)), () => {
                b.break_();
            });
            buildFieldMatcher(b, buffer, o, bsonType, activeProps, propVars, indexSignature, indexObj, ctx);
        });
    }

    // Build result object — always unconditional (no conditional variable pattern).
    // For canUnroll path, slow path already exited via early return above.
    let result: Ref<any>;
    let skipProps: Set<string> | undefined;

    if (type.kind === ReflectionKind.class) {
        const classType = type as TypeClass;
        const ctor = classType.classType;

        // Check if class has constructor properties (via inheritance chain)
        const deepCtorProps = getDeepConstructorProperties(classType);
        if (deepCtorProps.length > 0) {
            skipProps = new Set(deepCtorProps.map(p => String(p.name)));

            // Find this class's own constructor method to get parameter order
            const ctorMethod = classType.types.find(
                (t): t is TypeMethod => t.kind === ReflectionKind.method && t.name === 'constructor',
            );

            if (ctorMethod && ctorMethod.parameters) {
                const args: Ref<any>[] = [];
                for (const param of ctorMethod.parameters) {
                    if (
                        param.kind === ReflectionKind.parameter &&
                        (param.visibility !== undefined || param.readonly === true)
                    ) {
                        // Property parameter — find matching propVar by name
                        const paramName = param.name;
                        const entry = [...propVars.values()].find(e => memberNameToString(e.prop.name) === paramName);
                        if (entry) {
                            if (entry.usesSentinel) {
                                const argV = b.var_<any>(b.lit(undefined), `ctorArg_${paramName}`);
                                b.if_(b.neq(b.getVar(entry.varRef), b.lit(UNSET)), () => {
                                    b.setVar(argV, b.getVar(entry.varRef));
                                });
                                args.push(b.getVar(argV));
                            } else {
                                args.push(b.getVar(entry.varRef));
                            }
                        } else {
                            args.push(b.lit(undefined));
                        }
                    } else {
                        // Non-property parameter — pass undefined
                        args.push(b.lit(undefined));
                    }
                }
                result = b.let(b.new_(ctor, ...args), 'result');
            } else {
                result = b.let(b.call(Object.create, b.get(b.lit(ctor), 'prototype')), 'result');
            }
        } else {
            result = b.let(b.call(Object.create, b.get(b.lit(ctor), 'prototype')), 'result');
        }
    } else if (indexObj) {
        result = b.let(indexObj, 'result');
    } else {
        result = b.let(b.emptyObj(), 'result');
    }

    // Set properties on result
    for (const prop of activeProps) {
        const jsName = memberNameToString(prop.name);
        if (skipProps?.has(jsName)) continue;
        if (embeddedParentNames.has(jsName)) continue; // Handled below
        const bsonName = ctx.getPropertyName(prop);
        const entry = propVars.get(bsonName)!;
        const optional = isOptional(prop);
        const propHasDefault = hasDefaultValue(prop);

        if (!entry.usesSentinel) {
            // Simple required property — variable already has type default, just assign
            b.set(result, jsName, b.getVar(entry.varRef));
        } else {
            b.if_(
                b.neq(b.getVar(entry.varRef), b.lit(UNSET)),
                () => {
                    // Value was set from BSON — use it
                    b.set(result, jsName, b.getVar(entry.varRef));
                },
                () => {
                    // Value is UNSET — property was not in BSON
                    if (propHasDefault) {
                        // Use property's default initializer
                        const defaultFn = (prop as TypeProperty).default!;
                        b.set(result, jsName, b.call(defaultFn));
                    } else if (optional) {
                        // Optional without default — don't include in result
                    } else {
                        // Required without default — use type default or throw
                        const defaultValue = getDefaultForType(prop.type);
                        if (defaultValue !== undefined) {
                            b.set(result, jsName, b.lit(defaultValue));
                        } else if (
                            needsThrowOnMissing(prop.type) ||
                            prop.type.kind === ReflectionKind.objectLiteral ||
                            prop.type.kind === ReflectionKind.class
                        ) {
                            const typeName = describeType(prop.type);
                            const errorFn =
                                prop.type.kind === ReflectionKind.union
                                    ? makeUndefinedConversionError
                                    : makeBsonConversionError;
                            b.throw_(b.call(errorFn, b.lit(BSONType.UNDEFINED), b.lit(typeName)));
                        }
                    }
                },
            );
        }
    }

    // Reconstruct embedded objects from flattened sub-property vars
    for (const info of embeddedInfos) {
        const jsName = memberNameToString(info.parentProp.name);
        if (skipProps?.has(jsName)) continue;

        // Create embedded object instance
        let embeddedResult: Ref<any>;
        if (info.embeddedType.kind === ReflectionKind.class) {
            const ctor = (info.embeddedType as TypeClass).classType;
            embeddedResult = b.let(b.call(Object.create, b.get(b.lit(ctor), 'prototype')), `emb_${jsName}`);
        } else {
            embeddedResult = b.let(b.emptyObj(), `emb_${jsName}`);
        }

        // Set sub-properties on embedded object
        for (const subBsonName of info.subBsonNames) {
            const subEntry = propVars.get(subBsonName)!;
            const subJsName = memberNameToString(subEntry.prop.name);
            const subOptional = isOptional(subEntry.prop);
            const subHasDefault = hasDefaultValue(subEntry.prop);

            if (!subEntry.usesSentinel) {
                b.set(embeddedResult, subJsName, b.getVar(subEntry.varRef));
            } else {
                b.if_(
                    b.neq(b.getVar(subEntry.varRef), b.lit(UNSET)),
                    () => {
                        b.set(embeddedResult, subJsName, b.getVar(subEntry.varRef));
                    },
                    () => {
                        if (subHasDefault) {
                            const defaultFn = (subEntry.prop as TypeProperty).default!;
                            b.set(embeddedResult, subJsName, b.call(defaultFn));
                        } else if (subOptional) {
                            // Don't include
                        } else {
                            const defaultValue = getDefaultForType(subEntry.prop.type);
                            if (defaultValue !== undefined) {
                                b.set(embeddedResult, subJsName, b.lit(defaultValue));
                            }
                        }
                    },
                );
            }
        }

        b.set(result, jsName, embeddedResult);
    }

    // Add index signature properties (for class types)
    if (indexObj && type.kind === ReflectionKind.class) {
        b.forIn(
            indexObj,
            (key, value) => {
                b.set(result, key, value);
            },
            'key',
        );
    }

    if (topLevel) {
        // Top-level: return just the result (no tuple allocation)
        return result;
    }

    // Nested: return [result, endOffset+1] for offset tracking
    return b.arr(result, b.add(end, b.lit(1)));
}

/**
 * Build the field name matcher as an if-chain.
 * For each known property, generate byte-level name comparison.
 */
function buildFieldMatcher(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    properties: (TypeProperty | TypePropertySignature)[],
    propVars: Map<
        string,
        { varRef: VarRef<any>; prop: TypeProperty | TypePropertySignature; bsonName: string; usesSentinel?: boolean }
    >,
    indexSignature: TypeIndexSignature | undefined,
    indexObj: Ref<any> | undefined,
    ctx: BSONBuildState,
): void {
    // Build condition-action pairs for cond()
    const cases: Array<[Ref<boolean>, () => Ref | void]> = [];

    for (const entry of propVars.values()) {
        const bsonName = entry.bsonName;

        // Build byte comparison for this name
        const nameBytes = encodePropertyName(bsonName);
        const cond = buildNameCheck(b, buffer, o, nameBytes);

        cases.push([
            cond,
            () => {
                // Advance past name (including null terminator)
                b.setVar(o, b.add(b.getVar(o), b.lit(nameBytes.length + 1)));

                // For properties where type doesn't include null/undefined,
                // NULL/UNDEFINED BSON types should leave the sentinel (UNSET)
                const propType = entry.prop.type;
                const typeIncludesNullish = typeIncludesNull(propType) || isOptional(propType);
                const optional = isOptional(entry.prop);
                const propHasDefault = hasDefaultValue(entry.prop);

                if ((optional || propHasDefault) && !typeIncludesNullish) {
                    // NULL/UNDEFINED handling for optional/default properties
                    b.if_(
                        b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
                        () => {
                            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                            if (optional) {
                                // Explicitly-set null/undefined → preserve as undefined
                                b.setVar(entry.varRef, b.lit(undefined));
                            }
                            // If only propHasDefault but not optional: leave at UNSET → default
                        },
                        () => {
                            const propCtx = ctx.forProperty(bsonName);
                            deserializeValueInto(b, buffer, o, bsonType, propType, entry.varRef, propCtx);
                        },
                    );
                } else if (
                    !typeIncludesNullish &&
                    (propType.kind === ReflectionKind.objectLiteral || propType.kind === ReflectionKind.class)
                ) {
                    // Required object/class property: throw on NULL/UNDEFINED
                    b.if_(
                        b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
                        () => {
                            b.throw_(b.call(makeBsonConversionError, bsonType, b.lit(describeType(propType))));
                        },
                        () => {
                            const propCtx = ctx.forProperty(bsonName);
                            deserializeValueInto(b, buffer, o, bsonType, propType, entry.varRef, propCtx);
                        },
                    );
                } else {
                    // Read value normally
                    const propCtx = ctx.forProperty(bsonName);
                    deserializeValueInto(b, buffer, o, bsonType, propType, entry.varRef, propCtx);
                }
            },
        ]);
    }

    // Build else handler for unknown fields
    const elseHandler = () => {
        if (indexSignature && indexObj) {
            // Read the name as a string for index signature
            const nameResult = b.let(b.call(readCStringHelper, buffer, b.getVar(o)), 'nameResult');
            const fieldName = b.at(nameResult, 0);
            b.setVar(o, b.add(b.getVar(o), b.at(nameResult, 1)));

            // Read the value — use typed deserialization if value type is specific
            const valueType = indexSignature.type;
            if (valueType.kind === ReflectionKind.any || valueType.kind === ReflectionKind.unknown) {
                const indexValue = b.let(b.call(parseValueAny, buffer, b.getVar(o), bsonType), 'indexValue');
                b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                b.set(indexObj, fieldName, indexValue);
            } else {
                const elemCtx = ctx.forIndex();
                const indexVar = b.var_<any>(undefined, 'indexVal');
                deserializeValueInto(b, buffer, o, bsonType, valueType, indexVar, elemCtx);
                b.set(indexObj, fieldName, b.getVar(indexVar));
            }
        } else {
            // Skip field name
            b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));
            // Skip value
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        }
    };

    if (cases.length > 0) {
        b.cond(cases, elseHandler);
    } else {
        // No named properties — all fields go to else handler (index signature or skip)
        elseHandler();
    }
}

/**
 * Encode a property name to bytes (for byte-level comparison).
 */
function encodePropertyName(name: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < name.length; i++) {
        bytes.push(name.charCodeAt(i));
    }
    return bytes;
}

/**
 * Build a byte-level name check expression.
 * Compares bytes at buffer[o], buffer[o+1], ... and checks null terminator.
 */
function buildNameCheck(b: Builder, buffer: Ref<Uint8Array>, o: VarRef<number>, nameBytes: number[]): Ref<boolean> {
    // Build AND chain: buffer[o+0] === byte0 && buffer[o+1] === byte1 && ... && buffer[o+N] === 0
    let result = b.eq(b.at(buffer, b.getVar(o)), b.lit(nameBytes[0]));

    for (let i = 1; i < nameBytes.length; i++) {
        result = b.and(result, b.eq(b.at(buffer, b.add(b.getVar(o), b.lit(i))), b.lit(nameBytes[i])));
    }

    // Check null terminator
    result = b.and(result, b.eq(b.at(buffer, b.add(b.getVar(o), b.lit(nameBytes.length))), b.lit(0)));

    return result;
}

/**
 * Read a value from BSON and assign it to a VarRef.
 */
function deserializeValueInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: Type,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    // Check for reference types first
    if (isReferenceType(type) && type.kind === ReflectionKind.class) {
        deserializeReferenceInto(b, buffer, o, bsonType, type as TypeClass, target, ctx);
        return;
    }

    // Check for special annotated string types
    if (isUUIDType(type)) {
        // Inline fast path: BSON BINARY (subtype 4) → UUID hex string (no tuple allocation)
        b.if_(
            b.eq(bsonType, b.lit(BSONType.BINARY)),
            () => {
                // Binary: 4 bytes length + 1 byte subtype + 16 bytes UUID data
                b.setVar(target, b.call(readBytesAsUUID, buffer, b.add(b.getVar(o), b.lit(5))));
                b.setVar(o, b.add(b.getVar(o), b.lit(21))); // 4 + 1 + 16
            },
            () => {
                // Fallback for string-encoded UUID or other types
                const result = b.let(b.call(readUUIDValue, buffer, b.getVar(o), bsonType), 'uuidResult');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
            },
        );
        return;
    }
    if (isMongoIdType(type)) {
        // Inline fast path: BSON OID → hex string with lookup table (20x faster)
        b.if_(
            b.eq(bsonType, b.lit(BSONType.OID)),
            () => {
                b.setVar(target, b.call(readObjectIdHex, buffer, b.getVar(o)));
                b.setVar(o, b.add(b.getVar(o), b.lit(12)));
            },
            () => {
                // Fallback for string-encoded MongoId
                const result = b.let(b.call(readMongoIdValue, buffer, b.getVar(o), bsonType), 'mongoIdResult');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
            },
        );
        return;
    }

    // Check for binary types (Uint8Array, ArrayBuffer, etc.)
    if (type.kind === ReflectionKind.class && binaryTypes.includes(type.classType as any)) {
        if ((type as TypeClass).classType === ArrayBuffer) {
            const result = b.let(b.call(readArrayBufferValue, buffer, b.getVar(o), bsonType), 'abResult');
            b.setVar(target, b.at(result, 0));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
        } else {
            const result = b.let(b.call(readBinaryValue, buffer, b.getVar(o), bsonType), 'binResult');
            b.setVar(target, b.at(result, 0));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
        }
        return;
    }

    switch (type.kind) {
        case ReflectionKind.string: {
            // Inline fast path: BSON STRING → JS string (no tuple allocation)
            b.if_(
                b.eq(bsonType, b.lit(BSONType.STRING)),
                () => {
                    // Read string length (includes null terminator)
                    const strLen = b.let(b.sub(inlineInt32Read(b, buffer, b.getVar(o)), b.lit(1)), 'strLen');
                    b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                    // Read string data directly (no tuple)
                    b.setVar(target, b.call(readBSONStringDirect, buffer, b.getVar(o), strLen));
                    // Advance past string data + null terminator
                    b.setVar(o, b.add(b.getVar(o), b.add(strLen, b.lit(1))));
                },
                () => {
                    // Fallback for coercion (INT/DOUBLE/BOOLEAN → string)
                    const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'strFallback');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                },
            );
            break;
        }
        case ReflectionKind.number: {
            // Inline fast paths: BSON INT/DOUBLE → JS number (no tuple allocation)
            b.if_(
                b.eq(bsonType, b.lit(BSONType.INT)),
                () => {
                    // Int32: inline byte read (no DataView)
                    b.setVar(target, inlineInt32Read(b, buffer, b.getVar(o)));
                    b.setVar(o, b.add(b.getVar(o), b.lit(4)));
                },
                () => {
                    b.if_(
                        b.eq(bsonType, b.lit(BSONType.DOUBLE)),
                        () => {
                            // Float64: shared buffer (no per-call DataView)
                            const v = b.let(b.call(readDouble, buffer, b.getVar(o)), 'dblVal');
                            b.setVar(target, b.call(nanToZero, v));
                            b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                        },
                        () => {
                            // Fallback for coercion (BOOLEAN/LONG/STRING → number)
                            const result = b.let(b.call(readNumberValue, buffer, b.getVar(o), bsonType), 'numFallback');
                            b.setVar(target, b.at(result, 0));
                            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                        },
                    );
                },
            );
            break;
        }
        case ReflectionKind.boolean: {
            // Inline fast path: BSON BOOLEAN → JS boolean (no tuple allocation)
            b.if_(
                b.eq(bsonType, b.lit(BSONType.BOOLEAN)),
                () => {
                    b.setVar(target, b.eq(b.at(buffer, b.getVar(o)), b.lit(1)));
                    b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                },
                () => {
                    // Fallback for coercion (INT/DOUBLE/LONG → boolean)
                    const result = b.let(b.call(readBooleanValue, buffer, b.getVar(o), bsonType), 'boolFallback');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                },
            );
            break;
        }
        case ReflectionKind.bigint: {
            const binaryBigInt = binaryBigIntAnnotation.getFirst(type);
            if (binaryBigInt !== undefined) {
                // BinaryBigInt/SignedBinaryBigInt: primary path reads BSON BINARY
                const reader = binaryBigInt === BinaryBigIntType.signed ? readSignedBinaryBigInt : readBinaryBigInt;
                b.if_(
                    b.eq(bsonType, b.lit(BSONType.BINARY)),
                    () => {
                        const result = b.let(b.call(reader, buffer, b.getVar(o)), 'binaryBigIntResult');
                        b.setVar(target, b.at(result, 0));
                        b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                    },
                    () => {
                        // Fallback for coercion (LONG/INT/DOUBLE/STRING/BOOLEAN → bigint)
                        const result = b.let(b.call(readBigIntValue, buffer, b.getVar(o), bsonType), 'bigintFallback');
                        b.setVar(target, b.at(result, 0));
                        b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                        // Unsigned BinaryBigInt: clamp negatives to 0
                        if (binaryBigInt === BinaryBigIntType.unsigned) {
                            b.if_(b.lt(b.getVar(target), b.lit(0n)), () => {
                                b.setVar(target, b.lit(0n));
                            });
                        }
                    },
                );
            } else {
                // Regular bigint: inline fast path BSON LONG → JS bigint
                b.if_(
                    b.eq(bsonType, b.lit(BSONType.LONG)),
                    () => {
                        b.setVar(target, b.call(readInt64, buffer, b.getVar(o)));
                        b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                    },
                    () => {
                        // Fallback for coercion (INT/DOUBLE/BOOLEAN → bigint)
                        const result = b.let(b.call(readBigIntValue, buffer, b.getVar(o), bsonType), 'bigintFallback');
                        b.setVar(target, b.at(result, 0));
                        b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                    },
                );
            }
            break;
        }
        case ReflectionKind.null: {
            // Only NULL/UNDEFINED BSON types can be coerced to null
            b.if_(
                b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
                () => {
                    b.setVar(target, b.lit(null));
                    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                },
                () => {
                    b.throw_(b.call(makeBsonConversionError, bsonType, b.lit('null')));
                },
            );
            break;
        }
        case ReflectionKind.undefined: {
            // Only NULL/UNDEFINED BSON types can be coerced to undefined
            b.if_(
                b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
                () => {
                    b.setVar(target, b.lit(undefined));
                    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                },
                () => {
                    b.throw_(b.call(makeBsonConversionError, bsonType, b.lit('undefined')));
                },
            );
            break;
        }
        case ReflectionKind.literal: {
            deserializeLiteralInto(b, buffer, o, bsonType, type as TypeLiteral, target, ctx);
            break;
        }
        case ReflectionKind.templateLiteral: {
            deserializeTemplateLiteralInto(b, buffer, o, bsonType, type as TypeTemplateLiteral, target, ctx);
            break;
        }
        case ReflectionKind.class: {
            if ((type as TypeClass).classType === Date) {
                // Inline fast path: BSON DATE → FastDate (95x faster than new Date)
                b.if_(
                    b.eq(bsonType, b.lit(BSONType.DATE)),
                    () => {
                        b.setVar(target, b.new_(FastDate, b.call(readInt64AsNumber, buffer, b.getVar(o))));
                        b.setVar(o, b.add(b.getVar(o), b.lit(8)));
                    },
                    () => {
                        // Fallback for coercion (LONG/INT/DOUBLE/STRING → Date)
                        const result = b.let(b.call(readDateValue, buffer, b.getVar(o), bsonType), 'dateResult');
                        b.setVar(target, b.at(result, 0));
                        b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                    },
                );
            } else if ((type as TypeClass).classType === RegExp) {
                const result = b.let(b.call(readRegExpValue, buffer, b.getVar(o), bsonType), 'regexpResult');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
            } else if ((type as TypeClass).classType === Map) {
                deserializeMapInto(b, buffer, o, bsonType, type as TypeClass, target, ctx);
            } else if ((type as TypeClass).classType === Set) {
                deserializeSetInto(b, buffer, o, bsonType, type as TypeClass, target, ctx);
            } else {
                // Regular class - deserialize as object
                deserializeObjectInto(b, buffer, o, bsonType, type as TypeClass, target, ctx);
            }
            break;
        }
        case ReflectionKind.objectLiteral: {
            deserializeObjectInto(b, buffer, o, bsonType, type as TypeObjectLiteral, target, ctx);
            break;
        }
        case ReflectionKind.array: {
            deserializeArrayInto(b, buffer, o, bsonType, type as TypeArray, target, ctx);
            break;
        }
        case ReflectionKind.tuple: {
            deserializeTupleInto(b, buffer, o, bsonType, type as TypeTuple, target, ctx);
            break;
        }
        case ReflectionKind.regexp: {
            const result = b.let(b.call(readRegExpValue, buffer, b.getVar(o), bsonType), 'regexpResult');
            b.setVar(target, b.at(result, 0));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
            break;
        }
        case ReflectionKind.enum: {
            deserializeEnumInto(b, buffer, o, bsonType, type as TypeEnum, target, ctx);
            break;
        }
        case ReflectionKind.union: {
            deserializeUnionInto(b, buffer, o, bsonType, type as TypeUnion, target, ctx);
            break;
        }
        case ReflectionKind.promise: {
            // Unwrap Promise<T> → T (same as serializer)
            deserializeValueInto(b, buffer, o, bsonType, (type as TypePromise).type, target, ctx);
            break;
        }
        case ReflectionKind.any:
        case ReflectionKind.unknown: {
            // Use runtime parser for any/unknown
            b.setVar(target, b.call(parseValueAny, buffer, b.getVar(o), bsonType));
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
            break;
        }
        default: {
            // Skip unknown types
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
            break;
        }
    }
}

/**
 * Deserialize a literal type.
 */
function deserializeLiteralInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeLiteral,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    // Set to the literal value and skip the BSON value
    b.setVar(target, b.lit(type.literal));
    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
}

/**
 * Deserialize a template literal type (e.g., `a${number}`).
 */
function deserializeTemplateLiteralInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeTemplateLiteral,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    const pattern = templateLiteralToRegex(type);
    const typeName = describeTemplateLiteral(type);

    b.if_(
        b.eq(bsonType, b.lit(BSONType.STRING)),
        () => {
            const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'tplResult');
            b.setVar(target, b.call(validateTemplateLiteral, b.at(result, 0), b.lit(pattern), b.lit(typeName)));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
        },
        () => {
            b.throw_(b.call(makeBsonConversionError, bsonType, b.lit(typeName)));
        },
    );
}

/**
 * Deserialize a reference type.
 * - BSON OBJECT → deserialize as full class
 * - BSON primitive → create reference from primary key
 */
function deserializeReferenceInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeClass,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.eq(bsonType, b.lit(BSONType.OBJECT)),
        () => {
            // Full object — deserialize as class
            if (ctx.shouldExtract(type)) {
                const extractedFn = getExtractedDeserializer(type);
                const result = b.let(b.call(extractedFn, buffer, b.getVar(o)), 'refObjResult');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.at(result, 1));
            } else {
                ctx.pushType(type);
                const result = buildDocumentBody(b, buffer, b.getVar(o), type, ctx);
                const resultLet = b.let(result, 'refObjResult');
                b.setVar(target, b.at(resultLet, 0));
                b.setVar(o, b.at(resultLet, 1));
                ctx.popType(type);
            }
        },
        () => {
            // Primitive — create reference from primary key
            const result = b.let(
                b.call(deserializeReferencePk, buffer, b.getVar(o), bsonType, b.lit(type)),
                'refPkResult',
            );
            b.setVar(target, b.at(result, 0));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
        },
    );
}

/**
 * Deserialize an object/class type inline or via extracted function.
 */
function deserializeObjectInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeObjectLiteral | TypeClass,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.eq(bsonType, b.lit(BSONType.OBJECT)),
        () => {
            if (ctx.shouldExtract(type)) {
                // Use extracted deserializer
                const extractedFn = getExtractedDeserializer(type);
                const result = b.let(b.call(extractedFn, buffer, b.getVar(o)), 'extractedResult');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.at(result, 1));
            } else {
                // Inline
                ctx.pushType(type);
                const result = buildDocumentBody(b, buffer, b.getVar(o), type, ctx);
                const resultLet = b.let(result, 'objResult');
                b.setVar(target, b.at(resultLet, 0));
                b.setVar(o, b.at(resultLet, 1));
                ctx.popType(type);
            }
        },
        () => {
            // For null/undefined BSON values, throw a conversion error
            const typeName = describeType(type);
            b.if_(
                b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
                () => {
                    b.throw_(b.call(makeBsonConversionError, bsonType, b.lit(typeName)));
                },
                () => {
                    // Other non-object types: skip
                    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                },
            );
        },
    );
}

/**
 * Deserialize an array type.
 */
function deserializeArrayInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeArray,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.eq(bsonType, b.lit(BSONType.ARRAY)),
        () => {
            const arr = b.let(b.emptyArr(), 'arr');
            const arrSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'arrSize');
            const arrEnd = b.let(b.add(b.getVar(o), b.sub(arrSize, b.lit(1))), 'arrEnd');
            b.setVar(o, b.add(b.getVar(o), b.lit(4)));

            b.while_(b.lt(b.getVar(o), arrEnd), () => {
                const elemType = b.let(b.at(buffer, b.getVar(o)), 'elemType');
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));

                // Check terminator
                b.if_(b.eq(elemType, b.lit(0)), () => {
                    b.break_();
                });

                // Skip index cstring
                b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));

                // Read element value
                const elemCtx = ctx.forIndex();
                const elemVar = b.var_<any>(undefined, 'elem');
                deserializeValueInto(b, buffer, o, elemType, type.type, elemVar, elemCtx);
                b.push(arr, b.getVar(elemVar));
            });

            b.setVar(target, arr);
            // Skip past the array end (o should be at arrEnd, advance past null terminator)
            b.setVar(o, b.add(arrEnd, b.lit(1)));
        },
        () => {
            // Non-array BSON type — throw error
            const typeName = `Array<${describeType(type.type)}>`;
            b.throw_(b.call(makeBsonConversionError, bsonType, b.lit(typeName)));
        },
    );
}

/**
 * Deserialize a tuple type, supporting rest elements.
 */
function deserializeTupleInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeTuple,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.eq(bsonType, b.lit(BSONType.ARRAY)),
        () => {
            // Find rest element
            const restInfo = findTupleRest(type);

            if (restInfo.index >= 0) {
                // Tuple with rest element — use runtime approach
                deserializeTupleWithRest(b, buffer, o, type, target, ctx, restInfo);
            } else {
                // Fixed tuple — static unrolling
                const arr = b.let(b.emptyArr(), 'tupleArr');
                const arrSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'tupleSize');
                const arrEnd = b.let(b.add(b.getVar(o), b.sub(arrSize, b.lit(1))), 'tupleEnd');
                b.setVar(o, b.add(b.getVar(o), b.lit(4)));

                let elemIdx = 0;
                for (const member of type.types as TypeTupleMember[]) {
                    b.if_(b.lt(b.getVar(o), arrEnd), () => {
                        const elemType = b.let(b.at(buffer, b.getVar(o)), 'tupleElemType');
                        b.setVar(o, b.add(b.getVar(o), b.lit(1)));

                        b.if_(b.neq(elemType, b.lit(0)), () => {
                            // Skip index cstring
                            b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));

                            const elemCtx = ctx.forIndex(elemIdx);
                            const elemVar = b.var_<any>(undefined, `tuple_${elemIdx}`);
                            deserializeValueInto(b, buffer, o, elemType, member.type, elemVar, elemCtx);
                            b.push(arr, b.getVar(elemVar));
                        });
                    });
                    elemIdx++;
                }

                b.setVar(target, arr);
                b.setVar(o, b.add(arrEnd, b.lit(1)));
            }
        },
        () => {
            b.setVar(target, b.emptyArr());
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        },
    );
}

/**
 * Deserialize a tuple with rest elements using a runtime helper.
 */
function deserializeTupleWithRest(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    type: TypeTuple,
    target: VarRef<any>,
    ctx: BSONBuildState,
    restInfo: { index: number; type?: Type },
): void {
    // Read array envelope
    const arrSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'tupleRestSize');
    const arrEnd = b.let(b.add(b.getVar(o), b.sub(arrSize, b.lit(1))), 'tupleRestEnd');
    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

    // First pass: collect all raw BSON element [bsonType, offset] pairs into an array
    // We use a runtime helper to figure out which types apply to which positions
    const rawValues = b.let(b.emptyArr(), 'rawValues');
    b.while_(b.lt(b.getVar(o), arrEnd), () => {
        const elemBsonType = b.let(b.at(buffer, b.getVar(o)), 'rvType');
        b.setVar(o, b.add(b.getVar(o), b.lit(1)));
        b.if_(b.eq(elemBsonType, b.lit(0)), () => {
            b.break_();
        });
        b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));

        const elemVar = b.var_<any>(undefined, 'rvElem');
        b.setVar(elemVar, b.call(parseValueAny, buffer, b.getVar(o), elemBsonType));
        b.push(rawValues, b.getVar(elemVar));
        b.setVar(o, b.call(skipValue, buffer, b.getVar(o), elemBsonType));
    });

    // Use runtime helper to assign values to correct types
    const members = type.types as TypeTupleMember[];
    b.setVar(target, b.call(assignTupleRestValues, rawValues, b.lit(members), b.lit(restInfo)));
    b.setVar(o, b.add(arrEnd, b.lit(1)));
}

/**
 * Runtime helper: assign raw values to tuple positions with rest elements.
 */
function assignTupleRestValues(
    rawValues: unknown[],
    members: TypeTupleMember[],
    restInfo: { index: number; type?: Type },
): unknown[] {
    const result: unknown[] = [];
    const total = rawValues.length;

    // Count non-rest members before and after the rest
    let beforeRest = restInfo.index;
    let afterRest = members.length - restInfo.index - 1;

    // Number of rest elements
    const restCount = Math.max(0, total - beforeRest - afterRest);

    let rawIdx = 0;

    // Process members before rest
    for (let i = 0; i < beforeRest && rawIdx < total; i++) {
        result.push(coerceValue(rawValues[rawIdx], members[i].type));
        rawIdx++;
    }

    // Process rest elements
    if (restInfo.type) {
        for (let i = 0; i < restCount; i++) {
            result.push(coerceValue(rawValues[rawIdx], restInfo.type));
            rawIdx++;
        }
    }

    // Process members after rest (right-align when fewer values than suffix slots)
    const availableForAfterRest = total - rawIdx;
    const skipCount = Math.max(0, afterRest - availableForAfterRest);
    for (let i = restInfo.index + 1 + skipCount; i < members.length && rawIdx < total; i++) {
        result.push(coerceValue(rawValues[rawIdx], members[i].type));
        rawIdx++;
    }

    return result;
}

/**
 * Coerce a runtime value to a target type.
 */
function coerceValue(value: unknown, type: Type): unknown {
    if (type.kind === ReflectionKind.rest) {
        return coerceValue(value, (type as TypeRest).type);
    }
    switch (type.kind) {
        case ReflectionKind.string:
            return String(value);
        case ReflectionKind.number:
            return Number(value);
        case ReflectionKind.boolean:
            return Boolean(value);
        case ReflectionKind.bigint:
            return BigInt(value as number);
        default:
            return value;
    }
}

/**
 * Deserialize a Map type (stored as BSON object or BSON array of [key, value] pairs).
 */
function deserializeMapInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeClass,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    const keyType = type.arguments?.[0];
    const valueType = type.arguments?.[1];
    if (!keyType || !valueType) {
        b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        return;
    }

    b.if_(
        b.eq(bsonType, b.lit(BSONType.OBJECT)),
        () => {
            // Map stored as BSON object: { key1: value1, key2: value2 }
            const map = b.let(b.new_(Map), 'map');
            const mapSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'mapSize');
            const mapEnd = b.let(b.add(b.getVar(o), b.sub(mapSize, b.lit(1))), 'mapEnd');
            b.setVar(o, b.add(b.getVar(o), b.lit(4)));

            b.while_(b.lt(b.getVar(o), mapEnd), () => {
                const elemBsonType = b.let(b.at(buffer, b.getVar(o)), 'mapElemType');
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                b.if_(b.eq(elemBsonType, b.lit(0)), () => {
                    b.break_();
                });

                // Read key name as string
                const keyResult = b.let(b.call(readCStringHelper, buffer, b.getVar(o)), 'keyResult');
                const keyStr = b.at(keyResult, 0);
                b.setVar(o, b.add(b.getVar(o), b.at(keyResult, 1)));

                // Read value
                const elemCtx = ctx.forIndex();
                const valueVar = b.var_<any>(undefined, 'mapValue');
                deserializeValueInto(b, buffer, o, elemBsonType, valueType, valueVar, elemCtx);

                b.exec(b.method(map, 'set', keyStr, b.getVar(valueVar)));
            });

            b.setVar(target, map);
            b.setVar(o, b.add(mapEnd, b.lit(1)));
        },
        () => {
            b.if_(
                b.eq(bsonType, b.lit(BSONType.ARRAY)),
                () => {
                    // Map stored as BSON array of [key, value] pairs
                    const map = b.let(b.new_(Map), 'mapFromArr');
                    const arrSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'mapArrSize');
                    const arrEnd = b.let(b.add(b.getVar(o), b.sub(arrSize, b.lit(1))), 'mapArrEnd');
                    b.setVar(o, b.add(b.getVar(o), b.lit(4)));

                    b.while_(b.lt(b.getVar(o), arrEnd), () => {
                        const pairBsonType = b.let(b.at(buffer, b.getVar(o)), 'pairType');
                        b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                        b.if_(b.eq(pairBsonType, b.lit(0)), () => {
                            b.break_();
                        });

                        // Skip outer array index cstring
                        b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));

                        // Each element is a sub-array [key, value]
                        b.if_(
                            b.eq(pairBsonType, b.lit(BSONType.ARRAY)),
                            () => {
                                const pairSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'pairSize');
                                const pairEnd = b.let(b.add(b.getVar(o), b.sub(pairSize, b.lit(1))), 'pairEnd');
                                b.setVar(o, b.add(b.getVar(o), b.lit(4)));

                                // Read key (element 0)
                                const keyBsonType = b.let(b.at(buffer, b.getVar(o)), 'mkType');
                                b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                                b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));
                                const keyVar = b.var_<any>(undefined, 'mk');
                                const keyCtx = ctx.forIndex();
                                deserializeValueInto(b, buffer, o, keyBsonType, keyType, keyVar, keyCtx);

                                // Read value (element 1)
                                b.if_(b.lt(b.getVar(o), pairEnd), () => {
                                    const valBsonType = b.let(b.at(buffer, b.getVar(o)), 'mvType');
                                    b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                                    b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));
                                    const valVar = b.var_<any>(undefined, 'mv');
                                    const valCtx = ctx.forIndex();
                                    deserializeValueInto(b, buffer, o, valBsonType, valueType, valVar, valCtx);
                                    b.exec(b.method(map, 'set', b.getVar(keyVar), b.getVar(valVar)));
                                });

                                b.setVar(o, b.add(pairEnd, b.lit(1)));
                            },
                            () => {
                                b.setVar(o, b.call(skipValue, buffer, b.getVar(o), pairBsonType));
                            },
                        );
                    });

                    b.setVar(target, map);
                    b.setVar(o, b.add(arrEnd, b.lit(1)));
                },
                () => {
                    b.setVar(target, b.new_(Map));
                    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                },
            );
        },
    );
}

/**
 * Deserialize a Set type (stored as BSON array).
 */
function deserializeSetInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeClass,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    const valueType = type.arguments?.[0];
    if (!valueType) {
        b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        return;
    }

    b.if_(
        b.eq(bsonType, b.lit(BSONType.ARRAY)),
        () => {
            const set = b.let(b.new_(Set), 'set');
            const arrSize = b.let(b.call(readInt32LE, buffer, b.getVar(o)), 'setSize');
            const arrEnd = b.let(b.add(b.getVar(o), b.sub(arrSize, b.lit(1))), 'setEnd');
            b.setVar(o, b.add(b.getVar(o), b.lit(4)));

            b.while_(b.lt(b.getVar(o), arrEnd), () => {
                const elemType = b.let(b.at(buffer, b.getVar(o)), 'setElemType');
                b.setVar(o, b.add(b.getVar(o), b.lit(1)));
                b.if_(b.eq(elemType, b.lit(0)), () => {
                    b.break_();
                });

                // Skip index cstring
                b.setVar(o, b.call(skipCString, buffer, b.getVar(o)));

                const elemCtx = ctx.forIndex();
                const elemVar = b.var_<any>(undefined, 'setElem');
                deserializeValueInto(b, buffer, o, elemType, valueType, elemVar, elemCtx);
                b.exec(b.method(set, 'add', b.getVar(elemVar)));
            });

            b.setVar(target, set);
            b.setVar(o, b.add(arrEnd, b.lit(1)));
        },
        () => {
            b.setVar(target, b.new_(Set));
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        },
    );
}

/**
 * Deserialize an enum type.
 */
function deserializeEnumInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeEnum,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    b.if_(
        b.or(b.eq(bsonType, b.lit(BSONType.INT)), b.eq(bsonType, b.lit(BSONType.DOUBLE))),
        () => {
            const result = b.let(b.call(readNumberValue, buffer, b.getVar(o), bsonType), 'enumNumResult');
            b.setVar(target, b.at(result, 0));
            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
        },
        () => {
            b.if_(
                b.eq(bsonType, b.lit(BSONType.STRING)),
                () => {
                    const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'enumStrResult');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                },
                () => {
                    b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
                },
            );
        },
    );
}

/**
 * Deserialize a union type.
 */
function deserializeUnionInto(
    b: Builder,
    buffer: Ref<Uint8Array>,
    o: VarRef<number>,
    bsonType: Ref<number>,
    type: TypeUnion,
    target: VarRef<any>,
    ctx: BSONBuildState,
): void {
    // Separate null/undefined from other types
    const nonNullTypes = type.types.filter(t => t.kind !== ReflectionKind.null && t.kind !== ReflectionKind.undefined);
    const hasNull = type.types.some(t => t.kind === ReflectionKind.null);
    const hasUndefined = type.types.some(t => t.kind === ReflectionKind.undefined);

    // Strategy 1: Simple nullable (T | null, T | undefined, T | null | undefined)
    if (nonNullTypes.length === 1 && (hasNull || hasUndefined)) {
        b.if_(
            b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
            () => {
                b.setVar(target, hasNull ? b.lit(null) : b.lit(undefined));
                b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
            },
            () => {
                deserializeValueInto(b, buffer, o, bsonType, nonNullTypes[0], target, ctx);
            },
        );
        return;
    }

    // Strategy 2: Categorize members, then build BSON type dispatch
    const unionName = describeUnion(type);

    // Categorize union members (exclude UUID/MongoId from plain string — they need special handling)
    const hasString = type.types.some(t => t.kind === ReflectionKind.string && !isUUIDType(t) && !isMongoIdType(t));
    const hasNumber = type.types.some(t => t.kind === ReflectionKind.number);
    const hasBoolean = type.types.some(t => t.kind === ReflectionKind.boolean);
    const hasBigint = type.types.some(t => t.kind === ReflectionKind.bigint);
    const hasDate = type.types.some(t => t.kind === ReflectionKind.class && (t as TypeClass).classType === Date);
    const hasRegExp = type.types.some(
        t =>
            t.kind === ReflectionKind.regexp ||
            (t.kind === ReflectionKind.class && (t as TypeClass).classType === RegExp),
    );
    const hasUUID = type.types.some(t => isUUIDType(t));
    const hasMongoId = type.types.some(t => isMongoIdType(t));
    const enumMembers = type.types.filter((t): t is TypeEnum => t.kind === ReflectionKind.enum);
    const stringEnumMember = enumMembers.find(e => e.values.some(v => typeof v === 'string'));
    const numericEnumMember = enumMembers.find(e => e.values.some(v => typeof v === 'number'));
    const binaryMember = type.types.find(
        t => t.kind === ReflectionKind.class && binaryTypes.includes((t as TypeClass).classType as any),
    );
    const refMember = type.types.find(t => isReferenceType(t) && t.kind === ReflectionKind.class);
    const objectMember = type.types.find(
        t =>
            (t.kind === ReflectionKind.objectLiteral || t.kind === ReflectionKind.class) &&
            !isReferenceType(t) &&
            !binaryTypes.includes(t.kind === ReflectionKind.class ? ((t as TypeClass).classType as any) : null) &&
            (t.kind !== ReflectionKind.class ||
                ((t as TypeClass).classType !== Date &&
                    (t as TypeClass).classType !== RegExp &&
                    (t as TypeClass).classType !== Map &&
                    (t as TypeClass).classType !== Set)),
    );
    const arrayMember = type.types.find(t => t.kind === ReflectionKind.array || t.kind === ReflectionKind.tuple);
    const templateLiteralMember = type.types.find(t => t.kind === ReflectionKind.templateLiteral);

    // Collect literals grouped by JS type
    const stringLiterals = type.types.filter(
        (t): t is TypeLiteral => t.kind === ReflectionKind.literal && typeof (t as TypeLiteral).literal === 'string',
    );
    const numberLiterals = type.types.filter(
        (t): t is TypeLiteral => t.kind === ReflectionKind.literal && typeof (t as TypeLiteral).literal === 'number',
    );
    const booleanLiterals = type.types.filter(
        (t): t is TypeLiteral => t.kind === ReflectionKind.literal && typeof (t as TypeLiteral).literal === 'boolean',
    );

    const cases: Array<[Ref<boolean>, () => Ref | void]> = [];

    // === NULL ===
    // BSON NULL can mean null or undefined depending on union members.
    // undefined is serialized as BSON NULL (BSONType.UNDEFINED is deprecated).
    if (hasNull || hasUndefined) {
        cases.push([
            b.or(b.eq(bsonType, b.lit(BSONType.NULL)), b.eq(bsonType, b.lit(BSONType.UNDEFINED))),
            () => {
                // Prefer null if union has null, otherwise undefined
                b.setVar(target, hasNull ? b.lit(null) : b.lit(undefined));
                b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
            },
        ]);
    }

    // === BINARY (UUID or typed arrays) ===
    if (hasUUID || binaryMember) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.BINARY)),
            () => {
                if (hasUUID) {
                    const result = b.let(b.call(readUUIDValue, buffer, b.getVar(o), bsonType), 'uuidUnion');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                } else if (binaryMember) {
                    deserializeValueInto(b, buffer, o, bsonType, binaryMember, target, ctx);
                }
            },
        ]);
    }

    // === OID (MongoId) ===
    if (hasMongoId) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.OID)),
            () => {
                const result = b.let(b.call(readMongoIdValue, buffer, b.getVar(o), bsonType), 'mongoUnion');
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
            },
        ]);
    }

    // === STRING ===
    // Priority: string > templateLiteral > string enum > string literals > UUID(as string) > MongoId(as string)
    if (hasString || templateLiteralMember || stringEnumMember || stringLiterals.length > 0 || hasUUID || hasMongoId) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.STRING)),
            () => {
                if (hasString) {
                    // Base string type covers everything
                    const stringMember = type.types.find(t => t.kind === ReflectionKind.string)!;
                    deserializeValueInto(b, buffer, o, bsonType, stringMember, target, ctx);
                } else if (templateLiteralMember) {
                    deserializeValueInto(b, buffer, o, bsonType, templateLiteralMember, target, ctx);
                } else if (stringEnumMember) {
                    // String enum — read string value (enum values are valid strings)
                    deserializeValueInto(b, buffer, o, bsonType, stringEnumMember, target, ctx);
                } else if (hasUUID) {
                    // UUID stored as string — try validate, throw union error on failure
                    const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'uuidStr');
                    const validated = b.let(b.call(tryValidateUUID, b.at(result, 0)), 'uuidValidated');
                    b.if_(
                        b.neq(validated, b.lit(undefined)),
                        () => {
                            b.setVar(target, validated);
                            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                        },
                        () => {
                            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                            b.throw_(b.call(makeUnionNoMatchError, bsonType, b.lit(unionName)));
                        },
                    );
                } else if (hasMongoId) {
                    // MongoId stored as string — try validate, throw union error on failure
                    const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'mongoStr');
                    const validated = b.let(b.call(tryValidateMongoId, b.at(result, 0)), 'mongoValidated');
                    b.if_(
                        b.neq(validated, b.lit(undefined)),
                        () => {
                            b.setVar(target, validated);
                            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                        },
                        () => {
                            b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                            b.throw_(b.call(makeUnionNoMatchError, bsonType, b.lit(unionName)));
                        },
                    );
                } else if (stringLiterals.length > 0) {
                    // String literal — just read as string (literal value is a valid string)
                    const result = b.let(b.call(readStringValue, buffer, b.getVar(o), bsonType), 'litStr');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                }
            },
        ]);
    }

    // === INT/DOUBLE (number, numeric enum, number literals, bigint coercion, reference pk) ===
    if (hasNumber || numericEnumMember || numberLiterals.length > 0 || refMember || hasBigint) {
        cases.push([
            b.or(b.eq(bsonType, b.lit(BSONType.INT)), b.eq(bsonType, b.lit(BSONType.DOUBLE))),
            () => {
                if (hasNumber) {
                    // number wins over bigint for INT/DOUBLE BSON types (bigint gets LONG)
                    const numberMember = type.types.find(t => t.kind === ReflectionKind.number)!;
                    deserializeValueInto(b, buffer, o, bsonType, numberMember, target, ctx);
                } else if (numericEnumMember) {
                    // Numeric enum — read number value (enum values are valid numbers)
                    deserializeValueInto(b, buffer, o, bsonType, numericEnumMember, target, ctx);
                } else if (refMember) {
                    deserializeReferenceInto(b, buffer, o, bsonType, refMember as TypeClass, target, ctx);
                } else if (numberLiterals.length > 0) {
                    const result = b.let(b.call(readNumberValue, buffer, b.getVar(o), bsonType), 'litNum');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                } else if (hasBigint) {
                    // bigint only (no number/enum): coerce INT/DOUBLE → bigint
                    const bigintMember = type.types.find(t => t.kind === ReflectionKind.bigint)!;
                    deserializeValueInto(b, buffer, o, bsonType, bigintMember, target, ctx);
                }
            },
        ]);
    } else if (hasString) {
        // INT/DOUBLE coercion to string when union has string but no number
        cases.push([
            b.or(b.eq(bsonType, b.lit(BSONType.INT)), b.eq(bsonType, b.lit(BSONType.DOUBLE))),
            () => {
                const stringMember = type.types.find(t => t.kind === ReflectionKind.string)!;
                deserializeValueInto(b, buffer, o, bsonType, stringMember, target, ctx);
            },
        ]);
    }

    // === BOOLEAN ===
    // When both boolean literals and number exist, need special handling
    if (hasBoolean || booleanLiterals.length > 0 || hasNumber) {
        // Only add BOOLEAN case if not already covered by number's BOOLEAN coercion above
        // (number already claims INT|DOUBLE|BOOLEAN when hasNumber is true)
        const needsBooleanCase = hasBoolean || (booleanLiterals.length > 0 && !hasNumber);

        if (needsBooleanCase) {
            cases.push([
                b.eq(bsonType, b.lit(BSONType.BOOLEAN)),
                () => {
                    if (hasBoolean) {
                        const boolMember = type.types.find(t => t.kind === ReflectionKind.boolean)!;
                        deserializeValueInto(b, buffer, o, bsonType, boolMember, target, ctx);
                    } else {
                        // Boolean literal only
                        const result = b.let(b.call(readBooleanValue, buffer, b.getVar(o), bsonType), 'litBool');
                        b.setVar(target, b.at(result, 0));
                        b.setVar(o, b.add(b.getVar(o), b.at(result, 1)));
                    }
                },
            ]);
        } else if (booleanLiterals.length > 0 && hasNumber) {
            // Special case: boolean literal + number → BOOLEAN dispatches with priority
            // e.g., `true | number`: BOOLEAN true → true, BOOLEAN false → 0
            cases.push([
                b.eq(bsonType, b.lit(BSONType.BOOLEAN)),
                () => {
                    const result = b.let(b.call(readBooleanValue, buffer, b.getVar(o), bsonType), 'boolLitResult');
                    const boolVal = b.at(result, 0);
                    const consumed = b.at(result, 1);
                    // Check if value matches any boolean literal
                    const litValue = booleanLiterals[0].literal;
                    b.if_(
                        b.eq(boolVal, b.lit(litValue)),
                        () => {
                            b.setVar(target, b.lit(litValue));
                            b.setVar(o, b.add(b.getVar(o), consumed));
                        },
                        () => {
                            // Coerce to number
                            const numResult = b.let(
                                b.call(readNumberValue, buffer, b.getVar(o), bsonType),
                                'boolNumResult',
                            );
                            b.setVar(target, b.at(numResult, 0));
                            b.setVar(o, b.add(b.getVar(o), b.at(numResult, 1)));
                        },
                    );
                },
            ]);
        }

        // If hasNumber, add BOOLEAN coercion to number (when no boolean or literal claims it)
        if (hasNumber && !hasBoolean && booleanLiterals.length === 0) {
            cases.push([
                b.eq(bsonType, b.lit(BSONType.BOOLEAN)),
                () => {
                    const numberMember = type.types.find(t => t.kind === ReflectionKind.number)!;
                    deserializeValueInto(b, buffer, o, bsonType, numberMember, target, ctx);
                },
            ]);
        }
    }

    // === LONG (bigint) ===
    if (hasBigint) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.LONG)),
            () => {
                const bigintMember = type.types.find(t => t.kind === ReflectionKind.bigint)!;
                deserializeValueInto(b, buffer, o, bsonType, bigintMember, target, ctx);
            },
        ]);
    }

    // === DATE ===
    if (hasDate) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.DATE)),
            () => {
                const dateMember = type.types.find(
                    t => t.kind === ReflectionKind.class && (t as TypeClass).classType === Date,
                )!;
                deserializeValueInto(b, buffer, o, bsonType, dateMember, target, ctx);
            },
        ]);
    }

    // === REGEX ===
    if (hasRegExp) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.REGEX)),
            () => {
                const regexpMember = type.types.find(
                    t =>
                        t.kind === ReflectionKind.regexp ||
                        (t.kind === ReflectionKind.class && (t as TypeClass).classType === RegExp),
                )!;
                deserializeValueInto(b, buffer, o, bsonType, regexpMember, target, ctx);
            },
        ]);
    }

    // === OBJECT (reference, class, object literal) ===
    const allObjectMembers = type.types.filter(
        t =>
            (t.kind === ReflectionKind.objectLiteral || t.kind === ReflectionKind.class) &&
            !isReferenceType(t) &&
            !binaryTypes.includes(t.kind === ReflectionKind.class ? ((t as TypeClass).classType as any) : null) &&
            (t.kind !== ReflectionKind.class ||
                ((t as TypeClass).classType !== Date &&
                    (t as TypeClass).classType !== RegExp &&
                    (t as TypeClass).classType !== Map &&
                    (t as TypeClass).classType !== Set)),
    );

    if (refMember || allObjectMembers.length > 0) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.OBJECT)),
            () => {
                if (refMember) {
                    deserializeReferenceInto(b, buffer, o, bsonType, refMember as TypeClass, target, ctx);
                } else if (allObjectMembers.length === 1) {
                    deserializeValueInto(b, buffer, o, bsonType, allObjectMembers[0], target, ctx);
                } else {
                    // Multiple object members — create cached dispatcher at JIT time
                    const dispatcher = createMultiObjectUnionDispatcher(allObjectMembers, unionName);
                    const result = b.let(b.call(dispatcher, buffer, b.getVar(o)), 'multiObjResult');
                    b.setVar(target, b.at(result, 0));
                    b.setVar(o, b.at(result, 1));
                }
            },
        ]);
    }

    // === ARRAY (array, tuple) ===
    const allArrayMembers = type.types.filter(t => t.kind === ReflectionKind.array || t.kind === ReflectionKind.tuple);
    if (allArrayMembers.length === 1) {
        cases.push([
            b.eq(bsonType, b.lit(BSONType.ARRAY)),
            () => {
                deserializeValueInto(b, buffer, o, bsonType, allArrayMembers[0], target, ctx);
            },
        ]);
    } else if (allArrayMembers.length > 1) {
        // Multiple array types — use runtime dispatch
        // Read all elements as `any`, then try to match each array type
        cases.push([
            b.eq(bsonType, b.lit(BSONType.ARRAY)),
            () => {
                const result = b.let(
                    b.call(deserializeMultiArrayUnion, buffer, b.getVar(o), b.lit(allArrayMembers), b.lit(unionName)),
                    'multiArrResult',
                );
                b.setVar(target, b.at(result, 0));
                b.setVar(o, b.at(result, 1));
            },
        ]);
    }

    // === ANY / UNKNOWN (fallback for annotated types like UUID that resolve to `any`) ===
    const hasAny = type.types.some(t => t.kind === ReflectionKind.any || t.kind === ReflectionKind.unknown);
    if (hasAny) {
        // `any` accepts everything — use as else handler instead of throwing
        if (cases.length > 0) {
            b.cond(cases, () => {
                // Fallback to parseValueAny for any/unknown
                b.setVar(target, b.call(parseValueAny, buffer, b.getVar(o), bsonType));
                b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
            });
        } else {
            b.setVar(target, b.call(parseValueAny, buffer, b.getVar(o), bsonType));
            b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
        }
    } else if (cases.length > 0) {
        b.cond(cases, () => {
            // No match — throw error
            b.throw_(b.call(makeUnionNoMatchError, bsonType, b.lit(unionName)));
        });
    } else {
        b.setVar(o, b.call(skipValue, buffer, b.getVar(o), bsonType));
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a default value for a type (used for non-optional, no-default properties).
 */
function getDefaultForType(type: Type): any {
    switch (type.kind) {
        case ReflectionKind.string:
            return '';
        case ReflectionKind.number:
            return 0;
        case ReflectionKind.boolean:
            return false;
        case ReflectionKind.bigint:
            return 0n;
        case ReflectionKind.null:
            return null;
        case ReflectionKind.undefined:
            return undefined;
        case ReflectionKind.literal:
            return (type as TypeLiteral).literal;
        default:
            return undefined;
    }
}

/**
 * Check if a type includes null as a valid value.
 */
function typeIncludesNull(type: Type): boolean {
    if (type.kind === ReflectionKind.null) return true;
    if (type.kind === ReflectionKind.union) {
        return (type as TypeUnion).types.some(t => t.kind === ReflectionKind.null);
    }
    return false;
}

/**
 * Find the rest element in a tuple type.
 */
function findTupleRest(type: TypeTuple): { index: number; type?: Type } {
    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            return { index: i, type: (type.types[i].type as TypeRest).type };
        }
    }
    return { index: -1 };
}

/**
 * Read a cstring and return [string, bytesConsumed].
 */
function readCStringHelper(buffer: Uint8Array, offset: number): [string, number] {
    return readCString(buffer, offset);
}

const bsonTypeNames: Record<number, string> = {
    [BSONType.DOUBLE]: 'DOUBLE',
    [BSONType.STRING]: 'STRING',
    [BSONType.OBJECT]: 'OBJECT',
    [BSONType.ARRAY]: 'ARRAY',
    [BSONType.BINARY]: 'BINARY',
    [BSONType.UNDEFINED]: 'UNDEFINED',
    [BSONType.OID]: 'OID',
    [BSONType.BOOLEAN]: 'BOOLEAN',
    [BSONType.DATE]: 'DATE',
    [BSONType.NULL]: 'NULL',
    [BSONType.REGEX]: 'REGEX',
    [BSONType.INT]: 'INT',
    [BSONType.LONG]: 'LONG',
};

/**
 * Create a BSONError for type conversion failures.
 */
function makeBsonConversionError(bsonType: number, typeName: string): BSONError {
    const bsonName = bsonTypeNames[bsonType] || `0x${bsonType.toString(16)}`;
    return new BSONError(`Cannot convert bson type ${bsonName} to ${typeName}`);
}

/**
 * Create a BSONError for undefined conversion.
 */
function makeUndefinedConversionError(bsonType: number, typeName: string): BSONError {
    return new BSONError(`Cannot convert undefined value to ${typeName}`);
}

/**
 * Check if a type should throw when a required field is missing from BSON.
 */
function needsThrowOnMissing(type: Type): boolean {
    if (type.kind === ReflectionKind.union) {
        // Throw for unions that don't include null/undefined
        return !typeIncludesNull(type) && !isOptional(type);
    }
    return false;
}

/**
 * Create a BSONError for union no-match.
 */
function makeUnionNoMatchError(bsonType: number, unionName: string): BSONError {
    const bsonName = bsonTypeNames[bsonType] || `0x${bsonType.toString(16)}`;
    if (bsonType === BSONType.UNDEFINED || bsonType === BSONType.NULL) {
        return new BSONError(`Cannot convert undefined value to ${unionName}`);
    }
    return new BSONError(`No union member matched. Expected: ${unionName}`);
}

/**
 * Describe a type for error messages.
 */
function describeType(type: Type): string {
    if (type.kind === ReflectionKind.class) {
        return (type as TypeClass).classType.name;
    }
    if (type.kind === ReflectionKind.objectLiteral) {
        const props = (type as TypeObjectLiteral).types
            .filter((t): t is TypePropertySignature => t.kind === ReflectionKind.propertySignature)
            .map(t => `${memberNameToString(t.name)}: ${ReflectionKind[t.type.kind]}`);
        return `{${props.join(', ')}}`;
    }
    if (type.kind === ReflectionKind.array) {
        return `Array<${describeType((type as TypeArray).type)}>`;
    }
    if (type.kind === ReflectionKind.union) {
        return describeUnion(type as TypeUnion);
    }
    if (type.kind === ReflectionKind.templateLiteral) {
        return describeTemplateLiteral(type as TypeTemplateLiteral);
    }
    return ReflectionKind[type.kind];
}

/**
 * Describe a union type for error messages.
 */
function describeUnion(type: TypeUnion): string {
    if (type.typeName) return type.typeName;
    return type.types
        .map(t => {
            if (t.kind === ReflectionKind.null) return 'null';
            if (t.kind === ReflectionKind.undefined) return 'undefined';
            // Check annotated string types before plain string
            if (isUUIDType(t)) return 'UUID';
            if (isMongoIdType(t)) return 'MongoId';
            if (t.kind === ReflectionKind.string) return 'string';
            if (t.kind === ReflectionKind.number) return 'number';
            if (t.kind === ReflectionKind.boolean) return 'boolean';
            if (t.kind === ReflectionKind.bigint) return 'bigint';
            if (t.kind === ReflectionKind.regexp) return 'RegExp';
            if (t.kind === ReflectionKind.literal) return String((t as TypeLiteral).literal);
            if (t.kind === ReflectionKind.class) return (t as TypeClass).classType.name;
            if (t.kind === ReflectionKind.objectLiteral && (t as TypeObjectLiteral).typeName)
                return (t as TypeObjectLiteral).typeName!;
            if (t.kind === ReflectionKind.array) return `Array<${describeType((t as TypeArray).type)}>`;
            if (t.kind === ReflectionKind.templateLiteral) return describeTemplateLiteral(t as TypeTemplateLiteral);
            if (t.kind === ReflectionKind.any && (t as any).typeName) return (t as any).typeName;
            return ReflectionKind[t.kind];
        })
        .join(' | ');
}

/**
 * Describe a template literal for error messages.
 */
function describeTemplateLiteral(type: TypeTemplateLiteral): string {
    const parts = type.types.map(t => {
        if (t.kind === ReflectionKind.literal) return String((t as TypeLiteral).literal);
        if (t.kind === ReflectionKind.string) return '${string}';
        if (t.kind === ReflectionKind.number) return '${number}';
        return '${any}';
    });
    return '`' + parts.join('') + '`';
}

/**
 * Convert a template literal type to a RegExp for validation.
 */
function templateLiteralToRegex(type: TypeTemplateLiteral): RegExp {
    const parts = type.types.map(t => {
        if (t.kind === ReflectionKind.literal) {
            return escapeRegExp(String((t as TypeLiteral).literal));
        }
        if (t.kind === ReflectionKind.string) return '.+';
        if (t.kind === ReflectionKind.number) return '-?\\d+(?:\\.\\d+)?';
        return '.+';
    });
    return new RegExp('^' + parts.join('') + '$');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
