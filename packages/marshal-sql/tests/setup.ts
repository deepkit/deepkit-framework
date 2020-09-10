import {Database} from '@super-hornet/marshal-orm';
import {ClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '../index';
import {MySQLDatabaseAdapter} from '../src/mysql-adapter';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ClassSchema | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}
