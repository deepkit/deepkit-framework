import { expect, test } from '@jest/globals';
import { skip } from 'rxjs/operators';
import { DirectClient } from '../src/client/client-direct.js';
import { rpc } from '../src/decorators.js';
import { RpcKernel } from '../src/server/kernel.js';
import { ClientProgress } from '../src/progress.js';
import { RpcBinaryBufferReader } from '../src/protocol.js';
import { asyncOperation } from '@deepkit/core';

test('buffer read does not do copy', async () => {
    const data = Buffer.from('hello world');
    data.writeUint32LE(data.length, 0);
    let received: Uint8Array | undefined = undefined;

    new RpcBinaryBufferReader((p) => {
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

    function test(cb: (reader: RpcBinaryBufferReader) => void) {
        const received: string[] = [];
        const reader = new RpcBinaryBufferReader((p) => {
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

test('chunks', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        uploadBig(file: Uint8Array): number {
            return file.length;
        }

        @rpc.action()
        downloadBig(size: number): Uint8Array {
            return Buffer.alloc(size);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(TestController, 'test');

    const client = new DirectClient(kernel);
    const controller = client.controller<TestController>('test');

    {
        //small payloads trigger progress as well
        const progress = ClientProgress.track();
        expect(progress.download.progress).toBe(0);
        const file = await controller.downloadBig(100);
        expect(progress.download.progress).toBe(1);
        expect(progress.download.total).toBe(125);
        expect(file.length).toBe(100);
    }

    {
        const progress = ClientProgress.track();

        const stats: number[] = [];
        progress.download.pipe(skip(1)).subscribe((p) => {
            expect(progress.download.total).toBeGreaterThan(0);
            expect(progress.download.current).toBeLessThanOrEqual(progress.download.total);
            expect(progress.download.progress).toBeLessThanOrEqual(1);
            stats.push(progress.download.current);
        });
        const file = await controller.downloadBig(650_000);
        expect(file.length).toBe(650_000);
        expect(progress.download.done).toBe(true);
        expect(progress.download.total).toBe(650025);
        expect(stats).toEqual([
            100_000,
            200_000,
            300_000,
            400_000,
            500_000,
            600_000,
            650_025,
        ]);
        expect(progress.download.progress).toBe(1);
    }

    {
        //small payloads trigger progress as well
        const uploadFile = Buffer.alloc(100);
        const progress = ClientProgress.track();
        const size = await controller.uploadBig(uploadFile);
        expect(progress.upload.total).toBe(179);
        expect(progress.upload.progress).toBe(1);
    }

    {
        const uploadFile = Buffer.alloc(550_000);
        const progress = ClientProgress.track();
        const stats: number[] = [];
        progress.upload.pipe(skip(1)).subscribe((p) => {
            expect(progress.upload.total).toBeGreaterThan(0);
            expect(progress.upload.current).toBeLessThanOrEqual(progress.upload.total);
            expect(progress.upload.progress).toBeLessThanOrEqual(1);
            stats.push(progress.upload.current);
        });
        const size = await controller.uploadBig(uploadFile);
        expect(size).toBe(550_000);
        expect(stats).toEqual([
            100_000,
            200_000,
            300_000,
            400_000,
            500_000,
            550_079,
        ]);
        expect(progress.upload.done).toBe(true);
        expect(progress.upload.progress).toBe(1);
    }
});

test('back controller', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        uploadBig(file: Uint8Array): number {
            return file.length;
        }

        @rpc.action()
        downloadBig(size: number): Uint8Array {
            return Buffer.alloc(size);
        }
    }

    const kernel = new RpcKernel();

    const res = await asyncOperation<Uint8Array>(async (resolve) => {
        kernel.onConnection(async (connection) => {
            const ctrl = connection.controller<TestController>('test');
            const res = await ctrl.downloadBig(105_000);
            resolve(res);
        });

        const client = new DirectClient(kernel);
        client.registerController(TestController, 'test');
        await client.connect();
    });
    expect(res.byteLength).toBe(105_000);
});
