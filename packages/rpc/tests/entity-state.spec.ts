import { entity, t } from '@deepkit/type';
import { test } from '@jest/globals';
import 'reflect-metadata';
import { EntitySubject } from '../src/model';
import { DirectClient } from '../src/client/client-direct';
import { EntitySubjectStore } from '../src/client/entity-state';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';

test('EntitySubjectStore multi', () => {
    class MyModel {
        constructor(
            @t public id: number = 0
        ) { }
    }

    const store = new EntitySubjectStore();
    const m1 = new MyModel(1);
    store.register(m1);

    expect(store.isRegistered(1)).toBe(true);

    const fork1 = store.createFork(1);
    const fork2 = store.createFork(1);
    const fork3 = store.createFork(1);

    expect(fork1.value).toBe(m1);
    expect(fork2.value).toBe(m1);
    expect(fork3.value).toBe(m1);

    expect(store.getForkCount(1)).toBe(3);
    fork3.unsubscribe();

    expect(store.getForkCount(1)).toBe(2);

    const m2 = new MyModel(1);
    store.onSet(1, m2);

    expect(fork1.value).toBe(m2);
    expect(fork2.value).toBe(m2);
    expect(fork3.value).toBe(m1); //fork3 is unsubscribed, so it doesnt get the update

    fork2.unsubscribe();
    fork1.unsubscribe();

    expect(store.isRegistered(1)).toBe(false);
});

test('controller', async () => {
    @entity.name('collection/simple/model')
    class MyModel {
        constructor(
            @t public id: number = 0
        ) { }
    }

    class Controller {
        @rpc.action()
        @t.generic(MyModel)
        getModel(id: number): EntitySubject<MyModel> {
            return new EntitySubject(new MyModel(id));
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const m1 = await controller.getModel(55);
        expect(m1).toBeInstanceOf(EntitySubject);
        expect(m1.value.id).toBe(55);
        
        const m2 = await controller.getModel(55);
        expect(m2).toBeInstanceOf(EntitySubject);
        expect(m2.value.id).toBe(55);
        expect(m2.value).toBe(m1.value);
        expect(m2).not.toBe(m1);
        
        const m3 = await controller.getModel(1231325);
        expect(m3).toBeInstanceOf(EntitySubject);
        expect(m3.value.id).toBe(1231325);
    }
});