import { ClassSchema } from '@deepkit/type';
import { Database, DatabaseAdapter } from '@deepkit/orm';
import { ClassType } from '@deepkit/core';

export type DatabaseFactory = (entities?: (ClassSchema | ClassType)[]) => Promise<Database>;

export function executeTest(test: (factory: DatabaseFactory) => any, factory: DatabaseFactory): () => Promise<void> {
    let databases: Database<any>[] = [];

    async function collectedFactory(entities?: (ClassSchema | ClassType)[]): Promise<Database> {
        const database = await factory(entities);
        databases.push(database);
        return database;
    }

    return async () => {
        try {
            await test(collectedFactory);
        } finally {
            for (const db of databases) {
                db.disconnect(true);
            }
        }
    };
}