import 'reflect-metadata';
import 'jest';
import {t} from '@deepkit/type';
import {schemaMigrationRoundTrip} from './setup';
import {MySQLDatabaseAdapter} from '../src/mysql-adapter';
import {PostgresDatabaseAdapter} from '../src/postgres-adapter';
import {SQLiteDatabaseAdapter} from '../src/sqlite-adapter';


test('mysql custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.mysql({type: 'VARCHAR(255)'}),
        content: t.string,
    }, {name: 'post'});

    const adapter = new MySQLDatabaseAdapter('localhost');
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

    await schemaMigrationRoundTrip([post], adapter);
});


test('postgres custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.postgres({type: 'VARCHAR(255)'}),
        content: t.string.postgres({type: 'text'}),
    }, {name: 'post'});

    const adapter = new PostgresDatabaseAdapter('localhost');
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

    expect(postTable.getColumn('content').type).toBe('text');

    await schemaMigrationRoundTrip([post], adapter);
});


test('sqlite custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.sqlite({type: 'text'}),
        content: t.string,
        size: t.number.sqlite({type: 'integer(4)'})
    }, {name: 'post'});

    const adapter = new SQLiteDatabaseAdapter(':memory:');
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('size').type).toBe('integer');
    expect(postTable.getColumn('size').size).toBe(4);

    expect(postTable.getColumn('content').type).toBe('text');

    await schemaMigrationRoundTrip([post], adapter);
});
