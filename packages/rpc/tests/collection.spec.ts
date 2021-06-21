import 'reflect-metadata';
import { entity, plainToClass, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { DirectClient } from '../src/client/client-direct';
import { Collection } from '../src/collection';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';
import { sleep } from '@deepkit/core';


test('collection basic', () => {
    class Item {
        version: number = 0;

        constructor(
            public readonly id: number,
            public readonly name: string,
        ) { }
    }

    const collection = new Collection(Item);
    const item1 = new Item(1, 'Item 1');
    const item2 = new Item(2, 'Item 2');
    const item3 = new Item(3, 'Item 3');

    collection.set([item1, item2]);
    expect(collection.count()).toBe(2);
    expect(collection.has(item1.id)).toBe(true);
    expect(collection.has(item2.id)).toBe(true);
    expect(collection.get(item2.id)).toBe(item2);
    expect(collection.has(item3.id)).toBe(false);

    collection.add(item3);
    expect(collection.has(item3.id)).toBe(true);
    expect(collection.index(item3)).toBe(2);
    expect(collection.count()).toBe(3);
    expect(collection.getPageOf(item1, 2)).toBe(0);
    expect(collection.getPageOf(item2, 2)).toBe(0);
    expect(collection.getPageOf(item3, 2)).toBe(1);

    //adding same id just replace it
    collection.add(item3);
    expect(collection.has(item3.id)).toBe(true);
    expect(collection.index(item3)).toBe(2);
    expect(collection.count()).toBe(3);
    expect(collection.getPageOf(item3, 2)).toBe(1);

    const map = collection.map();
    expect(map.get(item3.id)).toBe(item3);

    expect(collection.ids()).toEqual([
        item1.id, item2.id, item3.id
    ]);

    expect(collection.empty()).toBe(false);
    collection.reset();
    expect(collection.count()).toBe(0);
    expect(collection.empty()).toBe(true);
});


test('collection state', async () => {
    @entity.name('collection/simple/model')
    class MyModel {
        @t id: number = 0;
    }

    class Controller {
        protected collection = new Collection(MyModel);

        @rpc.action()
        fix(): Collection<MyModel> {
            this.collection.set([
                plainToClass(MyModel, { id: 1 }),
                plainToClass(MyModel, { id: 2 }),
                plainToClass(MyModel, { id: 3 }),
            ]);
            this.collection.state.total = 150;
            return this.collection;
        }

        @rpc.action()
        changedModel(): Collection<MyModel> {
            const collection = new Collection(MyModel);
            collection.model.itemsPerPage = 30;
            collection.model.skip = 30;
            collection.model.limit = 5;
            collection.model.sort = { id: 'asc' };
            return collection;
        }

        @rpc.action()
        add(id: number): void {
            this.collection.add({ id });
        }

        @rpc.action()
        remove(id: number): void {
            this.collection.remove(id);
        }

        @rpc.action()
        set(@t.array(t.number) id: number[]): void {
            const items = id.map(v => { return { id: v } });
            this.collection.set(items);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const c = await controller.changedModel();
        expect(c.model.itemsPerPage).toBe(30);
        expect(c.model.skip).toBe(30);
        expect(c.model.limit).toBe(5);
        expect(c.model.sort).toEqual({ id: 'asc' });
    }

    {
        const c = await controller.fix();
        expect(c.classType).toBe(MyModel);
        expect(c.state.total).toBe(150);
        expect(c.all().length).toBe(3);
        expect(c.all()[0]).toBeInstanceOf(MyModel);
        expect(c.all()[0].id).toBe(1);
        expect(c.all()[1]).toBeInstanceOf(MyModel);
        expect(c.all()[1].id).toBe(2);

        controller.add(4);
        await c.nextStateChange;
        expect(c.all().length).toBe(4);
        expect(c.all()[3].id).toBe(4);

        controller.remove(1);
        await c.nextStateChange;
        expect(c.all().length).toBe(3);
        expect(c.all()[0].id).toBe(2);
        expect(c.all()[1].id).toBe(3);
        expect(c.all()[2].id).toBe(4);

        controller.set([10, 11,]);
        await c.nextStateChange;
        expect(c.all().length).toBe(2);
        expect(c.all()[0].id).toBe(10);
        expect(c.all()[1].id).toBe(11);

        c.unsubscribe();
        controller.set([55]);
        await sleep(0.1);

        //should not change anything, since we unsubscribed
        expect(c.all().length).toBe(2);
        expect(c.all()[0].id).toBe(10);
        expect(c.all()[1].id).toBe(11);
    }
});

