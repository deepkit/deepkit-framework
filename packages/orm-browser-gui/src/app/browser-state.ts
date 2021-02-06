import { Injectable } from "@angular/core";
import { empty, isObject } from "@deepkit/core";
import { getInstanceState } from "@deepkit/orm";
import { DatabaseCommit, DatabaseInfo } from "@deepkit/orm-browser-api";
import { Changes, changeSetSymbol, ClassSchema, classToPlain, getChangeDetector, getConverterForSnapshot, PropertySchema, PropertyValidatorError } from "@deepkit/type";
import { ControllerClient } from "./client";

export type ChangesStore = { [pkHash: string]: { pk: { [name: string]: any }, changes: Changes<any> } };
export type ValidationErrors = { [fieldName: string]: PropertyValidatorError };
export type ValidationErrorStore = Map<any, ValidationErrors>;

export type IdWrapper = { $___newId: any };

const storeKeySeparator = '\0t\0';

export class BrowserEntityState {
    properties: PropertySchema[] = [];

    loading: boolean = false;

    filter: {[name: string]: any} = {};

    count: number = 0;
    page: number = 1;

    get totalPages(): number {
        return Math.ceil(this.count / this.itemsPerPage);
    }

    itemsPerPage: number = 100;
    dbItems: any[] = []; //items from the db
    items: any[] = []; //items visible in table
    
    selection: any[] = [];

    changes?: ChangesStore;

    validationStore?: ValidationErrorStore;
    deletions: { [pkHash: string]: any } = {};
}

@Injectable()
export class BrowserState {
    databases: DatabaseInfo[] = [];
    database?: DatabaseInfo;
    entity?: ClassSchema;

    newId: number = 0;

    newItems = new Map<any, number>();
    newItemsMap = new Map<number, any>();

    browserEntityState: { [storeKey: string]: BrowserEntityState } = {};

    addedItems: { [storeKey: string]: any[] } = {};

    deletions: { [storeKey: string]: { [pkHash: string]: { [name: string]: any } } } = {};
    changes: { [storeKey: string]: ChangesStore } = {};
    validationErrors: { [storeKey: string]: ValidationErrorStore } = {};

    connectedNewItems = new Map<any, { row: any, property: PropertySchema }[]>();

    constructor(protected controllerClient: ControllerClient) { 
        (window as any).state = this;
    }

    async resetAll() {
        this.changes = {};
        this.addedItems = {};
        this.validationErrors = {};
        this.deletions = {};
        this.connectedNewItems.clear();
        this.newId = 0;
        this.newItems.clear();
        this.newItemsMap.clear();
    }

    getBrowserEntityState(dbName: string, entityName: string) {
        const storeKey = this.getStoreKey(dbName, entityName);
        return this.browserEntityState[storeKey] ||= new BrowserEntityState();
    }

    getDeletions(dbName: string, entityName: string) {
        const storeKey = this.getStoreKey(dbName, entityName);
        return this.deletions[storeKey] ||= {};
    }

    scheduleForDeletion(dbName: string, entityName: string, item: any) {
        const deletions = this.getDeletions(dbName, entityName);

        const state = getInstanceState(item);
        deletions[state.getLastKnownPKHash()] = state.getLastKnownPK();
    }

    unscheduleForDeletion(dbName: string, entityName: string, item: any) {
        const storeKey = this.getStoreKey(dbName, entityName);
        const deletions = this.deletions[storeKey] ||= {};

        const state = getInstanceState(item);
        delete deletions[state.getLastKnownPKHash()];
    }

    hasChanges(): boolean {
        for (const i in this.changes) {
            if (!empty(this.changes[i])) return true;
            if (!empty(this.deletions[i])) return true;
        }
        return this.newItems.size > 0;
    }

    hasAddedItems(dbName: string, entityName: string): boolean {
        const items = this.addedItems[this.getStoreKey(dbName, entityName)];
        return items && items.length > 0 ? true : false;;
    }

    getAddedItems(dbName: string, entityName: string): any[] {
        const key = this.getStoreKey(dbName, entityName);
        let items = this.addedItems[key];
        if (!items) items = this.addedItems[key] = [];
        return items;
    }

    getStoreKey(dbName: string, entityName: string): string {
        return dbName + storeKeySeparator + entityName;
    }

    async commit() {
        const commit: DatabaseCommit = {};
        for (const db of this.databases) {
            commit[db.name] = { added: {}, removed: {}, changed: {}, addedIds: {} };
        }

        for (const storeKey in this.deletions) {
            const [dbName, entityName] = storeKey.split(storeKeySeparator) as [string, string];
            commit[dbName].removed[entityName] = Object.values(this.deletions[storeKey]);
        }

        for (const storeKey in this.changes) {
            const [dbName, entityName] = storeKey.split(storeKeySeparator) as [string, string];
            const database = commit[dbName];
            const changed = database.changed[entityName] ||= [];

            for (const changes of Object.values(this.changes[storeKey])) {
                changed.push({
                    pk: changes.pk,
                    changes: { $inc: changes.changes.$inc, $set: changes.changes.$set, $unset: changes.changes.$unset },
                });
            }
        }

        for (const storeKey in this.addedItems) {
            const [dbName, entityName] = storeKey.split(storeKeySeparator) as [string, string];
            const database = commit[dbName];
            // const entity = this.getEntity(dbName, entityName);

            database.added[entityName] = this.addedItems[storeKey];
            database.addedIds[entityName] = this.addedItems[storeKey].map(v => this.newItems.get(v) || -1);
        }

        await this.controllerClient.browser.commit(commit);
        for (const entityState of Object.values(this.browserEntityState)) {
            entityState.items = [];
        }
    }

    getEntityFromCacheKey(key: string): ClassSchema {
        const [dbName, entityName] = key.split(storeKeySeparator);
        return this.getEntity(dbName, entityName);
    }

    getEntity(dbName: string, name: string): ClassSchema {
        for (const db of this.databases) {
            for (const entity of db.getClassSchemas()) {
                if (entity.name === name) return entity;
            }
        }

        throw new Error(`No entity ${name} in db ${dbName} found`)
    }

    connectNewItem(newItem: any, row: any, property: PropertySchema) {
        let connections = this.connectedNewItems.get(newItem);
        if (!connections) {
            connections = [];
            this.connectedNewItems.set(newItem, connections);
        }
        connections.push({ row, property });

        return connections;
    }

    disconnectForNewItem(newItem: any) {
        const connections = this.connectedNewItems.get(newItem);
        if (!connections) return;

        for (const connection of connections) {
            connection.row[connection.property.name] = undefined;
        }
    }

    registerNewItem(item: any) {
        const id = ++this.newId;
        this.newItems.set(item, id);
        this.newItemsMap.set(id, item);
    }

    getNewItemId(item: any): number {
        const id = this.newItems.get(item);
        if (!id) throw new Error('Item is not registered as new');
        return id;
    }

    getNewItemIdWrapper(item: any): IdWrapper {
        const id = this.newItems.get(item);
        if (!id) throw new Error('Item is not registered as new');
        return { $___newId: id };
    }

    extractIdWrapper(value: IdWrapper): any {
        return value.$___newId;
    }

    extractHashFromNewItem(item: any): any {
        const id = this.newItems.get(item);
        return 'h\0' + id;
    }

    extractHashFromIdWrapper(value: IdWrapper): any {
        return 'h\0' + value.$___newId;
    }

    isIdWrapper(value: any): value is IdWrapper {
        return isObject(value) && '$___newId' in value;
    }

    isNew(item: any): boolean {
        return this.newItems.has(item);
    }

    getChangeStore(dbName: string, entityName: string): ChangesStore {
        return this.changes[this.getStoreKey(dbName, entityName)] ||= {};
    }

    getValidationStore(dbName: string, entityName: string): ValidationErrorStore {
        let store = this.validationErrors[this.getStoreKey(dbName, entityName)];
        if (!store) store = this.validationErrors[this.getStoreKey(dbName, entityName)] = new Map();
        return store;
    }

    changed(dbName: string, entityName: string, item: any) {
        const entity = this.getEntity(dbName, entityName);
        const changes = this.getChangeStore(dbName, entityName);

        const state = getInstanceState(item);

        const lastSnapshot = state.getSnapshot();
        const changeDetector = getChangeDetector(entity);
        const doSnapshot = getConverterForSnapshot(entity);

        const currentSnapshot = doSnapshot(item);
        delete item[changeSetSymbol]; //we want to start over. We don't use $inc for the moment, so thats ok
        const changeSet = changeDetector(lastSnapshot, currentSnapshot, item);
        const pkHash = state.getLastKnownPKHash();

        if (changeSet) {
            // console.log('changed', lastSnapshot, currentSnapshot, changeSet);
            changes[pkHash] = { changes: changeSet, pk: state.getLastKnownPK() };
        } else if (changes[pkHash]) {
            delete changes[pkHash];
        }
    }
}