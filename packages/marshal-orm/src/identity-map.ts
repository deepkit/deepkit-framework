import {
    ClassSchema,
    getClassSchema,
    getClassTypeFromInstance, JitPropertyConverter,
    partialClassToPlain,
    PartialEntity
} from "@super-hornet/marshal";
import {Entity} from "./query";
import {getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator} from "./converter";

jest.setTimeout(111111111);

export type PrimaryKey<T extends Entity> = { [name in keyof T & string]?: T[name] };
export type JSONPartial<T extends Entity> = { [name in keyof T & string]?: any };

class InstanceState<T extends Entity> {
    protected knownInDatabase: boolean = false;

    /**
     * This represents the last known values known to be in the database.
     * The data is used for change-detection + last known primary key extraction.
     */
    protected snapshot: JSONPartial<T>;

    protected classSchema: ClassSchema<T>;
    protected fromDatabase: boolean = false;

    constructor(private item: T) {
        this.classSchema = getClassSchema(item);

        this.snapshot = partialClassToPlain(this.classSchema.classType, item);
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
        this.snapshot = getJITConverterForSnapshot(this.classSchema)(this.item);
        this.knownInDatabase = true;
    }

    getLastKnownPKOrCurrent(): PrimaryKey<T> {
        return getPrimaryKeyExtractor(this.classSchema)(this.snapshot || this.item as any);
    }

    getLastKnownPKHashOrCurrent(): string {
        return getPrimaryKeyHashGenerator(this.classSchema)(this.snapshot || this.item as any);
    }

    getLastKnownPK(): PrimaryKey<T> {
        if (!this.snapshot) {
            throw new Error(`Item is not known in the database.`);
        }
        return getPrimaryKeyExtractor(this.classSchema)(this.snapshot);
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
