/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {DatabaseSession} from './database-session';
import {DatabaseQueryModel, GenericQuery, GenericQueryResolver} from './query';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence, DatabasePersistenceChangeSet} from './database';
import {Changes} from './changes';
import {Entity, PatchResult} from './type';

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    async migrate(classSchemas: Iterable<ClassSchema>) {
    }

    isNativeForeignKeyConstraintSupported(): boolean {
        return false;
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
            createQuery<T>(classType: ClassType<T>) {
                class Resolver<T> extends GenericQueryResolver<T> {
                    async count(model: DatabaseQueryModel<T>): Promise<number> {
                        return Promise.resolve(0);
                    }

                    async delete(model: DatabaseQueryModel<T>): Promise<void> {
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
