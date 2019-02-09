import 'jest';
import {Action, Controller} from "@kamille/server";
import {createServerClientPair, subscribeAndWait} from "./util";
import {Observable} from "rxjs";
import {bufferCount} from "rxjs/operators";
import {Entity, StringType} from '@marcj/marshal';

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
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }

        @Action()
        user(name: string): User {
            return new User(name);
        }
    }

    const {server, client, close} = await createServerClientPair([TestController]);
    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await test.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    close();
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

    const {server, client, close} = await createServerClientPair([TestController]);
    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await test.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    close();
});

test('test observable', async () => {
    @Controller('test')
    class TestController {
        @Action()
        observer(): Observable<string> {
            return new Observable((observer) => {
                observer.next('a');

                setTimeout(() => {
                    observer.next('b');
                }, 100);

                setTimeout(() => {
                    observer.next('c');
                }, 200);

                setTimeout(() => {
                    observer.complete();
                }, 300);
            });
        }

        @Action()
        user(name: string): Observable<User> {
            return new Observable((observer) => {
                observer.next(new User('first'));
                setTimeout(() => {
                    observer.next(new User(name));
                }, 200);
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController]);
    const test = client.controller<TestController>('test');

    const observer = await test.observer();
    expect(observer).toBeInstanceOf(Observable);

    await subscribeAndWait(observer.pipe(bufferCount(3)), async (next) => {
        expect(next).toEqual(['a', 'b', 'c']);
    });

    await subscribeAndWait((await test.user('pete')).pipe(bufferCount(2)), async (next) => {
        expect(next[0]).toBeInstanceOf(User);
        expect(next[1]).toBeInstanceOf(User);
        expect(next[0].name).toEqual('first');
        expect(next[1].name).toEqual('pete');
    });

    close();
});
