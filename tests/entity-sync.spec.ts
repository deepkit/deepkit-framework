import 'jest';
import {Action, Controller, EntityStorage, ExchangeDatabase} from "@marcj/glut-server";
import {createServerClientPair} from "./util";
import {Entity, NumberType, StringType} from '@marcj/marshal';
import {Collection, EntitySubject, IdInterface} from "@marcj/glut-core";
import uuid = require("uuid");
import {Observable, BehaviorSubject} from 'rxjs';
import {nextValue} from '@marcj/estdlib-rxjs';

global['WebSocket'] = require('ws');

@Entity('user')
class User implements IdInterface {
    @StringType()
    id: string = uuid();

    @NumberType()
    version: number = 1;

    @StringType()
    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}

test('test entity sync list', async () => {
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

            setTimeout(async () => {
                await this.database.add(User, new User('Peter 3'));
            }, 10);

            setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 50);

            return await this.storage.find(User, {
                name: {$regex: /Peter/}
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController], [User]);
    const test = client.controller<TestController>('test');

    const users = await test.users();
    await users.readyState;

    expect(users.count()).toBe(2);
    expect(users.all()[0].name).toBe('Peter 1');
    expect(users.all()[1].name).toBe('Peter 2');

    await users.nextStateChange;
    expect(users.count()).toBe(3);
    expect(users.all()[2].name).toBe('Peter 3');
    expect(users.all()[0].name).toBe('Peter 1');

    await users.nextStateChange;
    expect(users.count()).toBe(3);
    expect(users.all()[0].name).toBe('Peter patched');

    await close();
});

test('test entity sync item', async () => {
    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        @Action()
        async user(): Promise<EntitySubject<User>> {
            await this.database.deleteMany(User, {});
            await this.database.add(User, new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(User, peter);

            setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 20);

            setTimeout(async () => {
                await this.database.remove(User, peter.id);
            }, 280);

            return await this.storage.findOne(User, {
                name: {$regex: /Peter/}
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController], [User]);
    const test = client.controller<TestController>('test');

    const user = await test.user();
    expect(user).toBeInstanceOf(EntitySubject);
    expect(user.getValue()).toBeInstanceOf(User);
    expect(user.getValue().name).toBe('Peter 1');

    await user.nextStateChange;
    expect(user.getValue().name).toBe('Peter patched');

    await user.nextStateChange;
    expect(user.getValue()).toBeUndefined();

    await close();
});

test('test entity sync item undefined', async () => {
    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        names(): string[] {
            return ['a'];
        }

        @Action()
        async user(): Promise<EntitySubject<User | undefined>> {
            await this.database.deleteMany(User, {});
            await this.database.add(User, new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(User, peter);

            setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 50);

            return await this.storage.findOneOrUndefined(User, {
                name: {$regex: /Marie/}
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController], [User]);
    const test = client.controller<TestController>('test');

    const user = await test.user();
    expect(user).toBeInstanceOf(EntitySubject);
    expect(user.getValue()).toBeUndefined();

    await close();
});


test('test entity sync count', async () => {
    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {
        }

        @Action()
        async userCount(): Promise<Observable<number>> {
            await this.database.deleteMany(User, {});
            await this.database.add(User, new User('Guschdl'));
            const peter1 = new User('Peter 1');

            setTimeout(async () => {
                console.log('add peter1');
                await this.database.add(User, peter1);
            }, 100);

            setTimeout(async () => {
                console.log('add peter2');
                await this.database.add(User, new User('Peter 2'));
            }, 150);

            setTimeout(async () => {
                console.log('remove peter1');
                await this.database.remove(User, peter1.id);
            }, 200);

            return await this.storage.count(User, {
                name: {$regex: /Peter/}
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController], [User]);
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

    console.log('subscribe again');
    result.subscribe(userCount);
    console.log('subscribe again done');

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
