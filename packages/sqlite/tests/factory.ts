import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';
import { mkdtempSync } from 'fs';
import { join } from 'path';

export const databaseFactory: DatabaseFactory = async (entities, plugins): Promise<Database> => {
    const adapter = new SQLiteDatabaseAdapter(join(mkdtempSync('/tmp/', 'utf8'), 'db.sqlite'));

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
