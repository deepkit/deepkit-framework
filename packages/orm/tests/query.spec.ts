import { getClassSchema, plainToClass, PrimaryKey, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { assert, IsExact } from "conditional-type-checks";
import { BaseQuery, Methods, Query } from '../src/query';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { ClassType } from '@deepkit/core';
import { DeleteResult, Entity } from '../src/type';
import { addListener } from 'process';

test('query select', async () => {
    const s = t.schema({
        id: t.number.primary,
        username: t.string
    }, { name: 'User' });

    assert<IsExact<{ id: PrimaryKey<number>, username: string }, InstanceType<typeof s.classType>>>(true);

    const database = new Database(new MemoryDatabaseAdapter());
    await database.persist(plainToClass(s, { id: 0, username: 'Peter' }));
    await database.persist(plainToClass(s, { id: 0, username: 'Peter' }));

    {
        const item = await database.query(s).findOne();
        expect(item.username).toBe('Peter');
        assert<IsExact<InstanceType<typeof s.classType>, typeof item>>(true);
        assert<IsExact<{ id: PrimaryKey<number>, username: string }, typeof item>>(true);
    }

    {
        const item = await database.query(s).select('username').findOne();
        expect(item.username).toBe('Peter');
        assert<IsExact<InstanceType<typeof s.classType>, typeof item>>(false);
        assert<IsExact<{ id: PrimaryKey<number>, username: string }, typeof item>>(false);
        assert<IsExact<{ username: string }, typeof item>>(true);
    }
});

test('query lift', async () => {
    const s = t.schema({
        id: t.number.primary,
        username: t.string,
        openBillings: t.number.default(0),
    }, { name: 'User' });

    const database = new Database(new MemoryDatabaseAdapter());
    const q = database.query(s);

    await database.persist(plainToClass(s, { id: 0, username: 'foo' }));
    await database.persist(plainToClass(s, { id: 1, username: 'bar', openBillings: 5 }));

    class UserQuery<T extends { username: string }> extends Query<T> {
        findAllUserNames() {
            return this.findField('username');
        }
    }

    class BilligQuery<T extends { openBillings: number }> extends Query<T> {
        due() {
            return this.addFilter('openBillings', { $gt: 0 });
        }
    }

    expect(q.isMemoryDb()).toBe(true);

    expect(q.lift(UserQuery).isMemoryDb()).toBe(true);


    {
        const items = await q.lift(UserQuery).find();
        assert<IsExact<{ username: string, openBillings: number, id: PrimaryKey<number> }[], typeof items>>(true);
    }

    {
        const items = await q.lift(UserQuery).find();
        assert<IsExact<{ username: string, openBillings: number, id: PrimaryKey<number> }[], typeof items>>(true);
    }

    {
        const items = await q.lift(UserQuery).select('id').find();
        assert<IsExact<{ id: PrimaryKey<number> }[], typeof items>>(true);
    }

    {
        const items = await UserQuery.from(q).find();
        assert<IsExact<{ username: string, openBillings: number, id: PrimaryKey<number> }[], typeof items>>(true);
    }

    {
        const items = await UserQuery.from(q).select('id').find();
        assert<IsExact<{ id: PrimaryKey<number> }[], typeof items>>(true);
    }

    {
        const names = await UserQuery.from(q).findAllUserNames();
        expect(names).toEqual(['foo', 'bar']);
    }

    {
        const names = await q.lift(UserQuery).findAllUserNames();
        expect(names).toEqual(['foo', 'bar']);
    }

    {
        const lifted = q.lift(UserQuery).lift(BilligQuery);
        assert<IsExact<UserQuery<any>['findAllUserNames'], typeof lifted['findAllUserNames']>>(true);
    }

    // {
    //     const lifted = BilligQuery.from(UserQuery.from(q));
    //     assert<IsExact<UserQuery<any>['findAllUserNames'], typeof lifted['findAllUserNames']>>(true);
    // }

    {
        const items = await UserQuery.from(q).filter({ username: 'foo' }).findAllUserNames();
        expect(items).toEqual(['foo']);
        assert<IsExact<string[], typeof items>>(true);
    }

    {
        const items = await q.lift(UserQuery).filter({ username: 'foo' }).findAllUserNames();
        expect(items).toEqual(['foo']);
        assert<IsExact<string[], typeof items>>(true);
    }

    {
        const items = await q.lift(UserQuery).lift(BilligQuery).findAllUserNames();
        expect(items).toEqual(['foo', 'bar']);
        assert<IsExact<string[], typeof items>>(true);
    }

    {
        const items = await q.lift(UserQuery).lift(BilligQuery).due().findAllUserNames();
        expect(items).toEqual(['bar']);
        assert<IsExact<string[], typeof items>>(true);
    }
});
