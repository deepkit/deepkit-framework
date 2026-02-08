/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BSONError } from './errors.js';
import { hexTable2 } from './model.js';
import { BSONType } from './types.js';

/**
 * TextDecoder for UTF-8 string decoding (fallback for non-ASCII).
 */
const textDecoder = new TextDecoder('utf-8');

/**
 * Decode UTF-8 bytes to a JavaScript string.
 * Optimized for the common case of short ASCII strings (string values, index-signature keys).
 *
 * Strategy:
 * - ≤12 bytes: unrolled OR-check + String.fromCharCode with explicit args (zero Array allocation)
 * - 13-64 bytes: single-pass OR-accumulate + fromCharCode.apply (no per-byte branch)
 * - >64 bytes: TextDecoder (optimized for bulk decoding)
 * - Non-ASCII at any length: TextDecoder fallback
 *
 * The OR-check `(buf[o] | buf[o+1] | ...) & 0x80` validates all bytes are ASCII in one
 * expression. String.fromCharCode with explicit args creates a flat SeqOneByteString directly
 * — no Array allocation, no apply overhead. Benchmarked at 1.5-1.6x over the previous
 * array+apply approach for ≤12B strings.
 * @internal
 */
export function decodeUTF8(buffer: Uint8Array, offset: number, length: number): string {
    // Short strings (≤12 bytes): unrolled path, zero allocation.
    // Each case: OR all bytes to check ASCII in one shot, then fromCharCode with explicit args.
    switch (length) {
        case 0:
            return '';
        case 1:
            if (buffer[offset] >= 128) return textDecoder.decode(buffer.subarray(offset, offset + 1));
            return String.fromCharCode(buffer[offset]);
        case 2:
            if ((buffer[offset] | buffer[offset + 1]) & 0x80)
                return textDecoder.decode(buffer.subarray(offset, offset + 2));
            return String.fromCharCode(buffer[offset], buffer[offset + 1]);
        case 3:
            if ((buffer[offset] | buffer[offset + 1] | buffer[offset + 2]) & 0x80)
                return textDecoder.decode(buffer.subarray(offset, offset + 3));
            return String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2]);
        case 4:
            if ((buffer[offset] | buffer[offset + 1] | buffer[offset + 2] | buffer[offset + 3]) & 0x80)
                return textDecoder.decode(buffer.subarray(offset, offset + 4));
            return String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
        case 5:
            if (
                (buffer[offset] | buffer[offset + 1] | buffer[offset + 2] | buffer[offset + 3] | buffer[offset + 4]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 5));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
            );
        case 6:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 6));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
            );
        case 7:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 7));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
            );
        case 8:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6] |
                    buffer[offset + 7]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 8));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
                buffer[offset + 7],
            );
        case 9:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6] |
                    buffer[offset + 7] |
                    buffer[offset + 8]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 9));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
                buffer[offset + 7],
                buffer[offset + 8],
            );
        case 10:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6] |
                    buffer[offset + 7] |
                    buffer[offset + 8] |
                    buffer[offset + 9]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 10));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
                buffer[offset + 7],
                buffer[offset + 8],
                buffer[offset + 9],
            );
        case 11:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6] |
                    buffer[offset + 7] |
                    buffer[offset + 8] |
                    buffer[offset + 9] |
                    buffer[offset + 10]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 11));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
                buffer[offset + 7],
                buffer[offset + 8],
                buffer[offset + 9],
                buffer[offset + 10],
            );
        case 12:
            if (
                (buffer[offset] |
                    buffer[offset + 1] |
                    buffer[offset + 2] |
                    buffer[offset + 3] |
                    buffer[offset + 4] |
                    buffer[offset + 5] |
                    buffer[offset + 6] |
                    buffer[offset + 7] |
                    buffer[offset + 8] |
                    buffer[offset + 9] |
                    buffer[offset + 10] |
                    buffer[offset + 11]) &
                0x80
            )
                return textDecoder.decode(buffer.subarray(offset, offset + 12));
            return String.fromCharCode(
                buffer[offset],
                buffer[offset + 1],
                buffer[offset + 2],
                buffer[offset + 3],
                buffer[offset + 4],
                buffer[offset + 5],
                buffer[offset + 6],
                buffer[offset + 7],
                buffer[offset + 8],
                buffer[offset + 9],
                buffer[offset + 10],
                buffer[offset + 11],
            );
        default: {
            // 13-64 bytes: single-pass OR-accumulate (no per-byte branch, check at end)
            if (length <= 64) {
                let acc = 0;
                const codes = new Array(length);
                for (let i = 0; i < length; i++) {
                    const c = buffer[offset + i];
                    acc |= c;
                    codes[i] = c;
                }
                if (acc & 0x80) return textDecoder.decode(buffer.subarray(offset, offset + length));
                return String.fromCharCode.apply(null, codes);
            }
            // >64 bytes: TextDecoder is optimized for bulk decoding
            return textDecoder.decode(buffer.subarray(offset, offset + length));
        }
    }
}

/**
 * Shared 8-byte buffer with typed array views for float64/int64/uint64 reads.
 * No DataView — typed arrays reinterpret the same underlying bytes directly.
 */
const _buf = new ArrayBuffer(8);
const _u8 = new Uint8Array(_buf);
const _f64 = new Float64Array(_buf);
const _i64 = new BigInt64Array(_buf);
const _u64 = new BigUint64Array(_buf);

/**
 * Read a 32-bit signed integer from a buffer (little-endian).
 * @internal
 */
export function readInt32(buffer: Uint8Array, offset: number): number {
    return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
}

/**
 * Read a 32-bit unsigned integer from a buffer (little-endian).
 * @internal
 */
export function readUint32(buffer: Uint8Array, offset: number): number {
    return buffer[offset] + buffer[offset + 1] * 0x100 + buffer[offset + 2] * 0x10000 + buffer[offset + 3] * 0x1000000;
}

/**
 * Read a 64-bit signed integer from a buffer as bigint (little-endian).
 * @internal
 */
export function readInt64(buffer: Uint8Array, offset: number): bigint {
    _u8[0] = buffer[offset];
    _u8[1] = buffer[offset + 1];
    _u8[2] = buffer[offset + 2];
    _u8[3] = buffer[offset + 3];
    _u8[4] = buffer[offset + 4];
    _u8[5] = buffer[offset + 5];
    _u8[6] = buffer[offset + 6];
    _u8[7] = buffer[offset + 7];
    return _i64[0];
}

/**
 * Read a 64-bit unsigned integer from a buffer as bigint (little-endian).
 * @internal
 */
export function readUint64(buffer: Uint8Array, offset: number): bigint {
    _u8[0] = buffer[offset];
    _u8[1] = buffer[offset + 1];
    _u8[2] = buffer[offset + 2];
    _u8[3] = buffer[offset + 3];
    _u8[4] = buffer[offset + 4];
    _u8[5] = buffer[offset + 5];
    _u8[6] = buffer[offset + 6];
    _u8[7] = buffer[offset + 7];
    return _u64[0];
}

/**
 * Read a 64-bit float from a buffer (little-endian).
 * @internal
 */
export function readDouble(buffer: Uint8Array, offset: number): number {
    _u8[0] = buffer[offset];
    _u8[1] = buffer[offset + 1];
    _u8[2] = buffer[offset + 2];
    _u8[3] = buffer[offset + 3];
    _u8[4] = buffer[offset + 4];
    _u8[5] = buffer[offset + 5];
    _u8[6] = buffer[offset + 6];
    _u8[7] = buffer[offset + 7];
    return _f64[0];
}

/**
 * Read signed int64 (little-endian) as JavaScript number.
 * For values in safe integer range (covers all BSON dates, timestamps).
 * @internal
 */
export function readInt64AsNumber(buffer: Uint8Array, offset: number): number {
    const lo = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
    const hi = buffer[offset + 4] | (buffer[offset + 5] << 8) | (buffer[offset + 6] << 16) | (buffer[offset + 7] << 24);
    return hi * 0x100000000 + (lo >>> 0);
}

/**
 * Read a null-terminated string (cstring).
 * Returns the string and the number of bytes read (including null).
 * @internal
 */
export function readCString(buffer: Uint8Array, offset: number): [string, number] {
    let end = offset;
    const bufLen = buffer.length;
    while (end < bufLen && buffer[end] !== 0) end++;
    if (end >= bufLen) throw new BSONError('Unexpected end of buffer while reading field name', 'DK-B020');
    const length = end - offset;
    if (length === 0) return ['', 1];
    return [decodeUTF8(buffer, offset, length), length + 1];
}

/**
 * Read a BSON string (length-prefixed, null-terminated).
 * Returns the string and the total bytes consumed.
 * @internal
 */
export function readBSONString(buffer: Uint8Array, offset: number): [string, number] {
    const length = readInt32(buffer, offset) - 1; // Exclude null terminator
    if (length < 0) throw new BSONError('Invalid BSON string: negative length', 'DK-B020');
    if (length === 0) return ['', 5];
    return [decodeUTF8(buffer, offset + 4, length), length + 5];
}

/**
 * Read a BSON string value directly (no tuple return).
 * The caller already knows the string length, so we just decode the bytes.
 * Used by inlined JIT code to avoid tuple allocation.
 * @internal
 */
export function readBSONStringDirect(buffer: Uint8Array, offset: number, length: number): string {
    return decodeUTF8(buffer, offset, length);
}

/**
 * Read 12 bytes as a hex string (for ObjectId).
 * Uses 2-byte lookup table: 6 concatenations instead of 12.
 * @internal
 */
export function readBytesAsHex(buffer: Uint8Array, offset: number, length: number): string {
    return (
        hexTable2[(buffer[offset] << 8) | buffer[offset + 1]] +
        hexTable2[(buffer[offset + 2] << 8) | buffer[offset + 3]] +
        hexTable2[(buffer[offset + 4] << 8) | buffer[offset + 5]] +
        hexTable2[(buffer[offset + 6] << 8) | buffer[offset + 7]] +
        hexTable2[(buffer[offset + 8] << 8) | buffer[offset + 9]] +
        hexTable2[(buffer[offset + 10] << 8) | buffer[offset + 11]]
    );
}

/**
 * Read bytes as a UUID string.
 * Uses 2-byte lookup table: 12 concatenations instead of 20.
 * @internal
 */
export function readBytesAsUUID(buffer: Uint8Array, offset: number): string {
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return (
        hexTable2[(buffer[offset] << 8) | buffer[offset + 1]] +
        hexTable2[(buffer[offset + 2] << 8) | buffer[offset + 3]] +
        '-' +
        hexTable2[(buffer[offset + 4] << 8) | buffer[offset + 5]] +
        '-' +
        hexTable2[(buffer[offset + 6] << 8) | buffer[offset + 7]] +
        '-' +
        hexTable2[(buffer[offset + 8] << 8) | buffer[offset + 9]] +
        '-' +
        hexTable2[(buffer[offset + 10] << 8) | buffer[offset + 11]] +
        hexTable2[(buffer[offset + 12] << 8) | buffer[offset + 13]] +
        hexTable2[(buffer[offset + 14] << 8) | buffer[offset + 15]]
    );
}

/**
 * Skip a field value based on its BSON type.
 * Returns the new offset after skipping.
 * @internal
 */
export function skipValue(buffer: Uint8Array, offset: number, type: number): number {
    switch (type) {
        case BSONType.DOUBLE:
            return offset + 8;
        case BSONType.STRING: {
            const length = readInt32(buffer, offset);
            if (length < 0) throw new BSONError('Invalid BSON string: negative length', 'DK-B020');
            return offset + 4 + length;
        }
        case BSONType.OBJECT:
        case BSONType.ARRAY: {
            const size = readInt32(buffer, offset);
            if (size < 5) throw new BSONError('Invalid BSON document: size too small', 'DK-B020');
            return offset + size;
        }
        case BSONType.BINARY: {
            const length = readInt32(buffer, offset);
            if (length < 0) throw new BSONError('Invalid BSON binary: negative length', 'DK-B020');
            return offset + 4 + 1 + length; // length + subtype + data
        }
        case BSONType.UNDEFINED:
        case BSONType.NULL:
        case BSONType.MIN_KEY:
        case BSONType.MAX_KEY:
            return offset;
        case BSONType.OID:
            return offset + 12;
        case BSONType.BOOLEAN:
            return offset + 1;
        case BSONType.DATE:
        case BSONType.TIMESTAMP:
        case BSONType.LONG:
            return offset + 8;
        case BSONType.INT:
            return offset + 4;
        case BSONType.DECIMAL128:
            return offset + 16;
        case BSONType.REGEX: {
            // Two null-terminated strings
            let o = offset;
            const bufLen = buffer.length;
            while (o < bufLen && buffer[o++] !== 0); // pattern
            if (o >= bufLen) throw new BSONError('Unexpected end of buffer while reading REGEX pattern', 'DK-B020');
            while (o < bufLen && buffer[o++] !== 0); // flags
            if (o > bufLen) throw new BSONError('Unexpected end of buffer while reading REGEX flags', 'DK-B020');
            return o;
        }
        default:
            throw new BSONError(`Unknown BSON type: ${type}`, 'DK-B010');
    }
}

/**
 * Skip a field (name + value) based on its BSON type.
 * The offset should point to the start of the field name.
 * @internal
 */
export function skipField(buffer: Uint8Array, offset: number, type: number): number {
    // Skip name
    const bufLen = buffer.length;
    while (offset < bufLen && buffer[offset++] !== 0);
    // Skip value
    return skipValue(buffer, offset, type);
}
