import { PrimaryKey, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { assert, IsExact } from "conditional-type-checks";
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';

test('query select', async () => {
    const s = t.schema({
        id: t.number.primary,
        username: t.string
    }, { name: 'User' });

    assert<IsExact<{ id: PrimaryKey<number>, username: string }, InstanceType<typeof s.classType>>>(true);

    const database = new Database(new MemoryDatabaseAdapter());

    {
        const item = await database.query(s).findOne();
        assert<IsExact<InstanceType<typeof s.classType>, typeof item>>(true);
        assert<IsExact<{ id: PrimaryKey<number>, username: string }, typeof item>>(true);
    }

    {
        const item = await database.query(s).select('username').findOne();
        assert<IsExact<InstanceType<typeof s.classType>, typeof item>>(false);
        assert<IsExact<{ id: PrimaryKey<number>, username: string }, typeof item>>(false);
        assert<IsExact<{ username: string }, typeof item>>(true);
    }

    // type Placeholder<T> = () => T;
    // type Resolve<T extends {_: Placeholder<any>}> = T['_'] extends Placeholder<infer K> ? K : never;
    // type Replace<T, R> = T & { _: Placeholder<R> };

    // class Query<T> {
    //     _!: Placeholder<T>;

    //     select<K extends (keyof Resolve<this>)[]>(...select: K): Replace<this, Pick<Resolve<this>, K[number]>> {
    //         // select<K>(select: K): Replace<this, {id: undefined, peter: string }> {
    //         return this as any
    //     }

    //     find(): Resolve<this> {
    //         return undefined as any;
    //     }

    //     // static create<K>(): $<Query, K[]> {
    //     //     return new Query() as any;
    //     // }
    // }

    // interface Model { id: number, username: string };
    // const m = new Query<Model>();
    // // const m: $<Query, Model[]> = new Query() as any;

    // // const m = Query.create<>();
    // const item1 = m.find();
    // item1.username = 'asd';
    // item1.id = 23;

    // const q = m.select('username');
    // const item2 = m.select('username').find();
    // item2.username = 'asd';
    // item2.id = 23;
});
