import { PrimaryKey } from '@deepkit/type';
import { test } from '@jest/globals';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';

test('query', () => {
    interface User {
        id: number & PrimaryKey;
        username: string;
    }

    const database = new Database(new MemoryDatabaseAdapter());
    const query = database.query<User>();
});
