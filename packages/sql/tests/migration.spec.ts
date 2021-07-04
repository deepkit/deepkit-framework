import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { t } from '@deepkit/type';
import { DatabaseModel, Index } from '../src/schema/table';
import { DefaultPlatform } from '../src/platform/default-platform';
import { SchemaParser } from '../src/reverse/schema-parser';

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


class MySchemaParser extends SchemaParser {
    parse(database: DatabaseModel, limitTableNames?: string[]): void {
    }
}

class MyPlatform extends DefaultPlatform {
    schemaParserType = MySchemaParser;
    constructor() {
        super();
        this.addType('number', 'integer');
    }
}

test('migration basic', async () => {
    const [tableUser, tablePost] = new MyPlatform().createTables([user, post]);

    expect(tableUser.hasColumn('id')).toBe(true);
    expect(tableUser.getColumn('id').isPrimaryKey).toBe(true);
    expect(tableUser.getColumn('id').isAutoIncrement).toBe(true);
    expect(tableUser.getColumn('id').type).toBe('integer');

    expect(user.getProperty('username').isOptional).toBe(false);
    expect(user.getProperty('username').isNullable).toBe(false);

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
