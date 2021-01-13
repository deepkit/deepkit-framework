import { afterAll } from '@jest/globals';
import { ClassSchema } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { MySQLDatabaseAdapter, PostgresDatabaseAdapter, SQLDatabaseAdapter, SQLiteDatabaseAdapter } from '@deepkit/sql';
import { Database, DatabaseAdapter } from '@deepkit/orm';
import { GenericCommand, MongoDatabaseAdapter } from '@deepkit/mongo';

const databases: Database<any>[] = []

afterAll(() => {
    for (const db of databases) db.disconnect(true);
    databases.splice(0, databases.length);
});

export async function createEnvSetup(schemas: (ClassSchema | ClassType)[]): Promise<Database<DatabaseAdapter>> {
    const driver = process.env['ADAPTER_DRIVER'] || 'sqlite';
    let adapter: DatabaseAdapter | undefined;
    if (driver === 'sqlite') {
        adapter = new SQLiteDatabaseAdapter('/tmp/orm-integration.sqlite');
    } else if (driver === 'mysql') {
        adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default' });
    } else if (driver === 'postgres') {
        adapter = new PostgresDatabaseAdapter({ host: 'localhost', database: 'postgres' });
    } else if (driver === 'mongo') {
        adapter = new MongoDatabaseAdapter('mongodb://localhost/orm-integration');
    }

    if (!adapter) throw new Error(`Could not detect adapter from ${driver}`);

    const database = new Database(adapter);
    databases.push(database);
    database.registerEntity(...schemas);
    if (adapter instanceof SQLDatabaseAdapter) {
        await adapter.createTables([...database.entities])
    } else {
        await database.migrate();
    }

    if (adapter instanceof MongoDatabaseAdapter) {
        await adapter.resetAutoIncrementSequences();
        await adapter.client.execute(new GenericCommand({ dropDatabase: 1, $db: 'orm-integration' }));
    }

    return database;
}
