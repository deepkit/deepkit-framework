/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext } from '@deepkit/core';

const decoder = new TextDecoder("utf-8");
export function decodeUTF8(buffer: Uint8Array, off: number = 0, end: number) {
    if (end - off > 512) {
        return decoder.decode(buffer.slice(off, end));
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
                return s;
            }

            s += String.fromCharCode(c);
        }
    }
    return s;
}

export function buildStringDecoder(specializations: number = 10) {
    const compiler = new CompilerContext();
    // const midDecoding: string[] = [];
    const endDecoding: string[] = [];

    function fromCharCode(number: number): string {
        const codes: string[] = [];
        for (let i = 0; i < number; i++) {
            codes.push(`codes[${i}]`);
        }
        return `fromCharCode(${codes.join(', ')})`;
    }

    const fns: Function[] = [];
    for (let i = 1; i <= specializations; i++) {
        const fn = new Function('fromCharCode', 'return function(codes) { return ' + fromCharCode(i) + '}')(String.fromCharCode);
        compiler.context.set('decodeCodes' + i, fn);
        fns.push(fn);
    }

    for (let i = 0; i < specializations; i++) {
        // midDecoding.push(`if (codesOffset === ${i + 1}) s += decodeCodes${i + 1}(codes);`)
        endDecoding.push(`if (codesOffset === ${i + 1}) return s + decodeCodes${i + 1}(codes);`);
    }
    compiler.context.set('codes', new Uint16Array(specializations));
    compiler.context.set('fns', fns);
    compiler.context.set('fromCharCode', String.fromCharCode);
    
    const functionCode = `
    let codesOffset = 0;
    let s = '';
    while (off < end) {
        let c = buffer[off++];

        if (c > 127) {
            if (c > 191 && c < 224) {
                c = (c & 31) << 6 | buffer[off++] & 63;
            } else if (c > 223 && c < 240) {
                c = (c & 15) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            } else if (c > 239 && c < 248) {
                c = (c & 7) << 18 | (buffer[off++] & 63) << 12 | (buffer[off++] & 63) << 6 | buffer[off++] & 63;
            }
            if (c <= 0xffff) {
                codes[codesOffset++] = c;
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                codes[codesOffset++] = c >> 10 | 0xd800;
                codes[codesOffset++] = c & 0x3FF | 0xdc00;
            }
        } else {
            if (c === 0) {
                return codesOffset ? s + fns[codesOffset - 1](codes) : s;
            }

            codes[codesOffset++] = c;
        }

        if (codesOffset >= ${specializations}) {
            s += decodeCodes${specializations}(codes);
            codesOffset = 0;
        }
    }

    if (codesOffset === 0) return s;
    return s + fns[codesOffset - 1](codes);
    `;

    return compiler.build(functionCode, 'buffer', 'off', 'end');
}
