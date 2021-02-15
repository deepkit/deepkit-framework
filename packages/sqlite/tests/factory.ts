import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new SQLiteDatabaseAdapter();

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.createTables([...database.entities]);

    return database;
};
