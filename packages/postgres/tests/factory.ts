import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';

import { PostgresDatabaseAdapter } from '../src/postgres-adapter.js';

export const databaseFactory: DatabaseFactory<PostgresDatabaseAdapter> = async (
    entities,
    plugins,
): Promise<Database<PostgresDatabaseAdapter>> => {
    const adapter = new PostgresDatabaseAdapter({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '15432', 10),
        database: process.env.POSTGRES_DB || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || undefined,
    });

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
