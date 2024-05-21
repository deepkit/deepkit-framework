import { Database, DatabaseAdapter, DatabasePlugin } from '@deepkit/orm';
import { AbstractClassType, formatError } from '@deepkit/core';
import { ReflectionClass, Type } from '@deepkit/type';

export type DatabaseFactory<T extends DatabaseAdapter = DatabaseAdapter> = (entities?: (Type | ReflectionClass<any> | AbstractClassType)[], plugins?: DatabasePlugin[]) => Promise<Database<T>>;

export async function executeTest(test: (factory: DatabaseFactory) => any, factory: DatabaseFactory): Promise<void> {
    let databases: Database<any>[] = [];

    const collectedFactory: DatabaseFactory<any> = async (entities, plugins) => {
        const database = await factory(entities, plugins);
        databases.push(database);
        return database;
    }

    try {
        await test(collectedFactory);
    } catch (error) {
        console.log(formatError(error));
        throw error;
    } finally {
        for (const db of databases) {
            db.disconnect(true);
        }
    }
}
