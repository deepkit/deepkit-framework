import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { schemaMigrationRoundTrip } from '@deepkit/sql';
import { t } from '../../type';
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

const user = t.schema({
    id: t.number.autoIncrement.primary,
    username: t.string.index({ unique: true }),
    created: t.date,
    deleted: t.boolean,
    logins: t.number,
}, { name: 'user' });
user.addIndex(['deleted'], '', { unique: true });
user.addIndex(['deleted', 'created']);

const post = t.schema({
    id: t.number.autoIncrement.primary,
    user: t.type(user).reference(),
    created: t.date,
    slag: t.string.index({ unique: true }),
    title: t.string,
    content: t.string,
}, { name: 'post' });

test('sqlite', async () => {
    await schemaMigrationRoundTrip([user, post], new SQLiteDatabaseAdapter(':memory:'));
});
