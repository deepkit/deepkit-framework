import { expect, test } from '@jest/globals';
import { entity, getClassSchema, jsonSerializer, t } from '@deepkit/type';
import { SQLFilterBuilder } from '../src/sql-filter-builder';
import { escape } from 'sqlstring';
import { sql, SQLQueryModel } from '../src/sql-adapter';
import { DefaultPlatform, SqlPlaceholderStrategy } from '../src/platform/default-platform';
import { SchemaParser } from '../src/reverse/schema-parser';
import { DatabaseModel } from '../src/schema/table';
import { SqlBuilder } from '../src/sql-builder';

function quoteId(value: string): string {
    return value;
}


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

test('sql query', () => {
    @entity.name('user')
    class User {}

    const id = 0;
    const query = sql`SELECT * FROM ${User} WHERE id > ${id}`;

    const generated = query.convertToSQL(new MyPlatform(), new SqlPlaceholderStrategy());
    expect(generated.sql).toBe('SELECT * FROM "user" WHERE id > ?');
    expect(generated.params).toEqual([0]);
});


test('select', () => {
    @entity.name('user-select')
    class User {
        @t.required id: number = 0;
        @t.required username!: string;
    }

    {
        const builder = new SqlBuilder(new MyPlatform());
        const model = new SQLQueryModel();
        const builtSQL = builder.select(getClassSchema(User), model);
        expect(builtSQL.sql).toBe(`SELECT "user-select"."id", "user-select"."username" FROM "user-select"`);
    }

    {
        const builder = new SqlBuilder(new MyPlatform());
        const model = new SQLQueryModel();
        model.sqlSelect = sql`count(*) as count`;
        const builtSQL = builder.select(getClassSchema(User), model);
        expect(builtSQL.sql).toBe(`SELECT count(*) as count FROM "user-select"`);
        expect(model.isPartial()).toBe(true);
    }
});

test('QueryToSql', () => {
    const User = t.class({
        id: t.number,
        username: t.string,
        password: t.string,
        disabled: t.boolean,
        created: t.date,
    });

    const queryToSql = new SQLFilterBuilder(getClassSchema(User), quoteId('user'), jsonSerializer, new SqlPlaceholderStrategy(), escape, quoteId);

    expect(queryToSql.convert({ id: 123 })).toBe(`user.id = ?`);
    expect(queryToSql.convert({ id: '$id' })).toBe(`user.id = user.id`);

    expect(queryToSql.convert({ username: 'Peter' })).toBe(`user.username = ?`);
    expect(queryToSql.convert({ id: 44, username: 'Peter' })).toBe(`(user.id = ? AND user.username = ?)`);

    expect(queryToSql.convert({ $or: [{ id: 44 }, { username: 'Peter' }] })).toBe(`(user.id = ? OR user.username = ?)`);
    expect(queryToSql.convert({ $and: [{ id: 44 }, { username: 'Peter' }] })).toBe(`(user.id = ? AND user.username = ?)`);

    expect(queryToSql.convert({ id: { $ne: 44 } })).toBe(`user.id != ?`);
    expect(queryToSql.convert({ id: { $eq: 44 } })).toBe(`user.id = ?`);
    expect(queryToSql.convert({ id: { $gt: 44 } })).toBe(`user.id > ?`);
    expect(queryToSql.convert({ id: { $gte: 44 } })).toBe(`user.id >= ?`);
    expect(queryToSql.convert({ id: { $lt: 44 } })).toBe(`user.id < ?`);
    expect(queryToSql.convert({ id: { $lte: 44 } })).toBe(`user.id <= ?`);
    expect(queryToSql.convert({ id: { $in: [44, 55] } })).toBe(`user.id IN (?, ?)`);

    expect(() => queryToSql.convert({ invalidField: { $nin: [44, 55] } })).toThrowError('invalidField not found');

    expect(queryToSql.convert({ id: { $nin: [44, 55] } })).toBe(`user.id NOT IN (?, ?)`);

    expect(() => queryToSql.convert({ id: { $oasdads: 123 } })).toThrow('not supported');
});
