import { assertType, entity, Positive, ReflectionClass, ReflectionKind } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { DirectClient } from '../src/client/client-direct.js';
import { getActions, rpc } from '../src/decorators.js';
import { RpcKernel, RpcKernelConnection } from '../src/server/kernel.js';
import { Session, SessionState } from '../src/server/security.js';
import { BehaviorSubject } from 'rxjs';
import { getClassName } from '@deepkit/core';

test('decorator', async () => {
    @rpc.controller('name')
    class Controller {
        @rpc.action()
        action(): void {
        }

        @rpc.action().group('a')
        second(): void {
        }
    }

    {
        const actions = getActions(Controller);
        expect(actions.size).toBe(2);
        expect(actions.get('action')!.name).toBe('action');
        expect(actions.get('action')!.groups).toEqual([]);
        expect(actions.get('second')!.name).toBe('second');
        expect(actions.get('second')!.groups).toEqual(['a']);
    }
});

test('inheritance', async () => {
    class User {
    }

    @rpc.controller('name')
    class Controller {
        @rpc.action()
        action(): User | undefined {
            return new User();
        }

        @rpc.action().group('a')
        second(): User {
            return new User();
        }
    }

    @rpc.controller('different')
    class Extended extends Controller {
        @rpc.action().group('extended')
        second() {
            return super.second();
        }

        @rpc.action().group('b')
        third(): void {
        }
    }

    {
        const actions = getActions(Controller);
        expect(actions.size).toBe(2);
        expect(actions.get('action')!.name).toBe('action');
        expect(actions.get('action')!.groups).toEqual([]);
        expect(actions.get('second')!.name).toBe('second');
        expect(actions.get('second')!.groups).toEqual(['a']);

        const resultProperty = ReflectionClass.from(Controller).getMethod('action');
        const returnType = resultProperty.getReturnType();
        assertType(returnType, ReflectionKind.union);
        assertType(returnType.types[0], ReflectionKind.class);
        assertType(returnType.types[1], ReflectionKind.undefined);
        expect(returnType.types[0].classType).toBe(User);
    }

    {
        const actions = getActions(Extended);
        expect(actions.size).toBe(3);
        expect(actions.get('action')!.name).toBe('action');
        expect(actions.get('action')!.groups).toEqual([]);

        expect(actions.get('second')!.name).toBe('second');
        expect(actions.get('second')!.groups).toEqual(['a', 'extended']);

        expect(actions.get('third')!.name).toBe('third');
        expect(actions.get('third')!.groups).toEqual(['b']);

        const resultProperty = ReflectionClass.from(Extended).getMethod('action');
        const returnType = resultProperty.getReturnType();
        assertType(returnType, ReflectionKind.union);
        assertType(returnType.types[0], ReflectionKind.class);
        assertType(returnType.types[1], ReflectionKind.undefined);
        expect(returnType.types[0].classType).toBe(User);
    }
});

test('basics', async () => {
    @entity.name('model/basics')
    class MyModel {
        constructor(public name: string) {
        }
    }

    @entity.name('MyError')
    class MyError extends Error {
    }

    @entity.name('MyError2')
    class MyError2 extends Error {
        constructor(public id: number) {
            super('critical');
        }
    }

    @rpc.controller('myController')
    class Controller {
        @rpc.action()
        createModel(value: string): MyModel {
            return new MyModel(value);
        }

        @rpc.action()
        notDefined(): (string | number)[] {
            return [123, 'bar'];
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
    kernel.registerController(Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const m = await controller.createModel('foo');
        expect(m).toBeInstanceOf(MyModel);
        expect(m.name).toBe('foo');
    }

    {
        const m = await controller.notDefined();
        expect(m).toEqual([123, 'bar']);
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

test('parameters', async () => {
    class Controller {
        @rpc.action()
        get(value: string = 'nope'): string {
            return value;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const v = await controller.get('foo');
        expect(v).toBe('foo');
    }

    {
        const v = await controller.get();
        expect(v).toBe('nope');
    }
});

test('promise', async () => {
    @entity.name('model/promise')
    class MyModel {
        constructor(public name: string) {
        }
    }

    class Controller {
        @rpc.action()
        async createModel(value: string): Promise<MyModel> {
            return new MyModel(value);
        }

        @rpc.action()
        async createModel2(value: string): Promise<MyModel> {
            return new MyModel(value);
        }

        @rpc.action()
        async createModel3(value: string): Promise<MyModel> {
            return new MyModel(value);
        }

        @rpc.action()
        async createModel4(value: string): Promise<BehaviorSubject<MyModel>> {
            return new BehaviorSubject<MyModel>(new MyModel(value));
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

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

    {
        const model = await controller.createModel2('foo');
        expect(model).toBeInstanceOf(MyModel);
    }

    {
        const model = await controller.createModel3('foo');
        expect(model).toBeInstanceOf(MyModel);
    }

    {
        const value = await controller.createModel4('foo');
        expect(value).toBeInstanceOf(BehaviorSubject);
        expect(value.value).toBeInstanceOf(MyModel);
    }
});

test('wrong arguments', async () => {
    @entity.name('model/promise2')
    class MyModel {
        constructor(public id: number) {
        }
    }

    class Controller {
        @rpc.action()
        async getProduct(id: number & Positive): Promise<MyModel> {
            return new MyModel(id);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    await controller.getProduct(1);

    {
        await expect(controller.getProduct(undefined as any)).rejects.toThrow('args.id(type): Cannot convert undefined to number');
    }

    {
        await expect(controller.getProduct('23' as any)).rejects.toThrow('args.id(type): Cannot convert 23 to number');
    }

    {
        await expect(controller.getProduct(NaN as any)).rejects.toThrow('args.id(type): Cannot convert NaN to number');
    }

    {
        await expect(controller.getProduct(-1)).rejects.toThrow('id(positive): Number needs to be positive');
    }
});

test('di', async () => {
    class Controller {
        constructor(protected connection: RpcKernelConnection, protected sessionState: SessionState) {
        }

        @rpc.action()
        hasSession(): boolean {
            return this.sessionState.getSession() instanceof Session;
        }

        @rpc.action()
        hasConnection(): boolean {
            return this.connection instanceof RpcKernelConnection;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'test');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('test');

    expect(await controller.hasConnection()).toBe(true);
    expect(await controller.hasSession()).toBe(true);
});

test('connect disconnect', async () => {
    class Controller {
        constructor(protected connection: RpcKernelConnection) {
        }

        @rpc.action()
        test(): void {
        }

        @rpc.action()
        bye(): void {
            this.connection.close();
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    let triggered = 0;
    client.transporter.disconnected.subscribe(() => triggered++);

    expect(client.transporter.isConnected()).toBe(false);
    await client.connect();
    expect(client.transporter.isConnected()).toBe(true);
    await client.disconnect();
    expect(client.transporter.isConnected()).toBe(false);
    expect(triggered).toBe(1);

    await controller.test();
    expect(client.transporter.isConnected()).toBe(true);
    await client.disconnect();
    expect(client.transporter.isConnected()).toBe(false);
    expect(triggered).toBe(2);

    await controller.test();
    expect(client.transporter.isConnected()).toBe(true);
    await controller.bye();
    expect(client.transporter.isConnected()).toBe(false);
    expect(triggered).toBe(3);

    await controller.test();
    expect(client.transporter.isConnected()).toBe(true);
});


test('types', async () => {
    @entity.name('types/model')
    class Model {

    }

    class Controller {
        @rpc.action()
        test(): { total: number, items: Model[] } {
            return { total: 5, items: [new Model] };
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const res = await controller.test();
        expect(res.total).toBe(5);
        expect(res.items.length).toBe(1);
        expect(res.items[0]).toBeInstanceOf(Model);
    }
});

test('disable type reuse', async () => {
    //per default its tried to reuse models that have an entity name set. with disableTypeReuse this can be disabled

    @entity.name('type/reuse')
    class Model {
        child?: Model;

        constructor(public title: string) {
        }
    }

    class Controller {
        @rpc.action()
        test(): Model {
            return new Model('123');
        }

        @rpc.action()
        testDeep(): { total: number, items: Model[] } {
            return { total: 5, items: [new Model('123')] };
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    client.disableTypeReuse();
    const controller = client.controller<Controller>('myController');

    {
        const res = await controller.test();
        expect(res).not.toBeInstanceOf(Model);
        expect(res).toEqual({ title: '123' });
        expect(getClassName(res)).toBe('Model');
    }

    {
        const res = await controller.testDeep();
        expect(res.items[0]).not.toBeInstanceOf(Model);
        expect(res.items[0]).toEqual({ title: '123' });
    }
});
