import {ClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {MySQLDatabaseAdapter, PostgresDatabaseAdapter, SQLiteDatabaseAdapter} from '@deepkit/sql';
import {Database, DatabaseAdapter} from '@deepkit/orm';
import {MongoDatabaseAdapter} from '@deepkit/mongo';

const databases: Database<any>[] = []

afterAll(() => {
    for (const db of databases) db.disconnect(true);
    databases.splice(0, databases.length);
});

export async function createEnvSetup(schemas: (ClassSchema | ClassType)[]): Promise<Database<DatabaseAdapter>> {
    const driver = process.env['ADAPTER_DRIVER'] || 'sqlite';
    let adapter: DatabaseAdapter | undefined;
    if (driver === 'sqlite') {
        adapter = new SQLiteDatabaseAdapter(':memory:');
    } else if (driver === 'mysql') {
        adapter = new MySQLDatabaseAdapter({host: 'localhost', user: 'root', database: 'default'});
    } else if (driver === 'postgres') {
        adapter = new PostgresDatabaseAdapter({host: 'localhost', database: 'postgres'});
    } else if (driver === 'mongo') {
        adapter = new MongoDatabaseAdapter('mongodb://localhost/bookstore');
    }

    if (!adapter) throw new Error(`Could not detect adapter from ${driver}`);

    const database = new Database(adapter);
    databases.push(database);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}
