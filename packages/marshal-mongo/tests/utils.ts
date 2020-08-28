import {Database, DatabaseSession} from '@super-hornet/marshal-orm';
import {MongoDatabaseAdapter} from '../src/adapter';
import {GenericCommand} from '../src/client/command/generic';

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

export async function createDatabaseSession(dbName: string = 'testing'): Promise<DatabaseSession<MongoDatabaseAdapter>> {
    dbName = dbName.replace(/\s+/g, '-');
    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/' + dbName));
    await database.adapter.client.execute(new GenericCommand({
        dropDatabase: 1,
        $db: dbName,
    }));
    databases.push(database);
    return database.createSession();
}

afterEach(async () => {
    for (const database of databases) {
        await database.disconnect(true);
    }
    databases.splice(0, databases.length);
});
