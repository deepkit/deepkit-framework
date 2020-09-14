import {DatabaseSession} from './database-session';
import {DatabaseQueryModel, Entity, GenericQuery} from './query';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence} from './database';

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    async migrate(classSchemas: Iterable<ClassSchema>) {
    }

    createPersistence(databaseSession: DatabaseSession<this>): DatabasePersistence {
        class Persistence extends DatabasePersistence {
            async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                return Promise.resolve(undefined);
            }

            async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                return Promise.resolve(undefined);
            }
        }

        return new Persistence;
    }

    disconnect(force?: boolean): void {
    }

    getName(): string {
        return 'memory';
    }

    getSchemaName(): string {
        return '';
    }

    queryFactory(databaseSession: DatabaseSession<this>): DatabaseAdapterQueryFactory {
        return new class {
            createQuery(classType: ClassType<any>) {
                class Resolver {
                }

                class Query extends GenericQuery<any, any, any> {
                }

                return new Query(getClassSchema(classType), new DatabaseQueryModel(), new Resolver);
            }
        };
    }
}
