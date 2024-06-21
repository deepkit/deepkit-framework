/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
/** @reflection never */
import { DatabaseSession, DatabaseTransaction } from './database-session.js';
import { Changes, getSerializeFunction, ReflectionClass, Serializer } from '@deepkit/type';
import { deletePathValue, getPathValue, setPathValue } from '@deepkit/core';
import {
    DatabaseAdapter,
    DatabaseEntityRegistry,
    DatabasePersistence,
    DatabasePersistenceChangeSet,
    MigrateOptions,
} from './database-adapter.js';
import { DeleteResult, OrmEntity, PatchResult } from './type.js';
import { Formatter } from './formatter.js';
import {
    and,
    eq,
    isOp,
    isProperty,
    OpExpression,
    opTag,
    SelectorProperty,
    SelectorResolver,
    SelectorState,
    where,
} from './select.js';

type SimpleStore<T> = { items: Map<any, T>, autoIncrement: number };

class MemorySerializer extends Serializer {
    name = 'memory';
}

const memorySerializer = new MemorySerializer();

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

type Accessor = (record: any) => any;
export type MemoryOpRegistry = { [tag: symbol]: (expression: OpExpression) => Accessor };

export const memoryOps: MemoryOpRegistry = {
    [eq.id](expression: OpExpression) {
        const [a, b] = expression.args.map(e => buildAccessor(e));
        return (record: any) => a(record) === b(record);
    },
    [and.id](expression: OpExpression) {
        const lines = expression.args.map(e => buildAccessor(e));
        return (record: any) => lines.every(v => v(record));
    },
    [where.id](expression: OpExpression) {
        const lines = expression.args.map(e => buildAccessor(e));
        return (record: any) => lines.every(v => v(record));
    },
};

function buildAccessor(op: OpExpression | SelectorProperty | unknown): Accessor {
    if (isOp(op)) {
        const fn = memoryOps[op[opTag].id];
        if (!fn) throw new Error(`No memory op registered for ${op[opTag].id.toString()}`);
        return fn(op);
    }

    if (isProperty(op)) {
        return (record: any) => {
            //todo: handle if selector of joined table
            // and deep json path
            return record[op.name];
        };
    }

    return () => op;
}

function sort(items: any[], accessor: Accessor, sortFn: typeof sortAsc | typeof sortAsc): void {
    items.sort((a, b) => {
        return sortFn(accessor(a), accessor(b));
    });
}

function filterWhere<T>(items: T[], where: OpExpression): T[] {
    const accessor = buildAccessor(where);
    console.log('accessor', accessor.toString());
    return items.filter(v => !!accessor(v));
}

const find = <T extends OrmEntity>(adapter: MemoryDatabaseAdapter, classSchema: ReflectionClass<any>, model: SelectorState<T>): T[] => {
    const rawItems = [...adapter.getStore(classSchema).items.values()];
    const deserializer = getSerializeFunction(classSchema.type, memorySerializer.deserializeRegistry);
    const items = rawItems.map(v => deserializer(v));

    console.log(items);
    let filtered = model.where ? filterWhere(items, model.where) : items;

    if (model.orderBy) {
        for (const order of model.orderBy) {
            sort(filtered, buildAccessor(order.a), order.direction === 'asc' ? sortAsc : sortDesc);
        }
    }

    if (model.offset && model.limit) {
        filtered = filtered.slice(model.offset, model.offset + model.limit);
    } else if (model.limit) {
        filtered = filtered.slice(0, model.limit);
    } else if (model.offset) {
        filtered = filtered.slice(model.offset);
    }
    return filtered;
};

const remove = <T>(adapter: MemoryDatabaseAdapter, classSchema: ReflectionClass<T>, toDelete: T[]) => {
    const items = adapter.getStore(classSchema).items;

    const primaryKey = classSchema.getPrimary().name;
    for (const item of toDelete) {
        items.delete(item[primaryKey as keyof T] as any);
    }
};

class Resolver<T extends object> extends SelectorResolver<T> {
    get adapter() {
        return this.session.adapter as any as MemoryDatabaseAdapter;
    }

    protected createFormatter(state: SelectorState<T>, withIdentityMap: boolean = false) {
        return new Formatter(
            state.schema,
            memorySerializer,
            this.session.getHydrator(),
            withIdentityMap ? this.session.identityMap : undefined,
        );
    }

    async count(state: SelectorState<T>): Promise<number> {
        const items = find(this.adapter, state.schema, state);
        return items.length;
    }

    async delete(state: SelectorState<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const items = find(this.adapter, state.schema, state);
        for (const item of items) {
            deleteResult.primaryKeys.push(item);
        }
        remove(this.adapter, state.schema, items);
    }

    async find(state: SelectorState<T>): Promise<T[]> {
        const items = find(this.adapter, state.schema, state);
        const formatter = this.createFormatter(state);
        return items.map(v => formatter.hydrate(state, v));
    }

    async findOneOrUndefined(state: SelectorState<T>): Promise<T | undefined> {
        const items = find(this.adapter, state.schema, state);

        if (items[0]) return this.createFormatter(state).hydrate(state, items[0]);
        return undefined;
    }

    async has(state: SelectorState<T>): Promise<boolean> {
        const items = find(this.adapter, state.schema, state);
        return items.length > 0;
    }

    async patch(state: SelectorState<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const items = find(this.adapter, state.schema, state);
        const store = this.adapter.getStore(state.schema);
        const primaryKey = state.schema.getPrimary().name as keyof T;
        const serializer = getSerializeFunction(state.schema.type, memorySerializer.serializeRegistry);

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

            // todo add returning support
            // if (model.returning) {
            //     for (const f of model.returning) {
            //         if (!patchResult.returning[f]) patchResult.returning[f] = [];
            //         const v = patchResult.returning[f];
            //         if (v) v.push(item[f]);
            //     }
            // }

            patchResult.primaryKeys.push(item);
            store.items.set(item[primaryKey] as any, serializer(item));
        }
    }
}

export class MemoryDatabaseTransaction extends DatabaseTransaction {
    async begin(): Promise<void> {
    }

    async commit(): Promise<void> {
    }

    async rollback(): Promise<void> {
    }
}

export class MemoryPersistence extends DatabasePersistence {
    constructor(private adapter: MemoryDatabaseAdapter) {
        super();
    }

    async remove<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const store = this.adapter.getStore(classSchema);

        const primaryKey = classSchema.getPrimary().name as keyof T;
        for (const item of items) {
            store.items.delete(item[primaryKey] as any);
        }
    }

    async insert<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const store = this.adapter.getStore(classSchema);
        const serializer = getSerializeFunction(classSchema.type, memorySerializer.serializeRegistry);
        const autoIncrement = classSchema.getAutoIncrement();

        const primaryKey = classSchema.getPrimary().name as keyof T;
        for (const item of items) {
            if (autoIncrement) {
                store.autoIncrement++;
                item[autoIncrement.name as keyof T & string] = store.autoIncrement as any;
            }
            store.items.set(item[primaryKey] as any, serializer(item));
        }
    }

    async update<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const store = this.adapter.getStore(classSchema);
        const serializer = getSerializeFunction(classSchema.type, memorySerializer.serializeRegistry);
        const primaryKey = classSchema.getPrimary().name as keyof T;

        for (const changeSet of changeSets) {
            store.items.set(changeSet.item[primaryKey] as any, serializer(changeSet.item));
        }
    }

    async release() {

    }
}

export class MemoryDatabaseAdapter extends DatabaseAdapter {
    protected store = new Map<number, SimpleStore<any>>();

    async migrate(options: MigrateOptions, entityRegistry: DatabaseEntityRegistry) {
    }

    createSelectorResolver<T extends OrmEntity>(session: DatabaseSession<this>): SelectorResolver<T> {
        return new Resolver<T>(session);
    }

    isNativeForeignKeyConstraintSupported(): boolean {
        return false;
    }

    createTransaction(session: DatabaseSession<this>): MemoryDatabaseTransaction {
        return new MemoryDatabaseTransaction();
    }

    getStore<T>(classSchema: ReflectionClass<T>): SimpleStore<T> {
        const id = classSchema.type.id || 0;
        let store = this.store.get(id);
        if (!store) {
            store = { items: new Map, autoIncrement: 0 };
            this.store.set(id, store);
        }
        return store;
    }

    createPersistence(): DatabasePersistence {
        return new MemoryPersistence(this);
    }

    disconnect(force?: boolean): void {
    }

    getName(): string {
        return 'memory';
    }

    getSchemaName(): string {
        return '';
    }
}
