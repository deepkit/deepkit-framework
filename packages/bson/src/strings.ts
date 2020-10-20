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
export function decodeUTF8(parser: BaseParser, size: number = parser.size - parser.offset) {
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

interface KeyCacheRecord {
    readonly bytes: Uint8Array;
    readonly offset: number;
    readonly key: string;
    hits: number;
}

/**
 * A string decoder that caches small strings. This is way faster than creating all the time the same string,
 * but only when the variance is not high.
 */
export class CachedKeyDecoder {
    private cachedValues: KeyCacheRecord[][] = [];

    constructor(private maxKeyLength: number = 32, private maxCachesPerBucket = 32) {
        for (let i = 0; i <= maxKeyLength; i++) {
            this.cachedValues.push([]);
        }
    }

    public get(bytes: Buffer, inputOffset: number, byteLength: number): string {
        if (byteLength > this.maxKeyLength) {
            return bytes.toString('utf8', inputOffset, inputOffset + byteLength);
        }

        return this.findCachedKey(bytes, inputOffset, byteLength, this.cachedValues[byteLength]);
    }

    private findCachedKey(
        bytes: Buffer,
        inputOffset: number,
        byteLength: number,
        chunks: Array<KeyCacheRecord>,
    ): string {
        let prevHits = 0;
        const chunksLength = Math.min(chunks.length, this.maxCachesPerBucket);
        const halfLength = byteLength / 2;
        const endPosition = inputOffset + byteLength;
        FIND_CHUNK: for (let i = 0; i < chunksLength; i++) {
            const chunk = chunks[i];

            if (i > 0 && prevHits < chunk.hits) {
                // sort chunks by number of hits in order to improve search speed for most used keys
                const prevChunk = chunks[i - 1];
                chunks[i] = prevChunk;
                chunks[i - 1] = chunk;
                prevHits = prevChunk.hits;
            } else {
                prevHits = chunk.hits;
            }

            for (let j = 0; j < halfLength; j++) {
                if (chunk.bytes[chunk.offset + j] !== bytes[inputOffset + j]) {
                    continue FIND_CHUNK;
                }

                if (chunk.bytes[chunk.offset + byteLength - j - 1] !== bytes[endPosition - j - 1]) {
                    continue FIND_CHUNK;
                }
            }

            chunk.hits++;

            return chunk.key;
        }

        const string = bytes.toString('utf8', inputOffset, inputOffset + byteLength);
        chunks.push({
            bytes, hits: 0, key: string, offset: inputOffset,
        });

        return string;
    }
}
