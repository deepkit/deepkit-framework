import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { schemaMigrationRoundTrip } from '@deepkit/sql';
import { AutoIncrement, Entity, integer, PrimaryKey, Reference, SQLite, typeOf, Unique } from '@deepkit/type';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';
import { DatabaseEntityRegistry } from '@deepkit/orm';

test('sqlite custom type', async () => {
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
    expect(postTable.getColumn('size').type).toBe('integer');
    expect(postTable.getColumn('size').size).toBe(4);

    expect(postTable.getColumn('content').type).toBe('text');
    expect(postTable.getColumn('float').type).toBe('float');

    await schemaMigrationRoundTrip([typeOf<Post>()], adapter);
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
