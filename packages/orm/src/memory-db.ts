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
import { ClassSchema, CompilerState, getClassSchema, jsonSerializer, PropertySchema } from '@deepkit/type';
import { ClassType, deletePathValue, getPathValue, setPathValue } from '@deepkit/core';
import { DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence, DatabasePersistenceChangeSet } from './database';
import { Changes } from './changes';
import { DeleteResult, Entity, PatchResult } from './type';
import { findQueryList } from './utils';
import { convertQueryFilter } from './query-filter';
import { Formatter } from './formatter';

type SimpleStore<T> = { items: Map<any, T>, autoIncrement: number };

const memorySerializer = new class extends jsonSerializer.fork('memory') { };

memorySerializer.fromClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

memorySerializer.toClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

memorySerializer.fromClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

memorySerializer.toClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

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
            store = { items: new Map, autoIncrement: 0 };
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
                const serializer = memorySerializer.for(classSchema);
                const autoIncrement = classSchema.getAutoIncrementField();

                const primaryKey = classSchema.getPrimaryFieldName();
                for (const item of items) {
                    if (autoIncrement) {
                        store.autoIncrement++;
                        item[autoIncrement.name as keyof T & string] = store.autoIncrement as any;
                    }
                    store.items.set(item[primaryKey] as any, serializer.serialize(item));
                }
            }

            async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
                const store = adapter.getStore(classSchema);
                const serializer = memorySerializer.for(classSchema);
                const primaryKey = classSchema.getPrimaryFieldName();

                for (const changeSet of changeSets) {
                    store.items.set(changeSet.item[primaryKey] as any, serializer.serialize(changeSet.item));
                }
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
        const adapter = this;

        const find = <T>(classSchema: ClassSchema, model: DatabaseQueryModel<T>): T[] => {
            const rawItems = [...this.getStore(classSchema).items.values()];
            const serializer = memorySerializer.for(classSchema);
            const items = rawItems.map(v => serializer.deserialize(v));

            if (model.filter) {
                model.filter = convertQueryFilter(classSchema, model.filter, (convertClassType: ClassSchema, path: string, value: any) => {
                    //this is important to convert relations to its foreignKey value
                    return serializer.serializeProperty(path, value);
                });
            }

            let filtered = model.filter ? findQueryList<T>(items, model.filter) : items;

            if (model.hasJoins()) {
                throw new Error('MemoryDatabaseAdapter does not support joins. Please use another lightweight adapter like SQLite.');
            }

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

                    protected createFormatter(withIdentityMap: boolean = false) {
                        return new Formatter(
                            this.classSchema,
                            memorySerializer,
                            this.databaseSession.getHydrator(),
                            withIdentityMap ? this.databaseSession.identityMap : undefined
                        );
                    }

                    async count(model: DatabaseQueryModel<T>): Promise<number> {
                        const items = find(schema, model);
                        return items.length;
                    }

                    async delete(model: DatabaseQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
                        const items = find(schema, model);
                        const primaryKey = schema.getPrimaryFieldName();
                        for (const item of items) {
                            deleteResult.primaryKeys.push(item[primaryKey] as any);
                        }
                        remove(schema, items);
                    }

                    async find(model: DatabaseQueryModel<T>): Promise<T[]> {
                        const items = find(schema, model);
                        const formatter = this.createFormatter(model.withIdentityMap);
                        return items.map(v => formatter.hydrate(model, v));
                    }

                    async findOneOrUndefined(model: DatabaseQueryModel<T>): Promise<T | undefined> {
                        const items = find(schema, model);

                        if (items[0]) return this.createFormatter(model.withIdentityMap).hydrate(model, items[0]);
                        return undefined;
                    }

                    async has(model: DatabaseQueryModel<T>): Promise<boolean> {
                        const items = find(schema, model);
                        return items.length > 0;
                    }

                    async patch(model: DatabaseQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
                        const items = find(schema, model);
                        const store = adapter.getStore(schema);
                        const primaryKey = schema.getPrimaryFieldName();
                        const serializer = memorySerializer.for(schema);

                        patchResult.modified = items.length;
                        for (const item of items) {

                            if (changes.$inc) {
                                for (const [path, v] of Object.entries(changes.$inc)) {
                                    setPathValue(item, path, getPathValue(item, path) + v);
                                }
                            }

                            if (changes.$unset) {
                                for (const path of Object.keys(changes.$unset)) {
                                    deletePathValue(item, path);
                                }
                            }

                            if (changes.$set) {
                                for (const [path, v] of Object.entries(changes.$set)) {
                                    setPathValue(item, path, v);
                                }
                            }

                            if (model.returning) {
                                for (const f of model.returning) {
                                    if (!patchResult.returning[f]) patchResult.returning[f] = [];
                                    const v = patchResult.returning[f];
                                    if (v) v.push(item[f]);
                                }
                            }

                            patchResult.primaryKeys.push(item[primaryKey] as any);
                            store.items.set(item[primaryKey] as any, serializer.serialize(item));
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
