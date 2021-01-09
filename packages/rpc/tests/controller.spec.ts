import { entity, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { skip } from 'rxjs/operators';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';
import { ClientProgress } from '../src/writer';

test('basics', async () => {
    @entity.name('model')
    class MyModel {
        constructor(
            @t public name: string
        ) { }
    }

    @entity.name('MyError')
    class MyError extends Error {
    }

    @entity.name('MyError2')
    class MyError2 extends Error {
        constructor(
            @t public id: number
        ) {
            super('critical');
        }
    }

    class Controller {
        @rpc.action()
        createModel(value: string): MyModel {
            return new MyModel(value);
        }

        @rpc.action()
        notDefined(): (string | number)[] {
            return [123, "bar"];
        }

        @rpc.action()
        union(): (string | number) {
            return 213;
        }

        @rpc.action()
        throws(): void {
            throw new Error('Great');
        }

        @rpc.action()
        myError(): void {
            throw new MyError('Mhpf');
        }

        @rpc.action()
        myError2(): void {
            throw new MyError2(99);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const m = await controller.createModel('foo');
        expect(m).toBeInstanceOf(MyModel);
        expect(m.name).toBe('foo');
    }

    {
        const m = await controller.notDefined();
        expect(m).toEqual([123, "bar"]);
    }

    {
        const m = await controller.union();
        expect(m).toBe(213);
    }

    {
        await expect(controller.throws()).rejects.toThrowError(Error as any);
        await expect(controller.throws()).rejects.toThrowError('Great');
    }

    {
        await expect(controller.myError()).rejects.toThrowError(MyError as any);
        await expect(controller.myError()).rejects.toThrowError('Mhpf');
    }

    {
        await expect(controller.myError2()).rejects.toThrowError(MyError2 as any);
        await expect(controller.myError2()).rejects.toThrowError('critical');
        await expect(controller.myError2()).rejects.toMatchObject({ id: 99 });
    }
});

test('chunks', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        uploadBig(@t.type(Buffer) file: Buffer): number {
            return file.length;
        }

        @rpc.action()
        downloadBig(): Buffer {
            return Buffer.alloc(650_000);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('test', TestController);

    const client = new DirectClient(kernel);
    const test = client.controller<TestController>('test');

    {
        const progress = ClientProgress.track();

        const stats: number[] = [];
        progress.download.pipe(skip(1)).subscribe((p) => {
            expect(progress.download.total).toBeGreaterThan(0);
            expect(progress.download.current).toBeLessThanOrEqual(progress.download.total);
            expect(progress.download.progress).toBeLessThanOrEqual(1);
            stats.push(progress.download.current);
        });
        const file = await test.downloadBig();
        expect(file.length).toBe(650_000);
        expect(progress.download.done).toBe(true);
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
        const uploadFile = Buffer.alloc(550_000);
        const progress = ClientProgress.track();
        const stats: number[] = [];
        progress.upload.pipe(skip(1)).subscribe((p) => {
            expect(progress.upload.total).toBeGreaterThan(0);
            expect(progress.upload.current).toBeLessThanOrEqual(progress.upload.total);
            expect(progress.upload.progress).toBeLessThanOrEqual(1);
            stats.push(progress.upload.current);
        });
        const size = await test.uploadBig(uploadFile);
        expect(size).toBe(550_000);
        expect(stats).toEqual([
            100_000,
            200_000,
            300_000,
            400_000,
            500_000,
            550_082,
        ]);
        expect(progress.upload.done).toBe(true);
        expect(progress.upload.progress).toBe(1);
    }
});
