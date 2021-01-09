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
        @t version: number = 0;

        constructor(
            @t public id: number
        ) { }
    }

    class Controller {
        @rpc.action()
        @t.generic(MyModel)
        async getModel(id: number): Promise<EntitySubject<MyModel>> {
            //basically like a query to a database, where we know the ID only after resolving the query
            const subject = new EntitySubject(new MyModel(id));

            //data could come from database, file system, API (s3, etc)
            //we need to fix the issue with the race-condition between loading the data and subscribing to the entity-feed,
            //when each entity id gets its own pub/sub channel. This has major drawbacks tho when loading
            //tenthousand items in a Collection.

            //Either
            //1. The whole entity has a single channel
            //2. Each entity item gets its own channel

            //3. Use a single /patch channel, but filter sending to a subscriber based on what IDs he want
            //   This requires us to decode each message and read its content.
            //3.1. Use a single /add channel for subscribers interested in created items satisfying a certain filter



            //first idea: 
            // 1. load source, 
            // 2. subscribe to feed & retrieve last version from last known update
            // 3. if last version is different from loaded source, then 
            // 3.1. queue up all incoming updates
            // 3.2. load source again, just same query again
            // 3.3. apply valid queued updates
            // 4. now it's definitely the newest version on the client
            // - the question with this approach is: How likely is it that we need to enter 3?
            //   -> very likely when the item is changed frequently 
            //   -> at least 1 query, worst-case 2 full queries

            //second idea:
            // 1. load ID
            // 2. subscribe to feed & queue up all incoming updates
            // 3. load source
            // 4. send data, and send all valid queued updates as well
            // 5. now it's definitely the newest version on the client
            // - at least 2 queries, worst-case 2 as well.


            //third idea:
            // 1. load source
            // 2. subscribe to feed with the id & version.
            // 2.1. the feed holds in memory the last x operations, and sends whatever operation is necessary so that the subscriber has at the end the newest version
            //    This requires that the feed reads the message content
            // - at least 1 queries, worse-case 2 as well, but it should be very rare. We could log this and mitigate it by increasing the last-x-operations amount.
            // more cpu and memory usage on the broker.
            // => Does this work when I have 50k items in a collection? First I have to send 50k primary keys, which is for uuid 16byte in total 781kB. A LOT.


            //fourth idea
            // 1. Subscribe to entity change feed, cache all patches
            // 2. load entity
            // 3. send entity and forward outstanding patches from the change-feed

            //this sends change-feed now in the background
            //bla.subscribe(MyModel, id);

            return subject;
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