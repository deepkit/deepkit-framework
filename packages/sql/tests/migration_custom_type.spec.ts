import { expect, test } from '@jest/globals';
import { jest } from '@jest/globals'
import 'reflect-metadata';
import { t } from '@deepkit/type';
import { schemaMigrationRoundTrip } from './setup';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';


test('sqlite custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.sqlite({ type: 'text' }),
        content: t.string,
        size: t.number.sqlite({ type: 'integer(4)' })
    }, { name: 'post' });

    const adapter = new SQLiteDatabaseAdapter(':memory:');
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('size').type).toBe('integer');
    expect(postTable.getColumn('size').size).toBe(4);

    expect(postTable.getColumn('content').type).toBe('text');

    await schemaMigrationRoundTrip([post], adapter);
});
