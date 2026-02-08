import { test } from '@jest/globals';

import { PrimaryKey } from '@deepkit/type';

import { Database } from '../src/database.js';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';

test('query', () => {
    interface User {
        id: number & PrimaryKey;
        username: string;
    }

    const database = new Database(new MemoryDatabaseAdapter());
    const query = database.query<User>();
});
