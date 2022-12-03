import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { PostgresDatabaseAdapter } from '../src/postgres-adapter';

export const databaseFactory: DatabaseFactory<PostgresDatabaseAdapter> = async (entities, plugins): Promise<Database<PostgresDatabaseAdapter>> => {
    const adapter = new PostgresDatabaseAdapter({host: 'localhost', database: 'postgres', user: 'postgres'});

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
