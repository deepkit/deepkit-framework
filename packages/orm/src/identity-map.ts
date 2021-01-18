/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, getClassSchema, JSONPartial, jsonSerializer, PartialEntity } from '@deepkit/type';
import { Entity } from './type';
import { getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator, getSimplePrimaryKeyHashGenerator } from './converter';
import { isObject, toFastProperties } from '@deepkit/core';
import { inspect } from 'util';
import { changeSetSymbol, ItemChanges } from './changes';

export function getNormalizedPrimaryKey(schema: ClassSchema, primaryKey: any) {
    const primaryFields = schema.getPrimaryFields();

    if (primaryFields.length > 1) {
        if (!isObject(primaryKey)) {
            throw new Error(`Entity ${schema.getClassName()} has composite primary key. Please provide primary key as object, e.g. {pk1: value, pk2: value2}.`);
        }
        const res: { [name: string]: any } = {};
        for (const primaryField of primaryFields) {
            res[primaryField.name] = primaryKey[primaryField.name];
        }
        return res;
    } else {
        const first = primaryFields[0];
        if (isObject(primaryKey) && (primaryKey as any)[first.name] !== undefined) {
            return { [first.name]: (primaryKey as any)[first.name] };
        } else {
            return { [first.name]: primaryKey };
        }
    }
}

class InstanceState<T extends Entity> {
    knownInDatabase: boolean = false;

    /**
     * This represents the last known values known to be in the database.
     * The data is used for change-detection + last known primary key extraction.
     * References store only its primary keys.
     */
    snapshot?: JSONPartial<T>;

    readonly classSchema: ClassSchema<T>;
    readonly item: T;

    fromDatabase: boolean = false;

    constructor(item: T) {
        this.item = item;
        this.classSchema = getClassSchema(item);
    }

    [inspect.custom]() {
        return `InstanceState<knownInDatabase=${this.knownInDatabase}, fromDatabase=${this.fromDatabase}>`;
    }

    toString(): string {
        return `knownInDatabase: ${this.knownInDatabase}`;
    }

    getSnapshot(): JSONPartial<T> {
        if (!this.snapshot) this.snapshot = getJITConverterForSnapshot(this.classSchema)(this.item);
        return this.snapshot!;
    }

    isFromDatabase() {
        return this.fromDatabase;
    }

    isKnownInDatabase(): boolean {
        return this.knownInDatabase;
    }

    markAsFromDatabase() {
        this.fromDatabase = true;
    }

    markAsPersisted() {
        const snap = getJITConverterForSnapshot(this.classSchema);
        this.snapshot = snap(this.item);
        this.knownInDatabase = true;
        (this.item as any)[changeSetSymbol] = new ItemChanges({}, this.item);
    }

    getLastKnownPK(): Partial<T> {
        return getPrimaryKeyExtractor(this.classSchema)(this.snapshot);
    }

    getLastKnownPKHash(): string {
        return getPrimaryKeyHashGenerator(this.classSchema, jsonSerializer)(this.snapshot);
    }

    markAsDeleted() {
        this.knownInDatabase = false;
    }
}

const instanceStateSymbol = Symbol('state');

export function getInstanceState<T>(item: T): InstanceState<T> {
    //this approach is up to 60-90x faster than a WeakMap
    if (!(item as any)['constructor'].prototype.hasOwnProperty(instanceStateSymbol)) {
        Object.defineProperty((item as any)['constructor'].prototype, instanceStateSymbol, {
            writable: true,
            enumerable: false,
            value: null
        });
        toFastProperties((item as any)['constructor'].prototype);
    }

    if (!(item as any)['constructor'].prototype.hasOwnProperty(changeSetSymbol)) {
        Object.defineProperty((item as any)['constructor'].prototype, changeSetSymbol, {
            writable: true,
            enumerable: false,
            value: null
        });
        toFastProperties((item as any)['constructor'].prototype);
    }


    if (!(item as any)[instanceStateSymbol]) {
        (item as any)[instanceStateSymbol] = new InstanceState(item);
    }
    return (item as any)[instanceStateSymbol];
}

export type PKHash = string;
type Store = {
    ref: any,
    stale: boolean
};

export class IdentityMap {
    registry = new Map<ClassSchema, Map<PKHash, Store>>();

    deleteMany<T>(classSchema: ClassSchema<T>, pks: Partial<T>[]) {
        const store = this.getStore(classSchema);
        const pkHashGenerator = getPrimaryKeyHashGenerator(classSchema, jsonSerializer);
        for (const pk of pks) {
            const pkHash = pkHashGenerator(pk);
            let item = store.get(pkHash);
            if (item) {
                store.delete(pkHash);
                getInstanceState(item.ref).markAsDeleted();
            }
        }
    }

    deleteManyBySimplePK<T>(classSchema: ClassSchema<T>, pks: any[]) {
        const store = this.getStore(classSchema);
        const pkHashGenerator = getSimplePrimaryKeyHashGenerator(classSchema);
        for (const pk of pks) {
            const pkHash = pkHashGenerator(pk);
            let item = store.get(pkHash);
            if (item) {
                store.delete(pkHash);
                getInstanceState(item.ref).markAsDeleted();
            }
        }
    }

    clear<T>() {
        this.registry.clear();
    }

    isKnown<T>(item: T): boolean {
        const store = this.getStore(getClassSchema(item));
        const pkHash = getInstanceState(item).getLastKnownPKHash();

        return store.has(pkHash);
    }

    storeMany<T>(classSchema: ClassSchema<T>, items: PartialEntity<T>[]) {
        if (!classSchema.hasPrimaryFields()) throw new Error(`Entity ${classSchema.getClassName()} has no primary field defined. Use @f.primary to defined one.`);
        const store = this.getStore(classSchema);
        for (const item of items) {
            const pkHash = getPrimaryKeyHashGenerator(classSchema, jsonSerializer)(item);
            store.set(pkHash, { ref: item, stale: false });
            getInstanceState(item).markAsPersisted();
        }
    }

    store<T>(classSchema: ClassSchema<T>, item: T) {
        this.storeMany(classSchema, [item]);
    }

    getByHash<T>(classSchema: ClassSchema<T>, pk: PKHash): T | undefined {
        const store = this.getStore(classSchema);

        return store.has(pk) ? store.get(pk)!.ref : undefined;
    }

    getStore(classSchema: ClassSchema): Map<PKHash, Store> {
        const store = this.registry.get(classSchema);
        if (store) {
            return store;
        }

        const newStore = new Map();
        this.registry.set(classSchema, newStore);
        return newStore;
    }
}
