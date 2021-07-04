/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseSession } from './database-session';
import { DatabaseQueryModel, GenericQueryResolver, Query } from './query';
import { Changes, ClassSchema, CompilerState, getClassSchema, jsonSerializer, PropertySchema } from '@deepkit/type';
import { AbstractClassType, deletePathValue, getPathValue, setPathValue } from '@deepkit/core';
import { DatabaseAdapter, DatabaseAdapterQueryFactory, DatabasePersistence, DatabasePersistenceChangeSet } from './database-adapter';
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

function sortAsc(a: any, b: any) {
    if (a > b) return +1;
    if (a < b) return -1;
    return 0;
}

function sortDesc(a: any, b: any) {
    if (a > b) return -1;
    if (a < b) return +1;
    return 0;
}

function sort(items: any[], field: string, sortFn: typeof sortAsc | typeof sortAsc): void {
    items.sort((a, b) => {
        return sortFn(a[field], b[field]);
    });
}

export class MemoryQuery<T> extends Query<T> {
    protected isMemory = true;

    isMemoryDb() {
        return this.isMemory;
    }
}


const find = <T>(adapter: MemoryDatabaseAdapter, classSchema: ClassSchema, model: DatabaseQueryModel<T>): T[] => {
    const rawItems = [...adapter.getStore(classSchema).items.values()];
    const serializer = memorySerializer.for(classSchema);
    const items = rawItems.map(v => serializer.deserialize(v));

    if (model.filter) {
        model.filter = convertQueryFilter(classSchema, model.filter, (convertClassType: ClassSchema, path: string, value: any) => {
            //this is important to convert relations to its foreignKey value
            return serializer.serializeProperty(path, value);
        }, {}, {
            $parameter: (name, value) => {
                if (undefined === model.parameters[value]) {
                    throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
                }
                return model.parameters[value];
            }
        });
    }

    let filtered = model.filter ? findQueryList<T>(items, model.filter) : items;

    if (model.hasJoins()) {
        throw new Error('MemoryDatabaseAdapter does not support joins. Please use another lightweight adapter like SQLite.');
    }

    if (model.sort) {
        for (const [name, direction] of Object.entries(model.sort)) {
            sort(filtered, name, direction === 'asc' ? sortAsc : sortDesc);
        }
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

const remove = <T>(adapter: MemoryDatabaseAdapter, classSchema: ClassSchema<T>, toDelete: T[]) => {
    const items = adapter.getStore(classSchema).items;

    const primaryKey = classSchema.getPrimaryFieldName();
    for (const item of toDelete) {
        items.delete(item[primaryKey] as any);
    }
}

export class MemoryQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(protected adapter: MemoryDatabaseAdapter, protected databaseSession: DatabaseSession<any>) {
        super();
    }

    createQuery<T extends Entity>(classType: AbstractClassType<T> | ClassSchema<T>): MemoryQuery<T> {
        const schema = getClassSchema(classType);
        const adapter = this.adapter;

        class Resolver extends GenericQueryResolver<T> {

            protected createFormatter(withIdentityMap: boolean = false) {
                return new Formatter(
                    this.classSchema,
                    memorySerializer,
                    this.session.getHydrator(),
                    withIdentityMap ? this.session.identityMap : undefined
                );
            }

            async count(model: DatabaseQueryModel<T>): Promise<number> {
                if (this.session.logger.logger) {
                    this.session.logger.logger.log('count', model.filter);
                }
                const items = find(adapter, schema, model);
                return items.length;
            }

            async delete(model: DatabaseQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
                if (this.session.logger.logger) {
                    this.session.logger.logger.log('delete', model.filter);
                }
                const items = find(adapter, schema, model);
                const primaryKey = schema.getPrimaryFieldName();
                for (const item of items) {
                    deleteResult.primaryKeys.push(item[primaryKey] as any);
                }
                remove(adapter, schema, items);
            }

            async find(model: DatabaseQueryModel<T>): Promise<T[]> {
                const items = find(adapter, schema, model);
                if (this.session.logger.logger) {
                    this.session.logger.logger.log('find', model.filter);
                }
                const formatter = this.createFormatter(model.withIdentityMap);
                return items.map(v => formatter.hydrate(model, v));
            }

            async findOneOrUndefined(model: DatabaseQueryModel<T>): Promise<T | undefined> {
                const items = find(adapter, schema, model);

                if (items[0]) return this.createFormatter(model.withIdentityMap).hydrate(model, items[0]);
                return undefined;
            }

            async has(model: DatabaseQueryModel<T>): Promise<boolean> {
                const items = find(adapter, schema, model);
                return items.length > 0;
            }

            async patch(model: DatabaseQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
                const items = find(adapter, schema, model);
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


        return new MemoryQuery(getClassSchema(classType), this.databaseSession, new Resolver(getClassSchema(classType), this.databaseSession));
    }
}

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

    queryFactory(databaseSession: DatabaseSession<this>): MemoryQueryFactory {
        return new MemoryQueryFactory(this, databaseSession);
    }
}
