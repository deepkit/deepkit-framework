/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Collection, CollectionSort, ConnectionWriter, EntityPatches, EntitySubject, ExchangeEntity, IdInterface} from '@deepkit/framework-shared';
import {injectable} from '../injector/injector';
import {AsyncEventSubscription, asyncOperation, ClassType, eachPair} from '@deepkit/core';
import {ClassSchema, getClassSchema, jsonSerializer, resolveClassTypeOrForward} from '@deepkit/type';
import {Observable, Subscription} from 'rxjs';
import {Exchange} from './exchange';
import {findQuerySatisfied} from '../utils';
import {Databases} from '../database/databases';
import {
    BaseQuery,
    Database,
    DatabaseQueryModel,
    exportQueryFilterFieldNames,
    FilterQuery,
    GenericQuery,
    QueryDatabaseDeleteEvent,
    replaceQueryFilterParameter,
    Sort,
    UnitOfWorkEvent,
    UnitOfWorkUpdateEvent
} from '@deepkit/orm';
import {AsyncSubscription} from '@deepkit/core-rxjs';

interface SentState {
    lastSentVersion?: number;
    listeners: number;
}

class SubscriptionHandler {
    protected sentEntities: { [id: string]: SentState } = {};
    protected entitySubscription?: Subscription;

    /**
     * Which fields other subscriber in the topology require so
     * they are able to match their query filters.
     * We basically add for all query's `returning` those fields
     * and the values in patch bus-message.
     *
     * This is required for live-collections to answer the question:
     *  - What if it wasn't a known item, but WOULD become one after the patch?
     */
    public usedFields: string[] = [];

    constructor(
        protected writer: ConnectionWriter,
        protected classSchema: ClassSchema,
        protected database: Database,
        protected exchange: Exchange,
    ) {
    }

    protected hasSentState(id: string | number): boolean {
        return !!this.sentEntities[id];
    }

    /**
     * Necessary when the whole state of `id` should be deleted from memory, so it wont sync to client anymore.
     */
    protected rmSentState<T>(id: string | number) {
        delete this.sentEntities[id];
        if (Object.keys(this.sentEntities).length === 0) {
            if (this.entitySubscription) {
                this.entitySubscription.unsubscribe();
                this.entitySubscription = undefined;
            }
        }
    }

    protected getSentState(id: string | number): SentState {
        if (!this.sentEntities[id]) {
            this.sentEntities[id] = {
                lastSentVersion: 0,
                listeners: 0,
            };
        }

        return this.sentEntities[id];
    }

    public setSent(id: string | number, version?: number) {
        this.getSentState(id).lastSentVersion = version;
    }

    public needsToBeSend(id: string | number, version: number): boolean {
        if (!this.hasSentState(id)) return false;

        const state = this.getSentState(id);
        return state.listeners > 0 && (state.lastSentVersion === undefined || (version === 0 || version > state.lastSentVersion));
    }

    public decreaseUsage(id: string | number) {
        const state = this.getSentState(id);
        state.listeners--;

        if (state.listeners <= 0) {
            this.rmSentState(id);
        }
    }

    public increaseUsage(id: string | number) {
        const state = this.getSentState(id);
        state.listeners++;

        this.subscribeEntity();
    }

    subscribeEntity() {
        if (this.entitySubscription) {
            //already subscribed, nothing to do here
            return;
        }

        const entityName = this.classSchema.getName();

        this.entitySubscription = this.exchange.subscribeEntity(this.classSchema, (message: ExchangeEntity) => {
            if (message.type === 'removeMany') {
                for (const id of message.ids) {
                    this.rmSentState(id);
                }

                this.writer.write({
                    type: 'entity/removeMany',
                    entityName: entityName,
                    ids: message.ids,
                });
                return;
            }

            // useful debugging lines
            // const state = this.getSentState(classType, message.id);

            if (this.needsToBeSend(message.id, message.version)) {
                this.setSent(message.id, message.version);

                if (message.type === 'patch') {
                    this.writer.write({
                        type: 'entity/patch',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                        patch: message.patch
                    });
                } else if (message.type === 'remove') {
                    //we remove it from our sentState, so we stop syncing changes
                    //this works, since subscribeEntity() and findOne() is always made
                    //on the same connection. If a different connection calls findOne()
                    //it also calls subscribeEntity.

                    this.rmSentState(message.id);

                    this.writer.write({
                        type: 'entity/remove',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                    });
                } else if (message.type === 'add') {
                    //nothing to do.
                }
            }
        });
    }
}

class SubscriptionHandlers {
    protected handler = new Map<ClassSchema, SubscriptionHandler>();

    constructor(
        protected writer: ConnectionWriter,
        protected databases: Databases,
        protected exchange: Exchange,
    ) {
    }

    get(classSchema: ClassSchema): SubscriptionHandler {
        let handler = this.handler.get(classSchema);
        if (!handler) {
            handler = new SubscriptionHandler(this.writer, classSchema, this.databases.getDatabaseForEntity(classSchema), this.exchange);
            this.handler.set(classSchema, handler);
        }

        return handler;
    }
}

class LiveDatabaseQueryModel<T> extends DatabaseQueryModel<T, FilterQuery<T>, Sort<T, any>> {
    public pagination: { enabled: boolean, page: number, itemsPerPage: number } = {
        enabled: false,
        page: 1,
        itemsPerPage: 10,
    };

    clone(parentQuery?: BaseQuery<T>): this {
        const m = super.clone(parentQuery);
        m.pagination = {...this.pagination};

        return m;
    }

    public disableEntityChangeFeed = false;

    isChangeFeedActive() {
        return !this.disableEntityChangeFeed;
    }

    getCollectionSort(): CollectionSort[] {
        const sort: CollectionSort[] = [];
        if (!this.sort) return sort;

        for (const [name, direction] of Object.entries(this.sort as Sort<T>)) {
            sort.push({field: name, direction: direction as 'asc' | 'desc'});
        }
        return sort;
    }
}

type JoinedClassSchemaInfo = {
    classSchema: ClassSchema,
    fields: string[],
    filter: FilterQuery<any>,
    usedEntityFieldsSubscription?: AsyncSubscription,
    entitySubscription?: Subscription,
};


function extractModelData(classSchema: ClassSchema, model: DatabaseQueryModel<any>, result: JoinedClassSchemaInfo[]): void {
    result.push({
        classSchema,
        filter: model.filter || {},
        fields: model.filter ? exportQueryFilterFieldNames(classSchema, model.filter) : [],
    });

    extractJoinedClassSchemaInfos(model, result);
}

function extractJoinedClassSchemaInfos(model: DatabaseQueryModel<any>, result: JoinedClassSchemaInfo[]): void {
    for (const join of model.joins) {
        if (join.propertySchema.backReference && join.propertySchema.backReference.via) {
            const schema = getClassSchema(resolveClassTypeOrForward(join.propertySchema.backReference.via));
            result.push({
                classSchema: schema,
                filter: {},
                fields: [],
            });
        }

        extractModelData(join.query.classSchema, join.query.model, result);
    }
}


class LiveCollection<T extends IdInterface> {
    protected joinedClassSchemas: JoinedClassSchemaInfo[] = [];

    protected rootFields: string[] = [];
    protected rootUsedEntityFieldsSubscription?: AsyncSubscription;
    protected entitySubscription?: Subscription;

    protected knownIDs = new Set<string | number>();

    protected classSchema = getClassSchema(this.collection.classType);

    constructor(
        protected collection: Collection<any>,
        protected model: LiveDatabaseQueryModel<T>,
        protected exchange: Exchange,
        protected database: Database,
        protected subscriptionHandler: SubscriptionHandler,
        protected writer: ConnectionWriter,
    ) {
        this.rootFields = exportQueryFilterFieldNames(this.classSchema, model.filter || {});
        // figure out what entities are involved (by going through all joins)
        extractJoinedClassSchemaInfos(this.model, this.joinedClassSchemas);
    }

    protected async publishUseEntityFields() {
        const promises: Promise<any>[] = [];

        if (this.rootFields.length) promises.push(this.exchange.publishUsedEntityFields(this.classSchema, this.rootFields).then(v => this.rootUsedEntityFieldsSubscription = v));

        for (const info of this.joinedClassSchemas) {
            if (!info.fields.length) continue;
            promises.push(this.exchange.publishUsedEntityFields(info.classSchema, info.fields).then(sub => {
                info.usedEntityFieldsSubscription = sub;
            }));
        }
        await Promise.all(promises);
    }

    public async stopSync() {
        if (this.entitySubscription) this.entitySubscription.unsubscribe();
        const promises: Promise<any>[] = [];
        for (const [, info] of this.joinedClassSchemas.entries()) {
            if (info.usedEntityFieldsSubscription) promises.push(info.usedEntityFieldsSubscription.unsubscribe());
            if (info.entitySubscription) info.entitySubscription.unsubscribe();
        }
        if (this.rootUsedEntityFieldsSubscription) promises.push(this.rootUsedEntityFieldsSubscription.unsubscribe());
        await Promise.all(promises);
        this.joinedClassSchemas = [];

        for (const id of this.knownIDs.values()) {
            if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(id);
        }
    }

    protected lastUpdatePromise: any;

    protected async updateCollection(databaseChanged: boolean = false) {
        if (this.lastUpdatePromise) return this.lastUpdatePromise;

        this.lastUpdatePromise = asyncOperation((resolve) => {
            // this.lastUpdatePromiseResolver = resolve;
            setTimeout(async () => {
                await this._updateCollection(databaseChanged);
                this.lastUpdatePromise = undefined;
                resolve(undefined);
            }, 100);
        });
        return this.lastUpdatePromise;
    }

    protected async _updateCollection(databaseChanged: boolean = false) {
        if (!this.entitySubscription) return;

        // let pagingHash = '';
        // let parametersHash = '';
        // //when database is changed during entityFeed events, we don't check that stuff
        // if (databaseChanged) {
        //     pagingHash = this.collection.pagination.getPagingHash();
        //     parametersHash = this.collection.pagination.getParametersHash();
        // } else {
        //     const newPagingHash = this.collection.pagination.getPagingHash();
        //     const newParametersHash = this.collection.pagination.getParametersHash();
        //     let needUpdate = false;
        //
        //     if (pagingHash !== newPagingHash) {
        //         pagingHash = newPagingHash;
        //         needUpdate = true;
        //     }
        //
        //     if (parametersHash !== newParametersHash) {
        //         parametersHash = newParametersHash;
        //         // if (reactiveQuery.haveParametersChanged()) {
        //         //     needUpdate = true;
        //         // }
        //     }
        //
        //     if (!needUpdate) {
        //         return;
        //     }
        // }

        //- query the database and put all items in our list
        const query = this.database.query(this.classSchema);
        query.model = this.model.clone(query);

        query.model.limit = undefined;
        query.model.skip = undefined;
        const total = await query.count();

        this.applyPagination(query);
        const items = await query.find();
        this.collection.batchStart();
        const copiedKnownIds = new Set(this.knownIDs.values());

        for (const item of items) {
            copiedKnownIds.delete(item.id);

            if (!this.knownIDs.has(item.id)) {
                this.knownIDs.add(item.id);
                if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(item.id);
                this.collection.add(item);
            }
        }

        //items left in copiedKnownIds have been deleted or filter doesn't match anymore.
        for (const id of copiedKnownIds.values()) {
            this.knownIDs.delete(id);
            if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(id);
        }

        const idsToRemove = [...copiedKnownIds.values()];
        if (idsToRemove.length > 0) this.collection.removeMany(idsToRemove);

        //todo, call it only when really changed
        this.collection.setSort(items.map(v => v.id));

        if (this.collection.pagination.getTotal() !== total) {
            this.collection.pagination.setTotal(total);
            this.collection.pagination.event.next({type: 'internal_server_change'});
        }
        this.collection.batchEnd();
    }

    protected async getItem(id: string | number): Promise<T | undefined> {
        const query = this.database.query(this.classSchema);
        query.model = this.model.clone(query);
        query.filter({id: id});
        return query.findOneOrUndefined();
    }

    protected applyPagination(query: GenericQuery<T>) {
        if (!this.collection.pagination.isActive()) {
            query.model.limit = this.model.limit;
            query.model.skip = this.model.skip;
            return;
        }

        query.limit(this.collection.pagination.getItemsPerPage());
        query.skip((this.collection.pagination.getPage() * this.collection.pagination.getItemsPerPage()) - this.collection.pagination.getItemsPerPage());

        if (this.collection.pagination.hasSort()) {
            const sort: Sort<T> = {};
            for (const order of this.collection.pagination.getSort()) {
                sort[order.field as keyof T & string] = order.direction;
            }
            query.sort(sort);
        }
    }

    public async startSync() {
        if (this.entitySubscription) throw new Error('Collection sync already started');

        await this.publishUseEntityFields();

        for (const info of this.joinedClassSchemas) {
            if (info.entitySubscription) continue;
            //if its part of our join filter, we reload the collection
            info.entitySubscription = this.exchange.subscribeEntity(info.classSchema, (message) => {
                //todo: check if item belongs to the join criteria
                this.updateCollection(true);
            });
        }

        let currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

        const scopedSerializer = jsonSerializer.for(this.classSchema);
        this.entitySubscription = this.exchange.subscribeEntity(this.classSchema, async (message) => {
            if (message.type === 'removeMany') {
                if (this.collection.pagination.isActive()) {
                    await this.updateCollection(true);
                    return;
                }

                for (const id of message.ids) {
                    this.knownIDs.delete(id);
                    if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(id);
                }
                this.collection.removeMany(message.ids);
            }

            if (message.type === 'add' && !this.knownIDs.has(message.id) && findQuerySatisfied(message.item, currentQuery)) {
                if (this.collection.pagination.isActive()) {
                    await this.updateCollection(true);
                    return;
                }

                this.knownIDs.add(message.id);
                if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(message.id);
                this.collection.add(scopedSerializer.deserialize(message.item));
            }

            if (message.type === 'patch') {
                const querySatisfied = findQuerySatisfied(message.item, currentQuery);

                if (this.knownIDs.has(message.id) && !querySatisfied) {
                    if (this.collection.pagination.isActive()) {
                        await this.updateCollection(true);
                    } else {
                        //got invalid after updates?
                        this.knownIDs.delete(message.id);
                        if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(message.id);
                        this.collection.remove(message.id);
                    }
                } else if (!this.knownIDs.has(message.id) && querySatisfied) {
                    if (this.collection.pagination.isActive()) {
                        await this.updateCollection(true);
                    } else {
                        //got valid after updates?
                        this.knownIDs.add(message.id);
                        if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(message.id);

                        const item = await this.getItem(message.id);
                        if (item) {
                            this.collection.add(item);
                        } else {
                            await this.updateCollection(true);
                        }
                    }
                }
            }

            if (message.type === 'remove' && this.knownIDs.has(message.id)) {
                if (this.collection.pagination.isActive()) {
                    await this.updateCollection();
                } else {
                    this.knownIDs.delete(message.id);
                    if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(message.id);
                    this.collection.remove(message.id);
                }
            }
        });

        this.collection.pagination.event.subscribe(async (event) => {
            if (event.type === 'client:apply' || event.type === 'apply') {
                //its important to not reassign a new object ref to this.model.parameters, since the ref
                //is stored in joined query models as well.
                const newParameters = this.collection.pagination.getParameters();
                for (const [i, value] of eachPair(newParameters)) {
                    this.model.parameters[i] = value;
                }
                currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

                await this.updateCollection();

                if (event.type === 'client:apply') this.collection.pagination.event.next({type: 'server:apply/finished'});
                if (event.type === 'apply') this.collection.pagination._applyFinished();
            }
        });

        const query = this.database.query(this.classSchema);
        query.model = this.model;

        query.model.limit = undefined;
        query.model.skip = undefined;
        const total = await query.count();
        this.collection.pagination.setTotal(total);

        this.applyPagination(query);
        const items = await query.find();

        for (const item of items) {
            this.knownIDs.add(item.id);
            if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(item.id);
        }

        this.collection.set(items);
    }
}

export class LiveQuery<T extends IdInterface> extends BaseQuery<T> {
    public model = this.createModel<T>();

    constructor(
        protected writer: ConnectionWriter,
        public classSchema: ClassSchema<T>,
        protected database: Database,
        protected exchange: Exchange,
        protected subscriptionHandler: SubscriptionHandler,
    ) {
        super(classSchema);
    }

    enablePagination(): this {
        this.model.pagination.enabled = true;
        return this;
    }

    disableEntityChangeFeed(): this {
        this.model.disableEntityChangeFeed = true;
        return this;
    }

    itemsPerPage(items: number): this {
        this.model.pagination.itemsPerPage = items;
        return this;
    }

    page(page: number): this {
        this.model.pagination.enabled = true;
        this.model.pagination.page = page;
        return this;
    }

    protected createModel<T>(): LiveDatabaseQueryModel<T> {
        return new LiveDatabaseQueryModel();
    }

    async findOneOrUndefined(): Promise<EntitySubject<T> | undefined> {
        const item = await this.database.query(this.classSchema).filter(this.model.filter).findOneOrUndefined();
        if (!item) return;

        const foundId = item.id;
        this.subscriptionHandler.increaseUsage(foundId);

        //we must start with version 0, since exchange issues from 0
        //we don't care about the item.version
        this.subscriptionHandler.setSent(item.id, 0);
        this.subscriptionHandler.subscribeEntity();

        return new EntitySubject(item, () => {
            this.subscriptionHandler.decreaseUsage(foundId);
        });
    }

    async findOne(): Promise<EntitySubject<T>> {
        const item = await this.database.query(this.classSchema).filter(this.model.filter).findOne();

        const foundId = item.id;
        this.subscriptionHandler.increaseUsage(foundId);

        //we must start with version 0, since exchange issues from 0
        //we don't care about the item.version
        this.subscriptionHandler.setSent(item.id, 0);
        this.subscriptionHandler.subscribeEntity();

        return new EntitySubject(item, () => {
            this.subscriptionHandler.decreaseUsage(foundId);
        });
    }

    public count<T extends IdInterface>(): Observable<number> {
        const rootFields = exportQueryFilterFieldNames(this.classSchema, this.model.filter || {});
        let currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

        const joinedClassSchemas: JoinedClassSchemaInfo[] = [];
        extractJoinedClassSchemaInfos(this.model, joinedClassSchemas);

        return new Observable((observer) => {
            let rootEntitySub: Subscription;
            let usedEntityFieldsSub: AsyncSubscription;

            (async () => {
                usedEntityFieldsSub = await this.exchange.publishUsedEntityFields(this.classSchema, rootFields);

                const knownIDs = new Set<string | number>();
                let counter = 0;

                rootEntitySub = await this.exchange.subscribeEntity(this.classSchema, (message) => {
                    if (message.type === 'add') {
                        if (!knownIDs.has(message.id) && findQuerySatisfied(message.item, currentQuery)) {
                            counter++;
                            knownIDs.add(message.id);
                            observer.next(counter);
                        }
                    }

                    if (message.type === 'patch') {
                        if (knownIDs.has(message.id) && !findQuerySatisfied(message.item, currentQuery)) {
                            counter--;
                            knownIDs.delete(message.id);
                            observer.next(counter);
                        } else if (!knownIDs.has(message.id) && findQuerySatisfied(message.item, currentQuery)) {
                            counter++;
                            knownIDs.add(message.id);
                            observer.next(counter);
                        }
                    }

                    if (message.type === 'remove') {
                        if (knownIDs.has(message.id)) {
                            counter--;
                            knownIDs.delete(message.id);
                            observer.next(counter);
                        }
                    }

                    if (message.type === 'removeMany') {
                        for (const id of message.ids) {
                            if (knownIDs.has(id)) {
                                counter--;
                                knownIDs.delete(id);
                                observer.next(counter);
                            }
                        }
                    }
                });

                const updateAll = async () => {
                    const query = this.database.query(this.classSchema);
                    query.model = this.model.clone(query);

                    const items = await query.select('id').find();

                    knownIDs.clear();
                    counter = items.length;
                    for (const item of items) knownIDs.add(item.id);
                    console.log('updateAll', counter);
                    observer.next(counter);
                };

                for (const info of joinedClassSchemas) {
                    if (info.entitySubscription) continue;
                    //if its part of our join filter, we reload the collection
                    info.entitySubscription = this.exchange.subscribeEntity(info.classSchema, (message) => {
                        //todo: check if item belongs to the join criteria
                        updateAll();
                    });
                }

                await updateAll();
            })();

            return {
                unsubscribe: async () => {
                    rootEntitySub.unsubscribe();
                    await usedEntityFieldsSub.unsubscribe();
                    for (const info of joinedClassSchemas) {
                        if (info.entitySubscription) info.entitySubscription.unsubscribe();
                    }
                }
            };
        });
    }

    async find(): Promise<Collection<T>> {
        const collection = new Collection(this.classSchema.classType);

        if (this.model.pagination.enabled) {
            collection.pagination._activate();
            collection.pagination.setPage(this.model.pagination.page);
            collection.pagination.setItemsPerPage(this.model.pagination.itemsPerPage);
        }
        collection.pagination.setSort(this.model.getCollectionSort());
        collection.pagination.setParameters(this.model.parameters);

        const liveCollection = new LiveCollection(collection, this.model, this.exchange, this.database, this.subscriptionHandler, this.writer);
        collection.addTeardown(async () => {
            await liveCollection.stopSync();
        });
        await liveCollection.startSync();

        return collection;
    }

    /**
     * Returns a new Observable that resolves the id as soon as an item in the database of given filter criteria is found.
     */
    public onCreation<T extends IdInterface>(
        initialCheck: boolean = true,
        stopOnFind: boolean = true,
    ): Observable<string | number> {
        return new Observable((observer) => {
            let sub: Subscription | undefined;
            const filter = this.model.filter || {};

            (async () => {
                sub = await this.exchange.subscribeEntity(this.classSchema, (message) => {
                    if (message.type === 'add' && findQuerySatisfied(message.item, filter)) {
                        observer.next(message.id);
                        if (stopOnFind && sub) sub.unsubscribe();
                    }
                });

                if (initialCheck) {
                    const item = await this.database.query(this.classSchema).select('id').filter(filter).findOneOrUndefined();
                    if (item) {
                        observer.next(item.id);
                        if (stopOnFind) sub.unsubscribe();
                    }
                }
            })();

            return {
                unsubscribe() {
                    if (sub) sub.unsubscribe();
                }
            };
        });
    }
}

@injectable()
export class LiveDatabase {
    protected subscriptionHandler = new SubscriptionHandlers(this.writer, this.databases, this.exchange);
    protected entitySubscriptions = new Map<ClassSchema, AsyncEventSubscription[]>();

    constructor(
        protected databases: Databases,
        protected exchange: Exchange,
        protected writer: ConnectionWriter,
    ) {
    }

    public disableChangeFeed<T extends IdInterface>(classType: ClassType<T> | ClassSchema<T>) {
        const schema = getClassSchema(classType);
        const subscriptions = this.entitySubscriptions.get(schema);
        if (!subscriptions) return;
        for (const sub of subscriptions) sub.unsubscribe();
        this.entitySubscriptions.delete(schema);
    }

    public enableChangeFeed(...classTypes: (ClassType<IdInterface> | ClassSchema<IdInterface>)[]) {
        for (const classType of classTypes) {
            this.setupListeners(classType);
        }
    }

    protected setupListeners(classType: ClassType | ClassSchema) {
        const database = this.databases.getDatabaseForEntity(classType);
        const schema = getClassSchema(classType);
        if (this.entitySubscriptions.has(schema)) return;

        const subscriptions: AsyncEventSubscription[] = [];

        subscriptions.push(database.unitOfWorkEvents.onInsertPost.subscribe((event: UnitOfWorkEvent<IdInterface>) => {
            if (schema !== event.classSchema) return;

            const serialized = jsonSerializer.for(event.classSchema);

            for (const item of event.items) {
                this.exchange.publishEntity(event.classSchema, {
                    type: 'add',
                    id: item.id,
                    version: item.version,
                    item: serialized.serialize(item)
                });
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePre.subscribe((event: UnitOfWorkUpdateEvent<IdInterface>) => {
            if (schema !== event.classSchema) return;

            for (const changeSet of event.changeSets) {
                changeSet.changes.increase('version', 1);
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePost.subscribe((event: UnitOfWorkUpdateEvent<IdInterface>) => {
            if (schema !== event.classSchema) return;
            const serialized = jsonSerializer.for(event.classSchema);

            for (const changeSet of event.changeSets) {
                const jsonPatch: EntityPatches = {
                    $set: changeSet.changes.$set ? serialized.partialSerialize(changeSet.changes.$set) : undefined,
                    $inc: changeSet.changes.$inc,
                    $unset: changeSet.changes.$unset,
                };

                const fields: Partial<any> = {};

                for (const field of this.exchange.getUsedEntityFields(event.classSchema).value) {
                    fields[field] = (changeSet.item as any)[field];
                }

                this.exchange.publishEntity(event.classSchema, {
                    type: 'patch',
                    id: changeSet.item.id,
                    version: changeSet.item.version,
                    item: fields,
                    patch: jsonPatch
                });
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onDeletePost.subscribe((event: UnitOfWorkEvent<IdInterface>) => {
            if (schema !== event.classSchema) return;
            const ids: (string | number)[] = [];
            for (const item of event.items) ids.push(item.id);
            this.exchange.publishEntity(event.classSchema, {
                type: 'removeMany',
                ids: ids
            });
        }));

        subscriptions.push(database.queryEvents.onDeletePost.subscribe((event: QueryDatabaseDeleteEvent<IdInterface>) => {
            if (schema !== event.classSchema) return;

            this.exchange.publishEntity(event.classSchema, {
                type: 'removeMany',
                ids: event.deleteResult.primaryKeys
            });
        }));

        subscriptions.push(database.queryEvents.onPatchPre.subscribe(async (event) => {
            if (schema !== event.classSchema) return;
            event.patch.increase('version', 1);
            for (const field of this.exchange.getUsedEntityFields(event.classSchema).value) {
                if (!event.returning.includes(field)) event.returning.push(field);
            }
        }));

        subscriptions.push(database.queryEvents.onPatchPost.subscribe(async (event) => {
            if (schema !== event.classSchema) return;
            const serialized = jsonSerializer.for(event.classSchema);
            const jsonPatch = {
                $set: event.patch.$set ? serialized.partialSerialize(event.patch.$set) : undefined,
                $inc: event.patch.$inc,
                $unset: event.patch.$unset,
            };

            for (let i = 0; i < event.patchResult.primaryKeys.length; i++) {
                const fields: Partial<any> = {};

                for (const field of this.exchange.getUsedEntityFields(event.classSchema).value) {
                    if (!(event.patchResult.returning as any)[field]) continue;
                    fields[field] = (event.patchResult.returning as any)[field][i];
                }

                this.exchange.publishEntity(event.classSchema, {
                    type: 'patch',
                    id: event.patchResult.primaryKeys[i],
                    version: (event.patchResult.returning as any)['version'][i],
                    item: fields,
                    patch: jsonPatch,
                });
            }
        }));

        this.entitySubscriptions.set(schema, subscriptions);
    }

    public query<T extends IdInterface>(classType: ClassType<T> | ClassSchema<T>) {
        return new LiveQuery(
            this.writer,
            getClassSchema(classType),
            this.databases.getDatabaseForEntity(classType),
            this.exchange,
            this.subscriptionHandler.get(getClassSchema(classType))
        );
    }
}
