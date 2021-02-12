import { EventEmitter, Injectable } from '@angular/core';
import { arrayRemoveItem, empty, isObject } from '@deepkit/core';
import { getInstanceState } from '@deepkit/orm';
import { DatabaseCommit, DatabaseInfo, EntityPropertySeed, EntitySeed, FakerTypes, findFaker } from '@deepkit/orm-browser-api';
import { Changes, changeSetSymbol, ClassSchema, getChangeDetector, getConverterForSnapshot, PropertySchema, PropertyValidatorError } from '@deepkit/type';
import { ControllerClient } from './client';
import { Progress } from '@deepkit/rpc';

export type ChangesStore = { [pkHash: string]: { pk: { [name: string]: any }, changes: Changes<any> } };
export type ValidationErrors = { [fieldName: string]: PropertyValidatorError };
export type ValidationErrorStore = Map<any, ValidationErrors>;

export type IdWrapper = { $___newId: any };

const storeKeySeparator = '\0t\0';

export type FilterItem = { name: string, comparator: string, value: any };

export class BrowserQuery {
    id: number = 0;
    javascript: string = '';
    placeholder: string = '';

    tab: string = 'result';

    loading: boolean = false;
    progress?: Progress;
    executionTime: number = 0;
    downloadTime: number = 0;
    downloadBytes: number = 0;

    result: any;
    error?: string;
    log: string[] = [];

    executed: boolean = false;
    inputHeight: number = 40;
    javascriptError: string = '';

    protected lastJson?: string;

    setValue(v: any) {
        this.result = v;
    }

    eval() {
        this.javascriptError = '';
        try {
            const a = new Function(this.javascript);
        } catch (error) {
            //new Function does not return helpful error message on syntax errors, but eval does.
            //we can not use eval at the beginning since it tries to actually execute the code.
            try {
                eval(this.javascript);
            } catch (error) {
                this.javascriptError = error;
            }
        }
    }
}

export class BrowserEntityState {
    properties: PropertySchema[] = [];
    queryId: number = 0;

    error?: string;

    loading: boolean = false;

    filter: FilterItem[] = [];

    activeQuery: number = -1;
    queries: BrowserQuery[] = [];

    progress?: Progress;
    executionTime: number = 0;
    downloadTime: number = 0;
    downloadBytes: number = 0;

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

    constructor(public schema: ClassSchema) {
    }

    addQuery() {
        const query = new BrowserQuery();
        query.placeholder = query.javascript = `database.query(${this.schema.getClassName()}).find()`;
        query.id = ++this.queryId;
        this.queries.push(query);
        this.activeQuery = this.queries.length - 1;
    }

    removeQuery(query: BrowserQuery) {
        const index = this.queries.indexOf(query);
        if (this.activeQuery >= index) this.activeQuery--;
        arrayRemoveItem(this.queries, query);
        this.queries = this.queries.slice(0);
    }
}

@Injectable()
export class BrowserState {
    databases: DatabaseInfo[] = [];
    seedSettings: { [storeKey: string]: EntitySeed } = {};

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

    onDataChange = new EventEmitter();

    constructor(protected controllerClient: ControllerClient) {
        (window as any).state = this;
    }

    getSeedSettings(fakerTypes: FakerTypes, db: string, entity: string): EntitySeed {
        const key = this.getStoreKey(db, entity);
        let settings = this.seedSettings[key];
        if (!settings) {
            const storage = localStorage.getItem('orm-browser/seed-properties/' + db + '/' + entity);
            const predefined: { [name: string]: { fake: boolean, faker: string } } = storage ? JSON.parse(storage) : { properties: {} };

            const properties: EntitySeed['properties'] = {};
            for (const property of this.getEntity(db, entity).getProperties()) {
                if (property.backReference) continue;

                const propertyPredefined = predefined[property.name];
                const seed = properties[property.name] = new EntityPropertySeed(property.name);
                seed.fake = propertyPredefined?.fake || false;
                seed.faker = propertyPredefined?.faker || findFaker(fakerTypes, property);
            }
            settings = this.seedSettings[key] = new EntitySeed();
            settings.properties = properties;
        }
        return settings;
    }

    storeSeedSettings(db: string, entity: string) {
        const key = this.getStoreKey(db, entity);
        const seedSettings = this.seedSettings[key];
        if (!seedSettings) return;

        const properties: { [name: string]: { fake: boolean, faker: string } } = {};
        for (const [name, seed] of Object.entries(seedSettings.properties)) {
            properties[name] = { fake: seed.fake, faker: seed.faker };
        }
        localStorage.setItem('orm-browser/seed-properties/' + db + '/' + entity, JSON.stringify(properties));
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
        return this.browserEntityState[storeKey] ||= new BrowserEntityState(this.getEntity(dbName, entityName));
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
            if (!this.changes.hasOwnProperty(i)) continue;
            if (!empty(this.changes[i])) return true;
            if (!empty(this.deletions[i])) return true;
        }
        return this.newItems.size > 0;
    }

    hasAddedItems(dbName: string, entityName: string): boolean {
        const items = this.addedItems[this.getStoreKey(dbName, entityName)];
        return items && items.length > 0;
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
            if (!this.deletions.hasOwnProperty(storeKey)) continue;
            const [dbName, entityName] = storeKey.split(storeKeySeparator) as [string, string];
            commit[dbName].removed[entityName] = Object.values(this.deletions[storeKey]);
        }

        for (const storeKey in this.changes) {
            if (!this.changes.hasOwnProperty(storeKey)) continue;
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
            if (!this.addedItems.hasOwnProperty(storeKey)) continue;
            const [dbName, entityName] = storeKey.split(storeKeySeparator) as [string, string];
            const database = commit[dbName];
            // const entity = this.getEntity(dbName, entityName);

            database.added[entityName] = this.addedItems[storeKey];
            database.addedIds[entityName] = this.addedItems[storeKey].map(v => this.newItems.get(v) || -1);
        }

        await this.controllerClient.browser.commit(commit);
        this.onDataChange.emit();
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

        throw new Error(`No entity ${name} in db ${dbName} found`);
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
