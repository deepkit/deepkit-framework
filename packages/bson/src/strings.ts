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

import {BaseParser} from './bson-parser';

/**
 * This creates a JS string from a utf8 byte buffer. This is the fastest way possible to create
 * small strings (< 14chars). Everything else should be cached or created by Buffer.toString('utf8').
 */
export function decodeUTF8Parser(parser: BaseParser, size: number = parser.size - parser.offset) {
    let i = parser.offset, s = '';
    const end = parser.offset + size;
    while (i < end) {
        let c = parser.buffer[i++];

        if (c > 127) {
            if (c > 191 && c < 224) {
                if (i >= end)
                    throw new Error('UTF-8 decode: incomplete 2-byte sequence');
                c = (c & 31) << 6 | parser.buffer[i++] & 63;
            } else if (c > 223 && c < 240) {
                if (i + 1 >= end)
                    throw new Error('UTF-8 decode: incomplete 3-byte sequence');
                c = (c & 15) << 12 | (parser.buffer[i++] & 63) << 6 | parser.buffer[i++] & 63;
            } else if (c > 239 && c < 248) {
                if (i + 2 >= end)
                    throw new Error('UTF-8 decode: incomplete 4-byte sequence');
                c = (c & 7) << 18 | (parser.buffer[i++] & 63) << 12 | (parser.buffer[i++] & 63) << 6 | parser.buffer[i++] & 63;
            } else throw new Error('UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (i - 1));
            if (c <= 0xffff) {
                s += String.fromCharCode(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                s += String.fromCharCode(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            } else throw new Error('UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach');
        } else {
            if (c === 0) {
                parser.offset = i;
                return s;
            }

            s += String.fromCharCode(c);
        }
    }
    parser.offset = end;
    return s;
}

export function decodeUTF8(buffer: Uint8Array, off: number = 0, end: number = Infinity) {
    let s = '';
    while (off < end) {
        let c = buffer[off++];

        if (c > 127) {
            if (c > 191 && c < 224) {
                if (off >= end)
                    throw new Error('UTF-8 decode: incomplete 2-byte sequence');
                c = (c & 31) << 6 | buffer[off++] & 63;
            } else if (c > 223 && c < 240) {
                if (off + 1 >= end)
                    throw new Error('UTF-8 decode: incomplete 3-byte sequence');
                c = (c & 15) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else if (c > 239 && c < 248) {
                if (off + 2 >= end)
                    throw new Error('UTF-8 decode: incomplete 4-byte sequence');
                c = (c & 7) << 18 | (buffer[off++] & 63) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else throw new Error('UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (off - 1));
            if (c <= 0xffff) {
                s += String.fromCharCode(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                s += String.fromCharCode(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            } else throw new Error('UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach');
        } else {
            if (c === 0) {
                off = off;
                return s;
            }

            s += String.fromCharCode(c);
        }
    }
    off = end;
    return s;
}

interface KeyCacheRecord {
    readonly bytes: Uint8Array;
    readonly offset: number;
    readonly key: string;
    hits: number;
}
