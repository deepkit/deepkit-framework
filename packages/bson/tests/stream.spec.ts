import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { BSONStreamReader } from '../index.js';
import { readInt32 } from '../src/reader.js';

/** Create a Uint8Array of given size */
function alloc(size: number): Uint8Array {
    return new Uint8Array(size);
}

/** Write a uint32 LE at offset into a Uint8Array */
function writeUint32LE(buf: Uint8Array, value: number, offset: number = 0): void {
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >>> 8) & 0xff;
    buf[offset + 2] = (value >>> 16) & 0xff;
    buf[offset + 3] = (value >>> 24) & 0xff;
}

/** Read a uint32 LE at offset from a Uint8Array */
function readUint32LE(buf: Uint8Array, offset: number = 0): number {
    return readInt32(buf, offset) >>> 0;
}

/** Convert hex string to Uint8Array */
function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/** Convert Uint8Array to hex string */
function toHex(buf: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < buf.length; i++) {
        hex += buf[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/** Concatenate multiple Uint8Arrays */
function concat(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

test('message reader', async () => {
    const messages: Uint8Array[] = [];
    const reader = new BSONStreamReader(Array.prototype.push.bind(messages));

    let buffer: Uint8Array;

    {
        messages.length = 0;
        buffer = alloc(8);
        writeUint32LE(buffer, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(readUint32LE(messages[0])).toBe(8);
    }

    {
        messages.length = 0;
        buffer = alloc(500_000);
        writeUint32LE(buffer, 1_000_000);
        reader.feed(buffer);
        buffer = alloc(500_000);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(readUint32LE(messages[0])).toBe(1_000_000);
    }

    {
        messages.length = 0;
        buffer = alloc(0);
        reader.feed(buffer);

        buffer = alloc(8);
        writeUint32LE(buffer, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(readUint32LE(messages[0])).toBe(8);
    }

    {
        messages.length = 0;
        buffer = alloc(18);
        writeUint32LE(buffer, 8);
        writeUint32LE(buffer, 10, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(readUint32LE(messages[0])).toBe(8);
        expect(readUint32LE(messages[1])).toBe(10);
    }

    {
        messages.length = 0;
        buffer = alloc(22);
        writeUint32LE(buffer, 8);
        writeUint32LE(buffer, 10, 8);
        writeUint32LE(buffer, 20, 18);

        reader.feed(buffer);
        buffer = alloc(16);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(3);
        expect(readUint32LE(messages[0])).toBe(8);
        expect(readUint32LE(messages[1])).toBe(10);
        expect(readUint32LE(messages[2])).toBe(20);
    }

    {
        messages.length = 0;
        buffer = alloc(8);
        writeUint32LE(buffer, 8);
        reader.feed(buffer);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(readUint32LE(messages[0])).toBe(8);
        expect(readUint32LE(messages[1])).toBe(8);
    }

    {
        messages.length = 0;
        buffer = alloc(4);
        writeUint32LE(buffer, 8);
        reader.feed(buffer);

        buffer = alloc(4);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(readUint32LE(messages[0])).toBe(8);
    }

    {
        messages.length = 0;
        let buffer = alloc(4);
        writeUint32LE(buffer, 30);
        reader.feed(buffer);

        buffer = alloc(26);
        reader.feed(buffer);

        buffer = alloc(8);
        writeUint32LE(buffer, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(readUint32LE(messages[0])).toBe(30);
        expect(readUint32LE(messages[1])).toBe(8);
    }
});

test('buffer read does not do copy', async () => {
    const data = new Uint8Array([0, 0, 0, 0, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77]);
    writeUint32LE(data, data.length);
    let received: Uint8Array | undefined = undefined;

    new BSONStreamReader(p => {
        received = p;
    }).feed(data);

    expect(received!.buffer === data.buffer).toBe(true);
});

test('RpcBinaryBufferReader', () => {
    const a = fromHex('0000000001020304050607');
    writeUint32LE(a, a.byteLength);
    const b = fromHex('000000000203040506070809');
    writeUint32LE(b, b.byteLength);
    const c = fromHex('00000000020304050607');
    writeUint32LE(c, c.byteLength);
    const data = concat(a, b, c);

    function runTest(cb: (reader: BSONStreamReader) => void) {
        const received: string[] = [];
        const reader = new BSONStreamReader(p => {
            received.push(toHex(p));
        });
        cb(reader);
        expect(received).toEqual(['0b00000001020304050607', '0c0000000203040506070809', '0a000000020304050607']);
    }

    runTest(reader => {
        //all at once
        reader.feed(data, data.byteLength);
    });

    runTest(reader => {
        reader.feed(a);
        reader.feed(b);
        reader.feed(c);
    });

    runTest(reader => {
        reader.feed(a);
        reader.feed(b.subarray(0, 5));
        reader.feed(b.subarray(5));
        reader.feed(c);
    });

    runTest(reader => {
        reader.feed(a);
        reader.feed(b.subarray(0, 4));
        reader.feed(b.subarray(4));
        reader.feed(c);
    });

    runTest(reader => {
        reader.feed(a);
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c);
    });

    runTest(reader => {
        reader.feed(a);
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c.subarray(0, 3));
        reader.feed(c.subarray(3));
    });

    runTest(reader => {
        reader.feed(a.subarray(0, 3));
        reader.feed(a.subarray(3));
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c);
    });

    const steps: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    for (const step of steps) {
        runTest(reader => {
            //step by step
            for (let i = 0; i < data.byteLength; i += step) {
                reader.feed(data.subarray(i, i + step));
            }
        });
    }
});
