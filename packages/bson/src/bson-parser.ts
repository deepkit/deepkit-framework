/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import bson from 'bson';
import {
    BSON_BINARY_SUBTYPE_BYTE_ARRAY,
    BSON_BINARY_SUBTYPE_UUID,
    BSONType,
    digitByteSize,
    TWO_PWR_32_DBL_N
} from './utils';
import {decodeUTF8, decodeUTF8Parser} from './strings';
import {nodeBufferToArrayBuffer, PropertySchema, typedArrayNamesMap} from '@deepkit/type';
import {seekElementSize} from './continuation';

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

/**
 * This is the (slowest) base parser which parses all property names as utf8.
 */
export class BaseParser {
    public size: number;
    public dataView: DataView;

    constructor(public buffer: Uint8Array, public offset: number = 0) {
        this.size = buffer.byteLength;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    peek(elementType: number, property?: PropertySchema) {
        const offset = this.offset;
        const v = this.parse(elementType, property);
        this.offset = offset;
        return v;
    }

    parse(elementType: number, property?: PropertySchema) {
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
                return this.parseBinary(property);
            case BSONType.OBJECT:
                return parseObject(this);
            case BSONType.ARRAY:
                return parseArray(this);
            default:
                throw new Error('Unsupported BSON type ' + elementType);
        }
    }

    parseBoolean() {
        return this.eatByte() === 1;
    }

    parseLong() {
        const lowBits = this.eatUInt32();
        const highBits = this.eatUInt32();

        return BigInt(highBits) * BigInt(TWO_PWR_32_DBL_N) + (BigInt(lowBits >>> 0));
    }

    parseString() {
        return this.eatString(this.eatUInt32());
    }

    parseBinary(property?: PropertySchema): any {
        let size = this.eatUInt32();
        const subType = this.eatByte();

        if (subType === BSON_BINARY_SUBTYPE_UUID) {
            const nextPosition = this.offset + size;
            const string = this.parseUUID();
            this.offset = nextPosition;
            return string;
        }

        if (subType === BSON_BINARY_SUBTYPE_BYTE_ARRAY) {
            size = this.eatUInt32();
        }

        const b = this.buffer.slice(this.offset, this.offset + size);
        this.seek(size);
        if (property && property.type === 'arrayBuffer') {
            return nodeBufferToArrayBuffer(b);
        }
        if (property && property.isTypedArray) {
            const type = typedArrayNamesMap.get(property.type);
            return new type(nodeBufferToArrayBuffer(b));
        }

        return b;
    }

    parseNumber() {
        return this.eatDouble();
    }

    parseOid() {
        const offset = this.offset, b = this.buffer;
        let o = hexTable[b[offset]]
            + hexTable[b[offset + 1]]
            + hexTable[b[offset + 2]]
            + hexTable[b[offset + 3]]
            + hexTable[b[offset + 4]]
            + hexTable[b[offset + 5]]
            + hexTable[b[offset + 6]]
            + hexTable[b[offset + 7]]
            + hexTable[b[offset + 8]]
            + hexTable[b[offset + 9]]
            + hexTable[b[offset + 10]]
            + hexTable[b[offset + 11]]
        ;

        this.seek(12);
        return o;
    }

    parseUUID() {
        //e.g. bef8de96-41fe-442f-b70c-c3a150f8c96c
        //         4      2    2    2       6
        const offset = this.offset, b = this.buffer;
        let o = hexTable[b[offset]]
            + hexTable[b[offset + 1]]
            + hexTable[b[offset + 2]]
            + hexTable[b[offset + 3]]
            + '-'
            + hexTable[b[offset + 4]]
            + hexTable[b[offset + 5]]
            + '-'
            + hexTable[b[offset + 6]]
            + hexTable[b[offset + 7]]
            + '-'
            + hexTable[b[offset + 8]]
            + hexTable[b[offset + 9]]
            + '-'
            + hexTable[b[offset + 10]]
            + hexTable[b[offset + 11]]
            + hexTable[b[offset + 12]]
            + hexTable[b[offset + 13]]
            + hexTable[b[offset + 14]]
            + hexTable[b[offset + 15]]
        ;

        this.seek(16);
        return o;
    }

    parseInt() {
        return this.eatInt32();
    }

    parseDate() {
        const lowBits = this.eatUInt32();
        const highBits = this.eatUInt32();
        return new Date(new bson.Long(lowBits, highBits).toNumber());
    }

    peekUInt32(): number {
        return this.dataView.getUint32(this.offset, true);
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

    eatString(size: number): string {
        this.offset += size;
        return decodeUTF8(this.buffer, this.offset - size, this.offset - 1);
    }
}

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

        const s = decodeUTF8(this.buffer, this.offset, end);
        this.offset = end + 1;

        return s;
    }

    eatString(size: number): string {
        return decodeUTF8Parser(this, size);
    }
}

export function findValueInObject(parser: BaseParser, checker: (elementType: BSONType, name: string) => boolean): any {
    const offset = parser.offset;
    parser.seek(4);

    while (true) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        const name = parser.eatObjectPropertyName();
        if (checker(elementType, name)) {
            const v = parser.parse(elementType);
            parser.offset = offset;
            return v;
        } else {
            seekElementSize(elementType, parser);
        }
    }
    
    parser.offset = offset;
    return undefined;
}

export function parseObject(parser: BaseParser): any {
    const result: any = {};
    parser.seek(4);

    while (true) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        const name = parser.eatObjectPropertyName();
        result[name] = parser.parse(elementType);
    }

    return result;
}

export function parseArray(parser: BaseParser): any[] {
    const result: any[] = [];
    parser.seek(4);

    for (let i = 0; ; i++) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        //arrays are represented as objects, so we skip the key name, since we have `i`
        parser.seek(digitByteSize(i));

        result.push(parser.parse(elementType));
    }

    return result;
}

export function deserialize(buffer: Uint8Array, offset = 0) {
    return parseObject(new ParserV2(buffer, offset));
}

