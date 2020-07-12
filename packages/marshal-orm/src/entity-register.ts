import {ClassSchema, getClassTypeFromInstance} from "@super-hornet/marshal";
import {getClassName} from "@super-hornet/core";
import {FieldName} from "./utils";

const globalKnownInDB = new WeakMap<any, {
    lastKnownPK: any,
}>();

/**
 * Marks that item as currently known in the database, for the current node process.
 */
export function markItemAsKnownInDatabase<T>(classSchema: ClassSchema<T>, item: T) {
    globalKnownInDB.set(item, {
        lastKnownPK: classSchema.getPrimaryFieldRepresentation(item),
    });
}

/**
 * Cross session state whether the item is currently known in the database, for the current node process.
 */
export function isItemKnownInDatabase<T>(item: T) {
    return globalKnownInDB.has(item);
}


/**
 * Cross session state whether the item is currently known in the database, for the current node process.
 */
export function getLastKnownPKInDatabase<T>(item: T): { [name in FieldName<T>]?: any } {
    if (!globalKnownInDB.has(item)) {
        throw new Error(`Item ${getClassName(getClassTypeFromInstance(item))} is not known in the database.`);
    }
    return globalKnownInDB.get(item)!.lastKnownPK;
}

/**
 * Unmarks that item as currently known in the database, for the current node process.
 */
export function unmarkItemAsKnownInDatabase<T>(item: T) {
    return globalKnownInDB.delete(item);
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
                unmarkItemAsKnownInDatabase(store.get(pk)!.ref);
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
            unmarkItemAsKnownInDatabase(store.get(pk)!.ref);
            store.delete(pk);
        }
    }

    store<T>(classSchema: ClassSchema<T>, item: T) {
        const store = this.getStore(classSchema);
        const pk = classSchema.getPrimaryFieldRepresentation(item);
        markItemAsKnownInDatabase(classSchema, item);
        store.set(pk, {ref: item, stale: false});
    }

    changeLastKnownPK<T>(classSchema: ClassSchema<T>, lastPK: any, newPK: any) {
        const store = this.getStore(classSchema);
        if (!store.has(lastPK)) return;

        markItemAsKnownInDatabase(classSchema, store.get(lastPK)!.ref);
        store.set(newPK, store.get(lastPK)!);
        store.delete(lastPK);
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

    isKnown<T>(classSchema: ClassSchema<T>, item: T): boolean {
        const store = this.getStore(classSchema);
        const pk = getLastKnownPKInDatabase(item);

        return store.has(pk);
    }
}
