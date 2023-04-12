import { Database } from '@deepkit/orm';
import { ClassType } from '@deepkit/core';
import { SQLDatabaseAdapter } from '../src/sql-adapter.js';
import { ReflectionClass } from '@deepkit/type';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ReflectionClass<any> | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await adapter.createTables(database.entityRegistry);

    return database;
}
