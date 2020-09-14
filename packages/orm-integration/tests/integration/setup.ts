import {ClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '@deepkit/sql';
import {MySQLDatabaseAdapter} from '@deepkit/sql';
import { Database } from '@deepkit/orm';
import {PostgresDatabaseAdapter} from '@deepkit/sql';

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