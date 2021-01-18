import { sleep } from '@deepkit/core';
import { nextValue } from '@deepkit/core-rxjs';
import { Database } from '@deepkit/orm';
import { Collection, EntityState, EntitySubject, IdInterface, rpc, RpcKernelConnection } from '@deepkit/rpc';
import { Entity, getClassSchema, t, uuid } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { fail } from 'assert';
import 'reflect-metadata';
import { BehaviorSubject, Observable } from 'rxjs';
import { Broker, DirectBroker } from '../src/broker/broker';
import { LiveDatabase } from '../src/database/live-database';
import { createTestingApp as createTestingAppOriginal } from '../src/testing';

// make it overwrideable
declare var createTestingApp: typeof createTestingAppOriginal;
global['createTestingApp'] ||= createTestingAppOriginal;

class UserBase implements IdInterface {
    @t.primary.uuid
    id: string = uuid();

    @t
    version: number = 1;

    constructor(@t public name: string) {
    }
}

test('test broker', async () => {
    @Entity('user_broker_test')
    class User extends UserBase { }

    const testing = createTestingApp({});
    await testing.startServer();

    const broker = testing.app.get(Broker);
    expect(broker).toBeInstanceOf(DirectBroker);

    const subject = new BehaviorSubject<any>(undefined);
    await broker.entityChannel(User).subscribe(v => {
        subject.next(v);
    });

    await broker.entityChannel(User).publishPatch(1, 1, { $set: { username: true } }, {});
    await sleep(0);
    expect(subject.value).not.toBe(undefined);
    expect(subject.value.id).toBe(1);
    expect(subject.value.patch).toEqual({ $set: { username: true } });
});


test('test increase', async () => {
    @Entity('user_increase')
    class User extends UserBase {
        @t
        connections: number = 0;
    }

    @rpc.controller('test')
    class TestController {
        constructor(private liveDatabase: LiveDatabase, private database: Database) {
            this.liveDatabase.enableChangeFeed(User);
        }

        @rpc.action()
        async start() {
            await this.database.query(User).deleteMany();
            const user = new User('peter');
            await this.database.persist(user);
        }

        @rpc.action()
        async increase(i: number) {
            await this.database.query(User).patchOne({ $inc: { connections: i } });
        }

        @rpc.action()
        @t.generic(User)
        async user(): Promise<EntitySubject<User>> {
            return await this.liveDatabase.query(User).findOne();
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [User]);
    await testing.startServer();
    const client = testing.createRpcClient();

    const testController = client.controller<TestController>('test');

    await testController.start();

    const user = await testController.user();
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(0);

    testController.increase(1);
    console.log('wait 1');
    await user.nextStateChange;
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(1);

    testController.increase(-5);
    console.log('wait 2');
    await user.nextStateChange;
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(-4);

    testController.increase(1);
    console.log('wait 3');
    await user.nextStateChange;

    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(-3);
});

test('test entity sync list', async () => {
    @Entity('user1')
    class User extends UserBase {
    }

    @rpc.controller('test')
    class TestController {
        constructor(private liveDatabase: LiveDatabase, private database: Database) {
            this.liveDatabase.enableChangeFeed(User);
        }

        @rpc.action()
        async users(): Promise<Collection<User>> {
            await this.database.query(User).deleteMany();
            const peter = new User('Peter 1');

            await this.database.persist(peter);
            await this.database.persist(new User('Peter 2'));
            await this.database.persist(new User('Guschdl'));
            await this.database.persist(new User('Ingrid'));

            const items = await this.database.query(User).find();
            expect(items[0].id).toBe(peter.id);
            expect(items.length).toBe(4);

            setTimeout(async () => {
                console.log('Peter 3 added');
                await this.database.persist(new User('Peter 3'));
            }, 500);

            setTimeout(async () => {
                console.log('Peter 1 patched');
                await this.database.query(User).filter({ id: peter.id }).patchOne({ name: 'Peter patched' });
            }, 1000);

            const collection = await this.liveDatabase.query(User).filter({
                name: { $regex: /Peter/ }
            }).find();
            return collection;
        }

        @rpc.action()
        async addUser(name: string) {
            await this.database.persist(new User(name));
            return false;
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [User]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const testController = client.controller<TestController>('test');

    const users: Collection<User> = await testController.users();

    expect(users.count()).toBe(2);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');

    console.log('users.nextStateChange 1');
    await users.nextStateChange;
    expect(users.count()).toBe(3);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');
    expect(users.all()[2].name).toBe('Peter 3');

    console.log('users.nextStateChange 2');
    await users.nextStateChange;
    expect(users.count()).toBe(3);
    expect(users.all()[0].name).toBe('Peter patched');

    const testController2 = testing.createRpcClient().controller<TestController>('test');
    testController2.addUser('Peter 20');

    console.log('users.nextStateChange 3');
    await users.nextStateChange;
    expect(users.count()).toBe(4);
    await users.unsubscribe();

    //unsubscribe is sent async, so we wait a bit.
    await sleep(0.1);

    await testController2.addUser('Peter 30');

    await sleep(0.1);
    //still 4, since we unsubscribed from feed
    expect(users.count()).toBe(4);
});

test('test entity sync list: remove', async () => {
    @Entity('user2')
    class User extends UserBase {
    }

    @rpc.controller('test')
    class TestController {
        constructor(private liveDatabase: LiveDatabase, private database: Database) {
            this.liveDatabase.enableChangeFeed(User);
        }

        @rpc.action()
        async users(): Promise<Collection<User>> {
            await this.database.query(User).deleteMany();

            await this.database.persist(new User('Peter 1'));
            await this.database.persist(new User('Peter 2'));

            return await this.liveDatabase.query(User).filter({
                name: { $regex: /Peter/ }
            }).find();
        }

        @rpc.action()
        async removeAll() {
            await this.database.query(User).deleteMany();
        }

        @rpc.action()
        async remove(id: string) {
            await this.database.query(User).filter({ id }).deleteOne();
        }

        @rpc.action()
        async addUser(name: string): Promise<string> {
            const user = new User(name);
            await this.database.persist(user);
            return user.id;
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [User]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const testController = client.controller<TestController>('test');

    const users: Collection<User> = await testController.users();

    expect(users.count()).toBe(2);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');

    let peter3Id: any;
    testController.addUser('Peter 3').then(v => peter3Id = v);
    console.log('wait peter3Id');
    await users.nextStateChange;
    expect(users.count()).toBe(3);

    //this triggers no nextStateChange as the filter doesn't match
    await testController.addUser('Nix da');

    testController.remove(peter3Id);

    console.log('wait remove peter3Id');
    await users.nextStateChange;
    expect(users.count()).toBe(2);

    testController.removeAll();
    console.log('wait removeAll');
    await users.nextStateChange;
    expect(users.count()).toBe(0);

    await users.unsubscribe();
    console.log('done');
});

// test('test entity sync item', async () => {
//     @Entity('user3')
//     class User extends UserBase {
//     }

//     @rpc.controller('test')
//     class TestController {
//         constructor(
//             private connection: RpcKernelConnection,
//             private liveDatabase: LiveDatabase,
//             private database: Database
//         ) {
//             this.liveDatabase.enableChangeFeed(User);
//         }

//         @rpc.action()
//         async user(): Promise<EntitySubject<User>> {
//             await this.database.query(User).deleteMany();
//             await this.database.persist(new User('Guschdl'));

//             const peter = new User('Peter 1');
//             await this.database.persist(peter);

//             this.connection.setTimeout(async () => {
//                 await this.database.query(User).filter({id: peter.id}).patchOne({name: 'Peter patched'});
//             }, 20);

//             this.connection.setTimeout(async () => {
//                 await this.database.query(User).filter({id: peter.id}).deleteOne();
//             }, 280);

//             return await this.liveDatabase.query(User).filter({
//                 name: {$regex: /Peter/}
//             }).findOne();
//         }
//     }

//     const {client, close, app} = await createServerClientPair('test entity sync item', [TestController], [User]);
//     const test = client.controller<TestController>('test');

//     {
//         const user = await test.user();
//         expect(user).toBeInstanceOf(EntitySubject);
//         expect(user.getValue()).toBeInstanceOf(User);
//         expect(user.getValue().name).toBe('Peter 1');
//         const userId = user.getValue().id;

//         const entityStorage = app.lastConnectionInjector!.get(EntityStorage);
//         await user.nextStateChange;
//         expect(user.getValue().name).toBe('Peter patched');
//         expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(true);

//         await user.nextStateChange;
//         expect(user.deleted).toBe(true);

//         // there are two ways to stop syncing that entity:
//         // call user.unsubscribe() or when server sent next(undefined), which means it got deleted.
//         expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(false);
//     }

//     {
//         const user = await test.user();
//         expect(user).toBeInstanceOf(EntitySubject);
//         expect(user.getValue()).toBeInstanceOf(User);
//         expect(user.getValue().name).toBe('Peter 1');
//         const userId = user.getValue().id;

//         const entityStorage = app.lastConnectionInjector!.get(EntityStorage);
//         expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(true);

//         //this happens async, since we sent a message to the server that
//         //we want to stop syncing.
//         user.unsubscribe();
//         await sleep(0.1);

//         expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(false);
//     }

//     await close();
// });

test('test entity sync item undefined', async () => {
    @Entity('user4')
    class User extends UserBase {
    }

    @rpc.controller('test')
    class TestController {
        constructor(
            private liveDatabase: LiveDatabase,
            private database: Database,
        ) {
            this.liveDatabase.enableChangeFeed(User);
        }

        @rpc.action()
        async user(): Promise<EntitySubject<User> | undefined> {
            await this.database.query(User).deleteMany();
            await this.database.persist(new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.persist(peter);

            return await this.liveDatabase.query(User).filter({
                name: { $regex: /Marie/ }
            }).findOneOrUndefined();
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [User]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const controller = client.controller<TestController>('test');

    const user = await controller.user();
    expect(user).toBeUndefined();
});


test('test entity sync count', async () => {
    @Entity('user5')
    class User extends UserBase {
    }

    @rpc.controller('test')
    class TestController {
        constructor(
            private connection: RpcKernelConnection,
            private liveDatabase: LiveDatabase,
            private database: Database,
        ) {
            this.liveDatabase.enableChangeFeed(User);
        }

        @rpc.action()
        async userCount(): Promise<Observable<number>> {
            await this.database.query(User).deleteMany();
            await this.database.persist(new User('Guschdl'));
            const peter1 = new User('Peter 1');

            this.connection.setTimeout(async () => {
                console.log('add peter1');
                await this.database.persist(peter1);
            }, 100);

            this.connection.setTimeout(async () => {
                console.log('add peter2');
                await this.database.persist(new User('Peter 2'));
            }, 150);

            this.connection.setTimeout(async () => {
                console.log('remove peter1');
                await this.database.query(User).filter({ id: peter1.id }).deleteOne();
            }, 200);

            return await this.liveDatabase.query(User).filter({
                name: { $regex: /Peter/ }
            }).count();
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [User]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const controller = client.controller<TestController>('test');

    const result = await controller.userCount();

    let i: number = 0;
    result.subscribe((next: any) => {
        console.log('next', i, next);
        if (i === 0) {
            //first count is not found
            expect(next).toBe(0);
        }
        if (i === 1) {
            //we created peter 1
            expect(next).toBe(1);
        }
        if (i === 2) {
            //we created peter 2
            expect(next).toBe(2);
        }
        if (i === 3) {
            //we deleted peter 1
            expect(next).toBe(1);
        }

        i++;
    });

    const userCount = new BehaviorSubject<number>(0);
    expect(userCount.getValue()).toBe(0);

    result.subscribe((next) => {
        userCount.next(next);
    });

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(0);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(1);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(2);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(1);

    expect(i).toBe(4);
});


test('test entity collection unsubscribe + findOne', async () => {
    @Entity('jobTest')
    class Job implements IdInterface {
        @t.primary.uuid
        id: string = uuid();

        @t
        version: number = 0;

        constructor(@t public name: string) {
        }
    }

    expect(getClassSchema(Job).name).toBe('jobTest');

    @rpc.controller('test')
    class TestController {
        constructor(
            private liveDatabase: LiveDatabase,
            private database: Database,
        ) {
            this.liveDatabase.enableChangeFeed(Job);
        }

        @rpc.action()
        async init() {
            await this.database.query(Job).deleteMany();
            await this.database.persist(new Job('Peter 1'));
            await this.database.persist(new Job('Peter 2'));
            await this.database.persist(new Job('Peter 3'));

            await this.database.persist(new Job('Marie 1'));
            await this.database.persist(new Job('Marie 2'));
        }

        @rpc.action()
        async getJobs(): Promise<Collection<Job>> {
            return await this.liveDatabase.query(Job).filter({
                name: { $regex: /Peter/ }
            }).find();
        }

        @rpc.action()
        async addJob(name: string): Promise<void> {
            return await this.database.persist(new Job(name));
        }

        @rpc.action()
        async getJob(id: string): Promise<EntitySubject<Job>> {
            return await this.liveDatabase.query(Job).filter({
                id: id
            }).findOne();
        }

        @rpc.action()
        async getJobByName(name: string): Promise<EntitySubject<Job>> {
            return await this.liveDatabase.query(Job).filter({
                name: name
            }).findOne();
        }

        @rpc.action()
        async rmJobByName(name: string): Promise<void> {
            await this.database.query(Job).filter({
                name: name
            }).deleteOne();
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [Job]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const controller = client.controller<TestController>('test');
    const entityState: EntityState = (client as any).actionClient.entityState;

    await controller.init();

    try {
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(0);

        const jobs = await controller.getJobs();

        expect(jobs.count()).toBe(3);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob = await controller.getJob(firstId);
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        expect(firstJob.getValue()).toBeInstanceOf(Job);
        expect(jobs.get(firstId) === jobs.all()[0]).toBe(true);

        await firstJob.unsubscribe();
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        await jobs.unsubscribe();
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(0);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
    } catch (e) {
        fail(e);
    }

    try {
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
        const jobs = await controller.getJobs();

        expect(jobs.count()).toBe(3);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob = await controller.getJob(firstId);
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        expect(firstJob.getValue()).toBeInstanceOf(Job);
        expect(jobs.get(firstId) === jobs.all()[0]).toBe(true);

        await jobs.unsubscribe();
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        await firstJob.unsubscribe();
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(0);
    } catch (e) {
        fail(e);
    }

    try {
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
        const jobs = await controller.getJobs();

        expect(jobs.count()).toBe(3);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob1 = await controller.getJob(firstId);
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstJob2 = await controller.getJob(firstId);
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(3);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstJob3 = await controller.getJobByName('Marie 1');
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(3);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(4);

        await firstJob1.unsubscribe();
        await firstJob2.unsubscribe();

        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(4);
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        controller.addJob('Peter 10');
        await jobs.nextStateChange;
        expect(jobs.count()).toBe(4);

        controller.rmJobByName('Peter 10');
        await jobs.nextStateChange;
        expect(jobs.count()).toBe(3);

        await jobs.unsubscribe();
        expect(entityState.getStore(Job).getForkCount(firstId)).toBe(0);
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(1);

        await firstJob3.unsubscribe();
        expect(entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
    } catch (e) {
        fail(e);
    }
});


test('test entity collection pagination', async () => {
    @Entity('paginate/item')
    class Item implements IdInterface {
        @t.primary.uuid
        id: string = uuid();

        @t
        version: number = 0;

        constructor(
            @t public name: string,
            @t public nr: number = 0,
            @t public clazz: string = 'a',
            @t.uuid public owner: string
        ) {
        }
    }

    @rpc.controller('test')
    class TestController {
        constructor(
            private connection: RpcKernelConnection,
            private liveDatabase: LiveDatabase,
            private database: Database
        ) {
            this.liveDatabase.enableChangeFeed(Item);
        }

        @rpc.action()
        async init() {
            await this.database.query(Item).deleteMany();

            const promises: Promise<any>[] = [];
            const clazzes = ['a', 'b', 'c'];
            const owners = ['3f63154d-4121-4f5c-a297-afc1f8f453fd', '4c349fe0-fa33-4e10-bb17-e25f13e4740e'];

            for (let i = 0; i < 100; i++) {
                promises.push(this.database.persist(new Item('name_' + i, i, clazzes[i % 3], owners[i % 2])));
            }

            await Promise.all(promises);
            console.log('init done!');
            const c = await this.database.query(Item).count();
            expect(c).toBe(100);
        }

        @rpc.action()
        async add(clazz: string, nr: number): Promise<void> {
            const item = new Item('name_' + nr, nr, clazz, '3f63154d-4121-4f5c-a297-afc1f8f453fd');
            await this.database.persist(item);
        }

        @rpc.action()
        async remove(name: string): Promise<void> {
            await this.database.query(Item).filter({ name }).deleteOne();
        }

        @rpc.action()
        async findByClass(clazz: string): Promise<Collection<Item>> {
            return this.liveDatabase.query(Item)
                .filter({ clazz: { $parameter: 'clazz' } })
                .parameter('clazz', clazz)
                .itemsPerPage(10)
                .page(1)
                .sort({ nr: 'asc' })
                .find();
        }

        @rpc.action()
        async findByOwner(owner: string): Promise<Collection<Item>> {
            return this.liveDatabase.query(Item)
                .filter({ owner: owner })
                .find();
        }

        @rpc.action()
        async findByOwnerPaged(owner: string): Promise<Collection<Item>> {
            return this.liveDatabase.query(Item)
                .filter({ owner: owner })
                .itemsPerPage(30)
                .page(2)
                .find();
        }
    }

    const testing = createTestingApp({ controllers: [TestController] }, [Item]);
    await testing.startServer();
    const client = testing.createRpcClient();
    const controller = client.controller<TestController>('test');

    await controller.init();
    console.log('test.init done');

    {
        console.log('findByOwner');
        const items = await controller.findByOwner('3f63154d-4121-4f5c-a297-afc1f8f453fd');
        expect(items.getPage()).toBe(1);
        console.log('findByOwner done');
        expect(items.count()).toBe(50);

        controller.add('a', 1000);
        console.log('item added a');
        await items.nextStateChange;
        console.log('done');
        expect(items.count()).toBe(51);

        controller.remove('name_1000');
        console.log('item removed name_1000');
        await items.nextStateChange;
        console.log('done');
        expect(items.count()).toBe(50);
    }

    {
        const items = await controller.findByOwnerPaged('3f63154d-4121-4f5c-a297-afc1f8f453fd');
        console.log('items.model', items.model);
        expect(items.getPage()).toBe(2);
        expect(items.getTotal()).toBe(50);
        expect(items.getItemsPerPage()).toBe(30);
        expect(items.count()).toBe(20); //we got 50 total, 30 per page. 30,20, we are at second page.

        controller.add('a', 1001);
        await items.nextStateChange;
        expect(items.count()).toBe(21);

        controller.remove('name_1001');
        await items.nextStateChange;
        expect(items.count()).toBe(20);
        await items.unsubscribe();
    }

    {
        const items = await controller.findByClass('a');
        expect(items.getTotal()).toBe(34);
        expect(items.getItemsPerPage()).toBe(10);
        expect(items.getSort()).toEqual({ "nr": "asc" });
        expect(items.getParameter('clazz')).toBe('a');

        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);

        await items.setParameter('clazz', 'b').apply();
        expect(items.getTotal()).toBe(33);
        expect(items.getItemsPerPage()).toBe(10);
        expect(items.getSort()).toEqual({ "nr": "asc" });
        expect(items.getParameter('clazz')).toBe('b');

        expect(items.all()[0].nr).toBe(1);
        expect(items.all()[9].nr).toBe(28);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(33);
        expect(items.getPages()).toBe(4);
        await items.unsubscribe();
    }

    {
        const items = await controller.findByClass('a');

        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);

        console.log('swap order');
        await items.orderByField('nr', 'desc').apply();
        expect(items.all()[0].nr).toBe(99);
        expect(items.all()[9].nr).toBe(72);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);

        console.log('swap order back');
        await items.orderByField('nr').apply();
        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);

        controller.remove('name_27');
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(30);
        expect(items.getTotal()).toBe(33);
        expect(items.getPages()).toBe(4);

        controller.remove('name_0');
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(3);
        expect(items.all()[9].nr).toBe(33);
        expect(items.getTotal()).toBe(32);
        expect(items.getPages()).toBe(4);

        //shouldn't change anything
        controller.add('a', 101);
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(3);
        expect(items.all()[9].nr).toBe(33);
        expect(items.count()).toBe(10);
        expect(items.getTotal()).toBe(33);
        expect(items.getPages()).toBe(4);

        //should change a lot
        controller.add('a', -1);
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(-1);
        expect(items.all()[9].nr).toBe(30);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);

        await items.setPage(2).apply();
        expect(items.count()).toBe(10);
        expect(items.all()[0].nr).toBe(33);
        expect(items.all()[9].nr).toBe(60);
        expect(items.getTotal()).toBe(34);
        expect(items.getPages()).toBe(4);
        items.unsubscribe();
    }
});
