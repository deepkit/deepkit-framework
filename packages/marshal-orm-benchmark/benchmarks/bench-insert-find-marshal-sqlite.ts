import 'reflect-metadata';
import {Entity, f} from '@super-hornet/marshal';
import {Database} from '@super-hornet/marshal-orm';
import {MongoDatabaseAdapter} from '@super-hornet/marshal-mongo';
import {performance} from 'perf_hooks';
import {SQLiteDatabaseAdapter} from '@super-hornet/marshal-sql';
import {ClassType} from '@super-hornet/core';

export async function bench(times: number, title: string, exec: () => void | Promise<void>) {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
        await exec();
    }
    const took = performance.now() - start;

    process.stdout.write([
        (1000 / took) * times, 'ops/s',
        title,
        (took/times).toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms/op,',
        process.memoryUsage().rss / 1024 / 1024, 'MB memory'
    ].join(' ') + '\n');
}

@Entity('marshal')
export class MarshalModel {
    @f ready?: boolean;

    // @f.array(f.string) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f.primary public id: number,
        @f public name: string
    ) {
    }
}

async function createDatabaseSession(types: ClassType[]) {
    const adapter = new SQLiteDatabaseAdapter(':memory');
    const database = new Database(adapter);
    database.registerEntity(...types);
    const tables = adapter.platform.createTables(types);
    const sql = adapter.platform.getAddTablesDDL(tables);
    for (const query of sql) await adapter.connection.exec(query);
    return database;
}

(async () => {
    const count = 10_000;
    const database = await createDatabaseSession([MarshalModel]);
    for (let j = 1; j <= 10; j++) {
        console.log('round', j);
        const session = database.createSession();
        await session.query(MarshalModel).deleteMany();
        await bench(1, 'Marshal insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MarshalModel(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                // user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench(10, 'Marshal fetch', async () => {
            await session.query(MarshalModel).disableIdentityMap().find();
        });

        // const dbItems = await session.query(MarshalModel).find();
        // for (const item of dbItems) {
        //     item.priority++;
        // }
        // await bench(1, 'update', async () => {
        //     await session.commit();
        // });
        //
        // await bench(1, 'remove', async () => {
        //     for (const item of dbItems) {
        //         session.remove(item);
        //     }
        //
        //     await session.commit();
        // });
    }

    database.disconnect();
})();