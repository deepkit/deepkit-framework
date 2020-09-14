import {Database} from '@deepkit/orm';
import {ClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '../index';
import {MySQLDatabaseAdapter} from '../src/mysql-adapter';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ClassSchema | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}
