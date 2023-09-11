import { PrimaryKey } from '@deepkit/type';
import { test } from '@jest/globals';
import { Database } from '../src/lib/database.js';
import { MemoryDatabaseAdapter } from '../src/lib/memory-db.js';

test('query', () => {
    interface User {
        id: number & PrimaryKey;
        username: string;
    }

    const database = new Database(new MemoryDatabaseAdapter());
    const query = database.query<User>();
});
