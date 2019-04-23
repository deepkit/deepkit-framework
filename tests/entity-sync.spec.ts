import 'jest';
import 'reflect-metadata';
import {Action, Collection, Controller, EntitySubject, IdInterface, ReactiveJoin} from "@marcj/glut-core";
import {ClientConnection, EntityStorage, ExchangeDatabase} from "@marcj/glut-server";
import {createServerClientPair} from "./util";
import {Entity, Field, getEntitySchema, IDField, uuid, UUIDField} from '@marcj/marshal';
import {BehaviorSubject, Observable} from 'rxjs';
import {nextValue} from '@marcj/estdlib-rxjs';
import {sleep} from '@marcj/estdlib';
import {Database} from '@marcj/marshal-mongo';

// @ts-ignore
global['WebSocket'] = require('ws');

// const Promise = require('bluebird');
// Promise.longStackTraces(); //needs to be disabled in production since it leaks memory
// global.Promise = Promise;

class UserBase implements IdInterface {
    @IDField()
    @Field()
    id: string = uuid();

    @Field()
    version: number = 1;

    constructor(@Field() public name: string) {
        this.name = name;
    }
}

test('test entity sync list', async () => {
    @Entity('user1')
    class User extends UserBase {}

    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        @Action()
        async users(): Promise<Collection<User>> {
            await this.database.deleteMany(User, {});
            const peter = new User('Peter 1');

            await this.database.add(User, peter);
            await this.database.add(User, new User('Peter 2'));
            await this.database.add(User, new User('Guschdl'));
            await this.database.add(User, new User('Ingrid'));

            const ids = await this.database.getIds(User);
            expect(ids[0]).toBe(peter.id);
            expect(ids.length).toBe(4);

            setTimeout(async () => {
                await this.database.add(User, new User('Peter 3'));
            }, 500);

            setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 1000);

            return await this.storage.find(User, {
                name: {$regex: /Peter/}
            });
        }

        @Action()
        async addUser(name: string) {
            await this.database.add(User, new User(name));
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
    users.unsubscribe();

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
    class User extends UserBase {}

    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        @Action()
        async users(): Promise<Collection<User>> {
            await this.database.deleteMany(User, {});

            await this.database.add(User, new User('Peter 1'));
            await this.database.add(User, new User('Peter 2'));

            return await this.storage.find(User, {
                name: {$regex: /Peter/}
            });
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
            await this.database.add(User, user);
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

    console.log('done');
    await close();
});

test('test entity sync item', async () => {
    @Entity('user3')
    class User extends UserBase {}

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
            await this.database.add(User, new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(User, peter);

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
        expect(user.getValue()).toBeUndefined();

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
    class User extends UserBase {}

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async user(): Promise<EntitySubject<User | undefined>> {
            await this.database.deleteMany(User, {});
            await this.database.add(User, new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(User, peter);

            return await this.storage.findOneOrUndefined(User, {
                name: {$regex: /Marie/}
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity sync item undefined', [TestController], [User]);
    const test = client.controller<TestController>('test');

    const user = await test.user();
    expect(user).toBeInstanceOf(EntitySubject);
    expect(user.getValue()).toBeUndefined();

    await close();
});


test('test entity sync count', async () => {
    @Entity('user5')
    class User extends UserBase {}

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
            await this.database.add(User, new User('Guschdl'));
            const peter1 = new User('Peter 1');

            this.connection.setTimeout(async () => {
                console.log('add peter1');
                await this.database.add(User, peter1);
            }, 100);

            this.connection.setTimeout(async () => {
                console.log('add peter2');
                await this.database.add(User, new User('Peter 2'));
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
    result.subscribe((next) => {
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
        @UUIDField()
        id: string = uuid();

        @Field()
        version: number = 0;

        constructor(@Field() public name: string) {
        }
    }

    expect(getEntitySchema(Job).name).toBe('jobTest');

    @Controller('test')
    class TestController {
        constructor(
            private connection: ClientConnection,
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {
        }

        @Action()
        async init() {
            await this.database.deleteMany(Job, {});
            await this.database.add(Job, new Job('Peter 1'));
            await this.database.add(Job, new Job('Peter 2'));
            await this.database.add(Job, new Job('Peter 3'));

            await this.database.add(Job, new Job('Marie 1'));
            await this.database.add(Job, new Job('Marie 2'));
        }

        @Action()
        async getJobs(): Promise<Collection<Job>> {
            return await this.storage.find(Job, {
                name: {$regex: /Peter/}
            });
        }

        @Action()
        async addJob(name: string): Promise<void> {
            return await this.database.add(Job, new Job(name));
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
            await this.database.deleteOne(Job, {
                name: name
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity sync count', [TestController], [Job]);
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
        @UUIDField()
        @IDField()
        id: string = uuid();

        @Field()
        version: number = 0;

        constructor(@Field() public name: string) {
        }
    }

    @Entity('entitySyncUserTeam')
    class UserTeam {
        @UUIDField()
        @IDField()
        id: string = uuid();

        @Field()
        version: number = 0;

        constructor(
            @UUIDField() public teamId: string,
            @UUIDField() public userId: string,
        ) {
        }
    }

    @Entity('entitySyncUser')
    class User implements IdInterface {
        @UUIDField()
        @IDField()
        id: string = uuid();

        @Field()
        version: number = 0;

        constructor(@Field() public name: string) {
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
            await this.database.deleteMany(UserTeam, {});

            const teamA = new Team('Team a');
            const teamB = new Team('Team b');

            await this.database.add(Team, teamA);
            await this.database.add(Team, teamB);

            const addUser = async (name: string, team: Team) => {
                const user = new User(name);
                await this.database.add(User, user);
                await this.database.add(UserTeam, new UserTeam(team.id, user.id));
            };

            await addUser('Peter 1', teamA);
            await addUser('Peter 2', teamA);
            await addUser('Marc 1', teamA);

            await addUser('Marie', teamB);
        }

        @Action()
        async unAssignUser(userName: string, teamName: string) {
            const user = await this.database.get(User, {name: userName});
            const team = await this.database.get(Team, {name: teamName});

            if (!user) throw new Error(`User ${userName} not found`);
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.deleteMany(UserTeam, {userId: user.id, teamId: team.id});
        }

        @Action()
        async getUserId(userName: string): Promise<string> {
            const user = await this.database.get(User, {name: userName});
            if (!user) throw new Error(`User ${userName} not found`);

            return user.id;
        }

        @Action()
        async assignUser(userName: string, teamName: string) {
            const user = await this.database.get(User, {name: userName});
            const team = await this.database.get(Team, {name: teamName});

            if (!user) throw new Error(`User ${userName} not found`);
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.add(UserTeam, new UserTeam(team.id, user.id));
        }

        @Action()
        async removeTeam(teamName: string) {
            const team = await this.database.get(Team, {name: teamName});
            if (!team) throw new Error(`Team ${teamName} not found`);

            await this.exchangeDatabase.deleteOne(Team, {id: team.id});
        }

        @Action()
        async find(teamName: string): Promise<Collection<User>> {
            return this.storage.find(User, {
                id: {
                    $join: ReactiveJoin.createField(UserTeam, 'userId', {
                        teamId: {
                            $join: ReactiveJoin.create(Team, {name: teamName})
                        }
                    }
                )}
            });
        }
    }

    const {client, close} = await createServerClientPair('test entity collection reactive find', [TestController], [Team, UserTeam, User]);
    const test = client.controller<TestController>('test');

    await test.init();

    const marieId = await test.getUserId('Marie');

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

    await close();
});
