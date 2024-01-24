/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ReflectionKind, SerializationError, Type, nodeBufferToArrayBuffer } from '@deepkit/type';

import { hexTable } from './model.js';
import { buildStringDecoder, decodeUTF8 } from './strings.js';
import {
    BSONType,
    BSON_BINARY_SUBTYPE_BYTE_ARRAY,
    BSON_BINARY_SUBTYPE_UUID,
    TWO_PWR_32_DBL_N,
    digitByteSize,
} from './utils.js';

declare var Buffer: any;

/**
 * This creates a JS string from a utf8 byte buffer. This is the fastest way possible to create
 * small strings (< 14chars). Everything else should be cached or created by Buffer.toString('utf8').
 */
export function decodeUTF8Parser(parser: BaseParser, size: number = parser.size - parser.offset) {
    const end = parser.offset + size;
    let s = decodeUTF8(parser.buffer, parser.offset, end - 1);
    parser.offset = end;
    return s;
}

/**
 * This is the (slowest) base parser which parses all property names as utf8.
 */
export class BaseParser {
    public size: number;
    public dataView: DataView;

    constructor(
        public buffer: Uint8Array,
        public offset: number = 0,
    ) {
        this.size = buffer.byteLength;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    peek(elementType: number, type?: Type) {
        const offset = this.offset;
        const v = this.parse(elementType, type);
        this.offset = offset;
        return v;
    }

    parse(elementType: number, type?: Type) {
        switch (elementType) {
            case BSONType.STRING:
                return this.parseString();
            case BSONType.NUMBER:
                return this.parseNumber();
            case BSONType.OID:
                return this.parseOid();
            case BSONType.INT:
                return this.parseInt();
            case BSONType.DATE:
                return this.parseDate();
            case BSONType.LONG:
            case BSONType.TIMESTAMP:
                return this.parseLong();
            case BSONType.BOOLEAN:
                return this.parseBoolean();
            case BSONType.NULL:
                return null;
            case BSONType.UNDEFINED:
                return undefined;
            case BSONType.BINARY:
                return this.parseBinary(type);
            case BSONType.REGEXP:
                return this.parseRegExp();
            case BSONType.OBJECT:
                return parseObject(this);
            case BSONType.ARRAY:
                return parseArray(this);
            default:
                throw new SerializationError('Unsupported BSON type ' + elementType, '');
        }
    }

    parseRegExp(): RegExp {
        const source = this.eatString(this.stringSize());
        const options = this.eatString(this.stringSize());
        return new RegExp(source, options.replace('s', 'g'));
    }

    /**
     * read the content without moving the parser offset.
     */
    read(elementType: number, type?: Type) {
        const start = this.offset;
        try {
            return this.parse(elementType, type);
        } finally {
            this.offset = start;
        }
    }

    parseBoolean() {
        return this.eatByte() === 1;
    }

    parseLong() {
        const lowBits = this.eatInt32();
        const highBits = this.eatInt32();

        return BigInt(highBits) * BigInt(TWO_PWR_32_DBL_N) + BigInt(lowBits >>> 0);
    }

    parseString() {
        return this.eatString(this.eatUInt32());
    }

    parseBinaryBigInt(): BigInt {
        let size = this.eatUInt32();
        const subType = this.eatByte();
        if (subType === BSON_BINARY_SUBTYPE_BYTE_ARRAY) {
            size = this.eatUInt32();
        }

        const nextPosition = this.offset + size;
        const v = this.readBigIntBinary(size);
        this.offset = nextPosition;
        return v;
    }

    parseSignedBinaryBigInt(): BigInt {
        let size = this.eatUInt32();
        const subType = this.eatByte();
        if (subType === BSON_BINARY_SUBTYPE_BYTE_ARRAY) {
            size = this.eatUInt32();
        }

        const nextPosition = this.offset + size;
        const v = this.readSignedBigIntBinary(size);
        this.offset = nextPosition;
        return v;
    }

    parseBinary(type?: Type): any {
        let size = this.eatUInt32();
        const subType = this.eatByte();

        if (subType === BSON_BINARY_SUBTYPE_UUID) {
            const nextPosition = this.offset + size;
            const v = this.parseUUID();
            this.offset = nextPosition;
            return v;
        }

        if (subType === BSON_BINARY_SUBTYPE_BYTE_ARRAY) {
            size = this.eatUInt32();
        }

        const b = this.buffer.slice(this.offset, this.offset + size);
        this.seek(size);
        if (type && type.kind === ReflectionKind.class && type.classType === ArrayBuffer) {
            return nodeBufferToArrayBuffer(b);
        }
        if (type && type.kind === ReflectionKind.class) {
            const typedArrayConstructor = type.classType;
            return new typedArrayConstructor(nodeBufferToArrayBuffer(b));
        }

        return b;
    }

    readBigIntBinary(size: number): bigint {
        if (size === 0) return BigInt(0);

        //todo: check if that is faster than the string concatenation
        // let r = BigInt(0);
        // const n8 = BigInt(8);
        // for (let i = 0; i < size; i++) {
        //     if (i !== 0) r = r << n8;
        //     r += BigInt(this.buffer[this.offset + i]);
        // }
        // return r;

        let s = '';
        for (let i = 0; i < size; i++) {
            s += hexTable[this.buffer[this.offset + i]];
        }
        return BigInt('0x' + s);
    }

    readSignedBigIntBinary(size: number): bigint {
        if (size === 0) return BigInt(0);

        let s = '';
        const signum = this.buffer[this.offset];

        for (let i = 1; i < size; i++) {
            s += hexTable[this.buffer[this.offset + i]];
        }

        //255 means negative
        if (signum === 255) return BigInt('0x' + s) * BigInt(-1);
        return BigInt('0x' + s);
    }

    parseNumber() {
        return this.eatDouble();
    }

    parseOid(): string {
        const offset = this.offset,
            b = this.buffer;
        let o =
            hexTable[b[offset]] +
            hexTable[b[offset + 1]] +
            hexTable[b[offset + 2]] +
            hexTable[b[offset + 3]] +
            hexTable[b[offset + 4]] +
            hexTable[b[offset + 5]] +
            hexTable[b[offset + 6]] +
            hexTable[b[offset + 7]] +
            hexTable[b[offset + 8]] +
            hexTable[b[offset + 9]] +
            hexTable[b[offset + 10]] +
            hexTable[b[offset + 11]];
        this.seek(12);
        return o;
    }

    parseUUID(): string {
        //e.g. bef8de96-41fe-442f-b70c-c3a150f8c96c
        //         4      2    2    2       6
        const offset = this.offset,
            b = this.buffer;
        let o =
            hexTable[b[offset]] +
            hexTable[b[offset + 1]] +
            hexTable[b[offset + 2]] +
            hexTable[b[offset + 3]] +
            '-' +
            hexTable[b[offset + 4]] +
            hexTable[b[offset + 5]] +
            '-' +
            hexTable[b[offset + 6]] +
            hexTable[b[offset + 7]] +
            '-' +
            hexTable[b[offset + 8]] +
            hexTable[b[offset + 9]] +
            '-' +
            hexTable[b[offset + 10]] +
            hexTable[b[offset + 11]] +
            hexTable[b[offset + 12]] +
            hexTable[b[offset + 13]] +
            hexTable[b[offset + 14]] +
            hexTable[b[offset + 15]];
        this.seek(16);
        return o;
    }

    parseInt() {
        return this.eatInt32();
    }

    parseDate() {
        const lowBits = this.eatInt32();
        const highBits = this.eatInt32();
        return new Date(highBits * TWO_PWR_32_DBL_N + (lowBits >>> 0));
    }

    peekUInt32(): number {
        return this.dataView.getUint32(this.offset, true);
    }

    /**
     * Returns the size including \0.
     */
    stringSize(): number {
        let end = this.offset;
        while (this.buffer[end] !== 0) end++;
        end++; //null
        return end - this.offset;
    }

    eatObjectPropertyName() {
        let end = this.offset;
        while (this.buffer[end] !== 0) end++;
        const s = decodeUTF8(this.buffer, this.offset, end);
        this.offset = end + 1;
        return s;
    }

    seek(size: number) {
        this.offset += size;
    }

    eatByte(): number {
        return this.buffer[this.offset++];
    }

    eatInt32(): number {
        this.offset += 4;
        return this.dataView.getInt32(this.offset - 4, true);
    }

    eatUInt32(): number {
        this.offset += 4;
        return this.dataView.getUint32(this.offset - 4, true);
    }

    eatDouble(): number {
        this.offset += 8;
        return this.dataView.getFloat64(this.offset - 8, true);
    }

    /**
     * Size includes the \0. If not existend, increase by 1.
     */
    eatString(size: number): string {
        this.offset += size;
        return decodeUTF8(this.buffer, this.offset - size, this.offset - 1);
    }
}

const stringParser = buildStringDecoder(32);

/**
 * This is a general purpose Parser assuming ascii names as property names.
 * It falls back automatically to UTF8 when a UTF8 byte was found.
 * This is way faster than BaseParser when property names are mainly ascii (which is usually the case).
 */
export class ParserV2 extends BaseParser {
    eatObjectPropertyName() {
        let end = this.offset;
        let simple = true;
        let string = '';
        while (this.buffer[end] !== 0) {
            if (this.buffer[end] > 127) {
                simple = false;
            }
            if (simple) {
                string += String.fromCharCode(this.buffer[end]);
            }
            end++;
        }

        if (simple) {
            //do simple ascii
            this.offset = end + 1;
            return string;
        }

        const s = stringParser(this.buffer, this.offset, end);
        this.offset = end + 1;

        return s;
    }

    eatString(size: number): string {
        // const s = stringParser(this.buffer, this.offset, this.offset + size);
        let s = '';
        if (size > 64 && 'undefined' !== typeof Buffer && 'function' === typeof Buffer.from) {
            s = Buffer.from(this.buffer.buffer, this.buffer.byteOffset + this.offset, size - 1).toString('utf8');
        } else {
            s = stringParser(this.buffer, this.offset, this.offset + size);
        }
        this.offset += size;
        return s;
    }
}

const decoder = new TextDecoder('utf8');

export class ParserV3 extends BaseParser {
    eatObjectPropertyName() {
        let end = this.offset;
        let simple = true;
        while (this.buffer[end] !== 0) {
            if (this.buffer[end] > 127) simple = false;
            end++;
        }

        if (simple) {
            //do simple ascii
            const s = String.fromCharCode.apply(String, this.buffer.slice(this.offset, end) as any);
            this.offset = end + 1;
            return s;
        }

        const s = decoder.decode(this.buffer.slice(this.offset, end));
        this.offset = end + 1;

        return s;
    }

    eatString(size: number): string {
        const end = this.offset + size;
        let s = decoder.decode(this.buffer.slice(this.offset, end - 1));
        this.offset = end;
        return s;
    }
}

export function parseObject(parser: BaseParser): any {
    const result: any = {};
    const end = parser.eatUInt32() + parser.offset;

    while (parser.offset < end) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        const name = parser.eatObjectPropertyName();
        result[name] = parser.parse(elementType);
    }

    return result;
}

export function parseArray(parser: BaseParser): any[] {
    const result: any[] = [];
    const end = parser.eatUInt32() + parser.offset;

    for (let i = 0; parser.offset < end; i++) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        //arrays are represented as objects, so we skip the key name, since we have `i`
        parser.seek(digitByteSize(i));

        result.push(parser.parse(elementType));
    }

    return result;
}

export function deserializeBSONWithoutOptimiser(buffer: Uint8Array, offset = 0) {
    return parseObject(new ParserV2(buffer, offset));
}
