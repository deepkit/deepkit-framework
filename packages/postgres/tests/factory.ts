import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { PostgresDatabaseAdapter } from '../src/postgres-adapter.js';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new PostgresDatabaseAdapter({host: 'localhost', database: 'postgres', user: 'postgres'});

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.createTables(database.entityRegistry);

    return database;
};
