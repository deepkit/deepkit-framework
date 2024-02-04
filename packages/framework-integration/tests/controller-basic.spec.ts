import { afterAll, expect, jest, test } from '@jest/globals';
import { ClientProgress, JSONError, rpc } from '@deepkit/rpc';
import { appModuleForControllers, closeAllCreatedServers, createServerClientPair, subscribeAndWait } from './util.js';
import { Observable } from 'rxjs';
import { bufferCount, first, skip } from 'rxjs/operators';
import { ObserverTimer } from '@deepkit/core-rxjs';
import { isArray } from '@deepkit/core';
import { fail } from 'assert';
import ws from 'ws';
import { entity, ValidationError, ValidationErrorItem } from '@deepkit/type';

// @ts-ignore
global['WebSocket'] = ws;

jest.setTimeout(15_000);

afterAll(async () => {
    await closeAllCreatedServers();
});

@entity.name('controller-basic/user')
class User {
    constructor(public name: string) {
        this.name = name;
    }
}

@entity.name('error:custom-error')
class MyCustomError {
    additional?: string;

    constructor(public readonly message: string) {

    }
}

test('basic setup and methods', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }

        @rpc.action()
        user(name: string): User {
            return new User(name);
        }

        @rpc.action()
        myErrorNormal() {
            throw new Error('Nothing to see here');
        }

        @rpc.action()
        myErrorJson() {
            throw new JSONError([{ path: 'name', name: 'missing' }]);
        }

        @rpc.action()
        myErrorCustom(): any {
            const error = new MyCustomError('Shit dreck');
            error.additional = 'hi';
            throw error;
        }

        @rpc.action()
        validationError(user: User) {
        }
    }

    const { client, close } = await createServerClientPair('basic setup and methods', appModuleForControllers([TestController]));

    const controller = client.controller<TestController>('test');

    const names = await controller.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    {
        try {
            const error = await controller.myErrorNormal();
            fail('should error');
        } catch (error: any) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Nothing to see here');
        }
    }

    {
        try {
            const error = await controller.myErrorJson();
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(JSONError);
            expect((error as JSONError).json).toEqual([{ path: 'name', name: 'missing' }]);
        }
    }

    {
        try {
            const error = await controller.myErrorCustom();
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(MyCustomError);
            expect((error as MyCustomError).message).toEqual('Shit dreck');
            expect((error as MyCustomError).additional).toEqual('hi');
        }
    }

    {
        try {
            const user = new User('asd');
            (user as any).name = undefined;
            const error = await controller.validationError(user);
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).errors[0]).toBeInstanceOf(ValidationErrorItem);
            expect((error as ValidationError).errors[0]).toEqual({ code: 'type', message: 'Cannot convert undefined to string', path: 'args.user.name' });
        }
    }

    const user = await controller.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    await close();
});

test('basic serialisation return: entity', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        async user(name: string): Promise<User> {
            return new User(name);
        }

        @rpc.action()
        async optionalUser(returnUser: boolean = false): Promise<User | undefined> {
            return returnUser ? new User('optional') : undefined;
        }

        @rpc.action()
        async users(name: string): Promise<User[]> {
            return [new User(name)];
        }

        @rpc.action()
        async allowPlainObject(name: string): Promise<{ mowla: boolean, name: string, date: Date }> {
            return { mowla: true, name, date: new Date('1987-12-12T11:00:00.000Z') };
        }

        @rpc.action()
        async observable(name: string): Promise<Observable<User>> {
            return new Observable((observer) => {
                observer.next(new User(name));
            });
        }
    }

    const { client, close } = await createServerClientPair('basic serialisation entity', appModuleForControllers([TestController]));

    const controller = client.controller<TestController>('test');
    const user = await controller.user('peter');
    expect(user).toBeInstanceOf(User);

    const users = await controller.users('peter');
    expect(users.length).toBe(1);
    expect(users[0]).toBeInstanceOf(User);
    expect(users[0].name).toBe('peter');

    const optionalUser = await controller.optionalUser();
    expect(optionalUser).toBeUndefined();

    const optionalUser2 = await controller.optionalUser(true);
    expect(optionalUser2).toBeInstanceOf(User);
    expect(optionalUser2!.name).toBe('optional');

    const struct = await controller.allowPlainObject('peter');
    expect(struct.mowla).toBe(true);
    expect(struct.name).toBe('peter');
    expect(struct.date).toBeInstanceOf(Date);
    expect(struct.date).toEqual(new Date('1987-12-12T11:00:00.000Z'));


    {
        const o = await controller.observable('peter');
        expect(o).toBeInstanceOf(Observable);
        const u = await o.pipe(first()).toPromise();
        expect(u).toBeInstanceOf(User);
    }

    await close();
});

test('basic serialisation param: entity', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        user(user: User): boolean {
            return user instanceof User && user.name === 'peter2';
        }
    }

    const { client, close } = await createServerClientPair('serialisation param: entity', appModuleForControllers([TestController]));

    const controller = client.controller<TestController>('test');
    const userValid = await controller.user(new User('peter2'));
    expect(userValid).toBe(true);

    await close();
});

test('basic serialisation partial param: entity', async () => {
    @entity.name('user3')
    class User {
        defaultVar: string = 'yes';

        date?: Date;

        constructor(public name: string) {
            this.name = name;
        }
    }

    @rpc.controller('test')
    class TestController {
        @rpc.action()
        passUser(user: Partial<User>): any {
            return user;
        }

        @rpc.action()
        getPartialUser(name?: string, date?: Date): Partial<User> {
            return {
                name: name,
                date: date
            };
        }

        @rpc.action()
        user(user: Partial<User>): boolean {
            return !(user instanceof User) && user.name === 'peter2' && !user.defaultVar;
        }
    }

    const { client, close } = await createServerClientPair('serialisation partial param: entity', appModuleForControllers([TestController]));

    const controller = client.controller<TestController>('test');

    expect(await controller.passUser({name: 'asd'})).toEqual({name: 'asd'});
    expect(await controller.passUser({})).toEqual({});

    const date = new Date('1987-12-12T11:00:00.000Z');

    expect(await controller.getPartialUser('asd', date)).toEqual({name: 'asd', date});
    expect(await controller.getPartialUser('asd')).toEqual({name: 'asd', date: undefined});
    expect(await controller.getPartialUser()).toEqual({name: undefined, date: undefined});

    const a = await controller.user({ name: 'peter2' });
    expect(a).toBe(true);

    await close();
});

test('test basic promise', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        async names(last: string): Promise<string[]> {
            return ['a', 'b', 'c', last];
        }

        @rpc.action()
        async user(name: string): Promise<User> {
            return new User(name);
        }
    }

    const { client, close } = await createServerClientPair('test basic promise', appModuleForControllers([TestController]));
    const controller = client.controller<TestController>('test');

    const names = await controller.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await controller.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    await close();
});

test('test observable', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
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

        @rpc.action()
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

    const { client, close } = await createServerClientPair('test observable', appModuleForControllers([TestController]));
    const controller = client.controller<TestController>('test');

    const observable = await controller.observer();

    await subscribeAndWait(observable.pipe(bufferCount(3)), async (next) => {
        expect(next).toEqual(['a', 'b', 'c']);
    });

    await subscribeAndWait((await controller.user('pete')).pipe(bufferCount(2)), async (next) => {
        expect(next[0]).toBeInstanceOf(User);
        expect(next[1]).toBeInstanceOf(User);
        expect(next[0].name).toEqual('first');
        expect(next[1].name).toEqual('pete');
    });

    await close();
});

test('test param serialization', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        actionString(array: string): boolean {
            return 'string' === typeof array;
        }

        @rpc.action()
        actionArray(array: string[]): boolean {
            return isArray(array) && 'string' === typeof array[0];
        }
    }

    const { client, close } = await createServerClientPair('test param serialization', appModuleForControllers([TestController]));
    const controller = client.controller<TestController>('test');

    expect(await controller.actionArray(['b'])).toBe(true);

    await close();
});

test('test batcher', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        uploadBig(file: Uint8Array): boolean {
            return file.length === 550_000;
        }

        @rpc.action()
        downloadBig(): Uint8Array {
            return new Buffer(650_000);
        }
    }

    const { client, close } = await createServerClientPair('test batcher', appModuleForControllers([TestController]));
    const controller = client.controller<TestController>('test');

    const progress = ClientProgress.track();
    let hit = 0;
    progress.download.pipe(skip(1)).subscribe(() => {
        expect(progress.download.total).toBeGreaterThan(0);
        expect(progress.download.current).toBeLessThanOrEqual(progress.download.total);
        expect(progress.download.progress).toBeLessThanOrEqual(1);
        hit++;
    });
    const file = await controller.downloadBig();
    expect(file.length).toBe(650_000);
    expect(hit).toBeGreaterThan(3);
    expect(progress.download.done).toBe(true);
    expect(progress.download.progress).toBe(1);

    const uploadFile = new Buffer(550_000);

    await close();
});
