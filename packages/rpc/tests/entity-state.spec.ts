import { entity, getClassSchema, plainToClass, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { EntitySubject, rpcEntityPatch, RpcTypes } from '../src/model';
import { DirectClient } from '../src/client/client-direct';
import { EntitySubjectStore } from '../src/client/entity-state';
import { rpc } from '../src/decorators';
import { RpcConnectionWriter, RpcKernel, RpcKernelConnection } from '../src/server/kernel';
import { ClassType } from '@deepkit/core';
import { Injector } from '@deepkit/injector';

test('EntitySubjectStore multi', () => {
    class MyModel {
        @t version: number = 0;

        constructor(
            @t public id: number = 0
        ) { }
    }

    const store = new EntitySubjectStore(getClassSchema(MyModel));
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
    class Config {
        @t timeout: number = 0;
        @t logs: boolean = true;
    }

    @entity.name('collection/simple/model')
    class MyModel {
        @t version: number = 0;
        @t title: string = 'foo';
        @t config: Config = new Config;

        constructor(
            @t public id: number
        ) { }
    }

    class Controller {
        constructor(protected connection: RpcKernelConnection) {

        }

        @rpc.action()
        async getModel(id: number): Promise<EntitySubject<MyModel>> {
            const model = new MyModel(id);
            model.title = 'foo';
            const subject = new EntitySubject(model);
            return subject;
        }

        @rpc.action()
        async getModelWithChange(id: number): Promise<EntitySubject<MyModel>> {
            const model = new MyModel(id);
            const subject = new EntitySubject(model);

            setTimeout(() => {
                this.connection.createMessageBuilder()
                    .composite(RpcTypes.Entity)
                    .add(RpcTypes.EntityPatch, rpcEntityPatch, {
                        entityName: getClassSchema(MyModel).getName(),
                        id: model.id,
                        version: model.version + 1,
                        patch: { $set: { title: 'bar', config: plainToClass(Config, { timeout: 44, logs: false }) } }
                    }).send();
            }, 10);

            return subject;
        }
    }

    const kernel = new class extends RpcKernel {
        createConnection(writer: RpcConnectionWriter): RpcKernelConnection {
            let connection: RpcKernelConnection;
            const injector = {
                get(classType: ClassType) {
                    return new classType(connection);
                }
            } as Injector;
            connection = new RpcKernelConnection(writer, this.connections, this.controllers, this.security, injector || this.injector, this.peerExchange);
            return connection;
        }
    };
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const m1 = await controller.getModel(55);
        expect(m1).toBeInstanceOf(EntitySubject);
        expect(m1.value).toBeInstanceOf(MyModel);
        expect(m1.value.id).toBe(55);
        expect(m1.value.title).toBe('foo');

        const m2 = await controller.getModel(55);
        expect(m2).toBeInstanceOf(EntitySubject);
        expect(m2.value).toBeInstanceOf(MyModel);
        expect(m2.value.id).toBe(55);
        expect(m2.value.title).toBe('foo');
        expect(m2.value).toBe(m1.value);
        expect(m2).not.toBe(m1);

        const m3 = await controller.getModel(1231325);
        expect(m3).toBeInstanceOf(EntitySubject);
        expect(m3.value).toBeInstanceOf(MyModel);
        expect(m3.value).not.toBe(m1.value);
        expect(m3.value.title).toBe('foo');
        expect(m3.value.id).toBe(1231325);
    }

    {
        const m1 = await controller.getModelWithChange(55);
        expect(m1).toBeInstanceOf(EntitySubject);
        expect(m1.value).toBeInstanceOf(MyModel);
        expect(m1.value.id).toBe(55);
        expect(m1.value.title).toBe('foo');
        expect(m1.value.config).toBeInstanceOf(Config);
        expect(m1.value.config.timeout).toBe(0);
        expect(m1.value.config.logs).toBe(true);

        await m1.nextStateChange;
        expect(m1.value.title).toBe('bar');
        expect(m1.value.config).toBeInstanceOf(Config);
        expect(m1.value.config.timeout).toBe(44);
        expect(m1.value.config.logs).toBe(false);
    }
});
