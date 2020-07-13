import {ClassSchema, getClassSchema} from "@super-hornet/marshal";
import {FieldName} from "./utils";


export type PrimaryKey<T> = { [name in FieldName<T>]?: T[name] };

class EntityState<T> {
    protected persisted: boolean = false;
    protected removed: boolean = false;
    protected lastKnownPK?: PrimaryKey<T>;
    protected classSchema: ClassSchema<T>;

    constructor(private item: T) {
        this.classSchema = getClassSchema(item);
        this.lastKnownPK = this.classSchema.getPrimaryFieldRepresentation(this.item);
    }

    isNew(): boolean {
        return !this.persisted;
    }

    markAsPersisted() {
        this.lastKnownPK = this.classSchema.getPrimaryFieldRepresentation(this.item);
        this.removed = false;
        this.persisted = true;
    }

    isKnownInDatabase(): boolean {
        return undefined !== this.lastKnownPK && !this.removed;
    }

    getLastKnownPKOrCurrent(): PrimaryKey<T> {
        if (this.lastKnownPK) return this.lastKnownPK;
        return this.classSchema.getPrimaryFieldRepresentation(this.item);
    }

    getLastKnownPK(): PrimaryKey<T> {
        if (!this.lastKnownPK) {
            throw new Error(`Item is not known in the database.`);
        }
        return this.lastKnownPK;
    }

    markAsDeleted() {
        this.removed = true;
    }
}
const entityStateMap = new WeakMap<any, EntityState<any>>();

export function getEntityState<T>(item: T): EntityState<T> {
    let entityState = entityStateMap.get(item);

    if (!entityState) {
        entityState = new EntityState(item);
        entityStateMap.set(item, entityState);
    }

    return entityState;
}

type PK = any;
type Store = {
    ref: any,
    stale: boolean
};

export class EntityRegistry {
    registry = new Map<string, Map<PK, Store>>();

    deleteMany<T>(classSchema: ClassSchema<T>, pks: any[]) {
        const store = this.getStore(classSchema);
        for (const pk of pks) {
            if (store.has(pk)) {
                store.delete(pk);
            }
        }
    }

    clear<T>() {
        this.registry.clear();
    }

    delete<T>(classSchema: ClassSchema<T>, pk: any) {
        const store = this.getStore(classSchema);
        if (store.has(pk)) {
            store.delete(pk);
        }
    }

    store<T>(classSchema: ClassSchema<T>, item: T) {
        const store = this.getStore(classSchema);
        const pk = classSchema.getPrimaryFieldRepresentation(item);
        store.set(pk, {ref: item, stale: false});
    }

    get<T>(classSchema: ClassSchema<T>, pk: any): T | undefined {
        const store = this.getStore(classSchema);

        return store.has(pk) ? store.get(pk)!.ref : undefined;
    }

    getStore(classSchema: ClassSchema): Map<PK, Store> {
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
