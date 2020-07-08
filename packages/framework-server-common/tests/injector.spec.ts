import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {CircularDependencyError, inject, injectable, Injector} from '../src/injector/injector';

test('injector', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    const injector = new Injector([MyServer, Connection]);
    expect(injector.get(Connection)).toBeInstanceOf(Connection);
    expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
});

test('injector key', () => {
    @injectable()
    class MyServer {
        constructor(@inject('foo') private foo: string) {
            expect(foo).toBe('bar');
        }
    }

    const injector = new Injector([MyServer, {provide: 'foo', useValue: 'bar'}]);
    expect(injector.get('foo')).toBe('bar');
    expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
});

test('injector overwrite token', () => {
    class Connection {
    }
    class Connection2 extends Connection {
    }

    @injectable()
    class MyServer {
        constructor(@inject(Connection2) private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection2);
        }
    }

    {
        const injector = new Injector([MyServer, Connection, Connection2]);
        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector unmet dependency', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(private connection?: Connection) {
            expect(connection).toBeUndefined()
        }
    }

    {
        const injector = new Injector([MyServer]);
        expect(() => injector.get(Connection)).toThrow('Could not resolve injector token Connection');
        expect(() => injector.get(MyServer)).toThrow('Unknown constructor argument MyServer(?). Make sure Connection is provided');
    }
});

test('injector optional dependency', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(@inject().optional() private connection?: Connection) {
            expect(connection).toBeUndefined()
        }
    }

    {
        const injector = new Injector([MyServer]);
        expect(() => injector.get(Connection)).toThrow('Could not resolve injector token Connection');
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector overwrite provider', () => {
    class Connection {
    }
    class Connection2 extends Connection {
    }

    @injectable()
    class MyServer {
        constructor(private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection2);
        }
    }

    {
        const injector = new Injector([MyServer, {
            provide: Connection, useClass: Connection2
        }]);
        expect(injector.get(Connection)).toBeInstanceOf(Connection2);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector direct circular dependency', () => {
    @injectable()
    class MyServer {
        constructor(private myServer: MyServer) {
        }
    }

    {
        const injector = new Injector([MyServer]);
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError);
    }
});


test('injector circular dependency', () => {
    @injectable()
    class Connection  {
        constructor(@inject(() => MyServer) myServer: any) {
            expect(myServer).not.toBeUndefined();
            expect(myServer).toBeInstanceOf(MyServer);
        }
    }

    @injectable()
    class MyServer {
        constructor(connection: Connection) {
            expect(connection).not.toBeUndefined();
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    {
        const injector = new Injector([MyServer, Connection]);
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError);
        expect(() => injector.get(MyServer)).toThrow('Circular dependency found MyServer -> Connection -> MyServer');
    }
});

test('injector factory', () => {

    class Service {}

    {
        const injector = new Injector([{provide: Service, useFactory: () => new Service()}]);

        const s1 = injector.get(Service);
        expect(s1).toBeInstanceOf(Service);

        const s2 = injector.get(Service);
        expect(s2).toBeInstanceOf(Service);
        expect(s2).toBe(s1);
    }
});


