import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';
import { mkdtempSync } from 'fs';
import { join } from 'path';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new SQLiteDatabaseAdapter(join(mkdtempSync('/tmp/', 'utf8'), 'db.sqlite'));

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.createTables(database.entityRegistry);

    return database;
};
