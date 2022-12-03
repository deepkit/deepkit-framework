import { Database, DatabaseAdapter, DatabasePlugin } from '@deepkit/orm';
import { AbstractClassType } from '@deepkit/core';
import { ReflectionClass, Type } from '@deepkit/type';

export type DatabaseFactory<T extends DatabaseAdapter = DatabaseAdapter> = (entities?: (Type | ReflectionClass<any> | AbstractClassType)[], plugins?: DatabasePlugin[]) => Promise<Database<T>>;

export function executeTest(test: (factory: DatabaseFactory) => any, factory: DatabaseFactory): () => Promise<void> {
    let databases: Database<any>[] = [];

    async function collectedFactory(entities?: (Type | ReflectionClass<any> | AbstractClassType)[]): Promise<Database> {
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
