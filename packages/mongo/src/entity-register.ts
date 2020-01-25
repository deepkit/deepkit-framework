import {ClassSchema, getClassSchema, getClassTypeFromInstance} from "@marcj/marshal";
import {ClassType, getClassName} from "@marcj/estdlib";

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
export function getLastKnownPKInDatabase<T>(item: T): any {
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
    registry = new Map<ClassType<any>, Map<PK, Store>>();

    /**
     * This marks all stored entity items as stale.
     * Stale means we don't simply pick the item when user fetched it, but also
     * overwrite its values from the database.
     */
    markAsStale<T>(classSchema: ClassSchema<T>, pks: PK[]) {
        const store = this.getStore(classSchema);
        for (const pk of pks) {
            if (store.has(pk)) {
                store.get(pk)!.stale = true;
            }
        }
    }

    markAsFresh(classSchema: ClassSchema, pk: PK) {
        const store = this.getStore(classSchema);
        store.get(pk)!.stale = false;
    }

    isStale(classSchema: ClassSchema, pk: PK): boolean {
        const store = this.getStore(classSchema);
        return store.get(pk)!.stale;
    }

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

    storeItem<T>(item: T) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        this.store(classSchema, item);
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

    public getStore(classSchema: ClassSchema): Map<PK, Store> {
        const store = this.registry.get(classSchema.classType);
        if (store) {
            return store;
        }

        const newStore = new Map();
        this.registry.set(classSchema.classType, newStore);
        return newStore;
    }

    isKnownItem<T>(item: T): boolean {
        return this.isKnown(getClassSchema(getClassTypeFromInstance(item)), item);
    }

    isKnown<T>(classSchema: ClassSchema<T>, item: T): boolean {
        const store = this.getStore(classSchema);
        const pk = getLastKnownPKInDatabase(item);

        return store.has(pk);
    }

    isKnownByPk<T>(classSchema: ClassSchema<T>, pk: any): boolean {
        const store = this.getStore(classSchema);

        return store.has(pk);
    }
}
