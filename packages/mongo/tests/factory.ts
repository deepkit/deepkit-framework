import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MongoDatabaseAdapter } from '../src/adapter';

export const databaseFactory: DatabaseFactory = async (entities): Promise<Database> => {
    const adapter = new MongoDatabaseAdapter('mongodb://localhost/orm-integration');

    const database = new Database(adapter);
    if (entities) {
        database.registerEntity(...entities);

        //drop&recreate collection is incredible slow in mongodb, so we work around that
        for (const entity of entities) {
            await database.query(entity).deleteMany();
        }
        await adapter.resetAutoIncrementSequences();

        // await adapter.client.dropDatabase('orm-integration');
        await database.migrate();
    }

    return database;
};
