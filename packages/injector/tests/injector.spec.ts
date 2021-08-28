import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { getClassSchema, t } from '@deepkit/type';
import { CircularDependencyError, Injector } from '../src/injector';
import { inject, injectable, InjectOptions, InjectorToken } from '../src/decorator';
import { createConfig } from '../src/config';
import { InjectorModule } from '../src/module';

export const a = 'asd';

test('injector basics', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    const injector = Injector.from([MyServer, Connection]);
    expect(injector.get(Connection)).toBeInstanceOf(Connection);
    expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
});

test('missing dep', () => {
    class Connection {
    }

    class Missing {
    }

    @injectable
    class MyServer {
        constructor(private connection: Connection, private missing: Missing) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    expect(() => Injector.from([MyServer, Connection])).toThrow(`Unknown dependency 'missing: Missing' of MyServer.missing`);
});

test('wrong dep 1', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(private connection: Connection, private missing: any) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    expect(() => Injector.from([MyServer, Connection])).toThrow(`Undefined dependency 'missing: undefined' of MyServer(✓, ?).`);
});

test('wrong dep 2', () => {
    @injectable
    class MyServer {
        constructor(private missing: any) {
        }
    }

    expect(() => Injector.from([MyServer])).toThrow(`Undefined dependency 'missing: undefined' of MyServer(?).`);
});

test('wrong dep 3', () => {
    @injectable
    class MyServer {
        @inject() private missing: any;
    }

    expect(() => Injector.from([MyServer])).toThrow(`Undefined dependency 'missing: undefined' of MyServer.missing.`);
});

test('injector key', () => {
    @injectable
    class MyServer {
        constructor(@inject('foo') private foo: string) {
            expect(foo).toBe('bar');
        }
    }

    const injector = Injector.from([MyServer, { provide: 'foo', useValue: 'bar' }]);
    expect(injector.get('foo')).toBe('bar');
    expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
});


test('injector transient', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(public connection: Connection) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    const injector = Injector.from([MyServer, { provide: Connection, transient: true }]);
    const c1 = injector.get(Connection);
    const c2 = injector.get(Connection);
    expect(c1).toBeInstanceOf(Connection);
    expect(c2).toBeInstanceOf(Connection);
    expect(c1 !== c2).toBe(true);

    const s1 = injector.get(MyServer);
    const s2 = injector.get(MyServer);
    expect(s1).toBeInstanceOf(MyServer);
    expect(s2).toBeInstanceOf(MyServer);

    expect(s1.connection).toBeInstanceOf(Connection);
    expect(s2.connection).toBeInstanceOf(Connection);

    expect(s1 === s2).toBe(true);
    expect(s1.connection === s2.connection).toBe(true);
    expect(s1.connection !== c1).toBe(true);
    expect(s2.connection !== c2).toBe(true);
});

test('injector property injection', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        @inject()
        public connection!: Connection;

        constructor(@inject('name') public name: string) {
        }
    }

    const injector = Injector.from([MyServer, Connection, { provide: 'name', useValue: 'peter' }]);
    const s = injector.get(MyServer);
    expect(s.connection).toBeInstanceOf(Connection);
    expect(s.name).toBe('peter');
});

test('injector overwrite token', () => {
    class Connection {
    }

    class Connection2 extends Connection {
    }

    @injectable
    class MyServer {
        constructor(@inject(Connection2) private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection2);
        }
    }

    {
        const injector = Injector.from([MyServer, Connection, Connection2]);
        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector unmet dependency', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(private connection?: Connection) {
            expect(connection).toBeUndefined();
        }
    }

    {
        expect(() => Injector.from([MyServer])).toThrow(`Unknown dependency 'connection: Connection' of MyServer.connection`);
    }
});

test('injector optional unmet dependency', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(@t.optional private connection?: Connection) {
            expect(connection).toBeUndefined();
        }
    }

    {
        const injector = Injector.from([MyServer]);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector optional dependency', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(@inject().optional private connection?: Connection) {
            expect(connection).toBeUndefined();
        }
    }

    {
        const injector = Injector.from([MyServer]);
        expect(() => injector.get(Connection)).toThrow(`Token 'Connection' in InjectorModule not found`);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector via t.optional', () => {
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(@t.optional private connection?: Connection) {
            expect(connection).toBeUndefined();
        }
    }

    {
        const injector = Injector.from([MyServer]);
        expect(() => injector.get(Connection)).toThrow(`Token 'Connection' in InjectorModule not found`);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector via t.type', () => {
    interface ConnectionInterface {}
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(@t.type(Connection) public connection: ConnectionInterface) {
        }
    }

    {
        const injector = Injector.from([MyServer, Connection]);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
        expect(injector.get(MyServer).connection).toBeInstanceOf(Connection);
    }
});

test('injector via t.type string', () => {
    interface ConnectionInterface {}
    class Connection {
    }

    @injectable
    class MyServer {
        constructor(@t.type('connection') public connection: ConnectionInterface) {
        }
    }

    {
        const injector = Injector.from([MyServer, {provide: 'connection', useClass: Connection}]);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
        expect(injector.get(MyServer).connection).toBeInstanceOf(Connection);
    }
});

test('injector token', () => {
    interface ConnectionInterface {
        doIt(): string;
    }

    const Connection = new InjectorToken<ConnectionInterface>('connection');

    {
        const injector = Injector.from([{provide: Connection, useValue: {doIt() {return 'hi'}}}]);
        expect(injector.get(Connection).doIt()).toBe('hi');
    }
});

test('injector overwrite provider', () => {
    class Connection {
    }

    class Connection2 extends Connection {
    }

    @injectable
    class MyServer {
        constructor(private connection: Connection) {
            expect(connection).toBeInstanceOf(Connection2);
        }
    }

    {
        const injector = Injector.from([MyServer, {
            provide: Connection, useClass: Connection2
        }]);
        expect(injector.get(Connection)).toBeInstanceOf(Connection2);
        expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
    }
});

test('injector direct circular dependency', () => {
    @injectable
    class MyServer {
        constructor(private myServer: MyServer) {
        }
    }

    {
        const injector = Injector.from([MyServer]);
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError as any);
    }
});


test('injector circular dependency', () => {
    @injectable
    class Connection {
        constructor(@inject(() => MyServer) myServer: any) {
            expect(myServer).not.toBeUndefined();
            expect(myServer).toBeInstanceOf(MyServer);
        }
    }

    @injectable
    class MyServer {
        constructor(connection: Connection) {
            expect(connection).not.toBeUndefined();
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    {
        const injector = Injector.from([MyServer, Connection]);
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError as any);
        expect(() => injector.get(MyServer)).toThrow('Circular dependency found MyServer -> Connection -> MyServer');
    }
});

test('injector factory', () => {

    class Service {
    }

    {
        const injector = Injector.from([{ provide: Service, useFactory: () => new Service() }]);

        const s1 = injector.get(Service);
        expect(s1).toBeInstanceOf(Service);

        const s2 = injector.get(Service);
        expect(s2).toBeInstanceOf(Service);
        expect(s2).toBe(s1);
    }
});

test('injector config', () => {
    const moduleConfig = createConfig({
        debug: t.boolean.default(false)
    });

    class ServiceConfig extends moduleConfig.slice('debug') {
    }

    @injectable
    class MyService {
        constructor(public config: ServiceConfig) {
        }
    }

    @injectable
    class MyService2 {
        constructor(@inject(moduleConfig) public config: typeof moduleConfig.type) {
        }
    }

    @injectable
    class MyService3 {
        constructor(@inject(moduleConfig.all()) public config: typeof moduleConfig.type) {
        }
    }

    class Slice extends moduleConfig.slice('debug') {
    }

    @injectable
    class MyService4 {
        constructor(public config: Slice) {
        }
    }

    {
        const i1 = Injector.fromModule(new InjectorModule([MyService, MyService2, MyService3, MyService4]).setConfigDefinition(moduleConfig));
        i1.module.configure({debug: false});
        expect(i1.get(MyService).config.debug).toBe(false);
        expect(i1.get(MyService2).config.debug).toBe(false);
        expect(i1.get(MyService3).config.debug).toBe(false);
        expect(i1.get(MyService4).config.debug).toBe(false);
    }

    {
        const i1 = Injector.fromModule(new InjectorModule([MyService, MyService2, MyService3, MyService4]).setConfigDefinition(moduleConfig));
        i1.module.configure({debug: true});
        expect(i1.get(MyService).config.debug).toBe(true);
        expect(i1.get(MyService2).config.debug).toBe(true);
        expect(i1.get(MyService3).config.debug).toBe(true);
        expect(i1.get(MyService4).config.debug).toBe(true);
    }
});

test('setup provider', () => {
    class MyService {
        transporter: string[] = [];

        addTransporter(t: string) {
            this.transporter.push(t);
        }
    }

    {
        const i1 = Injector.from([MyService]);
        expect(i1.get(MyService).transporter).toEqual([]);
    }

    {
        const module = new InjectorModule([MyService]);
        module.setupProvider(MyService).addTransporter('a');
        module.setupProvider(MyService).addTransporter('b');
        expect(module.setupProviderRegistry.get(MyService).length).toBe(2);
        const i1 = Injector.fromModule(module);
        expect(i1.get(MyService).transporter).toEqual(['a', 'b']);
    }

    {
        const module = new InjectorModule([MyService]);
        module.setupProvider(MyService).transporter = ['a'];
        module.setupProvider(MyService).transporter = ['a', 'b', 'c'];
        expect(module.setupProviderRegistry.get(MyService).length).toBe(2);
        const i1 = Injector.fromModule(module);
        expect(i1.get(MyService).transporter).toEqual(['a', 'b', 'c']);
    }
});

test('constructor one with @inject', () => {
    class HttpKernel {
    }

    class Logger {
    }

    class Stopwatch {
    }

    @injectable
    class MyService {
        constructor(
            protected httpKernel: HttpKernel,
            public logger: Logger,
            @inject().optional protected stopwatch?: Stopwatch,
        ) {
        }
    }

    class SubService extends MyService {
    }

    {
        const schema = getClassSchema(SubService);
        const methods = schema.getMethodProperties('constructor');
        expect(methods.length).toBe(3);

        expect(methods[0].name).toBe('httpKernel');
        expect(methods[1].name).toBe('logger');
        expect(methods[2].name).toBe('stopwatch');

        expect((methods[2].data['deepkit/inject'] as InjectOptions).optional).toBe(true);
    }

    @injectable
    class Service {
        constructor(public stopwatch: Stopwatch, @inject(Logger) public logger: any) {}
    }

    {
        const schema = getClassSchema(Service);
        const methods = schema.getMethodProperties('constructor');
        expect(methods.length).toBe(2);
        expect(methods[0].name).toBe('stopwatch');
        expect(methods[1].name).toBe('logger');
    }
});
