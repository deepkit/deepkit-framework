/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext, isArray, isIterable, isObject, toFastProperties } from '@deepkit/core';
import {
    assertType,
    binaryBigIntAnnotation,
    BinaryBigIntType,
    createReference,
    embeddedAnnotation,
    excludedAnnotation,
    executeTemplates,
    getConstructorProperties,
    getIndexCheck,
    getNameExpression,
    getTypeJitContainer,
    isOptional,
    isReference,
    isReferenceHydrated,
    JitStack,
    mongoIdAnnotation,
    NamingStrategy,
    OuterType,
    ReceiveType,
    referenceAnnotation,
    ReflectionClass,
    ReflectionKind,
    resolveReceiveType,
    RuntimeCode,
    Serializer,
    serializeTypeUnion,
    TemplateRegistry,
    TemplateState,
    TypeBigInt,
    TypeClass,
    TypeGuardRegistry,
    TypeIndexSignature,
    TypeLiteral,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    typeSettings,
    TypeTuple,
    UnpopulatedCheck,
    unpopulatedSymbol,
    uuidAnnotation
} from '@deepkit/type';
import {
    bsonTypeGuardArray,
    bsonTypeGuardForBsonTypes,
    bsonTypeGuardLiteral,
    bsonTypeGuardObjectLiteral,
    bsonTypeGuardTemplateLiteral,
    bsonTypeGuardTuple,
    bsonTypeGuardUnion,
    deserializeArray,
    deserializeBigInt,
    deserializeBinary,
    deserializeBoolean,
    deserializeDate,
    deserializeLiteral,
    deserializeNull,
    deserializeNumber,
    deserializeObjectLiteral,
    deserializeRegExp,
    deserializeString,
    deserializeTemplateLiteral,
    deserializeTuple,
    deserializeUndefined,
    deserializeUnion
} from './bson-deserializer-templates';
import { seekElementSize } from './continuation';
import { isObjectId, isUUID, ObjectId, UUID } from './model';
import { BSON_BINARY_SUBTYPE_DEFAULT, BSON_BINARY_SUBTYPE_UUID, BSONType, digitByteSize, TWO_PWR_32_DBL_N } from './utils';

export function createBuffer(size: number): Uint8Array {
    return 'undefined' !== typeof Buffer && 'function' === typeof Buffer.allocUnsafe ? Buffer.allocUnsafe(size) : new Uint8Array(size);
}

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// BSON MAX VALUES
const BSON_INT32_MAX = 0x7fffffff;
const BSON_INT32_MIN = -0x80000000;

// JS MAX PRECISE VALUES
export const JS_INT_MAX = 0x20000000000000; // Any integer up to 2^53 can be precisely represented by a double.
export const JS_INT_MIN = -0x20000000000000; // Any integer down to -2^53 can be precisely represented by a double.

const LONG_MAX = 'undefined' !== typeof BigInt ? BigInt('9223372036854775807') : 9223372036854775807;
const LONG_MIN = 'undefined' !== typeof BigInt ? BigInt('-9223372036854775807') : -9223372036854775807;

export function hexToByte(hex: string, index: number = 0, offset: number = 0): number {
    let code1 = hex.charCodeAt(index * 2 + offset) - 48;
    if (code1 > 9) code1 -= 39;

    let code2 = hex.charCodeAt((index * 2) + offset + 1) - 48;
    if (code2 > 9) code2 -= 39;
    return code1 * 16 + code2;
}

export function uuidStringToByte(hex: string, index: number = 0): number {
    let offset = 0;
    //e.g. bef8de96-41fe-442f-b70c-c3a150f8c96c
    if (index > 3) offset += 1;
    if (index > 5) offset += 1;
    if (index > 7) offset += 1;
    if (index > 9) offset += 1;
    return hexToByte(hex, index, offset);
}

export function stringByteLength(str: string): number {
    if (!str) return 0;
    let size = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 128) size += 1;
        else if (c > 127 && c < 2048) size += 2;
        else size += 3;
    }
    return size;
}

function getBinaryBigIntSize(value: bigint): number {
    let hex = value.toString(16);
    if (hex[0] === '-') hex = hex.slice(1);
    if (hex === '0') return 4 + 1;
    if (hex.length % 2) hex = '0' + hex;
    return 4 + 1 + Math.ceil(hex.length / 2);
}

function getSignedBinaryBigIntSize(value: bigint): number {
    let hex = value.toString(16);
    if (hex[0] === '-') hex = hex.slice(1);
    if (hex === '0') return 4 + 1;
    if (hex.length % 2) hex = '0' + hex;
    return 4 + 1 + 1 + Math.ceil(hex.length / 2);
}

export function getValueSize(value: any): number {
    if ('boolean' === typeof value) {
        return 1;
    } else if ('string' === typeof value) {
        //size + content + null
        return 4 + stringByteLength(value) + 1;
    } else if ('bigint' === typeof value) {
        //per default bigint will be serialized as long, to be compatible with default mongo driver and mongo database.
        return 8;
    } else if ('number' === typeof value) {
        if (Math.floor(value) === value) {
            //it's an int
            if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
                //32bit
                return 4;
            } else if (value >= JS_INT_MIN && value <= JS_INT_MAX) {
                //double, 64bit
                return 8;
            } else {
                //long
                return 8;
            }
        } else {
            //double
            return 8;
        }
    } else if (value instanceof Date) {
        return 8;
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        let size = 4; //size
        size += 1; //sub type
        size += value.byteLength;
        return size;
    } else if (isArray(value)) {
        let size = 4; //object size
        for (let i = 0; i < value.length; i++) {
            size += 1; //element type
            size += digitByteSize(i); //element name
            size += getValueSize(value[i]);
        }
        size += 1; //null
        return size;
    } else if (isUUID(value)) {
        return 4 + 1 + 16;
    } else if (isObjectId(value)) {
        return 12;
    } else if (value && value['_bsontype'] === 'Binary') {
        let size = 4; //size
        size += 1; //sub type
        size += value.buffer.byteLength;
        return size;
    } else if (value instanceof RegExp) {
        return stringByteLength(value.source) + 1
            +
            (value.global ? 1 : 0) +
            (value.ignoreCase ? 1 : 0) +
            (value.multiline ? 1 : 0) +
            1;
    } else if (isObject(value)) {
        let size = 4; //object size
        for (let i in value) {
            if (!value.hasOwnProperty(i)) continue;
            size += 1; //element type
            size += stringByteLength(i) + 1; //element name + null
            size += getValueSize(value[i]);
        }
        size += 1; //null
        return size;
    } //isObject() should be last

    return 0;
}

export class Writer {
    public dataView: DataView;

    constructor(public buffer: Uint8Array, public offset: number = 0) {
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    writeUint32(v: number) {
        this.dataView.setUint32(this.offset, v, true);
        this.offset += 4;
    }

    writeInt32(v: number) {
        this.dataView.setInt32(this.offset, v, true);
        this.offset += 4;
    }

    writeDouble(v: number) {
        this.dataView.setFloat64(this.offset, v, true);
        this.offset += 8;
    }

    writeDelayedSize(v: number, position: number) {
        this.dataView.setUint32(position, v, true);
    }

    writeByte(v: number) {
        this.buffer[this.offset++] = v;
    }

    writeBuffer(buffer: Uint8Array, offset: number = 0) {
        // buffer.copy(this.buffer, this.buffer.byteOffset + this.offset);
        for (let i = offset; i < buffer.byteLength; i++) {
            this.buffer[this.offset++] = buffer[i];
        }
        // this.offset += buffer.byteLength;
    }

    writeNull() {
        this.writeByte(0);
    }

    writeAsciiString(str: string | number) {
        str = 'string' === typeof str ? str : '' + str;
        for (let i = 0; i < str.length; i++) {
            this.buffer[this.offset++] = str.charCodeAt(i);
        }
    }

    writeString(str: string) {
        if (!str) return;
        if (typeof str !== 'string') return;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c < 128) {
                this.buffer[this.offset++] = c;
            } else if (c > 127 && c < 2048) {
                this.buffer[this.offset++] = (c >> 6) | 192;
                this.buffer[this.offset++] = ((c & 63) | 128);
            } else {
                this.buffer[this.offset++] = (c >> 12) | 224;
                this.buffer[this.offset++] = ((c >> 6) & 63) | 128;
                this.buffer[this.offset++] = (c & 63) | 128;
            }
        }
    }

    getBigIntBSONType(value: bigint): number {
        if (BSON_INT32_MIN <= value && value <= BSON_INT32_MAX) {
            return BSONType.INT;
        } else if (LONG_MIN <= value && value <= LONG_MAX) {
            return BSONType.LONG;
        } else {
            return BSONType.BINARY;
        }
    }

    writeBigIntLong(value: bigint) {
        if (value < 0) {
            this.writeInt32(~Number(-value % BigInt(TWO_PWR_32_DBL_N)) + 1 | 0); //low
            this.writeInt32(~(Number(-value / BigInt(TWO_PWR_32_DBL_N))) | 0); //high
        } else {
            this.writeInt32(Number(value % BigInt(TWO_PWR_32_DBL_N)) | 0); //low
            this.writeInt32(Number(value / BigInt(TWO_PWR_32_DBL_N)) | 0); //high
        }
    }

    writeBigIntBinary(value: bigint) {
        //custom binary
        let hex = value.toString(16);
        if (hex[0] === '-') hex = hex.slice(1);
        if (hex === '0') {
            this.writeUint32(0);
            this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);
            return;
        }
        if (hex.length % 2) hex = '0' + hex;
        let size = Math.ceil(hex.length / 2);
        this.writeUint32(size + 1);
        this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);
        for (let i = 0; i < size; i++) {
            this.buffer[this.offset++] = hexToByte(hex, i);
        }
    }

    writeSignedBigIntBinary(value: bigint) {
        //custom binary
        let hex = value.toString(16);
        let signum = 0;
        if (hex[0] === '-') {
            //negative number
            signum = 1;
            hex = hex.slice(1);
        }
        if (hex === '0') {
            this.writeUint32(0);
            this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);
            return;
        }
        if (hex.length % 2) hex = '0' + hex;
        let size = Math.ceil(hex.length / 2);
        this.writeUint32(1 + size);
        this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);
        this.buffer[this.offset++] = signum === 1 ? 255 : 0; //0xff means negative, 0 means positive
        for (let i = 0; i < size; i++) {
            this.buffer[this.offset++] = hexToByte(hex, i);
        }
    }

    writeLong(value: number) {
        if (value > 9223372036854775807) value = 9223372036854775807;
        if (value < -9223372036854775807) value = -9223372036854775807;

        if (value < 0) {
            this.writeInt32(~(-value % TWO_PWR_32_DBL_N) + 1 | 0); //low
            this.writeInt32(~(-value / TWO_PWR_32_DBL_N) | 0); //high
        } else {
            this.writeInt32((value % TWO_PWR_32_DBL_N) | 0); //low
            this.writeInt32((value / TWO_PWR_32_DBL_N) | 0); //high
        }
    }

    writeUUID(value: string | UUID) {
        value = value instanceof UUID ? value.id : value;
        this.writeUint32(16);
        this.writeByte(BSON_BINARY_SUBTYPE_UUID);

        this.buffer[this.offset + 0] = uuidStringToByte(value, 0);
        this.buffer[this.offset + 1] = uuidStringToByte(value, 1);
        this.buffer[this.offset + 2] = uuidStringToByte(value, 2);
        this.buffer[this.offset + 3] = uuidStringToByte(value, 3);
        //-
        this.buffer[this.offset + 4] = uuidStringToByte(value, 4);
        this.buffer[this.offset + 5] = uuidStringToByte(value, 5);
        //-
        this.buffer[this.offset + 6] = uuidStringToByte(value, 6);
        this.buffer[this.offset + 7] = uuidStringToByte(value, 7);
        //-
        this.buffer[this.offset + 8] = uuidStringToByte(value, 8);
        this.buffer[this.offset + 9] = uuidStringToByte(value, 9);
        //-
        this.buffer[this.offset + 10] = uuidStringToByte(value, 10);
        this.buffer[this.offset + 11] = uuidStringToByte(value, 11);
        this.buffer[this.offset + 12] = uuidStringToByte(value, 12);
        this.buffer[this.offset + 13] = uuidStringToByte(value, 13);
        this.buffer[this.offset + 14] = uuidStringToByte(value, 14);
        this.buffer[this.offset + 15] = uuidStringToByte(value, 15);
        this.offset += 16;
    }

    writeObjectId(value: string | ObjectId) {
        value = 'string' === typeof value ? value : value.id;
        this.buffer[this.offset + 0] = hexToByte(value, 0);
        this.buffer[this.offset + 1] = hexToByte(value, 1);
        this.buffer[this.offset + 2] = hexToByte(value, 2);
        this.buffer[this.offset + 3] = hexToByte(value, 3);
        this.buffer[this.offset + 4] = hexToByte(value, 4);
        this.buffer[this.offset + 5] = hexToByte(value, 5);
        this.buffer[this.offset + 6] = hexToByte(value, 6);
        this.buffer[this.offset + 7] = hexToByte(value, 7);
        this.buffer[this.offset + 8] = hexToByte(value, 8);
        this.buffer[this.offset + 9] = hexToByte(value, 9);
        this.buffer[this.offset + 10] = hexToByte(value, 10);
        this.buffer[this.offset + 11] = hexToByte(value, 11);
        this.offset += 12;
    }

    write(value: any, nameWriter?: () => void): void {
        if ('boolean' === typeof value) {
            if (nameWriter) {
                this.writeByte(BSONType.BOOLEAN);
                nameWriter();
            }
            this.writeByte(value ? 1 : 0);
        } else if (value instanceof RegExp) {
            if (nameWriter) {
                this.writeByte(BSONType.REGEXP);
                nameWriter();
            }
            this.writeString(value.source);
            this.writeNull();
            if (value.ignoreCase) this.writeString('i');
            if (value.global) this.writeString('s'); //BSON does not use the RegExp flag format
            if (value.multiline) this.writeString('m');
            this.writeNull();
        } else if ('string' === typeof value) {
            //size + content + null
            if (nameWriter) {
                this.writeByte(BSONType.STRING);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size placeholder
            this.writeString(value);
            this.writeByte(0); //null
            this.writeDelayedSize(this.offset - start - 4, start);
        } else if ('number' === typeof value) {
            if (Math.floor(value) === value) {
                //it's an int
                if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
                    //32bit
                    if (nameWriter) {
                        this.writeByte(BSONType.INT);
                        nameWriter();
                    }
                    this.writeInt32(value);
                } else if (value >= JS_INT_MIN && value <= JS_INT_MAX) {
                    //double, 64bit
                    if (nameWriter) {
                        this.writeByte(BSONType.NUMBER);
                        nameWriter();
                    }
                    this.writeDouble(value);
                } else {
                    //long, but we serialize as Double, because deserialize will be BigInt
                    if (nameWriter) {
                        this.writeByte(BSONType.NUMBER);
                        nameWriter();
                    }
                    this.writeDouble(value);
                }
            } else {
                //double
                if (nameWriter) {
                    this.writeByte(BSONType.NUMBER);
                    nameWriter();
                }
                this.writeDouble(value);
            }
        } else if (value instanceof Date) {
            if (nameWriter) {
                this.writeByte(BSONType.DATE);
                nameWriter();
            }

            this.writeLong(value.valueOf());
        } else if (isUUID(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            this.writeUUID(value);
        } else if ('bigint' === typeof value) {
            //this is only called for bigint in any structures.
            //to make sure the deserializing yields a bigint as well, we have to always use binary representation
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            this.writeBigIntBinary(value);
        } else if (isObjectId(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.OID);
                nameWriter();
            }
            this.writeObjectId(value);
        } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            this.writeArrayBuffer(value);
        } else if (isArray(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.ARRAY);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size

            for (let i = 0; i < value.length; i++) {
                this.write(value[i], () => {
                    this.writeAsciiString('' + i);
                    this.writeByte(0);
                });
            }
            this.writeNull();
            this.writeDelayedSize(this.offset - start, start);
        } else if (value === undefined) {
            if (nameWriter) {
                this.writeByte(BSONType.UNDEFINED);
                nameWriter();
            }
        } else if (value === null) {
            if (nameWriter) {
                this.writeByte(BSONType.NULL);
                nameWriter();
            }
        } else if (isObject(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.OBJECT);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size

            for (let i in value) {
                if (!value.hasOwnProperty(i)) continue;
                this.write(value[i], () => {
                    this.writeString(i);
                    this.writeByte(0);
                });
            }
            this.writeNull();
            this.writeDelayedSize(this.offset - start, start);
        } else {
            //the sizer incldues the type and name, so we have to write that
            if (nameWriter) {
                this.writeByte(BSONType.UNDEFINED);
                nameWriter();
            }
        }
    }

    writeArrayBuffer(value: ArrayBuffer | ArrayBufferView) {
        let view = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if ((value as any)['_bsontype'] === 'Binary') {
            view = (value as any).buffer;
        }

        this.writeUint32(value.byteLength);
        this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);

        for (let i = 0; i < value.byteLength; i++) {
            this.buffer[this.offset++] = view[i];
        }
    }
}

function getNameWriterCode(name: string): string {
    const nameSetter: string[] = [];
    //todo: support utf8 names
    for (let i = 0; i < name.length; i++) {
        nameSetter.push(`state.writer.buffer[state.writer.offset++] = ${name.charCodeAt(i)};`);
    }
    return `
        //write name: '${name}'
        ${nameSetter.join('\n')}
        state.writer.writeByte(0); //null
    `;
}

function sizerObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }
        if (member.kind !== ReflectionKind.property && member.kind !== ReflectionKind.propertySignature) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);
        existing.push(name);
        const accessor = `${state.accessor}[${name}]`;
        let converter = executeTemplates(state.fork('', accessor).extendPath(member.name).forPropertyName(state.namingStrategy.getPropertyName(member)), member.type);

        const embedded = embeddedAnnotation.getFirst(member.type);
        if (member.type.kind === ReflectionKind.class && embedded) {
            converter = serializeEmbeddable(member, embedded, state);
        }

        if (isOptional(member)) {
            lines.push(`
            if (${name} in ${state.accessor}) {
                if (${accessor} === undefined) {
                     ${executeTemplates(state.fork('', accessor).extendPath(member.name).forPropertyName(state.namingStrategy.getPropertyName(member)), { kind: ReflectionKind.undefined })}
                } else {
                    ${converter}
                }
            }
            `);
        } else {
            lines.push(converter);
        }
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
        const signatureLines: string[] = [];

        function isLiteralType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.literal || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.literal));
        }

        function isNumberType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.number || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.number));
        }

        //sort, so the order is literal, number, string, symbol.  literal comes first as its the most specific type.
        //we need to do that for numbers since all keys are string|symbol in runtime, and we need to check if a string is numeric first before falling back to string.
        signatures.sort((a, b) => {
            if (isLiteralType(a)) return -1;
            if (isNumberType(a) && !isLiteralType(b)) return -1;
            return +1;
        });

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
                ${executeTemplates(state.fork(undefined, `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new RuntimeCode(i)), signature.type)}
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        for (const ${i} in ${state.accessor}) {
            if (!${state.accessor}.hasOwnProperty(${i})) continue;
            if (${existingCheck}) continue;
            if (false) {} ${signatureLines.join(' ')}
        }
        `);
    }

    sizerPropertyNameAware(type, state, `'object' === typeof ${state.accessor}`, `
        state.size += 4; //object size

        ${lines.join('\n')}

        state.size += 1; //null
    `);

    if (type.kind === ReflectionKind.class) {
        if (referenceAnnotation.hasAnnotations(type) && !state.isAnnotationHandled(referenceAnnotation)) {
            state.annotationHandled(referenceAnnotation);
            state.setContext({ isObject, isReference, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            //the primary key is serialised for unhydrated references
            const index = getNameExpression(reflection.getPrimary().getName(), state);
            const primaryKey = reflection.getPrimary().getType();
            state.template = `
            if (isReference(${state.accessor}) && !isReferenceHydrated(${state.accessor})) {
                ${executeTemplates(state.fork(state.setter, `${state.accessor}[${index}]`).forPropertyName(state.propertyName), primaryKey)}
            } else {
                ${state.template}
            }
            `;
        }
    }
}

function serializeEmbeddable(member: TypeProperty | TypePropertySignature, embedded: { prefix?: string }, state: TemplateState): string {
    assertType(member.type, ReflectionKind.class);
    //only the constructor properties are serialized
    const embed: string[] = [];
    const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);
    const embedProperties = getConstructorProperties(member.type);
    const prefix = embedded.prefix ?? (embedProperties.length > 1 ? String(member.name) + '_' : '');

    for (const property of embedProperties) {
        const embeddedPropertyName = getNameExpression(property.name, state);
        const propertyName = embedProperties.length === 1 ? String(member.name) : prefix + String(property.name);
        embed.push(`
            ${executeTemplates(state.fork('', `${state.accessor}[${name}][${embeddedPropertyName}]`).extendPath(String(member.name)).forPropertyName(propertyName), property.type)}
        `);
    }

    return embed.join('\n');
}

function serializeObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }

        if (member.kind !== ReflectionKind.property && member.kind !== ReflectionKind.propertySignature) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);
        existing.push(name);
        const accessor = `${state.accessor}[${name}]`;
        let converter = executeTemplates(state.fork('', accessor).extendPath(member.name).forPropertyName(member.name), member.type);

        const embedded = embeddedAnnotation.getFirst(member.type);
        if (member.type.kind === ReflectionKind.class && embedded) {
            converter = serializeEmbeddable(member, embedded, state);
        }

        if (isOptional(member)) {
            lines.push(`
            if (${name} in ${state.accessor}) {
                if (${accessor} === undefined) {
                    ${executeTemplates(state.fork('', accessor).extendPath(member.name).forPropertyName(member.name), { kind: ReflectionKind.undefined })}
                } else {
                    ${converter}
                }
            }
            `);
        } else {
            lines.push(converter);
        }
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
        const signatureLines: string[] = [];

        function isLiteralType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.literal || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.literal));
        }

        function isNumberType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.number || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.number));
        }

        //sort, so the order is literal, number, string, symbol.  literal comes first as its the most specific type.
        //we need to do that for numbers since all keys are string|symbol in runtime, and we need to check if a string is numeric first before falling back to string.
        signatures.sort((a, b) => {
            if (isLiteralType(a)) return -1;
            if (isNumberType(a) && !isLiteralType(b)) return -1;
            return +1;
        });

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
                ${executeTemplates(state.fork(undefined, `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new RuntimeCode(i)), signature.type)}
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        for (const ${i} in ${state.accessor}) {
            if (!${state.accessor}.hasOwnProperty(${i})) continue;
            if (${existingCheck}) continue;
            if (false) {} ${signatureLines.join(' ')}
        }
        `);
    }


    const start = state.setVariable('start', 0);
    serializePropertyNameAware(type, state, BSONType.OBJECT, `'object' === typeof ${state.accessor}`, `
        ${start} = state.writer.offset;
        state.writer.offset += 4; //size

        ${lines.join('\n')}

        state.writer.writeNull();
        state.writer.writeDelayedSize(state.writer.offset - ${start}, ${start});
    `);

    if (type.kind === ReflectionKind.class) {
        if (referenceAnnotation.hasAnnotations(type) && !state.isAnnotationHandled(referenceAnnotation)) {
            state.annotationHandled(referenceAnnotation);
            state.setContext({ isObject, isReference, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            //the primary key is serialised for unhydrated references
            const index = getNameExpression(reflection.getPrimary().getName(), state);
            const primaryKey = reflection.getPrimary().getType();
            state.template = `
            if (isReference(${state.accessor}) && !isReferenceHydrated(${state.accessor})) {
                ${executeTemplates(state.fork(state.setter, `${state.accessor}[${index}]`).forPropertyName(state.propertyName), primaryKey)}
            } else {
                ${state.template}
            }
            `;
        }
    }
}

function propertyNameWriter(state: TemplateState) {
    if (state.propertyName) {
        if (state.propertyName instanceof RuntimeCode) {
            return `
               state.writer.writeAsciiString(${state.propertyName.code});
               state.writer.writeByte(0);
            `;
        } else {
            return getNameWriterCode(state.propertyName);
        }
    }
    return '';
}

function serializePropertyNameAware(type: OuterType, state: TemplateState, bsonType: BSONType, typeChecker: string, code: string): void {
    //when this call is reached first, and it's an object, then it's no type byte needed.
    const isInitialObject = `${bsonType === BSONType.OBJECT} && state.writer.offset === 0`;
    if (!typeChecker) {
        state.addCode(`
            if (!(${isInitialObject})) state.writer.writeByte(${bsonType});
            ${propertyNameWriter(state)}
            ${code}
        `);
        return;
    }

    state.addCode(`
        if (!(${typeChecker})) ${state.throwCode(type)}
        if (!(${isInitialObject})) state.writer.writeByte(${bsonType});
        ${propertyNameWriter(state)}
        ${code}
    `);
}

export class DigitByteRuntimeCode extends RuntimeCode {
    constructor(public code: string) {
        super(code);
    }
}

function sizerPropertyNameAware(type: OuterType, state: TemplateState, typeChecker: string, code: string): void {
    if (state.propertyName) {
        if (state.propertyName instanceof DigitByteRuntimeCode) {
            state.setContext({ digitByteSize });
            //type + string size + null
            code = `
                state.size += 1 + digitByteSize(${state.propertyName.code}); //type + byte of ${state.propertyName.code}
                ${code}
            `;
        } else if (state.propertyName instanceof RuntimeCode) {
            state.setContext({ stringByteLength });
            //type + string size + null
            code = `
                state.size += 1 + stringByteLength(${state.propertyName.code}) + 1; //type + string size of ${state.propertyName.code} + null
                ${code}
            `;
        } else {
            //type + string size + null
            code = `
               state.size += 1 + ${stringByteLength(state.propertyName)} + 1; //type + string size of ${state.propertyName} + null
               ${code}
            `;
        }
    }
    const checker = typeChecker ? `if (!(${typeChecker})) ${state.throwCode(type)}` : '';
    state.addCode(`
        ${checker}
        ${code}
    `);
}

function sizerAny(type: OuterType, state: TemplateState) {
    state.setContext({ getValueSize });
    sizerPropertyNameAware(type, state, ``, `state.size += getValueSize(${state.accessor});`);
}

function serializeAny(type: OuterType, state: TemplateState) {
    state.addCode(`
        state.writer.write(${state.accessor}, () => {
            ${propertyNameWriter(state)}
        });
    `);
}

function sizerBoolean(type: OuterType, state: TemplateState) {
    sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'boolean'`, `
        state.size += 1;
    `);
}

function sizerNumber(type: OuterType, state: TemplateState) {
    state.setContext({ getValueSize });
    //per default bigint will be serialized as long, to be compatible with default mongo driver and mongo database.
    //We should add a new annotation, maybe like `bigint & Binary` to make it binary (unlimited size)
    sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'number' || typeof ${state.accessor} === 'bigint'`, `
        state.size += getValueSize(${state.accessor});
    `);
}

function serializeBoolean(type: OuterType, state: TemplateState) {
    serializePropertyNameAware(type, state, BSONType.BOOLEAN, `typeof ${state.accessor} === 'boolean'`, `
        state.writer.writeByte(${state.accessor} ? 1 : 0);
    `);
}

function serializeString(type: OuterType, state: TemplateState) {
    if (uuidAnnotation.getFirst(type)) {
        serializePropertyNameAware(type, state, BSONType.BINARY, `typeof ${state.accessor} === 'string' && ${state.accessor}.length === 36`, `state.writer.writeUUID(${state.accessor});`);
        return;
    }
    if (mongoIdAnnotation.getFirst(type)) {
        serializePropertyNameAware(type, state, BSONType.OID, `typeof ${state.accessor} === 'string' && ${state.accessor}.length === 24`, `state.writer.writeObjectId(${state.accessor});`);
        return;
    }
    const start = state.setVariable('start', 0);
    serializePropertyNameAware(type, state, BSONType.STRING, `typeof ${state.accessor} === 'string'`, `
        ${start} = state.writer.offset;
        state.writer.offset += 4; //size placeholder
        state.writer.writeString(${state.accessor});
        state.writer.writeByte(0); //null
        state.writer.writeDelayedSize(state.writer.offset - ${start} - 4, ${start});
    `);
}

function sizeString(type: OuterType, state: TemplateState) {
    if (uuidAnnotation.getFirst(type)) {
        sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'string' && ${state.accessor}.length === 36`, `
            state.size += 4 + 1 + 16;
        `);
        return;
    }
    if (mongoIdAnnotation.getFirst(type)) {
        sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'string' && ${state.accessor}.length === 24`, `
            state.size += 12;
        `);
        return;
    }
    state.setContext({ getValueSize });
    sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'string'`, `
        state.size += getValueSize(${state.accessor});
    `);
}

function serializeNumber(type: OuterType, state: TemplateState) {
    const nameWriter = propertyNameWriter(state);
    state.addCode(`
        if ('bigint' === typeof ${state.accessor}) {
            //long
            state.writer.writeByte(${BSONType.LONG});
            ${nameWriter}
            state.writer.writeBigIntLong(${state.accessor});
        } else if ('number' === typeof ${state.accessor}) {
            if (Math.floor(${state.accessor}) === ${state.accessor}) {
                //it's an int
                if (${state.accessor} >= ${BSON_INT32_MIN} && ${state.accessor} <= ${BSON_INT32_MAX}) {
                    //32bit
                    state.writer.writeByte(${BSONType.INT});
                    ${nameWriter}
                    state.writer.writeInt32(${state.accessor});
                } else if (${state.accessor} >= ${JS_INT_MIN} && ${state.accessor} <= ${JS_INT_MAX}) {
                    //double, 64bit
                    state.writer.writeByte(${BSONType.NUMBER});
                    ${nameWriter}
                    state.writer.writeDouble(${state.accessor});
                } else {
                    //long, but we serialize as Double, because deserialize will be BigInt
                    state.writer.writeByte(${BSONType.NUMBER});
                    ${nameWriter}
                    state.writer.writeDouble(${state.accessor});
                }
            } else {
                //double, 64bit
                state.writer.writeByte(${BSONType.NUMBER});
                ${nameWriter}
                state.writer.writeDouble(${state.accessor});
            }
        }
    `);
}

function sizerBigInt(type: TypeBigInt, state: TemplateState) {
    const binaryBigInt = binaryBigIntAnnotation.getFirst(type);

    if (binaryBigInt !== undefined) {
        state.setContext({ getBinaryBigIntSize, getSignedBinaryBigIntSize });
        const bigIntSize = binaryBigInt === BinaryBigIntType.unsigned ? 'getBinaryBigIntSize' : 'getSignedBinaryBigIntSize';
        //per default bigint will be serialized as long, to be compatible with default mongo driver and mongo database.
        //We should add a new annotation, maybe like `bigint & Binary` to make it binary (unlimited size)
        sizerPropertyNameAware(type, state, `typeof ${state.accessor} === 'number' || typeof ${state.accessor} === 'bigint'`, `
            state.size += ${bigIntSize}(${state.accessor});
        `);
    } else {
        sizerNumber(type, state);
    }
}

function serializeBigInt(type: TypeBigInt, state: TemplateState) {
    const binaryBigInt = binaryBigIntAnnotation.getFirst(type);

    if (binaryBigInt !== undefined) {
        const nameWriter = propertyNameWriter(state);
        const writeBigInt = binaryBigInt === BinaryBigIntType.unsigned ? 'writeBigIntBinary' : 'writeSignedBigIntBinary';
        state.addCode(`
        if ('bigint' === typeof ${state.accessor} || 'number' === typeof ${state.accessor}) {
            //long
            state.writer.writeByte(${BSONType.BINARY});
            ${nameWriter}
            state.writer.${writeBigInt}(${state.accessor});
        }`);
    } else {
        serializeNumber(type, state);
    }
}

function sizerRegExp(type: OuterType, state: TemplateState) {
    state.setContext({ stringByteLength });
    sizerPropertyNameAware(type, state, `${state.accessor} instanceof RegExp`, `
        state.size += stringByteLength(${state.accessor}.source) + 1
            +
            (${state.accessor}.global ? 1 : 0) +
            (${state.accessor}.ignoreCase ? 1 : 0) +
            (${state.accessor}.multiline ? 1 : 0) +
            1;
    `);
}

function serializeRegExp(type: OuterType, state: TemplateState) {
    serializePropertyNameAware(type, state, BSONType.REGEXP, `${state.accessor} instanceof RegExp`, `
        state.writer.writeString(${state.accessor}.source);
        state.writer.writeNull();
        if (${state.accessor}.ignoreCase) state.writer.writeString('i');
        if (${state.accessor}.global) state.writer.writeString('s'); //BSON does not use the RegExp flag format
        if (${state.accessor}.multiline) state.writer.writeString('m');
        state.writer.writeNull();
    `);
}

function sizerLiteral(type: TypeLiteral, state: TemplateState) {
    if ('string' === typeof type.literal) {
        sizeString(type, state);
    } else if ('number' === typeof type.literal || 'bigint' === typeof type.literal) {
        sizerNumber(type, state);
    } else if ('boolean' === typeof type.literal) {
        sizerBoolean(type, state);
    } else if (type.literal instanceof RegExp) {
        sizerRegExp(type, state);
    }
}

function serializeLiteral(type: TypeLiteral, state: TemplateState) {
    if ('string' === typeof type.literal) {
        serializeString(type, state);
    } else if ('number' === typeof type.literal || 'bigint' === typeof type.literal) {
        serializeNumber(type, state);
    } else if ('boolean' === typeof type.literal) {
        serializeBoolean(type, state);
    } else if (type.literal instanceof RegExp) {
        serializeRegExp(type, state);
    }
}

function sizerBinary(type: TypeClass, state: TemplateState) {
    state.setContext({ ArrayBuffer });
    sizerPropertyNameAware(type, state, `${state.accessor} instanceof ArrayBuffer || ArrayBuffer.isView(${state.accessor})`, `
        state.size += 4  + 1 + ${state.accessor}.byteLength;
    `);
}

function serializeBinary(type: TypeClass, state: TemplateState) {
    state.setContext({ ArrayBuffer });
    serializePropertyNameAware(type, state, BSONType.BINARY, `${state.accessor} instanceof ArrayBuffer || ArrayBuffer.isView(${state.accessor})`, `
        state.writer.writeArrayBuffer(${state.accessor});
    `);
}

function sizerArray(elementType: OuterType, state: TemplateState) {
    state.setContext({ isIterable });

    const i = state.compilerContext.reserveName('i');
    const item = state.compilerContext.reserveName('item');
    sizerPropertyNameAware(elementType, state, `isIterable(${state.accessor})`, `
        state.size += 4; //array size

        let ${i} = 0;
        for (const ${item} of ${state.accessor}) {
            ${executeTemplates(state.fork('', item).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), elementType)}
            ${i}++;
        }

        state.size += 1; //null
    `);
}

function serializeArray(elementType: OuterType, state: TemplateState) {
    state.setContext({ isIterable });

    const start = state.setVariable('start', 0);
    const i = state.compilerContext.reserveName('i');
    const item = state.compilerContext.reserveName('item');
    serializePropertyNameAware(elementType, state, BSONType.ARRAY, `isIterable(${state.accessor})`, `
        ${start} = state.writer.offset;
        state.writer.offset += 4; //size

        let ${i} = 0;
        for (const ${item} of ${state.accessor}) {
            ${executeTemplates(state.fork('', item).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), elementType)}
            ${i}++;
        }

        state.writer.writeNull();
        state.writer.writeDelayedSize(state.writer.offset - ${start}, ${start});
    `);
}

function serializeTuple(type: TypeTuple, state: TemplateState) {
    //[string, number], easy
    //[...string, number], easy
    //[number, ...string], easy
    //[number, ...string, number, string], medium
    const lines: string[] = [];
    let restEndOffset = 0;
    const i = state.compilerContext.reserveName('i');

    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            restEndOffset = type.types.length - (i + 1);
            break;
        }
    }

    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            lines.push(`
            for (; ${i} < ${state.accessor}.length - ${restEndOffset}; ${i}++) {
                ${executeTemplates(state.fork('', `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), member.type.type)}
            }
            `);
        } else {
            lines.push(`
            ${executeTemplates(state.fork('', `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), member.type)}
            ${i}++;
            `);
        }
    }

    const start = state.setVariable('start', 0);
    state.setContext({ isArray });
    serializePropertyNameAware(type, state, BSONType.ARRAY, `isArray(${state.accessor})`, `
        let ${i} = 0;
        ${start} = state.writer.offset;
        state.writer.offset += 4; //size

        ${lines.join('\n')}

        state.writer.writeNull();
        state.writer.writeDelayedSize(state.writer.offset - ${start}, ${start});
    `);
}

function sizerTuple(type: TypeTuple, state: TemplateState) {
    //[string, number], easy
    //[...string, number], easy
    //[number, ...string], easy
    //[number, ...string, number, string], medium
    const lines: string[] = [];
    let restEndOffset = 0;
    const i = state.compilerContext.reserveName('i');

    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            restEndOffset = type.types.length - (i + 1);
            break;
        }
    }

    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            lines.push(`
            for (; ${i} < ${state.accessor}.length - ${restEndOffset}; ${i}++) {
                ${executeTemplates(state.fork('', `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), member.type.type)}
            }
            `);
        } else {
            lines.push(`
            ${executeTemplates(state.fork('', `${state.accessor}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new DigitByteRuntimeCode(i)), member.type)}
            ${i}++;
            `);
        }
    }

    state.setContext({ isArray });
    sizerPropertyNameAware(type, state, `isArray(${state.accessor})`, `
        let ${i} = 0;
        state.size += 4; //array size

        ${lines.join('\n')}

        state.size += 1; //null
    `);
}

class MongoSerializer extends Serializer {
    public sizerRegistry = new TemplateRegistry(this);
    public bsonSerializeRegistry = new TemplateRegistry(this);
    public bsonDeserializeRegistry = new TemplateRegistry(this);
    public bsonTypeGuards = new TypeGuardRegistry(this);

    constructor() {
        super();
        this.registerSizer();
        this.registerBsonSerializers();
        this.registerBsonDeserializers();
        this.registerBsonTypeGuards();
    }

    protected registerSizer() {
        this.sizerRegistry.register(ReflectionKind.any, sizerAny);
        this.sizerRegistry.register(ReflectionKind.class, sizerObjectLiteral);
        this.sizerRegistry.register(ReflectionKind.objectLiteral, sizerObjectLiteral);
        this.sizerRegistry.register(ReflectionKind.string, sizeString);
        this.sizerRegistry.register(ReflectionKind.templateLiteral, sizeString);
        this.sizerRegistry.register(ReflectionKind.boolean, sizerBoolean);
        this.sizerRegistry.register(ReflectionKind.promise, ((type, state) => executeTemplates(state, type.type)));
        this.sizerRegistry.register(ReflectionKind.number, sizerNumber);
        this.sizerRegistry.register(ReflectionKind.bigint, sizerBigInt);
        this.sizerRegistry.register(ReflectionKind.literal, sizerLiteral);
        this.sizerRegistry.register(ReflectionKind.regexp, sizerRegExp);
        this.sizerRegistry.register(ReflectionKind.array, (type, state) => sizerArray(type.type as OuterType, state));
        this.sizerRegistry.register(ReflectionKind.tuple, sizerTuple);
        this.sizerRegistry.registerClass(Map, (type, state) => sizerArray({
            kind: ReflectionKind.tuple, types: [
                { kind: ReflectionKind.tupleMember, type: type.arguments![0] },
                { kind: ReflectionKind.tupleMember, type: type.arguments![1] },
            ]
        }, state));
        this.sizerRegistry.registerClass(Set, (type, state) => sizerArray(type.arguments![0] as OuterType, state));
        this.sizerRegistry.registerClass(Date, (type, state) => sizerPropertyNameAware(type, state, `${state.accessor} instanceof Date`, `state.size += 8;`));
        this.sizerRegistry.register(ReflectionKind.undefined, (type, state) => sizerPropertyNameAware(type, state, `${state.accessor} === undefined`, ``));
        this.sizerRegistry.register(ReflectionKind.null, (type, state) => sizerPropertyNameAware(type, state, `${state.accessor} === null`, ``));
        this.sizerRegistry.registerBinary(sizerBinary);
        this.sizerRegistry.register(ReflectionKind.union, serializeTypeUnion);
    }

    protected registerBsonTypeGuards() {
        const numberTypes = [BSONType.NUMBER, BSONType.INT, BSONType.LONG];
        //first all exact matches
        this.bsonTypeGuards.register(1, ReflectionKind.objectLiteral, bsonTypeGuardObjectLiteral);
        this.bsonTypeGuards.register(1, ReflectionKind.class, bsonTypeGuardObjectLiteral);
        this.bsonTypeGuards.register(1, ReflectionKind.string, bsonTypeGuardForBsonTypes([BSONType.STRING]));
        this.bsonTypeGuards.register(1, ReflectionKind.number, bsonTypeGuardForBsonTypes(numberTypes));
        this.bsonTypeGuards.register(1, ReflectionKind.boolean, bsonTypeGuardForBsonTypes([BSONType.BOOLEAN]));
        this.bsonTypeGuards.register(1, ReflectionKind.undefined, bsonTypeGuardForBsonTypes([BSONType.UNDEFINED]));
        this.bsonTypeGuards.register(1, ReflectionKind.bigint, bsonTypeGuardForBsonTypes([...numberTypes, BSONType.BINARY]));
        this.bsonTypeGuards.register(1, ReflectionKind.null, bsonTypeGuardForBsonTypes([BSONType.NULL]));
        this.bsonTypeGuards.register(1, ReflectionKind.literal, bsonTypeGuardLiteral);
        this.bsonTypeGuards.register(1, ReflectionKind.templateLiteral, bsonTypeGuardTemplateLiteral);
        this.bsonTypeGuards.register(1, ReflectionKind.regexp, bsonTypeGuardForBsonTypes([BSONType.REGEXP]));

        this.bsonTypeGuards.register(1, ReflectionKind.union, (type, state) => bsonTypeGuardUnion(this.bsonTypeGuards, type, state));
        this.bsonTypeGuards.register(1, ReflectionKind.array, (type, state) => bsonTypeGuardArray(type.type as OuterType, state));
        this.bsonTypeGuards.register(1, ReflectionKind.tuple, bsonTypeGuardTuple);

        this.bsonTypeGuards.registerClass(1, Date, bsonTypeGuardForBsonTypes([...numberTypes, BSONType.DATE, BSONType.TIMESTAMP]));
        this.bsonTypeGuards.registerBinary(1, bsonTypeGuardForBsonTypes([BSONType.BINARY]));
        this.bsonTypeGuards.registerClass(1, Map, (type, state) => bsonTypeGuardArray({
            kind: ReflectionKind.tuple, types: [
                { kind: ReflectionKind.tupleMember, type: type.arguments![0] },
                { kind: ReflectionKind.tupleMember, type: type.arguments![1] },
            ]
        }, state));
        this.bsonTypeGuards.registerClass(1, Set, (type, state) => bsonTypeGuardArray(type.arguments![0] as OuterType, state));

        //many deserializes support other types as well as fallback, we register them under specificality > 1
        this.bsonTypeGuards.register(2, ReflectionKind.string, bsonTypeGuardForBsonTypes([BSONType.TIMESTAMP, BSONType.STRING, BSONType.NULL, BSONType.UNDEFINED, BSONType.BOOLEAN]));
        this.bsonTypeGuards.register(2, ReflectionKind.number, bsonTypeGuardForBsonTypes([BSONType.TIMESTAMP, BSONType.STRING, BSONType.NULL, BSONType.UNDEFINED, BSONType.BOOLEAN, BSONType.BINARY]));
        this.bsonTypeGuards.register(2, ReflectionKind.bigint, bsonTypeGuardForBsonTypes([BSONType.TIMESTAMP, BSONType.STRING, BSONType.NULL, BSONType.UNDEFINED, BSONType.BOOLEAN]));
        this.bsonTypeGuards.register(2, ReflectionKind.boolean, bsonTypeGuardForBsonTypes([BSONType.TIMESTAMP, BSONType.STRING, BSONType.NULL, BSONType.UNDEFINED]));
        this.bsonTypeGuards.register(2, ReflectionKind.literal, bsonTypeGuardForBsonTypes([BSONType.NULL, BSONType.UNDEFINED]));
        this.bsonTypeGuards.registerClass(2, Date, bsonTypeGuardForBsonTypes([...numberTypes]));


        this.bsonTypeGuards.getRegistry(1).addDecorator(ReflectionKind.class, (type, state) => {
            if (!referenceAnnotation.getFirst(type)) return;
            state.setContext({ isObject, createReference, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            const referenceClassTypeVar = state.setVariable('referenceClassType', type.classType);
            // in deserialization a reference is created when only the primary key is provided (no object given)
            state.template = `
                if (state.elementType === ${BSONType.OBJECT}) {
                    ${state.template}
                } else {
                    ${executeTemplates(state.fork().extendPath(String(reflection.getPrimary().getName())).forPropertyName(state.propertyName), reflection.getPrimary().getType())}
                }
            `;
        });
    }

    protected registerBsonDeserializers() {
        this.bsonDeserializeRegistry.register(ReflectionKind.class, deserializeObjectLiteral);
        this.bsonDeserializeRegistry.register(ReflectionKind.objectLiteral, deserializeObjectLiteral);
        this.bsonDeserializeRegistry.register(ReflectionKind.number, deserializeNumber);
        this.bsonDeserializeRegistry.register(ReflectionKind.bigint, deserializeBigInt);
        this.bsonDeserializeRegistry.register(ReflectionKind.string, deserializeString);
        this.bsonDeserializeRegistry.register(ReflectionKind.templateLiteral, deserializeTemplateLiteral);
        this.bsonDeserializeRegistry.register(ReflectionKind.boolean, deserializeBoolean);
        this.bsonDeserializeRegistry.register(ReflectionKind.undefined, deserializeUndefined);
        this.bsonDeserializeRegistry.register(ReflectionKind.null, deserializeNull);
        this.bsonDeserializeRegistry.register(ReflectionKind.literal, deserializeLiteral);
        this.bsonDeserializeRegistry.register(ReflectionKind.regexp, deserializeRegExp);
        this.bsonDeserializeRegistry.register(ReflectionKind.tuple, deserializeTuple);
        this.bsonDeserializeRegistry.register(ReflectionKind.union, (type, state) => deserializeUnion(this.bsonTypeGuards, type, state));
        this.bsonDeserializeRegistry.register(ReflectionKind.array, (type, state) => deserializeArray(type.type as OuterType, state));
        this.bsonDeserializeRegistry.registerClass(Date, deserializeDate);
        this.bsonDeserializeRegistry.registerBinary(deserializeBinary);
        this.bsonDeserializeRegistry.registerClass(Map, (type, state) => {
            deserializeArray({
                kind: ReflectionKind.tuple, types: [
                    { kind: ReflectionKind.tupleMember, type: type.arguments![0] },
                    { kind: ReflectionKind.tupleMember, type: type.arguments![1] },
                ]
            }, state);

            state.addSetter(`new Map(${state.setter})`);
        });
        this.bsonDeserializeRegistry.registerClass(Set, (type, state) => {
            deserializeArray(type.arguments![0] as OuterType, state);
            state.addSetter(`new Set(${state.setter})`);
        });

        this.bsonDeserializeRegistry.addDecorator(ReflectionKind.class, (type, state) => {
            if (!referenceAnnotation.getFirst(type)) return;
            state.setContext({ isObject, createReference, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            const referenceClassTypeVar = state.setVariable('referenceClassType', type.classType);
            // in deserialization a reference is created when only the primary key is provided (no object given)
            state.template = `
                if (state.elementType === ${BSONType.OBJECT}) {
                    ${state.template}
                } else {
                    let pk;
                    ${executeTemplates(state.fork('pk').extendPath(String(reflection.getPrimary().getName())).forPropertyName(state.propertyName), reflection.getPrimary().getType())}
                    ${state.setter} = createReference(${referenceClassTypeVar}, {${JSON.stringify(reflection.getPrimary().getName())}: pk});
                }
            `;
        });
    }

    protected registerBsonSerializers() {
        this.bsonSerializeRegistry.register(ReflectionKind.any, serializeAny);
        this.bsonSerializeRegistry.register(ReflectionKind.class, serializeObjectLiteral);
        this.bsonSerializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);
        this.bsonSerializeRegistry.register(ReflectionKind.string, serializeString);
        this.bsonSerializeRegistry.register(ReflectionKind.templateLiteral, serializeString);
        this.bsonSerializeRegistry.register(ReflectionKind.boolean, serializeBoolean);
        this.bsonSerializeRegistry.register(ReflectionKind.promise, ((type, state) => executeTemplates(state, type.type)));
        this.bsonSerializeRegistry.register(ReflectionKind.number, serializeNumber);
        this.bsonSerializeRegistry.register(ReflectionKind.bigint, serializeBigInt);
        this.bsonSerializeRegistry.register(ReflectionKind.literal, serializeLiteral);
        this.bsonSerializeRegistry.register(ReflectionKind.regexp, serializeRegExp);
        this.bsonSerializeRegistry.register(ReflectionKind.array, (type, state) => serializeArray(type.type as OuterType, state));
        this.bsonSerializeRegistry.register(ReflectionKind.tuple, serializeTuple);
        this.bsonSerializeRegistry.registerClass(Map, (type, state) => serializeArray({
            kind: ReflectionKind.tuple, types: [
                { kind: ReflectionKind.tupleMember, type: type.arguments![0] },
                { kind: ReflectionKind.tupleMember, type: type.arguments![1] },
            ]
        }, state));
        this.bsonSerializeRegistry.registerClass(Set, (type, state) => serializeArray(type.arguments![0] as OuterType, state));
        this.bsonSerializeRegistry.registerClass(Date, (type, state) => {
            serializePropertyNameAware(type, state, BSONType.DATE, `${state.accessor} instanceof Date`, `state.writer.writeLong(${state.accessor}.valueOf());`);
        });
        this.bsonSerializeRegistry.register(ReflectionKind.undefined, (type, state) => serializePropertyNameAware(type, state, BSONType.NULL, `${state.accessor} === undefined`, ``));
        this.bsonSerializeRegistry.register(ReflectionKind.null, (type, state) => serializePropertyNameAware(type, state, BSONType.NULL, `${state.accessor} === undefined`, ``));
        this.bsonSerializeRegistry.registerBinary(serializeBinary);
        this.bsonSerializeRegistry.register(ReflectionKind.union, serializeTypeUnion);
    }
}

export const mongoSerializer = new MongoSerializer();

function createBSONSerializer(type: OuterType, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack: JitStack = new JitStack()): BSONSerializer {
    const compiler = new CompilerContext();
    compiler.context.set('typeSettings', typeSettings);
    compiler.context.set('Writer', Writer);
    compiler.context.set('seekElementSize', seekElementSize);
    compiler.context.set('createBuffer', createBuffer);
    compiler.context.set('sizer', getBSONSizer(type));
    compiler.context.set('UnpopulatedCheck', UnpopulatedCheck);

    const state = new TemplateState('', 'data', compiler, registry, namingStrategy, jitStack, [path]).disableSetter();

    const code = `
        state = state || {};
        const size = sizer(data);
        state.writer = state.writer || new Writer(createBuffer(size));

        const unpopulatedCheck = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheck.ReturnSymbol;

        ${executeTemplates(state, type)}

        typeSettings.unpopulatedCheck = unpopulatedCheck;

        return state.writer.buffer;
    `;

    return compiler.build(code, 'data', 'state');
}

export function createBSONSizer(type: OuterType, registry: TemplateRegistry, jitStack: JitStack = new JitStack()): (data: object) => number {
    const compiler = new CompilerContext();
    compiler.context.set('typeSettings', typeSettings);
    compiler.context.set('unpopulatedSymbol', unpopulatedSymbol);
    compiler.context.set('UnpopulatedCheck', UnpopulatedCheck);
    compiler.context.set('seekElementSize', seekElementSize);

    const state = new TemplateState('', 'data', compiler, registry, new NamingStrategy(), jitStack, []).disableSetter();

    const code = `
        state = state || {};
        state.size = 0;

        const unpopulatedCheck = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheck.ReturnSymbol;

        ${executeTemplates(state, type)}

        typeSettings.unpopulatedCheck = unpopulatedCheck;

        return state.size;
    `;

    return compiler.build(code, 'data', 'state');
}

export function serialize(data: any): Uint8Array {
    const size = getValueSize(data);
    const writer = new Writer(createBuffer(size));
    writer.write(data);
    return writer.buffer;
}

export type BSONSerializer = (data: any, state?: { writer?: Writer }) => Uint8Array;
export type BSONSizer = (data: any) => number;

/**
 * Serializes a schema instance to BSON.
 *
 * Note: The instances needs to be in the mongo format already since it does not resolve decorated properties.
 *       So call it with the result of classToMongo(Schema, item).
 */
export function getBSONSerializer<T>(receiveType?: ReceiveType<T>): BSONSerializer {
    const type = resolveReceiveType(receiveType);

    const jit = getTypeJitContainer(type);
    if (jit.bsonSerializer) return jit.bsonSerializer;

    jit.bsonSerializer = createBSONSerializer(type, mongoSerializer.bsonSerializeRegistry);
    toFastProperties(jit);
    return jit.bsonSerializer;
}

export function getBSONSizer<T>(receiveType?: ReceiveType<T>): BSONSizer {
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (jit.bsonSizer) return jit.bsonSizer;

    jit.bsonSizer = createBSONSizer(type, mongoSerializer.sizerRegistry);
    toFastProperties(jit);
    return jit.bsonSizer;
}

export function serializeBSON<T>(data: T, receiveType?: ReceiveType<T>): Uint8Array {
    return getBSONSerializer(receiveType)(data);
}
