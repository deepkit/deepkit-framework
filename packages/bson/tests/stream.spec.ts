import { expect, test } from '@jest/globals';
import { BsonStreamReader } from '../src/stream';


test('message reader', async () => {
    const messages: Buffer[] = [];
    const reader = new BsonStreamReader(Array.prototype.push.bind(messages));

    let buffer: any;

    {
        messages.length = 0;
        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(500_000);
        buffer.writeUInt32LE(1_000_000);
        reader.feed(buffer);
        buffer = Buffer.alloc(500_000);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(1_000_000);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(0);
        reader.feed(buffer);

        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(18);
        buffer.writeUInt32LE(8);
        buffer.writeUInt32LE(10, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(10);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(22);
        buffer.writeUInt32LE(8);
        buffer.writeUInt32LE(10, 8);
        buffer.writeUInt32LE(20, 18);

        reader.feed(buffer);
        buffer = Buffer.alloc(16);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(3);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(10);
        expect(messages[2].readUInt32LE()).toBe(20);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        buffer = Buffer.alloc(4);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        let buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(30);
        reader.feed(buffer);

        buffer = Buffer.alloc(26);
        reader.feed(buffer);

        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(30);
        expect(messages[1].readUInt32LE()).toBe(8);
    }
});


test('buffer read does not do copy', async () => {
    const data = Buffer.from('hello world');
    data.writeUint32LE(data.length, 0);
    let received: Uint8Array | undefined = undefined;

    new BsonStreamReader((p) => {
        received = p;
    }).feed(data);

    expect(received!.buffer === data.buffer).toBe(true);
});

test('RpcBinaryBufferReader', () => {
    const a = Buffer.from('0000000001020304050607', 'hex');
    a.writeUint32LE(a.byteLength, 0);
    const b = Buffer.from('000000000203040506070809', 'hex');
    b.writeUint32LE(b.byteLength, 0);
    const c = Buffer.from('00000000020304050607', 'hex');
    c.writeUint32LE(c.byteLength, 0);
    const data = Buffer.concat([a, b, c]);

    function test(cb: (reader: BsonStreamReader) => void) {
        const received: string[] = [];
        const reader = new BsonStreamReader((p) => {
            received.push(Buffer.from(p).toString('hex'));
        });
        cb(reader);
        expect(received).toEqual([
            '0b00000001020304050607',
            '0c0000000203040506070809',
            '0a000000020304050607',
        ]);
    }

    test((reader) => {
        //all at once
        reader.feed(data, data.byteLength);
    });

    test((reader) => {
        reader.feed(a);
        reader.feed(b);
        reader.feed(c);
    });

    test((reader) => {
        reader.feed(a);
        reader.feed(b.subarray(0, 5));
        reader.feed(b.subarray(5));
        reader.feed(c);
    });

    test((reader) => {
        reader.feed(a);
        reader.feed(b.subarray(0, 4));
        reader.feed(b.subarray(4));
        reader.feed(c);
    });

    test((reader) => {
        reader.feed(a);
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c);
    });

    test((reader) => {
        reader.feed(a);
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c.subarray(0, 3));
        reader.feed(c.subarray(3));
    });

    test((reader) => {
        reader.feed(a.subarray(0, 3));
        reader.feed(a.subarray(3));
        reader.feed(b.subarray(0, 3));
        reader.feed(b.subarray(3));
        reader.feed(c);
    });

    const steps: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    for (const step of steps) {
        test((reader) => {
            //step by step
            for (let i = 0; i < data.byteLength; i += step) {
                reader.feed(data.subarray(i, i + step));
            }
        });
    }
});
