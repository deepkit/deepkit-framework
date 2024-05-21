import { expect, test } from '@jest/globals';
import { DatabaseField, entity, PrimaryKey, ReflectionClass, serializer } from '@deepkit/type';
import { SQLFilterBuilder } from '../src/sql-filter-builder.js';
import { splitDotPath, sql } from '../src/sql-adapter.js';
import { SqlPlaceholderStrategy } from '../src/platform/default-platform.js';
import { SqlBuilder } from '../src/sql-builder.js';
import { adapter, MyPlatform } from './my-platform.js';
import { PreparedAdapter } from '../src/prepare.js';
import { SqlBuilderRegistry } from '../src/sql-builder-registry.js';
import { count, from } from '@deepkit/orm';


test('splitDotPath', () => {
    expect(splitDotPath('addresses.zip')).toEqual(['addresses', 'zip']);
    expect(splitDotPath('addresses[0].zip')).toEqual(['addresses', '[0].zip']);
});

test('sql query', () => {
    @entity.name('user')
    class User {
    }

    const id = 0;
    const query = sql`SELECT * FROM ${User} WHERE id > ${id}`;

    const generated = query.convertToSQL(new MyPlatform(), new SqlPlaceholderStrategy());
    expect(generated.sql).toBe('SELECT * FROM "user" WHERE id > ?');
    expect(generated.params).toEqual([0]);
});


test('select', () => {
    @entity.name('user-select')
    class User {
        id: number & PrimaryKey = 0;
        username!: string;
    }

    {
        const builder = new SqlBuilder(adapter);
        const model = from<User>().select();
        const builtSQL = builder.select(model.state);
        expect(builtSQL.sql).toBe(`SELECT "user-select"."id", "user-select"."username" FROM "user-select"`);
    }

    {
        const builder = new SqlBuilder(adapter);
        const model = from<User>().select(user => {
            return [count('*')];
        });
        const builtSQL = builder.select(model.state);
        expect(builtSQL.sql).toBe(`SELECT count(*) as count FROM "user-select"`);
        // expect(model.isPartial()).toBe(true);
    }
});

test('skip property', () => {
    class Entity {
        id: PrimaryKey & number = 0;
        firstName?: string;
        firstName_tsvector: any & DatabaseField<{ skip: true }> = '';
        anotherone: any & DatabaseField<{ skipMigration: true }> = '';
    }

    const builder = new SqlBuilder(adapter);
    const model = from<Entity>().select();
    // model.adapterName = 'mongo';
    const builtSQL = builder.select(model.state);
    expect(builtSQL.sql).toBe(`SELECT "Entity"."id", "Entity"."firstName", "Entity"."anotherone" FROM "Entity"`);
});

test('QueryToSql', () => {
    class User {
        id!: number & PrimaryKey;
        username!: string;
        password!: string;
        disabled!: boolean;
        created!: Date;
    }

    const platform = new MyPlatform;

    const preparedAdapter: PreparedAdapter = {
        getName() {
            return 'adapter';
        },
        platform: platform,
        preparedEntities: new Map(),
        builderRegistry: new SqlBuilderRegistry()
    }
    const queryToSql = new SQLFilterBuilder(preparedAdapter, ReflectionClass.from(User), platform.quoteIdentifier('user'), serializer, new SqlPlaceholderStrategy());

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

    expect(queryToSql.convert({ id: { $eq: null } })).toBe(`user.id IS NULL`);
    expect(queryToSql.convert({ id: { $ne: null } })).toBe(`user.id IS NOT NULL`);

    expect(() => queryToSql.convert({ invalidField: { $nin: [44, 55] } })).toThrowError('No type found for path invalidField');

    expect(queryToSql.convert({ id: { $nin: [44, 55] } })).toBe(`user.id NOT IN (?, ?)`);

    expect(() => queryToSql.convert({ id: { $oasdads: 123 } })).toThrow('not supported');
});
