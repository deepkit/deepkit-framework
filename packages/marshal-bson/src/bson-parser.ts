import {Binary, Long} from 'bson';
import * as Moment from 'moment';
import {
    BSON_DATA_ARRAY,
    BSON_DATA_BINARY,
    BSON_DATA_BOOLEAN,
    BSON_DATA_DATE,
    BSON_DATA_INT,
    BSON_DATA_LONG,
    BSON_DATA_NULL,
    BSON_DATA_NUMBER,
    BSON_DATA_OBJECT,
    BSON_DATA_OID,
    BSON_DATA_STRING,
    BSON_DATA_UNDEFINED,
    digitByteSize,
    moment
} from './utils';
import {CachedKeyDecoder, decodeUTF8} from './strings';

const JS_INT_MAX_LONG = Long.fromNumber(0x20000000000000);
const JS_INT_MIN_LONG = Long.fromNumber(-0x20000000000000);

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

    constructor(public buffer: Buffer, public offset: number = 0) {
        this.size = buffer.byteLength;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    parse(elementType: number) {
        switch (elementType) {
            case BSON_DATA_STRING:
                return this.parseString();
            case BSON_DATA_NUMBER:
                return this.parseNumber();
            case BSON_DATA_OID:
                return this.parseOid();
            case BSON_DATA_INT:
                return this.parseInt();
            case BSON_DATA_DATE:
                return this.parseDate();
            case BSON_DATA_LONG:
                return this.parseLong();
            case BSON_DATA_BOOLEAN:
                return this.parseBoolean();
            case BSON_DATA_NULL:
                return null;
            case BSON_DATA_UNDEFINED:
                return undefined;
            case BSON_DATA_BINARY:
                return this.parseBinary();
            case BSON_DATA_OBJECT:
                return parseObject(this);
            case BSON_DATA_ARRAY:
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
        const long = new Long(lowBits, highBits);
        return long.lessThanOrEqual(JS_INT_MAX_LONG) && long.greaterThanOrEqual(JS_INT_MIN_LONG)
            ? long.toNumber()
            : long;
    }

    parseString() {
        return this.eatString(this.eatUInt32());
    }

    parseBinary() {
        let size = this.eatUInt32();
        const subType = this.eatByte();

        if (subType === Binary.SUBTYPE_BYTE_ARRAY) {
            size = this.eatUInt32();
        }

        const b = new Binary(this.buffer.slice(this.offset, this.offset + size), subType);
        this.seek(size);
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

    parseInt() {
        return this.eatUInt32();
    }

    parseDate() {
        const lowBits = this.eatUInt32();
        const highBits = this.eatUInt32();
        return new Date(new Long(lowBits, highBits).toNumber());
    }

    parseMoment(): Moment.Moment {
        const lowBits = this.eatUInt32();
        const highBits = this.eatUInt32();
        return moment(new Date(new Long(lowBits, highBits).toNumber()));
    }

    peekUInt32(): number {
        return this.dataView.getUint32(this.offset, true);
    }

    eatStringUntilNull() {
        let end = this.offset;
        let simple = true;
        let string = '';
        while (this.buffer[end] !== 0 && end < this.offset + this.size) {
            if (simple && this.buffer[end] > 127) simple = false;
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

        const s = this.buffer.toString('utf8', this.offset, end);
        this.offset = end + 1;
        return s;
    }

    seek(size: number) {
        this.offset += size;
    }

    eatByte(): number {
        return this.buffer[this.offset++];
    }

    eatUInt32(): number {
        this.offset += 4;
        return this.dataView.getUint32(this.offset - 4, true);
    }

    eatDouble(): number {
        this.offset += 8;
        return this.dataView.getFloat64(this.offset - 8, true);
    }

    eatString(size): string {
        this.offset += size;
        return this.buffer.toString('utf8', this.offset - size, this.offset - 1);
    }
}

/**
 * This is a general purpose Parser assuming ascii names as property names.
 * It falls back automatically to UTF8 when a UTF8 byte was found.
 * This is way faster than BaseParser when property names are mainly ascii (which is usually the case).
 */
export class ParserV2 extends BaseParser {
    eatStringUntilNull() {
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

        const s = this.buffer.toString('utf8', this.offset, end);
        this.offset = end + 1;
        return s;
    }

    eatString(size): string {
        if (size > 14) {
            this.offset += size;
            return this.buffer.toString('utf8', this.offset - size, this.offset - 1);
        }
        return decodeUTF8(this, size);
    }
}

/**
 * This is a parser using speculative property names parsing. Its way faster than ParserV2, however only in cases
 * where property names are relatively constant and have low variance. For example in a document with many (same) sub-documents in an array.
 * If the object is small and has unique property names, this is slower as ParserV2.
 */
export class ParserV3 extends BaseParser {
    protected cachedKeyDecoder = new CachedKeyDecoder(32);

    eatStringUntilNull() {
        let end = this.offset;
        let size = 0;
        while (this.buffer[end++] !== 0) size++;

        const s = this.cachedKeyDecoder.get(this.buffer, this.offset, size);
        this.offset = end;
        return s;
    }

    eatString(size): string {
        if (size > 14) {
            this.offset += size;
            return this.buffer.toString('utf8', this.offset - size, this.offset - 1);
        }
        return decodeUTF8(this, size);
    }
}

export function parseObject(parser: BaseParser): any {
    const result: any = {};
    parser.seek(4);

    while (true) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        const name = parser.eatStringUntilNull();
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

export function parseArrayConverter(parser: BaseParser, converter: (parser: BaseParser) => any): any[] {
    const result: any[] = [];
    parser.seek(4);

    for (let i = 0; ; i++) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        //arrays are represented as objects, so we skip the key name, since we have `i`
        parser.seek(digitByteSize(i));

        result.push(converter(parser));
    }

    return result;
}

