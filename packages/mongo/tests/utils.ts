import { afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';

import { Database } from '@deepkit/orm';

import { MongoDatabaseAdapter } from '../src/adapter.js';

/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export async function bench(times: number, title: string, exec: (i: number) => Promise<void> | void) {
    const start = performance.now();

    for (let i = 0; i < times; i++) {
        await exec(i);
    }

    const took = performance.now() - start;

    console.log(times, 'x benchmark', title, took, 'ms', took / times, 'per item');
}

const databases: Database<MongoDatabaseAdapter>[] = [];

export async function createDatabase(dbName: string = 'testing'): Promise<Database<MongoDatabaseAdapter>> {
    dbName = dbName.replace(/\s+/g, '-');
    const database = new Database(new MongoDatabaseAdapter('mongodb://127.0.0.1/' + dbName));
    await database.adapter.client.dropDatabase(dbName);
    databases.push(database);
    return database;
}

afterEach(async () => {
    for (const database of databases) {
        await database.disconnect(true);
    }
    databases.splice(0, databases.length);
});
