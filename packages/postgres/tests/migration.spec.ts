import { expect, test } from "@jest/globals";
import { schemaMigrationRoundTrip } from "@deepkit/sql/dist/cjs/tests/setup";
import { t } from "@deepkit/type";
import { PostgresDatabaseAdapter } from "../src/postgres-adapter";


test('postgres custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.postgres({ type: 'VARCHAR(255)' }),
        content: t.string.postgres({ type: 'text' }),
    }, { name: 'post' });

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres' });
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

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

test('postgres', async () => {
    await schemaMigrationRoundTrip([user, post], new PostgresDatabaseAdapter({ host: 'localhost', database: 'postgres' }));
});
