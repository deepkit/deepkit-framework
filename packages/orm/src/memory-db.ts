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

import { DatabaseSession } from './database-session';
import { DatabaseQueryModel, GenericQuery, GenericQueryResolver } from './query';
import { ClassSchema, getClassSchema } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence, DatabasePersistenceChangeSet } from './database';
import { Changes } from './changes';
import { Entity, PatchResult } from './type';
import { findQueryList } from './utils';

type SimpleStore<T> = { items: Map<any, T> };

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    protected store = new Map<ClassSchema, SimpleStore<any>>();

    async migrate(classSchemas: Iterable<ClassSchema>) {
    }

    isNativeForeignKeyConstraintSupported(): boolean {
        return false;
    }

    getStore<T>(classSchema: ClassSchema<T>): SimpleStore<T> {
        let store = this.store.get(classSchema);
        if (!store) {
            store = { items: new Map };
            this.store.set(classSchema, store);
        }
        return store;
    }

    createPersistence(): DatabasePersistence {
        const adapter = this;
        class Persistence extends DatabasePersistence {
            async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                const store = adapter.getStore(classSchema);

                const primaryKey = classSchema.getPrimaryFieldName();
                for (const item of items) {
                    store.items.delete(item[primaryKey] as any);
                }
            }

            async insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
                const store = adapter.getStore(classSchema);

                const primaryKey = classSchema.getPrimaryFieldName();
                for (const item of items) {
                    store.items.set(item[primaryKey] as any, item);
                }
            }

            async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
                //nothing to do, since we store references
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

        const find = <T>(classSchema: ClassSchema, model: DatabaseQueryModel<T>): T[] => {
            const items = this.getStore(classSchema).items;
            let filtered = model.filter ? findQueryList<T>([...items.values()], model.filter) : [...items.values()];
            if (model.skip && model.limit) {
                filtered = filtered.slice(model.skip, model.skip + model.limit);
            } else if (model.limit) {
                filtered = filtered.slice(0, model.limit);
            } else if (model.skip) {
                filtered = filtered.slice(model.skip);
            }
            return filtered;
        }

        const remove = <T>(classSchema: ClassSchema<T>, toDelete: T[]) => {
            const items = this.getStore(classSchema).items;

            const primaryKey = classSchema.getPrimaryFieldName();
            for (const item of toDelete) {
                items.delete(item[primaryKey] as any);
            }
        }

        return new class {
            createQuery<T extends Entity>(classType: ClassType<T> | ClassSchema<T>): GenericQuery<T> {
                const schema = getClassSchema(classType);

                class Resolver extends GenericQueryResolver<T> {
                    async count(model: DatabaseQueryModel<T>): Promise<number> {
                        const items = find(schema, model);
                        return items.length;
                    }

                    async delete(model: DatabaseQueryModel<T>): Promise<void> {
                        const items = find(schema, model);
                        remove(schema, items);
                    }

                    async find(model: DatabaseQueryModel<T>): Promise<T[]> {
                        const items = find(schema, model);
                        return items;
                    }
                    
                    async findOneOrUndefined(model: DatabaseQueryModel<T>): Promise<T | undefined> {
                        const items = find(schema, model);
                        return items[0];
                    }

                    async has(model: DatabaseQueryModel<T>): Promise<boolean> {
                        const items = find(schema, model);
                        return items.length > 0;
                    }

                    async patch(model: DatabaseQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
                        const items = find(schema, model);
                        const primaryKey = schema.getPrimaryFieldName();

                        patchResult.modified = items.length;
                        for (const item of items) {
                            patchResult.primaryKeys.push(item[primaryKey] as any);
                            if (model.returning) {
                                for (const f of model.returning) {
                                    if (!patchResult.returning[f]) patchResult.returning[f] = [];
                                    const v = patchResult.returning[f];
                                    if (v) v.push(item[f]);
                                }
                            }
                            if (changes.$inc) {
                                for (const [name, v] of Object.entries(changes.$inc)) {
                                    (item as any)[name] += v;
                                }
                            }

                            if (changes.$unset) {
                                for (const name of Object.keys(changes.$unset)) {
                                    (item as any)[name] = undefined;
                                }
                            }

                            if (changes.$set) {
                                for (const [name, v] of Object.entries(changes.$set)) {
                                    (item as any)[name] = v;
                                }
                            }
                        }
                    }
                }

                class Query extends GenericQuery<T> {
                }

                return new Query(getClassSchema(classType), databaseSession, new Resolver(getClassSchema(classType), databaseSession));
            }
        };
    }
}
