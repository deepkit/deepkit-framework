import { Database } from '@deepkit/orm';
import { ClassType } from '@deepkit/core';
import { ReflectionClass, Type } from '@deepkit/type';

export type DatabaseFactory = (entities?: (Type | ReflectionClass<any> | ClassType)[]) => Promise<Database>;

export function executeTest(test: (factory: DatabaseFactory) => any, factory: DatabaseFactory): () => Promise<void> {
    let databases: Database<any>[] = [];

    async function collectedFactory(entities?: (Type | ReflectionClass<any> | ClassType)[]): Promise<Database> {
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
