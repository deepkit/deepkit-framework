import { expect, test } from '@jest/globals';

import { DatabaseEntityRegistry } from '@deepkit/orm';
import { schemaMigrationRoundTrip } from '@deepkit/sql';
import {
    AutoIncrement,
    Entity,
    Postgres,
    PrimaryKey,
    Reference,
    ReflectionClass,
    Unique,
    float32,
    int8,
    int16,
    int32,
    integer,
    typeOf,
    uint8,
    uint16,
    uint32,
} from '@deepkit/type';

import { PostgresDatabaseAdapter } from '../src/postgres-adapter.js';

test('custom type', async () => {
    class post {
        id: number & AutoIncrement & PrimaryKey = 0;
        slug: string & Postgres<{ type: 'VARCHAR(255)' }> = '';
        content: string = '';
    }

    const reflection = ReflectionClass.from(post);
    reflection.getProperty('slug');
    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));
    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

    expect(postTable.getColumn('content').type).toBe('text');

    await schemaMigrationRoundTrip([post], adapter);
});

test('default expression', async () => {
    class post {
        id: number & AutoIncrement & PrimaryKey = 0;
        str: string & Postgres<{ type: 'VARCHAR(255)'; default: 'abc' }> = '';
        no: number & Postgres<{ default: 34.5 }> = 3;
        json: any & Postgres<{ default: { a: true } }> = {};
        jsonAuto: any = { a: true };
        created: Date & Postgres<{ defaultExpr: `now()` }> = new Date();
        createdAuto: Date = new Date(); //this is detected as datetime('now')
        opt?: boolean;
    }

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    expect(postTable.getColumn('str').defaultValue).toBe('abc');
    expect(postTable.getColumn('no').defaultValue).toBe(34.5);
    expect(postTable.getColumn('json').defaultValue).toEqual({ a: true });
    expect(postTable.getColumn('jsonAuto').defaultValue).toEqual({ a: true });
    expect(postTable.getColumn('created').defaultExpression).toBe(`now()`);
    expect(postTable.getColumn('createdAuto').defaultExpression).toBe(`now()`);

    await schemaMigrationRoundTrip([post], adapter);
});

test('numbers', async () => {
    class post {
        id: integer & AutoIncrement & PrimaryKey = 0;
        int8: int8 = 0;
        uint8: uint8 = 0;
        int16: int16 = 0;
        uint16: uint16 = 0;
        int32: int32 = 0;
        uint32: uint32 = 0;
        float32: float32 = 0;
        default: number = 0;
    }

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    const DDL = await schemaMigrationRoundTrip([post], adapter);

    expect(DDL).toContain(`CREATE TABLE "post" (
    "id" SERIAL,
    "int8" smallint NOT NULL DEFAULT 0,
    "uint8" smallint NOT NULL DEFAULT 0,
    "int16" smallint NOT NULL DEFAULT 0,
    "uint16" smallint NOT NULL DEFAULT 0,
    "int32" integer NOT NULL DEFAULT 0,
    "uint32" integer NOT NULL DEFAULT 0,
    "float32" real NOT NULL DEFAULT 0,
    "default" double precision NOT NULL DEFAULT 0,
    PRIMARY KEY ("id")
)`);
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
    user: User & Reference;
    created: Date;
    slag: string & Unique;
    title: string;
    content: string;
}

test('postgres', async () => {
    await schemaMigrationRoundTrip(
        [typeOf<User>(), typeOf<Post>()],
        new PostgresDatabaseAdapter({ host: 'localhost', database: 'postgres', user: 'postgres' }),
    );
});
