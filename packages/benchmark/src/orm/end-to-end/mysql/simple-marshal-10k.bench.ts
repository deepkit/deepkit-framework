import 'reflect-metadata';
import {Entity, t} from '@deepkit/type';
import {BenchSuite} from '@deepkit/core';
import {atomicChange, Database} from '@deepkit/orm';
import {MySQLDatabaseAdapter} from '@deepkit/sql';

@Entity('deepkit')
export class DeepkitModel {
    @t.primary public id?: number;

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
    const database = new Database(new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default' }));
    database.registerEntity(DeepkitModel);
    await database.migrate();

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(DeepkitModel).deleteMany();
        const bench = new BenchSuite('deepkit');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new DeepkitModel('Peter ' + i);
                user.id = i;
                user.ready = true;
                user.priority = 5;
                // user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await session.query(DeepkitModel).disableIdentityMap().find();
        });

        const dbItems = await session.query(DeepkitModel).find();
        for (const item of dbItems) {
            item.priority++;
        }
        atomicChange(dbItems[0]).increase('priority', 2);

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
