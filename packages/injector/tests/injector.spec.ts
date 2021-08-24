import { expect, test } from '@jest/globals';
import { getClassSchema, t } from '@deepkit/type';
import 'reflect-metadata';
import { CircularDependencyError, createConfig, inject, injectable, InjectOptions, Injector } from '../src/injector';
import { InjectorModule } from '../src/module';
import { InjectorContext } from '../src/injector-context';

export const a = 'asd';

test('injector basics', () => {
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

test('missing dep', () => {
    class Connection {
    }

    class Missing {
    }

    @injectable()
    class MyServer {
        constructor(private connection: Connection, private missing: Missing) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    const injector = new Injector([MyServer, Connection]);
    expect(() => injector.get(MyServer)).toThrow(`Unknown constructor argument 'missing: Missing' of MyServer(✓, ?). Make sure 'Missing' is provided.`);
});

test('wrong dep 1', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(private connection: Connection, private missing: any) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    expect(() => new Injector([MyServer, Connection])).toThrow(`Undefined dependency 'missing: undefined' of MyServer(✓, ?).`);
});

test('wrong dep 2', () => {
    @injectable()
    class MyServer {
        constructor(private missing: any) {
        }
    }

    expect(() => new Injector([MyServer])).toThrow(`Undefined dependency 'missing: undefined' of MyServer(?).`);
});

test('wrong dep 3', () => {
    @injectable()
    class MyServer {
        @inject() private missing: any;
    }

    expect(() => new Injector([MyServer])).toThrow(`Undefined dependency 'missing: undefined' of MyServer.missing.`);
});

test('injector key', () => {
    @injectable()
    class MyServer {
        constructor(@inject('foo') private foo: string) {
            expect(foo).toBe('bar');
        }
    }

    const injector = new Injector([MyServer, { provide: 'foo', useValue: 'bar' }]);
    expect(injector.get('foo')).toBe('bar');
    expect(injector.get(MyServer)).toBeInstanceOf(MyServer);
});


test('injector transient', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(public connection: Connection) {
            expect(connection).toBeInstanceOf(Connection);
        }
    }

    const injector = new Injector([MyServer, { provide: Connection, transient: true }]);
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

    @injectable()
    class MyServer {
        @inject()
        public connection!: Connection;

        constructor(@inject('name') public name: string) {
        }
    }

    const injector = new Injector([MyServer, Connection, { provide: 'name', useValue: 'peter' }]);
    const s = injector.get(MyServer);
    expect(s.connection).toBeInstanceOf(Connection);
    expect(s.name).toBe('peter');
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
            expect(connection).toBeUndefined();
        }
    }

    {
        const injector = new Injector([MyServer]);
        expect(() => injector.get(Connection)).toThrow('Could not resolve injector token Connection');
        expect(() => injector.get(MyServer)).toThrow(`Unknown constructor argument 'connection: Connection' of MyServer(?).`);
    }
});

test('injector optional dependency', () => {
    class Connection {
    }

    @injectable()
    class MyServer {
        constructor(@inject().optional private connection?: Connection) {
            expect(connection).toBeUndefined();
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
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError as any);
    }
});


test('injector circular dependency', () => {
    @injectable()
    class Connection {
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
        expect(() => injector.get(MyServer)).toThrow(CircularDependencyError as any);
        expect(() => injector.get(MyServer)).toThrow('Circular dependency found MyServer -> Connection -> MyServer');
    }
});

test('injector factory', () => {

    class Service {
    }

    {
        const injector = new Injector([{ provide: Service, useFactory: () => new Service() }]);

        const s1 = injector.get(Service);
        expect(s1).toBeInstanceOf(Service);

        const s2 = injector.get(Service);
        expect(s2).toBeInstanceOf(Service);
        expect(s2).toBe(s1);
    }
});


test('injector stack parent', () => {
    const i1 = new Injector([
        { provide: 'level', deps: ['deep1'], useFactory: (d: any) => d },
        { provide: 'level2', deps: ['deep2'], useFactory: (d: any) => d },
    ]);

    const i2 = new Injector([{ provide: 'deep1', useValue: 2 }], [i1]);
    const i3 = new Injector([{ provide: 'deep2', useValue: 3 }], [i2]);

    expect(i2.get('level')).toBe(2);
    expect(i3.get('level')).toBe(2);

    expect(() => i2.get('level2')).toThrow(`Unknown factory dependency argument 'deep2' of useFactory`);
    expect(i3.get('level2')).toBe(3);
});

test('injector stack parent fork', () => {
    const i1 = new Injector([
        { provide: 'level', deps: ['deep1'], useFactory: (d: any) => d },
        { provide: 'level2', deps: ['deep2'], useFactory: (d: any) => d },
    ]);

    const i2 = new Injector([{ provide: 'deep1', useValue: 2 }], [i1]).fork();
    const i3 = new Injector([{ provide: 'deep2', useValue: 3 }], [i2]).fork();

    expect(i2.get('level')).toBe(2);
    expect(i3.get('level')).toBe(2);

    expect(() => i2.get('level2')).toThrow(`Unknown factory dependency argument 'deep2' of useFactory`);
    expect(i3.get('level2')).toBe(3);
});


test('injector config', () => {
    const FullConfig = createConfig({
        debug: t.boolean.default(false)
    });

    class ServiceConfig extends FullConfig.slice('debug') {
    }

    @injectable()
    class MyService {
        constructor(public config: ServiceConfig) {
        }
    }

    @injectable()
    class MyService2 {
        constructor(@inject(FullConfig) public config: typeof FullConfig.type) {
        }
    }

    @injectable()
    class MyService3 {
        constructor(@inject(FullConfig.all()) public config: typeof FullConfig.type) {
        }
    }

    class Slice extends FullConfig.slice('debug') {
    }

    @injectable()
    class MyService4 {
        constructor(public config: Slice) {
        }
    }

    {
        const i1 = new Injector([MyService, MyService2, MyService3, MyService4], []);
        expect(i1.get(MyService).config.debug).toBe(false);
        expect(i1.get(MyService2).config.debug).toBe(false);
        expect(i1.get(MyService3).config.debug).toBe(false);
        expect(i1.get(MyService4).config.debug).toBe(false);
    }

    {
        const myModule = new InjectorModule('asd', { debug: true });
        const injectorContext = new InjectorContext();
        const context = injectorContext.registerModule(myModule, FullConfig);
        const i1 = new Injector([MyService, MyService2, MyService3, MyService4], [], injectorContext, undefined, undefined, undefined, context);
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
        const injectorContext = new InjectorContext();
        const i1 = new Injector([MyService], [], injectorContext);
        expect(i1.get(MyService).transporter).toEqual([]);
    }

    {
        const injectorContext = new InjectorContext();
        injectorContext.setupProvider(MyService).addTransporter('a');
        injectorContext.setupProvider(MyService).addTransporter('b');
        expect(injectorContext.configuredProviderRegistry.get(MyService).length).toBe(2);
        const i1 = new Injector([MyService], [], injectorContext);
        expect(i1.get(MyService).transporter).toEqual(['a', 'b']);
    }

    {
        const injectorContext = new InjectorContext();
        injectorContext.setupProvider(MyService).transporter = ['a'];
        injectorContext.setupProvider(MyService).transporter = ['a', 'b', 'c'];
        expect(injectorContext.configuredProviderRegistry.get(MyService).length).toBe(2);
        const i1 = new Injector([MyService], [], injectorContext);
        expect(i1.get(MyService).transporter).toEqual(['a', 'b', 'c']);
    }
});


test('injector fork', () => {
    class MyService {
    }

    const i1 = new Injector([MyService]);
    const s1 = i1.get(MyService);
    expect(s1).toBeInstanceOf(MyService);

    const i2 = i1.fork();
    const s2 = i2.get(MyService);
    expect(s2).toBeInstanceOf(MyService);
    expect(s2).not.toBe(s1);
});

test('constructor one with @inject', () => {
    class HttpKernel {
    }

    class Logger {
    }

    class Stopwatch {
    }

    @injectable()
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

    @injectable()
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
