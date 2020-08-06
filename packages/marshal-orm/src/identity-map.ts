import {ClassSchema, getClassSchema, getClassTypeFromInstance, PartialEntity} from "@super-hornet/marshal";
import {Entity} from "./query";
import {getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator} from "./converter";
import {isObject} from '@super-hornet/core';

export type PrimaryKey<T extends Entity> = { [name in keyof T & string]?: T[name] };

export type JSONPartial<T extends Entity> = { [name in keyof T & string]?: any };

export function getNormalizedPrimaryKey(schema: ClassSchema<any>, primaryKey: any) {
    const primaryFields = schema.getPrimaryFields();

    if (primaryFields.length > 1) {
        if (!isObject(primaryKey)) {
            throw new Error(`Entity ${schema.getClassName()} has composite primary key. Please provide primary key as object, e.g. {pk1: value, pk2: value2}.`)
        }
        const res: { [name: string]: any } = {};
        for (const primaryField of primaryFields) {
            res[primaryField.name] = primaryKey[primaryField.name];
        }
        return res;
    } else {
        const first = primaryFields[0];
        if (isObject(primaryKey) && (primaryKey as any)[first.name] !== undefined) {
            return {[first.name]: (primaryKey as any)[first.name]};
        } else {
            return {[first.name]: primaryKey};
        }
    }
}

class InstanceState<T extends Entity> {
    #knownInDatabase: boolean = false;

    /**
     * This represents the last known values known to be in the database.
     * The data is used for change-detection + last known primary key extraction.
     * Reference store only its primary keys.
     */
    #snapshot: JSONPartial<T>;

    readonly #classSchema: ClassSchema<T>;
    readonly #item: T;

    #fromDatabase: boolean = false;

    constructor(item: T) {
        this.#item = item;
        this.#classSchema = getClassSchema(item);

        this.#snapshot = getJITConverterForSnapshot(this.#classSchema)(this.#item);
    }

    toString(): string {
        return `knownInDatabase: ${this.#knownInDatabase}`;
    }

    getSnapshot() {
        return this.#snapshot;
    }

    isFromDatabase() {
        return this.#fromDatabase;
    }

    isKnownInDatabase(): boolean {
        return this.#knownInDatabase;
    }

    markAsFromDatabase() {
        this.#fromDatabase = true;
    }

    markAsPersisted() {
        this.#snapshot = getJITConverterForSnapshot(this.#classSchema)(this.#item);
        this.#knownInDatabase = true;
    }

    getLastKnownPKOrCurrent(): PrimaryKey<T> {
        return getPrimaryKeyExtractor(this.#classSchema)(this.#snapshot || this.#item as any);
    }

    getLastKnownPKHashOrCurrent(): string {
        return getPrimaryKeyHashGenerator(this.#classSchema)(this.#snapshot || this.#item as any);
    }

    getLastKnownPK(): PrimaryKey<T> {
        if (!this.#snapshot) {
            throw new Error(`Item is not known in the database.`);
        }
        return getPrimaryKeyExtractor(this.#classSchema)(this.#snapshot);
    }

    markAsDeleted() {
        this.#knownInDatabase = false;
    }
}

const entityStateMap = new WeakMap<any, InstanceState<any>>();

export function getInstanceStateOld<T>(item: T): InstanceState<T> {
    let entityState = entityStateMap.get(item);

    if (!entityState) {
        entityState = new InstanceState(item);
        entityStateMap.set(item, entityState);
    }

    return entityState;
}

const instanceStateSymbol = Symbol('state');

export function getInstanceState<T>(item: T): InstanceState<T> {
    //this approach is up to 60-90x faster than a WeakMap
    if (!(item as any)['constructor'].prototype.hasOwnProperty(instanceStateSymbol)) {
        Object.defineProperty((item as any)['constructor'].prototype, instanceStateSymbol, {
            writable: true,
            enumerable: false
        });
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
    registry = new Map<string, Map<PKHash, Store>>();

    deleteMany<T>(classSchema: ClassSchema<T>, pks: PartialEntity<T>[]) {
        const store = this.getStore(classSchema);
        for (const pk of pks) {
            const pkHash = getPrimaryKeyHashGenerator(classSchema)(pk);
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
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        const store = this.getStore(classSchema);
        const pk = getInstanceState(item).getLastKnownPKHashOrCurrent();

        return store.has(pk);
    }

    storeMany<T>(classSchema: ClassSchema<T>, items: PartialEntity<T>[]) {
        const store = this.getStore(classSchema);
        for (const item of items) {
            const pkHash = getPrimaryKeyHashGenerator(classSchema)(item);
            store.set(pkHash, {ref: item, stale: false});
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
        if (!classSchema.name) throw new Error(`Class ${classSchema.getClassName()} has no name via @Entity() defined.`);

        const store = this.registry.get(classSchema.name);
        if (store) {
            return store;
        }

        const newStore = new Map();
        this.registry.set(classSchema.name, newStore);
        return newStore;
    }
}
