import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MySQLDatabaseAdapter } from '../src/mysql-adapter';

export const databaseFactory: DatabaseFactory = async (entities, plugins): Promise<Database> => {
    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', database: 'default', user: 'root' });

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
