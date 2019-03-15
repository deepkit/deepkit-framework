import 'jest';
import {Action, Controller, ReturnType} from "@marcj/glut-server";
import {createServerClientPair, subscribeAndWait} from "./util";
import {Observable} from "rxjs";
import {bufferCount} from "rxjs/operators";
import {Entity, StringType} from '@marcj/marshal';
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
        names(last: string): string[] {
            return ['a', 'b', 'c', 15 as any as string, last];
        }
    }

    const {client, close} = await createServerClientPair('test basic setup', [TestController]);

    const test = client.controller<TestController>('test');
    const names = await test.names(16 as any as string);

    //we do not convert primitives as typescript checks that already at build time.
    expect(names).toEqual(['a', 'b', 'c', 15, 16]);

    await close();
});

test('test basic serialisation return: entity', async () => {
    @Controller('test')
    class TestController {
        @Action()
        async user(name: string): Promise<User> {
            return new User(name);
        }
    }

    const {client, close} = await createServerClientPair('test basic setup', [TestController]);

    const test = client.controller<TestController>('test');
    const user = await test.user('peter');
    expect(user).toBeInstanceOf(User);
    console.log('user', user);

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

    const {client, close} = await createServerClientPair('test basic setup', [TestController]);

    const test = client.controller<TestController>('test');
    const userValid = await test.user(new User('peter2'));
    expect(userValid).toBe(true);

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
