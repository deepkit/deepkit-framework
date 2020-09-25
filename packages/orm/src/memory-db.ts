import {DatabaseSession} from './database-session';
import {DatabaseQueryModel, Entity, GenericQuery, GenericQueryResolver, PatchResult} from './query';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence, DatabasePersistenceChangeSet} from './database';
import {Changes} from './changes';

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    async migrate(classSchemas: Iterable<ClassSchema>) {
    }

    createPersistence(): DatabasePersistence {
        class Persistence extends DatabasePersistence {
            async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                return Promise.resolve(undefined);
            }

            async insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                return Promise.resolve(undefined);
            }

            async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
                return Promise.resolve(undefined);
            }

            async release() {

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
                class Resolver<T> extends GenericQueryResolver<T> {
                    async count(model: DatabaseQueryModel<T>): Promise<number> {
                        return Promise.resolve(0);
                    }

                    async delete(model: DatabaseQueryModel<T>): Promise<number> {
                        return Promise.resolve(0);
                    }

                    async find(model: DatabaseQueryModel<T>): Promise<T[]> {
                        return Promise.resolve([]);
                    }

                    async findOneOrUndefined(model: DatabaseQueryModel<T>): Promise<T | undefined> {
                        return Promise.resolve(undefined);
                    }

                    async has(model: DatabaseQueryModel<T>): Promise<boolean> {
                        return Promise.resolve(false);
                    }

                    async patch(model: DatabaseQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
                    }
                }

                class Query<T> extends GenericQuery<T> {
                    protected resolver = new Resolver<T>(this.classSchema, databaseSession);
                }

                return new Query(getClassSchema(classType), databaseSession);
            }
        };
    }
}
