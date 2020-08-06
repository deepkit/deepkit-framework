import 'reflect-metadata';
const {performance} = require('perf_hooks');
import {BenchSuite, bench} from '@super-hornet/core';
import {Database, DatabaseSession} from '@super-hornet/marshal-orm';
import {MongoDatabaseAdapter, MongoDatabaseConfig} from '../src/adapter';
import {Entity, f} from '@super-hornet/marshal';
import assert = require('assert');

(global as any).performance = performance;

@Entity('user')
export class User {
    @f ready?: boolean;

    @f.array(f.string) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f.primary id: number,
        @f public name: string
    ) {
    }
}

async function createDatabaseSession(dbName: string = 'testing'): Promise<DatabaseSession<MongoDatabaseAdapter>> {
    dbName = dbName.replace(/\s+/g, '-');
    const database = new Database(new MongoDatabaseAdapter(new MongoDatabaseConfig('localhost', dbName)));
    await (await database.adapter.connection.connect()).db(dbName).dropDatabase();
    return database.createSession();
}

const items = 10_000;
(async () => {
    const database = await createDatabaseSession('benchmark-a');
    await database.getConnection().connect();

    for (let j = 1; j <= 15; j++) {
        await database.query(User).deleteMany();
        await bench(1, 'Marshal insert', async () => {
            for (let i = 1; i <= items; i++) {
                const user = new User(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                database.add(user);
            }

            await database.commit();
        });

        const query = database.query(User).disableIdentityMap();
        assert((await query.find()).length === items);
        // assert((await query.find())[0] instanceof User);
        await bench(1, 'Marshal find', async () => {
            for (const item of await query.find()) {

            }
        });
    }

    database.getConnection().close(true);
})();
