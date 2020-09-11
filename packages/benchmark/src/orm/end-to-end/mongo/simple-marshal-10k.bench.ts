import 'reflect-metadata';
import {Entity, t} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import {Database} from '@super-hornet/marshal-orm';
import {MongoDatabaseAdapter} from '@super-hornet/marshal-mongo';

@Entity('marshal')
export class MarshalModel {
    @t.mongoId.primary public _id?: string;
    @t ready?: boolean;

    @t.array(t.string) tags: string[] = [];

    @t priority: number = 0;

    constructor(
        @t public id: number,
        @t public name: string
    ) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/bench-small-marshal'));

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(MarshalModel).deleteMany();
        const bench = new BenchSuite('marshal');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MarshalModel(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await session.query(MarshalModel).disableIdentityMap().find();
        });

        const dbItems = await session.query(MarshalModel).find();
        for (const item of dbItems) {
            item.priority++;
        }

        await bench.runAsyncFix(1, 'update', async () => {
            await session.commit();
        });

        await bench.runAsyncFix(1, 'remove', async () => {
            for (const item of dbItems) {
                session.remove(item);
            }

            await session.commit();
        });
    }

    database.disconnect();
}
