import {DatabaseSession} from './database-session';
import {DatabaseQueryModel, Entity, GenericQuery} from './query';
import {ClassSchema, getClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabaseConnection, DatabasePersistence} from './database';

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    createConnection(): DatabaseConnection {
        class Connection implements DatabaseConnection {
            isInTransaction() {
                return false;
            }
        }

        return new Connection;
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
