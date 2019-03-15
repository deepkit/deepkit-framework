import 'jest';
import {Action, Controller, PartialEntityReturnType, PartialParamType, ReturnType} from "@marcj/glut-server";
import {createServerClientPair, subscribeAndWait} from "./util";
import {Observable} from "rxjs";
import {bufferCount} from "rxjs/operators";
import {Entity, StringType, DateType} from '@marcj/marshal';
import {ObserverTimer} from "@marcj/estdlib-rxjs";
global['WebSocket'] = require('ws');

@Entity('user')
class User {
    @StringType()
    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}

test('test basic setup', async () => {
    @Controller('test')
    class TestController {
        @Action()
        @ReturnType(String)
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }

        @Action()
        user(name: string): User {
            return new User(name);
        }
    }

    const {client, close} = await createServerClientPair('test basic setup', [TestController]);
    {
        const types = await client.getActionTypes('test', 'names');
        expect(types.parameters[0]).toEqual({
            partial: false,
            type: 'String',
            array: false,
        });
        expect(types.returnType).toEqual({
            partial: false,
            type: 'String',
            array: true,
        });
    }

    {
        const types = await client.getActionTypes('test', 'user');
        expect(types.parameters[0]).toEqual({
            partial: false,
            type: 'String',
            array: false,
        });
        expect(types.returnType).toEqual({
            partial: false,
            type: 'Entity',
            entityName: 'user',
            array: false,
        });
    }

    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await test.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    await close();
});


test('test basic serialisation: primitives', async () => {
    @Controller('test')
    class TestController {
        @Action()
        @ReturnType(String)
        names(last: string): string[] {
            return ['a', 'b', 'c', 15 as any as string, last];
        }
    }

    const {client, close} = await createServerClientPair('test basic setup', [TestController]);

    const test = client.controller<TestController>('test');
    const names = await test.names(16 as any as string);

    expect(names).toEqual(['a', 'b', 'c', "15", "16"]);

    await close();
});

test('test basic serialisation return: entity', async () => {
    @Controller('test')
    class TestController {
        @Action()
        @ReturnType(User)
        async user(name: string): Promise<User> {
            return new User(name);
        }

        @Action()
        @ReturnType(User)
        async users(name: string): Promise<User[]> {
            return [new User(name)];
        }

        @Action()
        async failUser(name: string): Promise<User> {
            return new User(name);
        }

        @Action()
        async failObservable(name: string): Promise<Observable<User>> {
            return new Observable((observer) => {
                observer.next(new User(name));
            });
        }
    }

    const {client, close} = await createServerClientPair('test basic serialisation return: entity', [TestController]);

    const test = client.controller<TestController>('test');
    const user = await test.user('peter');
    expect(user).toBeInstanceOf(User);

    const users = await test.users('peter');
    expect(users.length).toBe(1);
    expect(users[0]).toBeInstanceOf(User);

    try {
        await test.failUser('peter');
        fail('Should fail');
    } catch (e) {
        expect(e.message).toMatch('Action test::failUser failed: Error: Result returns an not annotated custom class instance (User) that can not be serialized.\n' +
            'Use e.g. @ReturnType(MyClass) at your action.');
    }

    try {
        await (await test.failObservable('peter')).toPromise();
        fail('Should fail');
    } catch (e) {
        expect(e.message).toMatch('Action test::failObservable failed: Observable returns an not annotated custom class instance (User) that can not be serialized.\n' +
            'Use e.g. @ReturnType(MyClass) at your action.');
    }

    await close();
});

test('test basic serialisation param: entity', async () => {
    @Controller('test')
    class TestController {
        @Action()
        user(user: User): boolean {
            return user instanceof User && user.name === 'peter2';
        }
    }

    const {client, close} = await createServerClientPair('test basic serialisation param: entity', [TestController]);

    const test = client.controller<TestController>('test');
    const userValid = await test.user(new User('peter2'));
    expect(userValid).toBe(true);

    await close();
});

test('test basic serialisation partial param: entity', async () => {
    @Entity('user3')
    class User {
        @StringType()
        name: string;

        @StringType()
        defaultVar = 'yes';

        @DateType()
        birthdate?: Date;

        constructor(name: string) {
            this.name = name;
        }
    }

    @Controller('test')
    class TestController {
        @Action()
        failUser(user: Partial<User>) {
        }

        @Action()
        failPartialUser(name: string, date: Date): Partial<User> {
            return {
                name: name,
                birthdate: date
            };
        }

        @Action()
        @PartialEntityReturnType(User)
        partialUser(name: string, date: Date): Partial<User> {
            return {
                name: name,
                birthdate: date
            };
        }

        @Action()
        user(@PartialParamType(User) user: Partial<User>): boolean {
            return !(user instanceof User) && user.name === 'peter2' && !user.defaultVar;
        }
    }

    const {client, close} = await createServerClientPair('test basic serialisation partial param: entity', [TestController]);

    const test = client.controller<TestController>('test');

    try {
        await test.failUser({name: 'asd'});
        fail('Should fail');
    } catch (e) {
        expect(e.message).toMatch('TestController::failUser argument 0 is an Object with unknown structure. Define an entity and use @ParamType(MyEntity)');
    }

    const date = new Date('1987-12-12T11:00:00.000Z');

    try {
        await test.failPartialUser('asd', date);
        fail('Should fail');
    } catch (e) {
        expect(e.message).toMatch('Action test::failPartialUser failed: Error: Result returns an not annotated object literal that can not be serialized.\n' +
            'Use either @ReturnPlainObject() to avoid serialisation, or (better) create an entity and use @ReturnType(MyEntity) at your action.');
    }

    const a = await test.user({name: 'peter2'});
    expect(a).toBeTruthy();

    const partialUser = await test.partialUser('peter2', date);
    expect(partialUser.name).toBe('peter2');
    expect(partialUser.birthdate).toEqual(date);

    await close();
});

test('test basic promise', async () => {
    @Controller('test')
    class TestController {
        @Action()
        async names(last: string): Promise<string[]> {
            return ['a', 'b', 'c', last];
        }

        @Action()
        @ReturnType(User)
        async user(name: string): Promise<User> {
            return new User(name);
        }
    }

    const {client, close} = await createServerClientPair('test basic promise', [TestController]);
    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await test.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    await close();
});

test('test observable', async () => {
    @Controller('test')
    class TestController {
        @Action()
        observer(): Observable<string> {
            return new Observable((observer) => {
                observer.next('a');

                const timer = new ObserverTimer(observer);

                timer.setTimeout(() => {
                    observer.next('b');
                }, 100);

                timer.setTimeout(() => {
                    observer.next('c');
                }, 200);

                timer.setTimeout(() => {
                    observer.complete();
                }, 300);
            });
        }

        @Action()
        @ReturnType(User)
        user(name: string): Observable<User> {
            return new Observable((observer) => {
                observer.next(new User('first'));

                const timer = new ObserverTimer(observer);

                timer.setTimeout(() => {
                    observer.next(new User(name));
                }, 200);
            });
        }
    }

    const {client, close} = await createServerClientPair('test observable', [TestController]);
    const test = client.controller<TestController>('test');

    const observable = await test.observer();
    expect(observable).toBeInstanceOf(Observable);

    await subscribeAndWait(observable.pipe(bufferCount(3)), async (next) => {
        expect(next).toEqual(['a', 'b', 'c']);
    });

    await subscribeAndWait((await test.user('pete')).pipe(bufferCount(2)), async (next) => {
        expect(next[0]).toBeInstanceOf(User);
        expect(next[1]).toBeInstanceOf(User);
        expect(next[0].name).toEqual('first');
        expect(next[1].name).toEqual('pete');
    });

    await close();
});
