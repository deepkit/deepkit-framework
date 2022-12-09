import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';
import { join } from 'path';

export const databaseFactory: DatabaseFactory<SQLiteDatabaseAdapter> = async (entities, plugins): Promise<Database<SQLiteDatabaseAdapter>> => {
    const adapter = new SQLiteDatabaseAdapter(join('/tmp/', 'db.sqlite'));

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
