import 'jest';
import 'reflect-metadata';
import {injectable, InjectorContext} from '../src/injector/injector';


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
        {provide: Connection, scope: 'http'},
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
