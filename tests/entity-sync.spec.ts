import 'jest';
import 'reflect-metadata';
import {Action, Collection, Controller, EntitySubject, IdInterface, ReactiveSubQuery} from "@marcj/glut-core";
import {ClientConnection, EntityStorage, ExchangeDatabase} from "@marcj/glut-server";
import {closeAllCreatedServers, createServerClientPair} from "./util";
import {Entity, f, getClassSchema, uuid} from '@marcj/marshal';
import {BehaviorSubject, Observable} from 'rxjs';
import {nextValue} from '@marcj/estdlib-rxjs';
import {sleep} from '@marcj/estdlib';
import {Database} from '@marcj/marshal-mongo';

// @ts-ignore
global['WebSocket'] = require('ws');

afterAll(async () => {
    await closeAllCreatedServers();
});

// const Promise = require('bluebird');
// Promise.longStackTraces(); //needs to be disabled in production since it leaks memory
// global.Promise = Promise;

class UserBase implements IdInterface {
    @f.primary().uuid()
    id: string = uuid();

    @f
    version: number = 1;

    constructor(@f public name: string) {
        this.name = name;
    }
}

test('test increase', async () => {
    @Entity('user_increase')
    class User extends UserBase {
        @f
        connections: number = 0;
    }

    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private exchangeDatabase: ExchangeDatabase) {
        }

        @Action()
        async start() {
            await this.exchangeDatabase.deleteMany(User, {});
            const user = new User('peter');
            await this.exchangeDatabase.add(user);
        }

        @Action()
        async increase(i: number) {
            await this.exchangeDatabase.increase(User, {}, {connections: i});
        }

        @Action()
        async user(): Promise<EntitySubject<User>> {
            return await this.storage.findOne(User, {});
        }
    }

    const {client} = await createServerClientPair('test increase', [TestController], [User]);
    const testController = client.controller<TestController>('test');

    await testController.start();

    const user = await testController.user();
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(0);

    testController.increase(1);
    console.log('wait');
    await user.nextStateChange;
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(1);

    testController.increase(-5);
    console.log('wait');
    await user.nextStateChange;
    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(-4);

    testController.increase(1);
    await user.nextStateChange;

    expect(user.value.name).toBe('peter');
    expect(user.value.connections).toBe(-3);
});

test('test entity sync list', async () => {
    @Entity('user1')
    class User extends UserBase {
    }

    @Controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async users(): Promise<Collection<User>> {
            await this.database.deleteMany(User, {});
            const peter = new User('Peter 1');

            await this.database.add(peter);
            await this.database.add(new User('Peter 2'));
            await this.database.add(new User('Guschdl'));
            await this.database.add(new User('Ingrid'));

            const ids = await this.database.getIds(User);
            expect(ids[0]).toBe(peter.id);
            expect(ids.length).toBe(4);

            setTimeout(async () => {
                console.log('Peter 3 added');
                await this.database.add(new User('Peter 3'));
            }, 500);

            setTimeout(async () => {
                console.log('Peter 1 patched');
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 1000);

            return await this.storage.collection(User).filter({
                name: {$regex: /Peter/}
            }).find();
        }

        @Action()
        async addUser(name: string) {
            await this.database.add(new User(name));
            return false;
        }
    }

    const {client, close, createControllerClient} = await createServerClientPair('test entity sync list', [TestController], [User]);
    const testController = client.controller<TestController>('test');

    const users: Collection<User> = await testController.users();

    expect(users.count()).toBe(2);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');

    await users.nextStateChange;
    console.log('users.nextStateChange');
    expect(users.count()).toBe(3);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');
    expect(users.all()[2].name).toBe('Peter 3');

    await users.nextStateChange;
    expect(users.count()).toBe(3);
    expect(users.all()[0].name).toBe('Peter patched');

    const testController2 = createControllerClient<TestController>('test');
    await testController2.addUser('Peter 20');

    await users.nextStateChange;
    expect(users.count()).toBe(4);
    await users.unsubscribe();

    //unsubscribe is sent async, so we wait a bit.
    await sleep(0.1);

    await testController2.addUser('Peter 30');

    await sleep(0.1);
    //still 4, since we unsubscribed from feed
    expect(users.count()).toBe(4);

    await close();
});

test('test entity sync list: remove', async () => {
    @Entity('user2')
    class User extends UserBase {
    }

    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        @Action()
        async users(): Promise<Collection<User>> {
            await this.database.deleteMany(User, {});

            await this.database.add(new User('Peter 1'));
            await this.database.add(new User('Peter 2'));

            return await this.storage.collection(User).filter({
                name: {$regex: /Peter/}
            }).find();
        }

        @Action()
        async removeAll() {
            await this.database.deleteMany(User, {});
        }

        @Action()
        async remove(id: string) {
            await this.database.remove(User, id);
        }

        @Action()
        async addUser(name: string): Promise<string> {
            const user = new User(name);
            await this.database.add(user);
            return user.id;
        }
    }

    const {client, close} = await createServerClientPair('test entity sync list: remove', [TestController], [User]);
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
    await close();
});

test('test entity sync item', async () => {
    @Entity('user3')
    class User extends UserBase {
    }

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async user(): Promise<EntitySubject<User>> {
            await this.database.deleteMany(User, {});
            await this.database.add(new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(peter);

            this.connection.setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 20);

            this.connection.setTimeout(async () => {
                await this.database.remove(User, peter.id);
            }, 280);

            return await this.storage.findOne(User, {
                name: {$regex: /Peter/}
            });
        }
    }

    const {client, close, app} = await createServerClientPair('test entity sync item', [TestController], [User]);
    const test = client.controller<TestController>('test');

    {
        const user = await test.user();
        expect(user).toBeInstanceOf(EntitySubject);
        expect(user.getValue()).toBeInstanceOf(User);
        expect(user.getValue().name).toBe('Peter 1');
        const userId = user.getValue().id;

        const entityStorage = app.lastConnectionInjector!.get(EntityStorage);
        await user.nextStateChange;
        expect(user.getValue().name).toBe('Peter patched');
        expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(true);

        await user.nextStateChange;
        expect(user.deleted).toBe(true);

        // there are two ways to stop syncing that entity:
        // call user.unsubscribe() or when server sent next(undefined), which means it got deleted.
        expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(false);
    }

    {
        const user = await test.user();
        expect(user).toBeInstanceOf(EntitySubject);
        expect(user.getValue()).toBeInstanceOf(User);
        expect(user.getValue().name).toBe('Peter 1');
        const userId = user.getValue().id;

        const entityStorage = app.lastConnectionInjector!.get(EntityStorage);
        expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(true);

        //this happens async, since we sent a message to the server that
        //we want to stop syncing.
        user.unsubscribe();
        await sleep(0.1);

        expect(entityStorage.needsToBeSend(User, userId, 10000)).toBe(false);
    }

    await close();
});

test('test entity sync item undefined', async () => {
    @Entity('user4')
    class User extends UserBase {
    }

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async user(): Promise<EntitySubject<User> | undefined> {
            await this.database.deleteMany(User, {});
            await this.database.add(new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(peter);

            return await this.storage.findOneOrUndefined(User, {
                name: {$regex: /Marie/}
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity sync item undefined', [TestController], [User]);
    const test = client.controller<TestController>('test');

    const user = await test.user();
    expect(user).toBeUndefined();

    await close();
});


test('test entity sync count', async () => {
    @Entity('user5')
    class User extends UserBase {
    }

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async userCount(): Promise<Observable<number>> {
            await this.database.deleteMany(User, {});
            await this.database.add(new User('Guschdl'));
            const peter1 = new User('Peter 1');

            this.connection.setTimeout(async () => {
                console.log('add peter1');
                await this.database.add(peter1);
            }, 100);

            this.connection.setTimeout(async () => {
                console.log('add peter2');
                await this.database.add(new User('Peter 2'));
            }, 150);

            this.connection.setTimeout(async () => {
                console.log('remove peter1');
                await this.database.remove(User, peter1.id);
            }, 200);

            return await this.storage.count(User, {
                name: {$regex: /Peter/}
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity sync count', [TestController], [User]);
    const test = client.controller<TestController>('test');

    const result = await test.userCount();

    let i: number = 0;
    result.subscribe((next: any) => {
        console.log('next', next);
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

    result.subscribe(userCount);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(0);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(1);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(2);

    await nextValue(userCount);
    expect(userCount.getValue()).toBe(1);

    expect(i).toBe(4);

    await close();
});


test('test entity collection unsubscribe + findOne', async () => {

    @Entity('jobTest')
    class Job implements IdInterface {
        @f.primary().uuid()
        id: string = uuid();

        @f
        version: number = 0;

        constructor(@f public name: string) {
        }
    }

    expect(getClassSchema(Job).name).toBe('jobTest');

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private exchangeDatabase: ExchangeDatabase,
        ) {
        }

        @Action()
        async init() {
            await this.exchangeDatabase.deleteMany(Job, {});
            await this.exchangeDatabase.add(new Job('Peter 1'));
            await this.exchangeDatabase.add(new Job('Peter 2'));
            await this.exchangeDatabase.add(new Job('Peter 3'));

            await this.exchangeDatabase.add(new Job('Marie 1'));
            await this.exchangeDatabase.add(new Job('Marie 2'));
        }

        @Action()
        async getJobs(): Promise<Collection<Job>> {
            return await this.storage.collection(Job).filter({
                name: {$regex: /Peter/}
            }).find();
        }

        @Action()
        async addJob(name: string): Promise<void> {
            return await this.exchangeDatabase.add(new Job(name));
        }

        @Action()
        async getJob(id: string): Promise<EntitySubject<Job>> {
            return await this.storage.findOne(Job, {
                id: id
            });
        }

        @Action()
        async getJobByName(name: string): Promise<EntitySubject<Job>> {
            return await this.storage.findOne(Job, {
                name: name
            });
        }

        @Action()
        async rmJobByName(name: string): Promise<void> {
            await this.exchangeDatabase.deleteOne(Job, {
                name: name
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity collection unsubscribe + findOne', [TestController], [Job]);
    const test = client.controller<TestController>('test');

    await test.init();

    try {
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(0);

        const jobs = await test.getJobs();

        expect(jobs.count()).toBe(3);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob = await test.getJob(firstId);
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        expect(firstJob.getValue()).toBeInstanceOf(Job);
        expect(jobs.get(firstId) === jobs.all()[0]).toBe(true);

        await firstJob.unsubscribe();
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        await jobs.unsubscribe();
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(0);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
    } catch (e) {
        fail(e);
    }

    try {
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
        const jobs = await test.getJobs();

        expect(jobs.count()).toBe(3);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob = await test.getJob(firstId);
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        expect(firstJob.getValue()).toBeInstanceOf(Job);
        expect(jobs.get(firstId) === jobs.all()[0]).toBe(true);

        await jobs.unsubscribe();
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        await firstJob.unsubscribe();
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(0);
    } catch (e) {
        fail(e);
    }

    try {
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
        const jobs = await test.getJobs();

        expect(jobs.count()).toBe(3);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstId = jobs.all()[0].id;
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        const firstJob1 = await test.getJob(firstId);
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(2);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstJob2 = await test.getJob(firstId);
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(3);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(3);

        const firstJob3 = await test.getJobByName('Marie 1');
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(3);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(4);

        await firstJob1.unsubscribe();
        await firstJob2.unsubscribe();

        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(4);
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(1);

        test.addJob('Peter 10');
        await jobs.nextStateChange;
        expect(jobs.count()).toBe(4);

        test.rmJobByName('Peter 10');
        await jobs.nextStateChange;
        expect(jobs.count()).toBe(3);

        await jobs.unsubscribe();
        expect(client.entityState.getStore(Job).getForkCount(firstId)).toBe(0);
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(1);

        await firstJob3.unsubscribe();
        expect(client.entityState.getStore(Job).getEntitySubjectCount()).toBe(0);
    } catch (e) {
        fail(e);
    }

    await close();
});


test('test entity collection reactive find', async () => {
    @Entity('entitySyncTeam')
    class Team implements IdInterface {
        @f.primary().uuid()
        id: string = uuid();

        @f
        version: number = 0;

        constructor(@f public name: string) {
        }
    }

    @Entity('entitySyncUserTeam')
    class UserTeam {
        @f.primary().uuid()
        id: string = uuid();

        @f
        version: number = 0;

        constructor(
            @f.uuid() public teamId: string,
            @f.uuid() public userId: string,
        ) {
        }
    }

    @Entity('entitySyncUser')
    class User implements IdInterface {
        @f.primary().uuid()
        id: string = uuid();

        @f
        version: number = 0;

        constructor(@f public name: string) {
        }
    }

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: Database,
            private exchangeDatabase: ExchangeDatabase,
        ) {
        }

        @Action()
        async init() {
            await this.exchangeDatabase.deleteMany(User, {});
            await this.exchangeDatabase.deleteMany(Team, {});
            await this.database.query(UserTeam).deleteMany();

            const teamA = new Team('Team a');
            const teamB = new Team('Team b');

            await this.database.add(teamA);
            await this.database.add(teamB);

            const addUser = async (name: string, team: Team) => {
                const user = new User(name);
                await this.database.add(user);
                await this.database.add(new UserTeam(team.id, user.id));
            };

            await addUser('Peter 1', teamA);
            await addUser('Peter 2', teamA);
            await addUser('Marc 1', teamA);

            await addUser('Marie', teamB);
        }

        @Action()
        async unAssignUser(userName: string, teamName: string) {
            const user = await this.database.query(User).filter({name: userName}).findOne();
            const team = await this.database.query(Team).filter({name: teamName}).findOne();

            if (!user) throw new Error(`User ${userName} not found`);
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.deleteMany(UserTeam, {userId: user.id, teamId: team.id});
        }

        @Action()
        async getUserId(userName: string): Promise<string> {
            const user = await this.database.query(User).filter({name: userName}).findOne();
            if (!user) throw new Error(`User ${userName} not found`);

            return user.id;
        }

        @Action()
        async assignUser(userName: string, teamName: string) {
            const user = await this.database.query(User).filter({name: userName}).findOne();
            const team = await this.database.query(Team).filter({name: teamName}).findOne();

            if (!user) throw new Error(`User ${userName} not found`);
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.add(new UserTeam(team.id, user.id));
        }

        @Action()
        async removeTeam(teamName: string) {
            const team = await this.database.query(Team).filter({name: teamName}).findOne();
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.deleteOne(Team, {id: team.id});
        }

        @Action()
        async find(teamName: string): Promise<Collection<User>> {
            return this.storage.collection(User).filter({
                id: {
                    $sub: ReactiveSubQuery.createField(UserTeam, 'userId', {
                            teamId: {
                                $sub: ReactiveSubQuery.create(Team, {name: {$parameter: 'teamName'}})
                            }
                        }
                    )
                }
            })
                .parameter('teamName', teamName)
                .find();
        }
    }

    const {client, close} = await createServerClientPair('test entity collection reactive find', [TestController], [Team, UserTeam, User]);
    const test = client.controller<TestController>('test');

    await test.init();

    const marieId = await test.getUserId('Marie');

    {
        for (let i = 0; i < 50; i++) {
            const teamMembers = await test.find('Team a');
            expect(teamMembers.count()).toBe(3);
            await teamMembers.unsubscribe();
        }
    }

    {
        const teamMembers = await test.find('Team a');
        expect(teamMembers.count()).toBe(3);
        console.log('members loaded');

        console.log('apply Team B');
        await teamMembers.pagination.setParameter('teamName', 'Team b').apply();
        console.log('Team B loaded');
        expect(teamMembers.count()).toBe(1);
        expect(teamMembers.all()[0].id).toBe(marieId);
        await teamMembers.unsubscribe();
    }

    {
        const teamMembers = await test.find('Team a');
        console.log('members loaded');
        expect(teamMembers.count()).toBe(3);
        expect(teamMembers.get(marieId)).toBeUndefined();

        test.assignUser('Marie', 'Team a');
        await teamMembers.nextStateChange;
        console.log('marie assigned');
        expect(teamMembers.count()).toBe(4);
        expect(teamMembers.get(marieId)).toBeInstanceOf(User);
        expect(teamMembers.get(marieId)!.name).toBe('Marie');

        console.log('marie unassign ...');
        test.unAssignUser('Marie', 'Team a');
        await teamMembers.nextStateChange;
        console.log('marie unassigned');
        expect(teamMembers.count()).toBe(3);
        expect(teamMembers.get(marieId)).toBeUndefined();

        test.removeTeam('Team a');
        await teamMembers.nextStateChange;
        console.log('Team deleted');
        expect(teamMembers.count()).toBe(0);
        expect(teamMembers.get(marieId)).toBeUndefined();
        await teamMembers.unsubscribe();
    }

    await close();
});

test('test entity collection pagination', async () => {
    @Entity('paginate/item')
    class Item implements IdInterface {
        @f.primary().uuid()
        id: string = uuid();

        @f
        version: number = 0;

        constructor(
            @f public name: string,
            @f public nr: number = 0,
            @f public clazz: string = 'a',
            @f.uuid() public owner: string
        ) {
        }
    }

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: Database,
            private exchangeDatabase: ExchangeDatabase,
        ) {
        }

        @Action()
        async init() {
            await this.database.query(Item).deleteMany();

            const promises: Promise<any>[] = [];
            const clazzes = ['a', 'b', 'c'];
            const owners = ['3f63154d-4121-4f5c-a297-afc1f8f453fd', '4c349fe0-fa33-4e10-bb17-e25f13e4740e'];

            for (let i = 0; i < 100; i++) {
                promises.push(this.database.add(new Item('name_' + i, i, clazzes[i % 3], owners[i % 2])));
            }

            await Promise.all(promises);
        }

        @Action()
        async add(clazz: string, nr: number): Promise<void> {
            const item = new Item('name_' + nr, nr, clazz, '3f63154d-4121-4f5c-a297-afc1f8f453fd');
            await this.exchangeDatabase.add(item);
        }

        @Action()
        async remove(name: string): Promise<void> {
            await this.exchangeDatabase.deleteOne(Item, {name: name});
        }

        @Action()
        async findByClass(clazz: string): Promise<Collection<Item>> {
            return this.storage.collection(Item)
                .filter({clazz: {$parameter: 'clazz'}})
                .parameter('clazz', clazz)
                .enablePagination()
                .itemsPerPage(10)
                .orderBy('nr')
                .find();
        }

        @Action()
        async findByOwner(owner: string): Promise<Collection<Item>> {
            return this.storage.collection(Item)
                .filter({owner: owner})
                .find();
        }

        @Action()
        async findByOwnerPaged(owner: string): Promise<Collection<Item>> {
            return this.storage.collection(Item)
                .filter({owner: owner})
                .itemsPerPage(30)
                .page(2)
                .find();
        }
    }

    const {client, close} = await createServerClientPair('test entity collection pagination', [TestController], [Item]);
    const test = client.controller<TestController>('test');

    await test.init();

    {
        const items = await test.findByOwner('3f63154d-4121-4f5c-a297-afc1f8f453fd');
        expect(items.count()).toBe(50);

        test.add('a', 1000);
        await items.nextStateChange;
        expect(items.count()).toBe(51);

        test.remove('name_1000');
        await items.nextStateChange;
        expect(items.count()).toBe(50);
    }

    {
        const items = await test.findByOwnerPaged('3f63154d-4121-4f5c-a297-afc1f8f453fd');
        expect(items.pagination.getPage()).toBe(2);
        expect(items.pagination.getTotal()).toBe(50);
        expect(items.pagination.getItemsPerPage()).toBe(30);
        expect(items.count()).toBe(20); //we got 50 total, 30 per page. 30,20, we are at second page.

        test.add('a', 1001);
        await items.nextStateChange;
        expect(items.count()).toBe(21);

        test.remove('name_1001');
        await items.nextStateChange;
        expect(items.count()).toBe(20);
        await items.unsubscribe();
    }

    {
        const items = await test.findByClass('a');
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getItemsPerPage()).toBe(10);
        expect(items.pagination.getSort()).toEqual([{field: 'nr', direction: 'asc'}]);
        expect(items.pagination.getParameter('clazz')).toBe('a');

        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);

        await items.pagination.setParameter('clazz', 'b').apply();
        expect(items.pagination.getTotal()).toBe(33);
        expect(items.pagination.getItemsPerPage()).toBe(10);
        expect(items.pagination.getSort()).toEqual([{field: 'nr', direction: 'asc'}]);
        expect(items.pagination.getParameter('clazz')).toBe('b');

        expect(items.all()[0].nr).toBe(1);
        expect(items.all()[9].nr).toBe(28);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(33);
        expect(items.pagination.getPages()).toBe(4);
        await items.unsubscribe();
    }

    {
        const items = await test.findByClass('a');

        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);

        //swap order
        items.pagination.orderByField('nr', 'desc');
        await items.pagination.apply();
        expect(items.all()[0].nr).toBe(99);
        expect(items.all()[9].nr).toBe(72);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);

        //swap order back
        items.pagination.orderByField('nr');
        await items.pagination.apply();
        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(27);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);

        test.remove('name_27');
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(0);
        expect(items.all()[9].nr).toBe(30);
        expect(items.pagination.getTotal()).toBe(33);
        expect(items.pagination.getPages()).toBe(4);

        test.remove('name_0');
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(3);
        expect(items.all()[9].nr).toBe(33);
        expect(items.pagination.getTotal()).toBe(32);
        expect(items.pagination.getPages()).toBe(4);

        //shouldn't change anything
        test.add('a', 101);
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(3);
        expect(items.all()[9].nr).toBe(33);
        expect(items.count()).toBe(10);
        expect(items.pagination.getTotal()).toBe(33);
        expect(items.pagination.getPages()).toBe(4);

        //should change a lot
        test.add('a', -1);
        await items.nextStateChange;
        expect(items.all()[0].nr).toBe(-1);
        expect(items.all()[9].nr).toBe(30);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);

        items.pagination.setPage(2);
        items.pagination.apply();
        await items.nextStateChange;
        expect(items.count()).toBe(10);
        expect(items.all()[0].nr).toBe(33);
        expect(items.all()[9].nr).toBe(60);
        expect(items.pagination.getTotal()).toBe(34);
        expect(items.pagination.getPages()).toBe(4);
        await items.unsubscribe();
    }

    await close();
});
