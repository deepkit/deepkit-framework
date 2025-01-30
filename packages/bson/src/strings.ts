/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BSONError } from './model.js';

const decoder = new TextDecoder('utf-8');

export function decodeUTF8(buffer: Uint8Array, off: number = 0, end: number) {
    if (end - off > 8) {
        return decoder.decode(buffer.subarray(off, end));
    } else {
        return decodeUTF8Short(buffer, off, end);
    }
}

export function decodeUTF8Short(buffer: Uint8Array, off: number = 0, end: number) {
    let s = '';
    while (off < end) {
        let c = buffer[off++];

        if (c > 127) {
            if (c > 191 && c < 224) {
                if (off >= end)
                    throw new BSONError('UTF-8 decode: incomplete 2-byte sequence');
                c = (c & 31) << 6 | buffer[off++] & 63;
            } else if (c > 223 && c < 240) {
                if (off + 1 >= end)
                    throw new BSONError('UTF-8 decode: incomplete 3-byte sequence');
                c = (c & 15) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else if (c > 239 && c < 248) {
                if (off + 2 >= end)
                    throw new BSONError('UTF-8 decode: incomplete 4-byte sequence');
                c = (c & 7) << 18 | (buffer[off++] & 63) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else throw new BSONError('UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (off - 1));
            if (c <= 0xffff) {
                s += String.fromCharCode(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                s += String.fromCharCode(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            } else throw new BSONError('UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach');
        } else {
            if (c === 0) {
                return s;
            }

            s += String.fromCharCode(c);
        }
    }
    return s;
}
