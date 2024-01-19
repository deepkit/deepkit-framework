import { expect, test } from '@jest/globals';
import { schemaMigrationRoundTrip } from '@deepkit/sql';
import { AutoIncrement, Entity, integer, PrimaryKey, Reference, SQLite, typeOf, Unique } from '@deepkit/type';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter.js';
import { DatabaseEntityRegistry } from '@deepkit/orm';

test('custom type', async () => {
    interface Post extends Entity<{ name: 'post' }> {
        id: integer & AutoIncrement & PrimaryKey;
        slug: string & SQLite<{ type: 'text' }>;
        content: string;
        size: number & SQLite<{ type: 'integer(4)' }>;
        float: number;
    }

    const adapter = new SQLiteDatabaseAdapter(':memory:');
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([typeOf<Post>()]));
    expect(postTable.getColumn('id').type).toBe('integer');
    expect(postTable.getColumn('slug').type).toBe('text');
    expect(postTable.getColumn('size').type).toBe('integer');
    expect(postTable.getColumn('size').size).toBe(4);

    expect(postTable.getColumn('content').type).toBe('text');
    expect(postTable.getColumn('float').type).toBe('float');

    await schemaMigrationRoundTrip([typeOf<Post>()], adapter);
});

test('default expression', async () => {
    class post {
        id: number & AutoIncrement & PrimaryKey = 0;
        str: string & SQLite<{ type: 'VARCHAR(255)', default: 'abc' }> = '';
        no: number & SQLite<{ default: 34.5 }> = 3;
        json: any & SQLite<{ default: {a: true} }> = {};
        jsonAuto: any = {a: true};
        created: Date & SQLite<{ defaultExpr: `(datetime('now','localtime'))` }> = new Date;
        createdAuto: Date = new Date; //this is detected as datetime('now')
        opt?: boolean;
    }

    const adapter = new SQLiteDatabaseAdapter(':memory:');
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    expect(postTable.getColumn('str').defaultValue).toBe('abc');
    expect(postTable.getColumn('no').defaultValue).toBe(34.5);
    expect(postTable.getColumn('json').defaultValue).toEqual({a: true});
    expect(postTable.getColumn('jsonAuto').defaultValue).toEqual({a: true});
    expect(postTable.getColumn('created').defaultExpression).toBe(`(datetime('now','localtime'))`);
    expect(postTable.getColumn('createdAuto').defaultExpression).toBe(`(datetime('now'))`);

    await schemaMigrationRoundTrip([post], adapter);
});

interface User extends Entity<{ name: 'user' }> {
    id: number & AutoIncrement & PrimaryKey;
    username: string & Unique;
    created: Date;
    deleted: boolean;
    logins: number;
}

interface Post extends Entity<{ name: 'post' }> {
    id: number & AutoIncrement & PrimaryKey;
    user: User & Reference,
    created: Date,
    slag: string & Unique,
    title: string,
    content: string,
}

test('sqlite', async () => {
    await schemaMigrationRoundTrip([typeOf<User>(), typeOf<Post>()], new SQLiteDatabaseAdapter(':memory:'));
});
