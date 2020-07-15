import {ClassSchema, getClassSchema, getClassTypeFromInstance, PartialEntity} from "@super-hornet/marshal";
import {Entity} from "./query";

jest.setTimeout(111111111);

export type PrimaryKey<T extends Entity> = { [name in keyof T & string]?: T[name] };

class InstanceState<T extends Entity> {
    protected knownInDatabase: boolean = false;
    protected lastKnownPK?: PrimaryKey<T>;
    protected classSchema: ClassSchema<T>;
    protected fromDatabase: boolean = false;

    constructor(private item: T) {
        this.classSchema = getClassSchema(item);
        this.lastKnownPK = this.classSchema.getPrimaryFieldRepresentation(this.item);
    }

    toString(): string {
        return `knownInDatabase: ${this.knownInDatabase}`;
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
        this.lastKnownPK = this.classSchema.getPrimaryFieldRepresentation(this.item);
        this.knownInDatabase = true;
    }

    getLastKnownPKOrCurrent(): PrimaryKey<T> {
        if (this.lastKnownPK) return this.lastKnownPK;
        return this.classSchema.getPrimaryFieldRepresentation(this.item);
    }

    getLastKnownPKHashOrCurrent(): string {
        return this.classSchema.getPrimaryFieldHash(this.lastKnownPK || this.item as any);
    }

    getLastKnownPK(): PrimaryKey<T> {
        if (!this.lastKnownPK) {
            throw new Error(`Item is not known in the database.`);
        }
        return this.lastKnownPK;
    }

    markAsDeleted() {
        this.knownInDatabase = false;
    }
}
const entityStateMap = new WeakMap<any, InstanceState<any>>();

export function getInstanceState<T>(item: T): InstanceState<T> {
    let entityState = entityStateMap.get(item);

    if (!entityState) {
        entityState = new InstanceState(item);
        entityStateMap.set(item, entityState);
    }

    return entityState;
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
            const pkHash = classSchema.getPrimaryFieldHash(pk);
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
            const pkHash = classSchema.getPrimaryFieldHash(item);
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
