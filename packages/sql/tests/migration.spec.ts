import { expect, test } from '@jest/globals';
import { AutoIncrement, entity, Index, PrimaryKey, Reference, ReflectionClass, ReflectionKind, Unique } from '@deepkit/type';
import { DatabaseModel, IndexModel } from '../src/schema/table';
import { DefaultPlatform } from '../src/platform/default-platform';
import { SchemaParser } from '../src/reverse/schema-parser';

@entity.name('user')
    .index(['deleted'], {unique: true})
    .index(['deleted', 'created'])
class user {
    id!: number & PrimaryKey & AutoIncrement;
    username!: string & Unique;
    created!: Date;
    deleted!: boolean;
    logins!: number;
}

@entity.name('post')
class post {
    id!: number & PrimaryKey & AutoIncrement;
    user?: user & Reference;
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
    const [tableUser, tablePost] = new MyPlatform().createTables([user, post]);

    const userReflection = ReflectionClass.from(user);
    expect(userReflection.getProperty('username').getIndex()).toEqual({unique: true});

    expect(tableUser.hasColumn('id')).toBe(true);
    expect(tableUser.getColumn('id').isPrimaryKey).toBe(true);
    expect(tableUser.getColumn('id').isAutoIncrement).toBe(true);
    expect(tableUser.getColumn('id').type).toBe('integer');

    // expect(user.getProperty('username').isOptional).toBe(false);
    // expect(user.getProperty('username').isNullable).toBe(false);

    expect(tableUser.hasColumn('username')).toBe(true);
    expect(tableUser.getColumn('username').type).toBe('text');
    expect(tableUser.getColumn('username').isNotNull).toBe(true);

    const indexes = tableUser.getUnices();
    expect(indexes[1]).toBeInstanceOf(IndexModel);
    expect(indexes[1]!.hasColumn('username')).toBe(true);

    expect(tablePost.foreignKeys.length).toBe(1);
    expect(tablePost.foreignKeys[0].foreign).toBe(tableUser);
    expect(tablePost.foreignKeys[0].localColumns[0].name).toBe('user');
    expect(tablePost.foreignKeys[0].foreignColumns[0].name).toBe('id');
});
