import {Database} from '@deepkit/marshal-orm';
import {ClassSchema} from '@deepkit/marshal';
import {ClassType} from '@deepkit/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '../index';
import {MySQLDatabaseAdapter} from '../src/mysql-adapter';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ClassSchema | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}
