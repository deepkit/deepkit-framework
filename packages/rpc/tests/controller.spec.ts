import { entity, getClassSchema, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';

test('basics', async () => {
    @entity.name('model/basics')
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

test('promise', async () => {
    @entity.name('model/promise')
    class MyModel {
        constructor(
            @t public name: string
        ) { }
    }

    class Controller {
        @rpc.action()
        //MyModel is automatically detected once executed. 
        async createModel(value: string): Promise<MyModel> {
            return new MyModel(value);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const model = await controller.createModel('foo');
        expect(model).toBeInstanceOf(MyModel);
    }

    {
        const model = await controller.createModel('foo');
        expect(model).toBeInstanceOf(MyModel);
    }
});

test('wrong arguments', async () => {
    @entity.name('model/promise2')
    class MyModel {
        constructor(
            @t public id: number
        ) { }
    }

    class Controller {
        @rpc.action()
        //MyModel is automatically detected once executed. 
        async getProduct(id: number): Promise<MyModel> {
            return new MyModel(id);
        }
    }

    expect(getClassSchema(Controller).getMethodProperties('getProduct')[0].isOptional).toBe(false);
    expect(getClassSchema(Controller).getMethodProperties('getProduct')[0].isNullable).toBe(false);

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        await expect(controller.getProduct(undefined as any)).rejects.toThrow('id(required): Required value is undefined');
    }

    {
        await expect(controller.getProduct('23' as any)).rejects.toThrow('id(required): Required value is undefined');
    }

    {
        await expect(controller.getProduct(NaN as any)).rejects.toThrow('id(invalid_number): No valid number given, got NaN');
    }
});
