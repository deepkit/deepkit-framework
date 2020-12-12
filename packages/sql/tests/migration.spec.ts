import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {t} from '@deepkit/type';
import {MySQLDatabaseAdapter, PostgresDatabaseAdapter, SQLiteDatabaseAdapter, SQLitePlatform} from '../index';
import {Index} from '../src/schema/table';
import {schemaMigrationRoundTrip} from './setup';

const user = t.schema({
    id: t.number.autoIncrement.primary,
    username: t.string.index({unique: true}),
    created: t.date,
    deleted: t.boolean,
    logins: t.number,
}, {name: 'user'});
user.addIndex(['deleted'], '', {unique: true});
user.addIndex(['deleted', 'created']);

const post = t.schema({
    id: t.number.autoIncrement.primary,
    user: t.type(user).reference(),
    created: t.date,
    slag: t.string.index({unique: true}),
    title: t.string,
    content: t.string,
}, {name: 'post'});

test('migration basic', async () => {
    const [tableUser, tablePost] = new SQLitePlatform().createTables([user, post]);

    expect(tableUser.hasColumn('id')).toBe(true);
    expect(tableUser.getColumn('id').isPrimaryKey).toBe(true);
    expect(tableUser.getColumn('id').isAutoIncrement).toBe(true);
    expect(tableUser.getColumn('id').type).toBe('integer');

    expect(tableUser.hasColumn('username')).toBe(true);
    expect(tableUser.getColumn('username').type).toBe('text');
    expect(tableUser.getColumn('username').isNotNull).toBe(true);

    expect(tableUser.getIndex('username')).toBeInstanceOf(Index);
    expect(tableUser.getIndex('username')!.hasColumn('username')).toBe(true);

    expect(tablePost.foreignKeys.length).toBe(1);
    expect(tablePost.foreignKeys[0].foreign).toBe(tableUser);
    expect(tablePost.foreignKeys[0].localColumns[0].name).toBe('user');
    expect(tablePost.foreignKeys[0].foreignColumns[0].name).toBe('id');
});

describe('migration round trip', () => {
    test('sqlite', async () => {
        await schemaMigrationRoundTrip([user, post], new SQLiteDatabaseAdapter(':memory:'));
    });

    test('mysql', async () => {
        await schemaMigrationRoundTrip([user, post], new MySQLDatabaseAdapter({host: 'localhost', user: 'root', database: 'default'}));
    });

    test('postgres', async () => {
        await schemaMigrationRoundTrip([user, post], new PostgresDatabaseAdapter({host: 'localhost', database: 'postgres'}));
    });
});
