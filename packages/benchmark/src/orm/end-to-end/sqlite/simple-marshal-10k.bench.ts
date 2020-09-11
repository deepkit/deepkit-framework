import 'reflect-metadata';
import {Entity, t} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import {Database} from '@super-hornet/marshal-orm';
import {SQLiteDatabaseAdapter} from '@super-hornet/marshal-sql';

@Entity('marshal')
export class MarshalModel {
    @t.primary.autoIncrement public id?: number;

    @t ready?: boolean;

    // @t.array(t.string) tags: string[] = [];

    @t priority: number = 0;

    constructor(
        @t public name: string
    ) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
    database.registerEntity(MarshalModel);
    await database.migrate();

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(MarshalModel).deleteMany();
        const bench = new BenchSuite('marshal');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MarshalModel('Peter ' + i);
                user.ready = true;
                user.priority = 5;
                // user.tags = ['a', 'b', 'c'];
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
