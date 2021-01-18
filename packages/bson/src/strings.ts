/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseParser } from './bson-parser';

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

const decoder = new TextDecoder("utf-8");
export function decodeUTF8(buffer: Uint8Array, off: number = 0, end: number = Infinity) {
    if (end - off > 1024 * 10) {
        return decoder.decode(buffer.slice(off, end));
    } else {
        return decodeUTF8Short(buffer, off, end);
    }
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000

export function decodeUTF8Short(buffer: Uint8Array, off: number = 0, end: number = Infinity) {
    let codes: number[] = [];
    let s = '';
    while (off < end) {
        let c = buffer[off++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                // if (off >= end)
                //     throw new Error('UTF-8 decode: incomplete 2-byte sequence');
                c = (c & 31) << 6 | buffer[off++] & 63;
            } else if (c > 223 && c < 240) {
                // if (off + 1 >= end)
                //     throw new Error('UTF-8 decode: incomplete 3-byte sequence');
                c = (c & 15) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else if (c > 239 && c < 248) {
                // if (off + 2 >= end)
                //     throw new Error('UTF-8 decode: incomplete 4-byte sequence');
                c = (c & 7) << 18 | (buffer[off++] & 63) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else {
                // throw new Error('UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (off - 1));
            }
            if (c <= 0xffff) {
                codes.push(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                codes.push(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            } else throw new Error('UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach');
        } else {
            if (c === 0) {
                s += String.fromCharCode.apply(String, codes);
                return s;
            }

            codes.push(c);
        }

        if (codes.length >= MAX_ARGUMENTS_LENGTH) {
            s += String.fromCharCode.apply(String, codes);
            codes = [];
        }
    }

    if (codes.length) {
        s += String.fromCharCode.apply(String, codes);
    }

    return s;
}