/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AsyncEventSubscription, asyncOperation, ClassType } from '@deepkit/core';
import { AsyncSubscription } from '@deepkit/core-rxjs';
import { BaseQuery, Database, DatabaseQueryModel, DatabaseRegistry, exportQueryFilterFieldNames, FilterQuery, QueryDatabaseDeleteEvent, replaceQueryFilterParameter, Sort, UnitOfWorkEvent, UnitOfWorkUpdateEvent } from '@deepkit/orm';
import { Collection, CollectionSort, EntitySubject, IdVersionInterface, rpcEntityPatch, rpcEntityRemove, RpcKernelBaseConnection, RpcTypes } from '@deepkit/rpc';
import { ClassSchema, getClassSchema, resolveClassTypeOrForward } from '@deepkit/type';
import { Observable } from 'rxjs';
import { Broker, EntityChannelMessageType, EntityPatches } from '../broker/broker';
import { injectable } from '@deepkit/injector';
import { findQuerySatisfied } from '../utils';

interface SentState {
    lastSentVersion?: number;
    listeners: number;
}

class SubscriptionHandler {
    protected sentEntities: { [id: string]: SentState } = {};
    protected entitySubscription?: Promise<AsyncSubscription>;

    constructor(
        protected connection: RpcKernelBaseConnection,
        protected classSchema: ClassSchema,
        protected database: Database,
        protected broker: Broker,
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
                this.entitySubscription.then(v => v.unsubscribe());
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

        this.entitySubscription = this.broker.entityChannel(this.classSchema).subscribe((message) => {
            if (message.type === EntityChannelMessageType.remove) {
                for (const id of message.ids) {
                    this.rmSentState(id);
                }

                this.connection.createMessageBuilder()
                    .composite(RpcTypes.Entity)
                    .add(RpcTypes.EntityRemove, rpcEntityRemove, {
                        entityName: entityName,
                        ids: message.ids,
                    }).send();
                return;
            }

            if (message.type === EntityChannelMessageType.patch && this.needsToBeSend(message.id, message.version)) {
                this.setSent(message.id, message.version);

                this.connection.createMessageBuilder()
                    .composite(RpcTypes.Entity)
                    .add(RpcTypes.EntityPatch, rpcEntityPatch, {
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                        patch: message.patch
                    }).send();
            }

            //nothing to do for ADD, because that's handled by Collection
        });
    }
}

class SubscriptionHandlers {
    protected handler = new Map<ClassSchema, SubscriptionHandler>();

    constructor(
        protected connection: RpcKernelBaseConnection,
        protected databases: DatabaseRegistry,
        protected broker: Broker,
    ) {
    }

    get(classSchema: ClassSchema): SubscriptionHandler {
        let handler = this.handler.get(classSchema);
        if (!handler) {
            handler = new SubscriptionHandler(this.connection, classSchema, this.databases.getDatabaseForEntity(classSchema), this.broker);
            this.handler.set(classSchema, handler);
        }

        return handler;
    }
}

class LiveDatabaseQueryModel<T> extends DatabaseQueryModel<T, FilterQuery<T>, Sort<T, any>> {
    public disableEntityChangeFeed = false;

    isChangeFeedActive() {
        return !this.disableEntityChangeFeed;
    }

    getCollectionSort(): CollectionSort[] {
        const sort: CollectionSort[] = [];
        if (!this.sort) return sort;

        for (const [name, direction] of Object.entries(this.sort as Sort<T>)) {
            sort.push({ field: name, direction: direction as 'asc' | 'desc' });
        }
        return sort;
    }
}

type JoinedClassSchemaInfo = {
    classSchema: ClassSchema,
    fields: string[],
    filter: FilterQuery<any>,
    usedEntityFieldsSubscription?: AsyncSubscription,
    entitySubscription?: AsyncSubscription,
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


class LiveCollection<T extends IdVersionInterface> {
    protected joinedClassSchemas: JoinedClassSchemaInfo[] = [];

    protected rootFields: string[] = [];
    protected rootUsedEntityFieldsSubscription?: AsyncSubscription;
    protected entitySubscription?: AsyncSubscription;

    protected knownIDs = new Set<string | number>();

    protected classSchema = getClassSchema(this.collection.classType);

    constructor(
        protected collection: Collection<any>,
        protected model: LiveDatabaseQueryModel<T>,
        protected broker: Broker,
        protected database: Database,
        protected subscriptionHandler: SubscriptionHandler,
        protected connection: RpcKernelBaseConnection,
    ) {
        this.rootFields = exportQueryFilterFieldNames(this.classSchema, model.filter || {});
        // figure out what entities are involved (by going through all joins)
        extractJoinedClassSchemaInfos(this.model, this.joinedClassSchemas);
    }

    protected async publishUseEntityFields() {
        const promises: Promise<any>[] = [];

        if (this.rootFields.length) promises.push(this.broker.publishEntityFields(this.classSchema, this.rootFields).then(v => this.rootUsedEntityFieldsSubscription = v));

        for (const info of this.joinedClassSchemas) {
            if (!info.fields.length) continue;
            promises.push(this.broker.publishEntityFields(info.classSchema, info.fields).then(sub => {
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

        query.model = this.model;

        const items = await query.find();
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

        if (this.collection.state.total !== total) {
            this.collection.state.total = total;
            this.collection.setState(this.collection.state);
        }
    }

    protected async getItem(id: string | number): Promise<T | undefined> {
        const query = this.database.query(this.classSchema);
        query.model = this.model.clone(query);
        query.filter({ id: id });
        return query.findOneOrUndefined();
    }

    public async startSync() {
        if (this.entitySubscription) throw new Error('Collection sync already started');

        await this.publishUseEntityFields();

        for (const info of this.joinedClassSchemas) {
            if (info.entitySubscription) continue;
            //if its part of our join filter, we reload the collection
            info.entitySubscription = await this.broker.entityChannel(info.classSchema).subscribe((message) => {
                //todo: check if item belongs to the join criteria
                this.updateCollection(true);
            });
        }

        let currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

        function requiresFullUpdate(collection: Collection<any>): boolean {
            return collection.model.hasPaging() || collection.model.hasSort();
        }

        // const scopedSerializer = jsonSerializer.for(this.classSchema);
        this.entitySubscription = await this.broker.entityChannel(this.classSchema).subscribe(async (message) => {
            if (message.type === EntityChannelMessageType.remove) {
                if (requiresFullUpdate(this.collection)) {
                    await this.updateCollection(true);
                    return;
                }

                for (const id of message.ids) {
                    this.knownIDs.delete(id);
                    if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(id);
                }
                this.collection.removeMany(message.ids);
            }

            if (message.type === EntityChannelMessageType.add) {

                if (this.knownIDs.has(message.id) || !findQuerySatisfied(message.item, currentQuery)) {
                    return;
                }

                if (requiresFullUpdate(this.collection)) {
                    await this.updateCollection(true);
                    return;
                }

                this.knownIDs.add(message.id);
                if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(message.id);
                this.collection.add(message.item);
            }

            if (message.type === EntityChannelMessageType.patch) {
                const querySatisfied = findQuerySatisfied(message.item, currentQuery);

                if (this.knownIDs.has(message.id) && !querySatisfied) {
                    if (requiresFullUpdate(this.collection)) {
                        await this.updateCollection(true);
                    } else {
                        //got invalid after updates?
                        this.knownIDs.delete(message.id);
                        if (this.model.isChangeFeedActive()) this.subscriptionHandler.decreaseUsage(message.id);
                        this.collection.remove(message.id);
                    }
                } else if (!this.knownIDs.has(message.id) && querySatisfied) {
                    if (requiresFullUpdate(this.collection)) {
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
        });

        this.model.change.subscribe(() => {
            this.updateCollection().catch(console.error);
        });

        this.collection.model.change.subscribe(() => {
            this.model.limit = this.collection.model.limit;
            this.model.skip = this.collection.model.skip;
            this.model.itemsPerPage = this.collection.model.itemsPerPage;
            this.model.sort = this.collection.model.sort as Sort<any>;

            if (this.collection.model.filter) this.model.filter = this.collection.model.filter;

            this.model.setParameters(this.collection.model.parameters);
            this.updateCollection().catch(console.error);
        });

        // this.collection.pagination.event.subscribe(async (event) => {
        //     if (event.type === 'client:apply' || event.type === 'apply') {
        //         //its important to not reassign a new object ref to this.model.parameters, since the ref
        //         //is stored in joined query models as well.
        //         const newParameters = this.collection.pagination.getParameters();
        //         for (const [i, value] of eachPair(newParameters)) {
        //             this.model.parameters[i] = value;
        //         }
        //         currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

        //         await this.updateCollection();

        //         if (event.type === 'client:apply') this.collection.pagination.event.next({type: 'server:apply/finished'});
        //         if (event.type === 'apply') this.collection.pagination._applyFinished();
        //     }
        // });

        const query = this.database.query(this.classSchema);

        query.model = this.model.clone(query);
        query.model.limit = undefined;
        query.model.skip = undefined;
        const total = await query.count();

        this.collection.state.total = total;

        query.model = this.model;
        const items = await query.find();

        for (const item of items) {
            this.knownIDs.add(item.id);
            if (this.model.isChangeFeedActive()) this.subscriptionHandler.increaseUsage(item.id);
        }

        this.collection.set(items);
    }
}

export class LiveQuery<T extends IdVersionInterface> extends BaseQuery<T> {
    public model = this.createModel<T>();

    constructor(
        public classSchema: ClassSchema<T>,
        protected connection: RpcKernelBaseConnection,
        protected database: Database,
        protected broker: Broker,
        protected subscriptionHandler: SubscriptionHandler,
    ) {
        super(classSchema);
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.connection, this.database, this.broker, this.subscriptionHandler);
        cloned.model = this.model.clone(cloned) as this['model'];
        return cloned;
    }

    disableEntityChangeFeed(): this {
        this.model.disableEntityChangeFeed = true;
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

    public count<T extends IdVersionInterface>(): Observable<number> {
        const rootFields = exportQueryFilterFieldNames(this.classSchema, this.model.filter || {});
        let currentQuery = replaceQueryFilterParameter(this.classSchema, this.model.filter || {}, this.model.parameters);

        const joinedClassSchemas: JoinedClassSchemaInfo[] = [];
        extractJoinedClassSchemaInfos(this.model, joinedClassSchemas);

        return new Observable((observer) => {
            let rootEntitySub: AsyncSubscription;
            let usedEntityFieldsSub: AsyncSubscription;

            (async () => {
                usedEntityFieldsSub = await this.broker.publishEntityFields(this.classSchema, rootFields);

                const knownIDs = new Set<string | number>();
                let counter = 0;

                rootEntitySub = await this.broker.entityChannel(this.classSchema).subscribe((message) => {
                    if (message.type === EntityChannelMessageType.add) {
                        if (!knownIDs.has(message.id) && findQuerySatisfied(message.item, currentQuery)) {
                            counter++;
                            knownIDs.add(message.id);
                            observer.next(counter);
                        }
                    }

                    if (message.type === EntityChannelMessageType.patch) {
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

                    if (message.type === EntityChannelMessageType.remove) {
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
                    observer.next(counter);
                };

                for (const info of joinedClassSchemas) {
                    if (info.entitySubscription) continue;
                    //if its part of our join filter, we reload the collection
                    info.entitySubscription = await this.broker.entityChannel(info.classSchema).subscribe((message) => {
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
        collection.model.set(this.model);

        const liveCollection = new LiveCollection(collection, this.model, this.broker, this.database, this.subscriptionHandler, this.connection);
        collection.addTeardown(async () => {
            await liveCollection.stopSync();
        });
        await liveCollection.startSync();

        return collection;
    }

    /**
     * Returns a new Observable that resolves the id as soon as an item in the database of given filter criteria is found.
     */
    public onCreation<T extends IdVersionInterface>(
        initialCheck: boolean = true,
        stopOnFind: boolean = true,
    ): Observable<string | number> {
        return new Observable((observer) => {
            let sub: AsyncSubscription | undefined;
            const filter = this.model.filter || {};

            (async () => {
                sub = await this.broker.entityChannel(this.classSchema).subscribe((message) => {
                    if (message.type === EntityChannelMessageType.add && findQuerySatisfied(message.item, filter)) {
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
    protected subscriptionHandler = new SubscriptionHandlers(this.connection, this.databases, this.broker);
    protected entitySubscriptions = new Map<ClassSchema, AsyncEventSubscription[]>();

    constructor(
        protected databases: DatabaseRegistry,
        protected broker: Broker,
        protected connection: RpcKernelBaseConnection,
    ) {
    }

    public disableChangeFeed<T extends IdVersionInterface>(classType: ClassType<T> | ClassSchema<T>) {
        const schema = getClassSchema(classType);
        const subscriptions = this.entitySubscriptions.get(schema);
        if (!subscriptions) return;
        for (const sub of subscriptions) sub.unsubscribe();
        this.entitySubscriptions.delete(schema);
    }

    public enableChangeFeed(...classTypes: (ClassType<IdVersionInterface> | ClassSchema<IdVersionInterface>)[]) {
        for (const classType of classTypes) {
            this.setupListeners(classType);
        }
    }

    public getSubscriptionHandler(classType: ClassType) {
        return this.subscriptionHandler.get(getClassSchema(classType));
    }

    protected setupListeners(classType: ClassType | ClassSchema) {
        const database = this.databases.getDatabaseForEntity(classType);
        const schema = getClassSchema(classType);
        if (this.entitySubscriptions.has(schema)) return;

        const subscriptions: AsyncEventSubscription[] = [];

        subscriptions.push(database.unitOfWorkEvents.onInsertPost.subscribe((event: UnitOfWorkEvent<IdVersionInterface>) => {
            if (schema !== event.classSchema) return;

            for (const item of event.items) {
                this.broker.entityChannel(event.classSchema).publishAdd(item).catch(() => {
                    console.warn('Failed publishing add event', schema.getClassName(), item);
                });
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePre.subscribe((event: UnitOfWorkUpdateEvent<IdVersionInterface>) => {
            if (schema !== event.classSchema) return;

            for (const changeSet of event.changeSets) {
                changeSet.changes.increase('version', 1);
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePost.subscribe(async (event: UnitOfWorkUpdateEvent<IdVersionInterface>) => {
            if (schema !== event.classSchema) return;
            // const serialized = jsonSerializer.for(event.classSchema);

            for (const changeSet of event.changeSets) {
                const jsonPatch: any = {
                    $set: changeSet.changes.$set,
                    $inc: changeSet.changes.$inc,
                    $unset: changeSet.changes.$unset,
                };

                const fields: Partial<any> = {};

                for (const field of await this.broker.getEntityFields(event.classSchema)) {
                    fields[field] = (changeSet.item as any)[field];
                }

                this.broker.entityChannel(event.classSchema).publishPatch(
                    changeSet.item.id,
                    changeSet.item.version,
                    jsonPatch,
                    fields,
                );
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onDeletePost.subscribe((event: UnitOfWorkEvent<IdVersionInterface>) => {
            if (schema !== event.classSchema) return;
            const ids: (string | number)[] = [];
            for (const item of event.items) ids.push(item.id);

            this.broker.entityChannel(event.classSchema).publishRemove(ids).catch(() => {
                console.warn('Failed publishing remove event', schema.getClassName(), ids);
            });;
        }));

        subscriptions.push(database.queryEvents.onDeletePost.subscribe((event: QueryDatabaseDeleteEvent<IdVersionInterface>) => {
            if (schema !== event.classSchema) return;

            this.broker.entityChannel(event.classSchema).publishRemove(event.deleteResult.primaryKeys).catch(() => {
                console.warn('Failed publishing remove event', schema.getClassName(), event.deleteResult.primaryKeys);
            });
        }));

        subscriptions.push(database.queryEvents.onPatchPre.subscribe(async (event) => {
            if (schema !== event.classSchema) return;
            event.patch.increase('version', 1);
            event.returning.push('version');
            for (const field of await this.broker.getEntityFields(event.classSchema)) {
                if (!event.returning.includes(field)) event.returning.push(field);
            }
        }));

        subscriptions.push(database.queryEvents.onPatchPost.subscribe(async (event) => {
            if (schema !== event.classSchema) return;

            const jsonPatch: EntityPatches = {
                $set: event.patch.$set,
                $inc: event.patch.$inc,
                $unset: event.patch.$unset,
            };

            for (let i = 0; i < event.patchResult.primaryKeys.length; i++) {
                const fields: Partial<any> = {};

                for (const field of await this.broker.getEntityFields(event.classSchema)) {
                    if (!(event.patchResult.returning as any)[field]) continue;
                    fields[field] = (event.patchResult.returning as any)[field][i];
                }

                this.broker.entityChannel(event.classSchema).publishPatch(
                    event.patchResult.primaryKeys[i],
                    (event.patchResult.returning as any)['version'][i],
                    jsonPatch,
                    fields,
                );
            }
        }));

        this.entitySubscriptions.set(schema, subscriptions);
    }

    public query<T extends IdVersionInterface>(classType: ClassType<T> | ClassSchema<T>) {
        return new LiveQuery(
            getClassSchema(classType),
            this.connection,
            this.databases.getDatabaseForEntity(classType),
            this.broker,
            this.subscriptionHandler.get(getClassSchema(classType))
        );
    }
}
