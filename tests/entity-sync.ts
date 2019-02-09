import 'jest';
import {Action, Controller, EntityStorage, ExchangeDatabase} from "@kamille/server";
import {createServerClientPair} from "./util";
import {Entity, NumberType, StringType} from '@marcj/marshal';
import {Collection, EntitySubject, IdInterface} from "@kamille/core";
import uuid = require("uuid");

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
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {}

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
            }, 20);

            return await this.storage.find(User, {
                name: { $regex: /Peter/ }
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

    close();
});

test('test entity sync item', async () => {
    @Controller('test')
    class TestController {
        constructor(private storage: EntityStorage, private database: ExchangeDatabase) {}

        @Action()
        async user(): Promise<EntitySubject<User>> {
            await this.database.deleteMany(User, {});
            await this.database.add(User, new User('Guschdl'));

            const peter = new User('Peter 1');
            await this.database.add(User, peter);

            setTimeout(async () => {
                await this.database.patch(User, peter.id, {name: 'Peter patched'});
            }, 20);

            return await this.storage.findOne(User, {
                name: { $regex: /Peter/ }
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

    close();
});
