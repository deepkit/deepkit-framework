import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {JSONError, ValidationError, ValidationErrorItem, ValidationParameterError} from '@deepkit/framework-shared';
import {appModuleForControllers, closeAllCreatedServers, createServerClientPair, subscribeAndWait} from './util';
import {Observable} from 'rxjs';
import {bufferCount, first, skip} from 'rxjs/operators';
import {Entity, getClassSchema, PropertySchema, t} from '@deepkit/type';
import {ObserverTimer} from '@deepkit/core-rxjs';
import {isArray} from '@deepkit/core';
import {ClientProgress} from '@deepkit/framework-client';
import {rpc} from '@deepkit/framework-shared';

afterAll(async () => {
    await closeAllCreatedServers();
});

@Entity('controller-basic/user')
class User {
    constructor(@t public name: string) {
        this.name = name;
    }
}

@Entity('error:custom-error')
class MyCustomError {
    @t
    additional?: string;

    constructor(@t public readonly message: string) {

    }
}

test('basic setup and methods', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        @t.array(String)
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
            throw new JSONError([{path: 'name', name: 'missing'}]);
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

    const schema = getClassSchema(TestController);
    {
        const u = schema.getMethodProperties('validationError')[0];
        expect(u).toBeInstanceOf(PropertySchema);
        expect(u.type).toBe('class');
        expect(u.classType).toBe(User);
        expect(u.toJSON()).toMatchObject({name: 'user', type: 'class', classType: 'controller-basic/user'});
    }

    const {client, close} = await createServerClientPair('basic setup and methods', appModuleForControllers([TestController]));
    {
        const types = await client.getActionTypes('test', 'names');
        expect(types.parameters[0].type).toBe('string');
    }

    {
        const types = await client.getActionTypes('test', 'user');
        expect(types.parameters[0].type).toBe('string');
    }

    {
        const types = await client.getActionTypes('test', 'validationError');
        expect(types.parameters[0].type).toBe('class');
        expect(types.parameters[0].classType).toBe(User);
    }

    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    {
        try {
            const error = await test.myErrorNormal();
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Nothing to see here');
        }
    }

    {
        try {
            const error = await test.myErrorJson();
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(JSONError);
            expect((error as JSONError).json).toEqual([{path: 'name', name: 'missing'}]);
        }
    }

    {
        try {
            const error = await test.myErrorCustom();
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
            const error = await test.validationError(user);
            fail('should error');
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationParameterError);
            expect((error as ValidationError).errors[0]).toBeInstanceOf(ValidationErrorItem);
            expect((error as ValidationError).errors[0]).toEqual({code: 'required', message: 'Required value is undefined', path: 'validationError#0.name'});
        }
    }

    const user = await test.user('pete');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toEqual('pete');

    await close();
});


test('basic serialisation: primitives', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        @t.array(t.string)
        names(last: string): string[] {
            return ['a', 'b', 'c', "15", last];
        }
    }

    const {client, close} = await createServerClientPair('basic setup primitives', appModuleForControllers([TestController]));

    const test = client.controller<TestController>('test');

    try {
        await test.names(16 as any as string);
        fail('should fail');
    } catch (error) {
        expect(error.message).toContain('names#0: No string given');
    }

    const names = await test.names("16");

    expect(names).toEqual(['a', 'b', 'c', "15", "16"]);

    await close();
});

test('basic serialisation return: entity', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        @t.type(User)
        async user(name: string): Promise<User> {
            return new User(name);
        }

        @rpc.action()
        @t.type(User).optional
        async optionalUser(@t.optional returnUser: boolean = false): Promise<User | undefined> {
            return returnUser ? new User('optional') : undefined;
        }

        @rpc.action()
        @t.array(User)
        async users(name: string): Promise<User[]> {
            return [new User(name)];
        }

        @rpc.action()
        async notAnnotatedUser(name: string): Promise<User> {
            return new User(name);
        }

        @rpc.action()
        @t.any
        async allowPlainObject(name: string): Promise<{mowla: boolean, name: string, date: Date}> {
            return {mowla: true, name, date: new Date('1987-12-12T11:00:00.000Z')};
        }

        @rpc.action()
        async notAnnotatedObservable(name: string): Promise<Observable<User>> {
            return new Observable((observer) => {
                observer.next(new User(name));
            });
        }
    }

    const {client, close} = await createServerClientPair('basic serialisation entity', appModuleForControllers([TestController]));

    const test = client.controller<TestController>('test');
    const user = await test.user('peter');
    expect(user).toBeInstanceOf(User);

    const users = await test.users('peter');
    expect(users.length).toBe(1);
    expect(users[0]).toBeInstanceOf(User);
    expect(users[0].name).toBe('peter');

    const optionalUser = await test.optionalUser();
    expect(optionalUser).toBeUndefined();

    const optionalUser2 = await test.optionalUser(true);
    expect(optionalUser2).toBeInstanceOf(User);
    expect(optionalUser2!.name).toBe('optional');

    const struct = await test.allowPlainObject('peter');
    expect(struct.mowla).toBe(true);
    expect(struct.name).toBe('peter');
    expect(struct.date).toBeInstanceOf(Date);
    expect(struct.date).toEqual(new Date('1987-12-12T11:00:00.000Z'));

    {
        //this should work because returnType is dynamic every time
        const u = await test.notAnnotatedUser('peter');
        expect(u).toBeInstanceOf(User);
    }

    {
        //this should work because returnType is dynamic every time
        const u = await (await test.notAnnotatedObservable('peter')).pipe(first()).toPromise();
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

    const {client, close} = await createServerClientPair('serialisation param: entity', appModuleForControllers([TestController]));

    const test = client.controller<TestController>('test');
    const userValid = await test.user(new User('peter2'));
    expect(userValid).toBe(true);

    await close();
});

test('basic serialisation partial param: entity', async () => {
    @Entity('user3')
    class User {
        @t
        defaultVar: string = 'yes';

        @t
        birthdate?: Date;

        constructor(@t public name: string) {
            this.name = name;
        }
    }

    @rpc.controller('test')
    class TestController {
        @rpc.action()
        failUser(user: Partial<User>) {
        }

        @rpc.action()
        failPartialUser(name: string, date: Date): Partial<User> {
            return {
                name: name,
                birthdate: date
            };
        }

        @rpc.action()
        @t.partial(User)
        partialUser(name: string, date: Date): Partial<User> {
            return {
                name: name,
                birthdate: date
            };
        }

        @rpc.action()
        user(@t.partial(User) user: Partial<User>): boolean {
            return !(user instanceof User) && user.name === 'peter2' && !user.defaultVar;
        }
    }

    const {client, close} = await createServerClientPair('serialisation partial param: entity', appModuleForControllers([TestController]));

    const test = client.controller<TestController>('test');
    //
    // try {
    //     await test.failUser({name: 'asd'});
    //     fail('Should fail');
    // } catch (e) {
    //     expect(e.message).toMatch('test::failUser argument 0 is an Object with unknown structure. ');
    // }
    //
    // const date = new Date('1987-12-12T11:00:00.000Z');
    //
    // try {
    //     await test.failPartialUser('asd', date);
    //     fail('Should fail');
    // } catch (e) {
    //     expect(e.message).toMatch('test::failPartialUser result is an Object with unknown structure.');
    // }

    const a = await test.user({name: 'peter2'});
    expect(a).toBeTruthy();

    // const partialUser = await test.partialUser('peter2', date);
    // expect(partialUser.name).toBe('peter2');
    // expect(partialUser.birthdate).toEqual(date);

    await close();
});

test('test basic promise', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        @t.array(String)
        async names(last: string): Promise<string[]> {
            return ['a', 'b', 'c', last];
        }

        @rpc.action()
        @t.type(User)
        async user(name: string): Promise<User> {
            return new User(name);
        }
    }

    const {client, close} = await createServerClientPair('test basic promise', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    const user = await test.user('pete');
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
        @t.template(User)
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

    const {client, close} = await createServerClientPair('test observable', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');

    const observable = await test.observer();

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

test('test param serialization', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        actionString(@t.type(String) array: string): boolean {
            return 'string' === typeof array;
        }

        @rpc.action()
        actionArray(@t.array(String) array: string[]): boolean {
            return isArray(array) && 'string' === typeof array[0];
        }
    }

    const {client, close} = await createServerClientPair('test param serialization', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');

    expect(await test.actionArray(['b'])).toBe(true);

    await close();
});


test('test batcher', async () => {
    @rpc.controller('test')
    class TestController {
        @rpc.action()
        uploadBig(@t.type(Buffer) file: Buffer): boolean {
            return file.length === 550_000;
        }

        @rpc.action()
        downloadBig(): Buffer {
            return new Buffer(650_000);
        }
    }

    const {client, close} = await createServerClientPair('test batcher', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');

    const progress = ClientProgress.trackDownload();
    let hit = 0;
    progress.pipe(skip(1)).subscribe((p) => {
        console.log(p.progress, p.total);
        expect(p.total).toBeGreaterThan(0);
        expect(p.current).toBeLessThanOrEqual(p.total);
        expect(progress.progress).toBeLessThanOrEqual(1);
        hit++;
    });
    const file = await test.downloadBig();
    expect(file.length).toBe(650_000);
    expect(hit).toBeGreaterThan(3);
    expect(progress.done).toBe(true);
    expect(progress.progress).toBe(1);

    const uploadFile = new Buffer(550_000);

    await close();
});
