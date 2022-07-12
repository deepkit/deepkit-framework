import { expect, test } from '@jest/globals';
import { AutoIncrement, entity, Index, PrimaryKey, Reference, ReflectionClass, ReflectionKind, Unique } from '@deepkit/type';
import { DatabaseModel, IndexModel } from '../src/schema/table.js';
import { DefaultPlatform } from '../src/platform/default-platform.js';
import { SchemaParser } from '../src/reverse/schema-parser.js';
import { DatabaseEntityRegistry } from '@deepkit/orm';

@entity.name('user')
    .index(['deleted'], {unique: true})
    .index(['deleted', 'created'])
class User {
    id!: number & PrimaryKey & AutoIncrement;
    username!: string & Unique;
    created!: Date;
    deleted!: boolean;
    logins!: number;
}

@entity.name('post')
class Post {
    id!: number & PrimaryKey & AutoIncrement;
    user?: User & Reference;
    created!: Date;
    slag!: string & Index;
    title!: string;
    content!: string;
}

class MySchemaParser extends SchemaParser {
    parse(database: DatabaseModel, limitTableNames?: string[]): void {
    }
}

class MyPlatform extends DefaultPlatform {
    schemaParserType = MySchemaParser;
    constructor() {
        super();
        this.addType(ReflectionKind.number, 'integer');
    }
}

test('migration basic', async () => {
    const user = ReflectionClass.from(User);
    expect(user.getProperty('id').getKind()).toBe(ReflectionKind.number);
    expect(user.getProperty('id').isPrimaryKey()).toBe(true);
    expect(user.getProperty('id').isAutoIncrement()).toBe(true);
    expect(user.getPrimary() === user.getProperty('id')).toBe(true);
    expect(user.getAutoIncrement() === user.getProperty('id')).toBe(true);
    expect(user.indexes.length).toBe(3);

    const [tableUser, tablePost] = new MyPlatform().createTables(DatabaseEntityRegistry.from([User, Post]));

    const userReflection = ReflectionClass.from(User);
    expect(userReflection.getProperty('username').getIndex()).toEqual({unique: true});

    expect(tableUser.hasColumn('id')).toBe(true);
    expect(tableUser.getColumn('id').isPrimaryKey).toBe(true);
    expect(tableUser.getColumn('id').isAutoIncrement).toBe(true);
    expect(tableUser.getColumn('id').type).toBe('integer');

    expect(tableUser.hasColumn('username')).toBe(true);
    expect(tableUser.getColumn('username').type).toBe('text');
    expect(tableUser.getColumn('username').isNotNull).toBe(true);

    const indexes = tableUser.getUnices();
    expect(indexes.length).toBe(2);
    expect(indexes[0]).toBeInstanceOf(IndexModel);
    expect(indexes[0]!.hasColumn('username')).toBe(true);

    expect(tablePost.foreignKeys.length).toBe(1);
    expect(tablePost.foreignKeys[0].foreign).toBe(tableUser);
    expect(tablePost.foreignKeys[0].localColumns[0].name).toBe('user');
    expect(tablePost.foreignKeys[0].foreignColumns[0].name).toBe('id');
});
