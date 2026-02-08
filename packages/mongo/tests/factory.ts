import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';

import { MongoDatabaseAdapter } from '../src/adapter.js';

export const databaseFactory: DatabaseFactory<MongoDatabaseAdapter> = async (
    entities,
    plugins,
): Promise<Database<MongoDatabaseAdapter>> => {
    const host = process.env.MONGO_HOST || '127.0.0.1';
    const port = process.env.MONGO_PORT || '27117';
    const db = process.env.MONGO_DB || 'orm-integration';
    const connectionString = process.env.MONGO_URL || `mongodb://${host}:${port}/${db}`;
    const adapter = new MongoDatabaseAdapter(connectionString);

    const database = new Database<MongoDatabaseAdapter>(adapter);
    if (entities) {
        database.registerEntity(...entities);
        if (plugins) database.registerPlugin(...plugins);

        //drop&recreate collection is incredible slow in mongodb, so we work around that
        for (const entity of database.entityRegistry.all()) {
            await database.query(entity).deleteMany();
        }
        await adapter.resetAutoIncrementSequences();

        // await adapter.client.dropDatabase('orm-integration');
        await database.migrate();
    }

    return database;
};
