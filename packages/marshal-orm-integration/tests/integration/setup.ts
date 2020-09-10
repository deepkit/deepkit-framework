import {ClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '@super-hornet/marshal-sql';
import {MySQLDatabaseAdapter} from '@super-hornet/marshal-sql';
import { Database } from '@super-hornet/marshal-orm';
import {PostgresDatabaseAdapter} from '@super-hornet/marshal-sql';

const databases: Database<any>[] = []

afterAll(() => {
    for (const db of databases) db.disconnect(true);
    databases.splice(0, databases.length);
});

export async function createEnvSetup(schemas: (ClassSchema | ClassType)[]): Promise<Database<SQLDatabaseAdapter>> {
    const driver = process.env['ADAPTER_DRIVER'] || 'sqlite';
    let adapter: SQLDatabaseAdapter | undefined;
    if (driver === 'sqlite') {
        adapter = new SQLiteDatabaseAdapter(':memory:');
    } else if (driver === 'mysql') {
        adapter = new MySQLDatabaseAdapter('localhost');
    } else if (driver === 'postgres') {
        adapter = new PostgresDatabaseAdapter('localhost');
    }

    if (!adapter) throw new Error(`Could not detect adapter from ${driver}`);

    const database = new Database(adapter);
    databases.push(database);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}