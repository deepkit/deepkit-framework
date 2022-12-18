import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';
import { MongoDatabaseAdapter } from '../src/adapter';

export const databaseFactory: DatabaseFactory = async (entities, plugins): Promise<Database> => {
    const adapter = new MongoDatabaseAdapter('mongodb://127.0.0.1/orm-integration');

    const database = new Database(adapter);
    if (entities) {
        database.registerEntity(...entities);
        if (plugins) database.registerPlugin(...plugins);

        //drop&recreate collection is incredible slow in mongodb, so we work around that
        for (const entity of database.entityRegistry.entities) {
            await database.query(entity).deleteMany();
        }
        await adapter.resetAutoIncrementSequences();

        // await adapter.client.dropDatabase('orm-integration');
        await database.migrate();
    }

    return database;
};
