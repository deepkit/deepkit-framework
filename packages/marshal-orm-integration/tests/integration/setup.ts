import {ClassSchema} from '@deepkit/marshal';
import {ClassType} from '@deepkit/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '@deepkit/marshal-sql';
import {MySQLDatabaseAdapter} from '@deepkit/marshal-sql';
import { Database } from '@deepkit/marshal-orm';
import {PostgresDatabaseAdapter} from '@deepkit/marshal-sql';

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