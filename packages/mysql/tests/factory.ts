import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MySQLDatabaseAdapter } from '../src/mysql-adapter';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new MySQLDatabaseAdapter({host: 'localhost', database: 'default', user: 'root'});

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.createTables([...database.entities]);

    return database;
};
