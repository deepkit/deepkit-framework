import { Database } from '@deepkit/orm';
import { MySQLDatabaseAdapter } from '../src/mysql-adapter';

export async function databaseFactory(entities): Promise<Database<MySQLDatabaseAdapter>> {
    const adapter = new MySQLDatabaseAdapter({host: 'localhost', database: 'default', user: 'root'});

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.createTables([...database.entities]);

    return database;
};
