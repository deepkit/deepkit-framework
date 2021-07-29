import { test } from '@jest/globals';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';

test('api', async () => {
    const database = new Database(new MemoryDatabaseAdapter());

    const session = database.createSession();

    //this starts a timer and prints a warning when no committed/rollback'd in time
    session.useTransaction();

    await session.flush();

    await session.commit();

    await session.rollback();

    await session.transaction(async () => {

    });
});
