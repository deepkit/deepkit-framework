import 'reflect-metadata';
import {Entity, f} from '@super-hornet/marshal';
import {Database, DatabaseSession} from '@super-hornet/marshal-orm';
import {MongoDatabaseAdapter, MongoDatabaseConfig} from '@super-hornet/marshal-mongo';
import {performance} from "perf_hooks";

export async function bench(times: number, title: string, exec: () => void | Promise<void>) {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
        await exec();
    }
    const took = performance.now() - start;

    process.stdout.write([
        (1000 / took) * times, 'ops/s',
        title,
        took.toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms,',
        process.memoryUsage().rss / 1024 / 1024, 'MB memory'
    ].join(' ') + '\n');
}

@Entity('marshal')
export class MarshalModel {
    @f ready?: boolean;

    @f.array(String) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f.primary public id: number,
        @f public name: string
    ) {
    }
}


async function createDatabaseSession(dbName: string = 'bench-insert'): Promise<DatabaseSession<MongoDatabaseAdapter>> {
    dbName = dbName.replace(/\s+/g, '-');
    const database = new Database(new MongoDatabaseAdapter(new MongoDatabaseConfig('localhost', dbName)));
    await (await database.adapter.connection.connect()).db(dbName).dropDatabase();
    return database.createSession();
}

(async () => {
    const count = 10_000;

    const database = await createDatabaseSession();
    await database.getConnection().connect();

    for (let j = 1; j <= 150; j++) {
        console.log('round', j);
        await database.query(MarshalModel).deleteMany();
        await bench(1, 'Marshal insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MarshalModel(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                database.add(user);
            }

            await database.commit();
        });

        database.identityMap.clear();
        await bench(1, 'Marshal fetch', async () => {
            const items = await database.query(MarshalModel).find();
        });
    }

    await database.getConnection().close();
})();