import {BenchSuite} from '@deepkit/core';
import {CachedKeyDecoder} from '../src/strings';

function decodeUTF8Ori(buffer: Uint8Array, size: number) {
    let i = 0, s = '';
    const end = 0 + size;

    while (i < end) {
        let c = buffer[i++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                c = (c & 31) << 6 | buffer[i++] & 63;
            } else if (c > 223 && c < 240) {
                c = (c & 15) << 12 | (buffer[i++] & 63) << 6 | buffer[i++] & 63;
            } else if (c > 239 && c < 248) {
                c = (c & 7) << 18 | (buffer[i++] & 63) << 12 | (buffer[i++] & 63) << 6 | buffer[i++] & 63;
            }

            if (c <= 0xffff) {
                s += String.fromCharCode(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                s += String.fromCharCode(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            }
        } else {
            if (c === 0) {
                return s;
            }
            s += String.fromCharCode(c);
        }
    }
    return s;
}

console.log('JSON.stringify buffer:', JSON.stringify([...Buffer.from('Peter')]));

function decodeUTF8_2(buf: Uint8Array, size: number) {
    return String.fromCharCode.apply(null, new Uint16Array(buf) as any);
    let i = 0, s = '';
    const buffer = new Uint16Array(buf);
    const end = 0 + size;
    const ar: any[] = [];

    while (i < end) {
        let c = buffer[i++];
        ar.push(c);
    }
    return String.fromCharCode(...ar);
}

function decodeUTF8(buffer: Uint8Array, size: number) {
    let i = 0, s = '';
    const end = 0 + size;
    const ar: any[] = new Array(size);

    while (i < end) {
        let c = buffer[i++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                c = (c & 31) << 6 | buffer[i++] & 63;
            } else if (c > 223 && c < 240) {
                c = (c & 15) << 12 | (buffer[i++] & 63) << 6 | buffer[i++] & 63;
            } else if (c > 239 && c < 248) {
                c = (c & 7) << 18 | (buffer[i++] & 63) << 12 | (buffer[i++] & 63) << 6 | buffer[i++] & 63;
            }

            if (c <= 0xffff) {
                ar.push(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                ar.push(c >> 10 | 0xd800, c & 0x3FF | 0xdc00);
            }
        } else {
            if (c === 0) {
                return s;
            }
            ar.push(c);
        }
    }
    return String.fromCharCode(...ar);
}

interface StringCacheEntry {
    readonly bytes: Buffer;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly string: string;
}

class StringCache {
    protected cache: StringCacheEntry[] = [];

    get(bytes: Buffer, byteOffset: number, byteLength: number): string {
        outer:
        for (let i = 0; i < this.cache.length; i++) {
            const cacheEntry = this.cache[i];
            if (byteLength !== cacheEntry.byteLength) continue;

            for (let i = 0; i < byteLength; i++) {
                if (cacheEntry.bytes[cacheEntry.byteOffset + i] !== bytes[byteOffset + i]) break outer;
            }
            return cacheEntry.string;
        }

        const string = bytes.toString('utf8');
        this.cache.push({
            bytes,
            byteOffset,
            byteLength,
            string
        });
        return string;
    }
}

const CHUNK_SIZE = 0x1_000;
export function utf8DecodeJsFromMsgPack(bytes: Uint8Array, inputOffset: number, byteLength: number): string {
    let offset = inputOffset;
    const end = offset + byteLength;

    const units: Array<number> = [];
    let result = "";
    while (offset < end) {
        const byte1 = bytes[offset++];
        if ((byte1 & 0x80) === 0) {
            // 1 byte
            units.push(byte1);
        } else if ((byte1 & 0xe0) === 0xc0) {
            // 2 bytes
            const byte2 = bytes[offset++] & 0x3f;
            units.push(((byte1 & 0x1f) << 6) | byte2);
        } else if ((byte1 & 0xf0) === 0xe0) {
            // 3 bytes
            const byte2 = bytes[offset++] & 0x3f;
            const byte3 = bytes[offset++] & 0x3f;
            units.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
        } else if ((byte1 & 0xf8) === 0xf0) {
            // 4 bytes
            const byte2 = bytes[offset++] & 0x3f;
            const byte3 = bytes[offset++] & 0x3f;
            const byte4 = bytes[offset++] & 0x3f;
            let unit = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
            if (unit > 0xffff) {
                unit -= 0x10000;
                units.push(((unit >>> 10) & 0x3ff) | 0xd800);
                unit = 0xdc00 | (unit & 0x3ff);
            }
            units.push(unit);
        } else {
            units.push(byte1);
        }

        if (units.length >= CHUNK_SIZE) {
            result += String.fromCharCode(...units);
            units.length = 0;
        }
    }

    if (units.length > 0) {
        result += String.fromCharCode(...units);
    }

    return result;
}

const suite = new BenchSuite(`UTF8 decode`);

const s10 = Buffer.from('0123456789');
const s20 = Buffer.from('01234567890123456789');
const s40 = Buffer.from('0123456789012345678901234567890123456789');

const decoder = new TextDecoder('utf-8');
const stringCache = new StringCache();
const cachedKeyDecoder = new CachedKeyDecoder();
let bigStringRaw = '';
for (let i = 0; i < 10_000; i++) bigStringRaw += 'a';
const bigString = Buffer.from(bigStringRaw);

suite.add('decodeUTF8 ' + bigString.byteLength, () => {
    decodeUTF8(bigString, bigString.byteLength);
});

suite.add('utf8DecodeJsFromMsgPack ' + bigString.byteLength, () => {
    utf8DecodeJsFromMsgPack(bigString, 0, bigString.byteLength);
});

suite.add('Buffer.toString ' + bigString.byteLength, () => {
    bigString.toString('utf8');
});

suite.add('TextDecoder ' + bigString.byteLength, () => {
    decoder.decode(bigString);
});

suite.add('decodeUTF8 ' + s10.byteLength, () => {
    decodeUTF8(s10, s10.byteLength);
});

suite.add('utf8DecodeJsFromMsgPack ' + s10.byteLength, () => {
    utf8DecodeJsFromMsgPack(s10, 0, s10.byteLength);
});

suite.add('TextDecoder ' + s10.byteLength, () => {
    decoder.decode(s10);
});

suite.add('StringCache ' + s10.byteLength, () => {
    stringCache.get(s10, 0, s10.byteLength);
});

suite.add('CachedKeyDecoder ' + s10.byteLength, () => {
    cachedKeyDecoder.get(s10, 0, s10.byteLength);
});

suite.add('decodeUTF8_2 ' + s10.byteLength, () => {
    decodeUTF8_2(s10, s10.byteLength);
});


suite.add('decodeUTF8Ori ' + s10.byteLength, () => {
    decodeUTF8Ori(s10, s10.byteLength);
});

suite.add('decodeUTF8 ' + s20.byteLength, () => {
    decodeUTF8(s20, s20.byteLength);
});

suite.add('decodeUTF8 ' + s40.byteLength, () => {
    decodeUTF8(s40, s40.byteLength);
});

suite.add('Buffer.toString s10', () => {
    s10.toString('utf8');
});

suite.add('Buffer.toString s40', () => {
    s40.toString('utf8');
});

function bla(buffer: Buffer) {
    if (buffer.byteLength === 1) {
        return String.fromCharCode(buffer[0]);
    }
    return buffer.toString('utf8');
}

suite.run();
