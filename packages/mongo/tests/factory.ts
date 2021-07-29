import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MongoDatabaseAdapter } from '../src/adapter';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new MongoDatabaseAdapter('mongodb://localhost:27018/orm-integration');

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    await adapter.client.dropDatabase('orm-integration');

    await database.migrate();

    return database;
};
