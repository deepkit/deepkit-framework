import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { injectable, InjectorContext } from '../src/injector';


test('context fork', () => {
    let databaseConstructed = 0;
    class Database {
        constructor() {
            databaseConstructed++;
        }
    }

    let connectionConstructed = 0;
    @injectable()
    class Connection {
        constructor(db: Database) {
            connectionConstructed++;
            expect(db).toBeInstanceOf(Database);
        }
    }

    const context = InjectorContext.forProviders([
        Database,
        { provide: Connection, scope: 'http' },
    ]);

    expect(context.get(Database)).toBeInstanceOf(Database);
    expect(databaseConstructed).toBe(1);

    expect(context.get(Database)).toBeInstanceOf(Database);
    expect(databaseConstructed).toBe(1);

    {
        const httpContext = context.createChildScope('http');

        expect(httpContext.get(Connection)).toBeInstanceOf(Connection);
        expect(databaseConstructed).toBe(1);
        expect(connectionConstructed).toBe(1);

        expect(httpContext.get(Connection)).toBeInstanceOf(Connection);
        expect(databaseConstructed).toBe(1);
        expect(connectionConstructed).toBe(1);
    }

    {
        const httpContext = context.createChildScope('http');

        expect(httpContext.get(Connection)).toBeInstanceOf(Connection);
        expect(databaseConstructed).toBe(1);
        expect(connectionConstructed).toBe(2);

        expect(httpContext.get(Connection)).toBeInstanceOf(Connection);
        expect(databaseConstructed).toBe(1);
        expect(connectionConstructed).toBe(2);
    }
});

test('injector scoped setup provider', () => {
    class MyService {
        public value: any;

        set(value: any) {
            this.value = value;
        }
    }

    class MySubService extends MyService { }

    const context = InjectorContext.forProviders([MyService, { provide: MySubService, scope: 'rpc' }]);
    context.configuredProviderRegistry.add(MyService, { type: 'call', methodName: 'set', args: ['foo'] });
    context.configuredProviderRegistry.add(MySubService, { type: 'call', methodName: 'set', args: ['foo'] });

    {
        const s = context.getInjector(0).get(MyService);
        expect(s.value).toBe('foo');
    }

    const sub = context.createChildScope('rpc');
    {
        const s = sub.getInjector(0).get(MySubService);
        expect(s.value).toBe('foo');
    }
});
