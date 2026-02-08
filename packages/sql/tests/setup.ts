import { ClassType } from '@deepkit/core';
import { Database } from '@deepkit/orm';
import { ReflectionClass } from '@deepkit/type';

import { SQLDatabaseAdapter } from '../src/sql-adapter.js';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ReflectionClass<any> | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await adapter.createTables(database.entityRegistry);

    return database;
}
