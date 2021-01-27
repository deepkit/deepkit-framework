import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MongoDatabaseAdapter } from '../src/adapter';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new MongoDatabaseAdapter('mongodb://localhost/orm-integration');

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await database.migrate();
    await adapter.resetAutoIncrementSequences();
    await adapter.client.dropDatabase('orm-integration');

    return database;
};
