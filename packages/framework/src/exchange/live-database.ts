import {Collection, ConnectionWriter, EntitySubject, ExchangeEntity, IdInterface} from '@deepkit/framework-shared';
import {injectable} from '../injector/injector';
import {AsyncEventSubscription, ClassType} from '@deepkit/core';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {Observable, Subscription} from 'rxjs';
import {Exchange} from './exchange';
import {findQuerySatisfied} from '../utils';
import {Databases} from '../databases';
import {BaseQuery, Database, DatabaseQueryModel, FilterQuery, Sort} from '@deepkit/orm';

interface SentState {
    lastSentVersion?: number;
    listeners: number;
}

class SubscriptionHandler {
    protected sentEntities: { [id: string]: SentState } = {};
    protected entitySubscription?: Subscription;

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
            // console.log('subscribeEntity message', entityName, this.needsToBeSend(classType, message.id, message.version), message);

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
                } else if (message.type === 'update') {
                    this.writer.write({
                        type: 'entity/update',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                        data: message.item
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

    itemsPerPage(items: number): this {
        this.model.pagination.itemsPerPage = items;
        return this;
    }

    page(page: number): this {
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

    count(): Observable<number> {
        return new Observable<number>((observer) => {
            observer.next(1);
            return {
                unsubscribe() {
                }
            };
        });
    }

    async find(): Promise<Collection<T>> {
        const collection = new Collection(this.classSchema.classType);
        return collection;
    }

    // async find(): Promise<Collection<T>> {
    //     const jsonCollection = new Collection<T>(this.classSchema.classType);
    //
    //     // if (options.isPaginationEnabled()) {
    //     //     jsonCollection.pagination._activate();
    //     //     if (options._page) {
    //     //         jsonCollection.pagination.setPage(options._page);
    //     //     }
    //     //     if (options._itemsPerPage) {
    //     //         jsonCollection.pagination.setItemsPerPage(options._itemsPerPage);
    //     //     }
    //     //     if (options.hasSort()) {
    //     //         jsonCollection.pagination.setSort(options._sorts);
    //     //     }
    //     //
    //     //     jsonCollection.pagination.setParameters(options._filterParameters);
    //     // }
    //
    //     //todo, that doesnt work with parameters
    //     const reactiveQuery = options._filter;
    //     reactiveQuery.parameters = options._filterParameters;
    //
    //     const knownIDs: { [id: string]: boolean } = {};
    //
    //     await reactiveQuery.setupProviders(this);
    //
    //     const initialClassQuery = reactiveQuery.getClassQuery();
    //
    //     let currentQuery = initialClassQuery.query;
    //
    //     const getQuery = (fields?: (keyof T | string)[]): DatabaseQuery<T> => {
    //         if (!fields) {
    //             fields = options._fields;
    //         }
    //
    //         if (fields && fields.length > 0) {
    //             return this.database.query(this.classSchema)
    //                 .filter(currentQuery)
    //                 .select([...fields, 'id', 'version'] as string[]);
    //         }
    //
    //         return this.database.query(this.classSchema).filter(currentQuery);
    //     };
    //
    //     const getJsonItem = async (id: string) => {
    //         return this.database.query(this.classSchema)
    //             .filter({id: id})
    //             .select((options.isPartial() ? [...options._fields, 'id', 'version'] : []) as string[])
    //             .findOne();
    //     };
    //
    //     const applyPagination = <T>(query: DatabaseQuery<T>) => {
    //         if (jsonCollection.pagination.isActive()) {
    //             query.limit(jsonCollection.pagination.getItemsPerPage());
    //             query.skip((jsonCollection.pagination.getPage() * jsonCollection.pagination.getItemsPerPage()) - jsonCollection.pagination.getItemsPerPage());
    //
    //             if (jsonCollection.pagination.hasSort()) {
    //                 const sort: { [path: string]: 'asc' | 'desc' } = {};
    //                 for (const order of jsonCollection.pagination.getSort()) {
    //                     sort[order.field] = order.direction;
    //                 }
    //                 query.sort(sort);
    //             }
    //         }
    //     };
    //
    //     let updateCollectionPromise: Promise<void> | undefined;
    //     let pagingHash = '';
    //     let parametersHash = '';
    //
    //     //todo, throttle to max 1 times per second
    //     const updateCollection = async (databaseChanged: boolean = false) => {
    //         while (updateCollectionPromise) {
    //             await sleep(0.01);
    //             await updateCollectionPromise;
    //         }
    //
    //         return updateCollectionPromise = new Promise<void>(async (resolve, reject) => {
    //             try {
    //
    //                 //when database is changed during entityFeed events, we don't check that stuff
    //                 if (databaseChanged) {
    //                     pagingHash = jsonCollection.pagination.getPagingHash();
    //                     parametersHash = jsonCollection.pagination.getParametersHash();
    //                 } else {
    //                     const newPagingHash = jsonCollection.pagination.getPagingHash();
    //                     const newParametersHash = jsonCollection.pagination.getParametersHash();
    //                     let needUpdate = false;
    //
    //                     if (pagingHash !== newPagingHash) {
    //                         pagingHash = newPagingHash;
    //                         needUpdate = true;
    //                     }
    //
    //                     if (parametersHash !== newParametersHash) {
    //                         parametersHash = newParametersHash;
    //                         if (reactiveQuery.haveParametersChanged()) {
    //                             needUpdate = true;
    //                         }
    //                     }
    //
    //                     if (!needUpdate) {
    //                         // console.log('updateCollection needUpdate=false', getClassName(reactiveQuery.classType), newPagingHash, newParametersHash);
    //                         return;
    //                     }
    //                 }
    //
    //                 currentQuery = reactiveQuery.getClassQuery().query;
    //
    //                 const cursor = await getQuery(['id']);
    //                 const total = await cursor.clone().count();
    //
    //                 applyPagination(cursor);
    //
    //                 const items = await cursor.find();
    //
    //                 // console.log('updateCollection needUpdate=true', getClassName(reactiveQuery.classType), currentQuery, items);
    //
    //                 const copiedKnownIds = {...knownIDs};
    //
    //                 jsonCollection.batchStart();
    //                 try {
    //                     //todo, detect when whole page changed, so we can load&add all new items at once, instead of one-by-one.
    //                     for (const item of items) {
    //                         delete copiedKnownIds[item.id];
    //
    //                         if (!knownIDs[item.id]) {
    //                             knownIDs[item.id] = true;
    //                             if (options.isChangeFeedActive()) {
    //                                 this.increaseUsage(this.classSchema, item.id);
    //                             }
    //
    //                             const fullItem = await getJsonItem(item.id);
    //
    //                             //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
    //                             if (fullItem) {
    //                                 jsonCollection.add(fullItem);
    //                             } else {
    //                                 console.warn('ID not found anymore', item.id);
    //                             }
    //                         }
    //                     }
    //
    //                     //items left in copiedKnownIds have been deleted or filter doesn't match anymore.
    //                     for (const id of eachKey(copiedKnownIds)) {
    //                         delete knownIDs[id];
    //                         if (options.isChangeFeedActive()) {
    //                             this.decreaseUsage(this.classSchema, id);
    //                         }
    //                     }
    //
    //                     const idsToRemove = Object.keys(copiedKnownIds);
    //                     if (idsToRemove.length > 0) {
    //                         jsonCollection.removeMany(idsToRemove);
    //                     }
    //
    //                     //todo, call it only when really changed
    //                     jsonCollection.setSort(items.map(v => v.id));
    //
    //                     if (jsonCollection.pagination.getTotal() !== total) {
    //                         jsonCollection.pagination.setTotal(total);
    //                         jsonCollection.pagination.event.next({type: 'internal_server_change'});
    //                     }
    //                 } finally {
    //                     jsonCollection.batchEnd();
    //                 }
    //             } catch (error) {
    //                 console.error('updateCollection error', getClassName(reactiveQuery.classType), error);
    //                 updateCollectionPromise = undefined;
    //                 reject(error);
    //             } finally {
    //                 updateCollectionPromise = undefined;
    //                 resolve();
    //             }
    //         });
    //     };
    //
    //     jsonCollection.pagination.event.subscribe(async (event) => {
    //         if (event.type === 'client:apply' || event.type === 'apply') {
    //             // console.log(event.type, getClassName(reactiveQuery.classType));
    //
    //             await reactiveQuery.setAndApplyParameters(jsonCollection.pagination.getParameters());
    //
    //             await updateCollection();
    //
    //             if (event.type === 'client:apply') {
    //                 jsonCollection.pagination.event.next({type: 'server:apply/finished'});
    //             }
    //
    //             if (event.type === 'apply') {
    //                 jsonCollection.pagination._applyFinished();
    //             }
    //         }
    //     });
    //
    //     //triggered when a sub query changed its values. It changed our parameters basically.
    //     reactiveQuery.internalParameterChange.subscribe(async () => {
    //         await updateCollection(true);
    //     });
    //
    //     this.subscriptionHandler.subscribeEntity();
    //
    //     const fieldSub: AsyncSubscription = await this.exchange.subscribeEntityFields(this.classSchema, initialClassQuery.fieldNames);
    //
    //     const sub: Subscription = await this.exchange.subscribeEntity(this.classSchema, async (message: ExchangeEntity) => {
    //         // console.log(
    //         //     'subscribeEntity message', getEntityName(this.classSchema), (message as any)['id'],
    //         //     {
    //         //         known: knownIDs[(message as any)['id']],
    //         //         querySatisfied: (message as any).item ? findQuerySatisfied((message as any).item, currentQuery) : 'no .item',
    //         //         paginationActive: jsonCollection.pagination.isActive()
    //         //     },
    //         //     currentQuery,
    //         //     message
    //         // );
    //
    //         if (message.type === 'removeMany') {
    //             if (jsonCollection.pagination.isActive()) {
    //                 updateCollection(true);
    //             } else {
    //                 for (const id of message.ids) {
    //                     delete knownIDs[id];
    //
    //                     if (options.isChangeFeedActive()) {
    //                         this.decreaseUsage(this.classSchema, id);
    //                     }
    //                 }
    //
    //                 jsonCollection.removeMany(message.ids);
    //             }
    //
    //             return;
    //         }
    //
    //         if (!knownIDs[message.id] && message.type === 'add' && findQuerySatisfied(message.item, currentQuery)) {
    //             if (jsonCollection.pagination.isActive()) {
    //                 updateCollection(true);
    //             } else {
    //                 knownIDs[message.id] = true;
    //                 if (options.isChangeFeedActive()) {
    //                     this.increaseUsage(this.classSchema, message.id);
    //                 }
    //                 //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
    //                 jsonCollection.add(message.item);
    //             }
    //         }
    //
    //         if ((message.type === 'update' || message.type === 'patch') && message.item) {
    //             const querySatisfied = findQuerySatisfied(message.item, currentQuery);
    //
    //             if (knownIDs[message.id] && !querySatisfied) {
    //                 if (jsonCollection.pagination.isActive()) {
    //                     updateCollection(true);
    //                 } else {
    //                     //got invalid after updates?
    //                     delete knownIDs[message.id];
    //                     if (options.isChangeFeedActive()) {
    //                         this.decreaseUsage(this.classSchema, message.id);
    //                     }
    //                     jsonCollection.remove(message.id);
    //                 }
    //             } else if (!knownIDs[message.id] && querySatisfied) {
    //                 if (jsonCollection.pagination.isActive()) {
    //                     updateCollection(true);
    //                 } else {
    //                     //got valid after updates?
    //                     knownIDs[message.id] = true;
    //                     if (options.isChangeFeedActive()) {
    //                         this.increaseUsage(this.classSchema, message.id);
    //                     }
    //
    //                     let itemToSend = message.item;
    //                     if (message.type === 'patch') {
    //                         //message.item is not complete when message.type === 'patch', so load it
    //                         itemToSend = await getJsonItem(message.id);
    //                     }
    //
    //                     //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
    //                     jsonCollection.add(itemToSend);
    //                 }
    //             }
    //         }
    //
    //         if (message.type === 'remove' && knownIDs[message.id]) {
    //             if (jsonCollection.pagination.isActive()) {
    //                 //todo, we should probablt throttle that, so this is max every second called
    //                 updateCollection(true);
    //             } else {
    //                 delete knownIDs[message.id];
    //                 if (options.isChangeFeedActive()) {
    //                     this.decreaseUsage(this.classSchema, message.id);
    //                 }
    //                 jsonCollection.remove(message.id);
    //             }
    //         }
    //     });
    //
    //     jsonCollection.addTeardown(async () => {
    //         reactiveQuery.unsubscribe();
    //         for (const id of eachKey(knownIDs)) {
    //             this.decreaseUsage(this.classSchema, id);
    //         }
    //         sub.unsubscribe();
    //         await fieldSub.unsubscribe();
    //     });
    //
    //     const cursor = await getQuery();
    //     const total = await cursor.clone().count();
    //     jsonCollection.pagination.setTotal(total);
    //     applyPagination(cursor);
    //
    //     const items = await cursor.find();
    //
    //     for (const item of items) {
    //         knownIDs[item.id] = true;
    //         if (options.isChangeFeedActive()) {
    //             this.increaseUsage(this.classSchema, item.id);
    //         }
    //     }
    //
    //     jsonCollection.set(items);
    //
    //     return jsonCollection;
    // }

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
        const schema = getClassSchema(classType);
        const database = this.databases.getDatabaseForEntity(classType);
        if (this.entitySubscriptions.has(schema)) return;

        const subscriptions: AsyncEventSubscription[] = [];

        subscriptions.push(database.unitOfWorkEvents.onInsertPost.subscribe((event) => {
            console.log('shit inserted', event);
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePre.subscribe((event) => {
            for (const changeSet of event.changeSets) {
                changeSet.changes.$inc = {version: 1};
            }
        }));

        subscriptions.push(database.unitOfWorkEvents.onUpdatePost.subscribe((event) => {
            //publish
        }));

        subscriptions.push(database.unitOfWorkEvents.onDeletePost.subscribe((event) => {
            console.log('shit deleted', event);
        }));

        subscriptions.push(database.queryEvents.onDeletePost.subscribe((event) => {
            console.log('query shit deleted', event);
        }));

        subscriptions.push(database.queryEvents.onPatchPre.subscribe(async (event) => {
            //insert version: {$inc: +1}}
            // read result in post, and send to exchange
        }));

        subscriptions.push(database.queryEvents.onPatchPost.subscribe(async (event) => {
            console.log('query shit patched', event);
            const version = await this.exchange.version();

            // for (const primaryKey of event.primaryKeys) {
            //     const id = primaryKey[primaryKeyName];
            //
            //     this.exchange.publishEntity(schema, {
            //         type: 'patch',
            //         id: id,
            //         version: version, //this is the new version in the db, which we end up having when `patch` is applied.
            //         // item: scopedSerialized.serialize(),
            //         item: {},
            //         //todo rework: event.patch supports now $inc/$unset as well, which is not compatible with serializer.
            //         patch: scopedSerialized.serialize(event.patch),
            //     });
            // }
        }));

        // subscriptions.push(database.queryEvents.onUpdatePost.subscribe((event) => {
        //     console.log('query shit updated', event);
        // }));

        this.entitySubscriptions.set(schema, subscriptions);
    }

    // public for<T extends IdInterface>(classType: ClassType<T> | ClassSchema<T>): Database {
    //     const database = this.databases.getDatabaseForEntity(classType).fork();
    //
    //     database.unitOfWorkEvents.onInsertPost.subscribe((event) => {
    //         console.log('shit inserted', event);
    //     });
    //
    //     database.unitOfWorkEvents.onUpdatePost.subscribe((event) => {
    //         console.log('shit updated', event);
    //     });
    //
    //     return database;
    // }

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
