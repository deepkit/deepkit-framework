import {Exchange} from "./exchange";
import {FS} from "./fs";
import {getEntityName} from "@marcj/marshal";
import {Observable, Subject, Subscription} from "rxjs";
import {convertClassQueryToMongo, convertPlainQueryToMongo, convertQueryToMongo, mongoToPlain, partialMongoToPlain} from "@marcj/marshal-mongo";
import sift, {SiftQuery} from "sift";
import {EntitySubject, ExchangeEntity, FilterQuery, GlutFile, IdInterface, JSONObjectCollection, ReactiveJoin, Collection, CollectionSort} from "@marcj/glut-core";
import {ClassType, eachKey} from "@marcj/estdlib";
import {AsyncSubscription, Subscriptions} from "@marcj/estdlib-rxjs";
import {ExchangeDatabase} from "./exchange-database";
import {Injectable} from "injection-js";
import {ConnectionWriter} from "./connection-writer";
import {Cursor} from "typeorm";

interface SentState {
    lastSentVersion?: number;
    listeners: number;
}

function findQuerySatisfied<T extends { [index: string]: any }>(target: { [index: string]: any }, query: FilterQuery<T>): boolean {
    return sift(query as SiftQuery<T[]>, [target]).length > 0;
}

class FindBuilder<T extends IdInterface> {
    public _filter: FilterQuery<T> | ReactiveQuery<T> = {};
    public _fields: (keyof T | string)[] = [];
    public _pagination: boolean = false;
    public _page: number = 1;
    public _itemsPerPage: number = 50;
    public _sorts: CollectionSort[] = [];

    constructor(
        public readonly classType: ClassType<T>,
        public readonly entityStorage: EntityStorage,

    ) {}

    public filter(filter: FilterQuery<T> | ReactiveQuery<T> = {}): FindBuilder<T> {
        this._filter = filter;
        return this;
    }

    public fields(fields: (keyof T | string)[]): FindBuilder<T> {
        this._fields = fields;
        return this;
    }

    public enablePagination(): FindBuilder<T> {
        this._pagination = true;
        return this;
    }

    public page(page: number): FindBuilder<T> {
        this._page = page;
        this._pagination = true;
        return this;
    }

    public itemsPerPage(items: number): FindBuilder<T> {
        this._itemsPerPage = items;
        this._pagination = true;
        return this;
    }

    public orderBy(field: keyof T | string, direction: 'asc' | 'desc' = 'asc'): FindBuilder<T> {
        this._sorts.push({field: field as string, direction: direction});
        return this;
    }

    public find(): Promise<Collection<T>> {
        return this.entityStorage.find(
            this.classType,
            this._filter,
            {
                fields: this._fields,
                sort: this._sorts,
                pagination: this._pagination,
                itemsPerPage: this._itemsPerPage,
                page: this._page,
            }
        );
    }
}

export class ReactiveQuery<T> {
    public providers: any[] = [];
    public providersSet = new Set<string>();
    public values: { [name: string]: any } = {};
    public didSetup = false;

    public readonly next = new Subject<any>();

    protected subs = new Subscriptions();

    constructor(
        public classType: ClassType<T>,
        public query: FilterQuery<T>
    ) {
        //read $join
        this.query = convertQueryToMongo(this.classType, this.query, (convertClassType, path, value) => {
            return value;
        }, {}, {
            '$join': (name, value: any) => {
                if (value instanceof ReactiveJoin) {
                    const reactiveName = name + '_' + value.field;
                    this.provide(reactiveName, value.classType, value.query, value.field);
                    return {'$reactive': reactiveName};
                }

                throw new Error('$join needs to be ReactiveJoin.');
            }
        });
    }

    static create<T>(classType: ClassType<T>, query: FilterQuery<T>) {
        return new ReactiveQuery(classType, query);
    }

    public provide<T, K extends keyof T>(name: string, classType: ClassType<T>, filter: any, field?: K | 'id') {
        if (this.didSetup) {
            throw new Error('Can not add provider while already activated.');
        }

        if (!field) field = 'id';

        if (this.providersSet.has(name)) {
            throw new Error(`Provider with name ${name} already exists.`);
        }

        this.providersSet.add(name);
        this.providers.push({
            name: name,
            classType: classType,
            filter: filter,
            field: field,
        });

        return this;
    }

    public change(name: string, value: any) {
        //rebuild filter and re-query, to see what changed.
        this.values[name] = value;

        if (this.didSetup) {
            //throttle?
            this.next.next(this.getClassQuery());
        }
    }

    public unsubscribe() {
        this.subs.unsubscribe();
        this.next.unsubscribe();
    }

    public async setupProviders(storage: EntityStorage) {
        for (const provider of this.providers) {
            const result = await storage.find(provider.classType, provider.filter, {fields: [provider.field], disableEntityChangeFeed: true});
            this.subs.add = result.subscribe((v: any) => {
                //change, propagate
                // console.log('change', provider.name, provider.field, v.map((i: any) => i[provider.field]));

                //WARNING: usually `filter` is class values based, but we pass here json values (since find() return json values). we should probably convert that here
                this.change(provider.name, v.map((i: any) => i[provider.field]));
            });
        }

        this.didSetup = true;
    }

    public getClassQuery(): { query: any, fieldNames: string[] } {
        const fieldNames = {};
        const query = convertClassQueryToMongo(this.classType, this.query, fieldNames, {
            '$reactive': (name, value) => {
                if (undefined === this.values[value]) {
                    throw new Error(`ReactiveQuery missing provider for '${value}'.`);
                }

                return {$in: this.values[value]};
            }
        });

        return {
            query: query,
            fieldNames: Object.keys(fieldNames)
        };
    }
}

@Injectable()
export class EntityStorage {
    protected sentEntities = new Map<ClassType<any>, { [id: string]: SentState }>();

    protected entitySubscription = new Map<ClassType<any>, Subscription>();

    constructor(
        protected readonly writer: ConnectionWriter,
        protected readonly exchange: Exchange,
        protected readonly exchangeDatabase: ExchangeDatabase,
        protected readonly fs: FS<GlutFile>, //todo, refactor: exclude that dependency and move fileContent to own class
    ) {
    }

    public destroy() {
        for (const sub of this.entitySubscription.values()) {
            sub.unsubscribe();
        }
    }

    public getSentStateStore<T>(classType: ClassType<T>): { [id: string]: SentState } {
        let store = this.sentEntities.get(classType);
        if (!store) {
            store = {};
            this.sentEntities.set(classType, store);
        }

        return store;
    }

    protected hasSentState<T>(classType: ClassType<T>, id: string): boolean {
        return !!this.getSentStateStore(classType)[id];
    }

    /**
     * Necessary when the whole state of `id` should be deleted from memory, so it wont sync to client anymore.
     */
    protected rmSentState<T>(classType: ClassType<T>, id: string) {
        const store = this.getSentStateStore(classType);

        delete store[id];
    }

    protected getSentState<T>(classType: ClassType<T>, id: string): SentState {
        const store = this.getSentStateStore(classType);

        if (!store[id]) {
            store[id] = {
                lastSentVersion: 0,
                listeners: 0,
            };
        }

        return store[id];
    }

    protected setSent<T>(classType: ClassType<T>, id: string, version?: number) {
        this.getSentState(classType, id).lastSentVersion = version;
    }

    public needsToBeSend<T>(classType: ClassType<T>, id: string, version: number): boolean {
        if (!this.hasSentState(classType, id)) return false;

        const state = this.getSentState(classType, id);
        return state.listeners > 0 && (state.lastSentVersion === undefined || (version === 0 || version > state.lastSentVersion));
    }

    public decreaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners--;

        if (state.listeners <= 0) {
            const store = this.getSentStateStore(classType);
            const entitySubscription = this.entitySubscription.get(classType);
            if (entitySubscription) {
                entitySubscription.unsubscribe();
                this.entitySubscription.delete(classType);
            }
            delete store[id];
        }
    }

    private increaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners++;
    }

    async subscribeEntity<T extends IdInterface>(classType: ClassType<T>) {
        if (this.entitySubscription.has(classType)) {
            //already subscribed, nothing to do here
            return;
        }

        const entityName = getEntityName(classType);

        const sub = await this.exchange.subscribeEntity(classType, (message: ExchangeEntity) => {
            if (message.type === 'removeMany') {
                for (const id of message.ids) {
                    this.rmSentState(classType, id);
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

            if (this.needsToBeSend(classType, message.id, message.version)) {
                this.setSent(classType, message.id, message.version);

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
                    //no the same connection. If a different connection calls findOne()
                    //it also calls subscribeEntity.

                    this.rmSentState(classType, message.id);

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

        this.entitySubscription.set(classType, sub);
    }

    // multiCount<T extends IdInterface>(classType: ClassType<T>, filters: { [p: string]: any }[] = []): Observable<CountResult> {
    //     return new Observable((observer) => {
    //         let fieldSub: AsyncSubscription;
    //         let sub: Subscription;
    //         let running = true;
    //
    //         (async () => {
    //             const filterFields: { [id: string]: boolean } = {};
    //             const counters: number[] = [];
    //             const ids: { [id: string]: boolean }[] = [];
    //
    //             for (const filter of filters) {
    //                 counters.push(0);
    //                 ids.push({});
    //                 for (const field of Object.keys(filter)) {
    //                     filterFields[field] = true;
    //                 }
    //
    //             }
    //
    //             fieldSub = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));
    //
    //             sub = this.exchange.subscribeEntity(classType, (message) => {
    //                 if (message.type === 'add') {
    //                     for (const [i, filter] of eachPair(filters)) {
    //                         if (!ids[i][message.id] && findQuerySatisfied(message.item, filter)) {
    //                             counters[i]++;
    //                             ids[i][message.id] = true;
    //                             observer.next({
    //                                 type: 'count',
    //                                 index: i,
    //                                 count: counters[i]
    //                             });
    //                         }
    //                     }
    //                 }
    //
    //                 if (message.type === 'patch' || message.type === 'update') {
    //                     for (const [i, filter] of eachPair(filters)) {
    //                         if (ids[i][message.id] && !findQuerySatisfied(message.item, filter)) {
    //                             counters[i]--;
    //                             delete ids[i][message.id];
    //                             observer.next({
    //                                 type: 'count',
    //                                 index: i,
    //                                 count: counters[i]
    //                             });
    //                         } else if (!ids[i][message.id] && findQuerySatisfied(message.item, filter)) {
    //                             counters[i]++;
    //                             ids[i][message.id] = true;
    //                             observer.next({
    //                                 type: 'count',
    //                                 index: i,
    //                                 count: counters[i]
    //                             });
    //                         }
    //                     }
    //                 }
    //
    //                 if (message.type === 'remove') {
    //                     for (const [i, filter] of eachPair(filters)) {
    //                         if (ids[i][message.id]) {
    //                             counters[i]--;
    //                             delete ids[i][message.id];
    //                             observer.next({
    //                                 type: 'count',
    //                                 index: i,
    //                                 count: counters[i]
    //                             });
    //                         }
    //                     }
    //                 }
    //             });
    //
    //             for (const [i, filter] of eachPair(filters)) {
    //                 const rawPlainCursor = await this.exchangeDatabase.rawPlainCursor(classType, filter);
    //                 rawPlainCursor.project({id: 1}).batchSize(64);
    //
    //                 while (running && await rawPlainCursor.hasNext()) {
    //                     const next = await rawPlainCursor.next();
    //                     if (!next) continue;
    //                     const item = partialMongoToPlain(classType, next);
    //                     counters[i]++;
    //                     ids[i][item.id] = true;
    //                 }
    //
    //                 observer.next({
    //                     type: 'count',
    //                     index: i,
    //                     count: counters[i]
    //                 });
    //             }
    //         })();
    //
    //
    //         return {
    //             unsubscribe: async () => {
    //                 running = false;
    //                 sub.unsubscribe();
    //                 await fieldSub.unsubscribe();
    //             }
    //         };
    //     });
    // }

    public count<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>): Observable<number> {
        return new Observable((observer) => {
            let fieldSub: AsyncSubscription;
            let sub: Subscription;
            let running = true;

            (async () => {
                const knownIDs: { [id: string]: boolean } = {};
                const filterFields: { [name: string]: boolean } = {};
                //todo, we expect filter to have class instance as values (Date, etc), so we need to convert it to JSON values first, or whatever findQuerySatisfied needs.
                convertPlainQueryToMongo(classType, filter, filterFields);
                let counter = 0;

                fieldSub = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));

                sub = await this.exchange.subscribeEntity(classType, (message) => {
                    if (message.type === 'add') {
                        if (!knownIDs[message.id] && findQuerySatisfied(message.item, filter)) {
                            counter++;
                            knownIDs[message.id] = true;
                            observer.next(counter);
                        }
                    }

                    if (message.type === 'patch' || message.type === 'update') {
                        if (knownIDs[message.id] && !findQuerySatisfied(message.item, filter)) {
                            counter--;
                            delete knownIDs[message.id];
                            observer.next(counter);
                        } else if (!knownIDs[message.id] && findQuerySatisfied(message.item, filter)) {
                            counter++;
                            knownIDs[message.id] = true;
                            observer.next(counter);
                        }
                    }

                    if (message.type === 'remove') {
                        if (knownIDs[message.id]) {
                            counter--;
                            delete knownIDs[message.id];
                            observer.next(counter);
                        }
                    }
                });

                const cursor = (await this.exchangeDatabase.rawPlainCursor(classType, filter))
                    .project({id: 1})
                    .map((v: any) => mongoToPlain(classType, v))
                    .batchSize(64);

                while (running && await cursor.hasNext()) {
                    const next = await cursor.next();
                    if (!next) continue;
                    const item = partialMongoToPlain(classType, next);
                    counter++;
                    knownIDs[item.id] = true;
                }

                observer.next(counter);
            })();


            return {
                unsubscribe: async () => {
                    running = false;
                    sub.unsubscribe();
                    await fieldSub.unsubscribe();
                }
            };
        });
    }

    public async findOneOrUndefined<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T> = {}): Promise<EntitySubject<T | undefined>> {
        const item = await this.exchangeDatabase.get(classType, filter);

        if (item) {
            const foundId = item.id;

            this.increaseUsage(classType, foundId);
            this.setSent(classType, item.id, item.version);
            this.subscribeEntity(classType);

            return new EntitySubject<T | undefined>(item, () => {
                this.decreaseUsage(classType, foundId);
            });
        } else {
            return new EntitySubject<T | undefined>(undefined, classType);
        }
    }

    public async findOne<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T> = {}): Promise<EntitySubject<T>> {
        const item = await this.exchangeDatabase.get(classType, filter);

        if (item) {
            const foundId = item.id;
            this.increaseUsage(classType, foundId);
            this.setSent(classType, item.id, item.version);
            this.subscribeEntity(classType);

            //todo, teardown is not called when item has been removed. mh
            // 22.4. really?
            return new EntitySubject(item, () => {
                this.decreaseUsage(classType, foundId);
            });
        } else {
            throw new Error('Item not found');
        }
    }

    collection<T extends IdInterface>(classType: ClassType<T>) {
        return new FindBuilder(classType, this);
    }

    /**
     * For performance reasons, this returns a JSONObjectCollection. Use plainToClass() if you want to work with the result. TODO add option to support regular Collection as well.
     */
    async find<T extends IdInterface, K extends keyof T & string>(
        classType: ClassType<T>,
        filter: FilterQuery<T> | ReactiveQuery<T> = {},
        options: {
            fields?: (keyof T | string)[],
            disableEntityChangeFeed?: true,
            pagination?: boolean,
            page?: number,
            itemsPerPage?: number,
            sort?: CollectionSort[],
        } = {}
    ): Promise<JSONObjectCollection<T>> {
        const jsonCollection = new JSONObjectCollection<T>(classType);

        if (options.pagination) {
            jsonCollection.pagination._activate();
            if (options.page) {
                jsonCollection.pagination.setPage(options.page);
            }
            if (options.itemsPerPage) {
                jsonCollection.pagination.setItemsPerPage(options.itemsPerPage);
            }
            if (options.sort) {
                jsonCollection.pagination.setOrder(options.sort);
            }
        }

        const reactiveQuery = filter instanceof ReactiveQuery ? filter : ReactiveQuery.create(classType, filter);
        const knownIDs: { [id: string]: boolean } = {};

        await reactiveQuery.setupProviders(this);

        const initialClassQuery = reactiveQuery.getClassQuery();
        let currentQuery: any = initialClassQuery.query;

        const getCursor = async (fields?: (keyof T | string)[]): Promise<Cursor<T>> => {
            if (!fields) {
                fields = options.fields;
            }

            if (fields && fields.length > 0) {
                return await this.exchangeDatabase.rawPlainCursor(classType, currentQuery, [...fields, 'id', 'version']);
            }

            return await this.exchangeDatabase.rawPlainCursor(classType, currentQuery);
        };

        const getItem = async (id: string) => {
            const cursor = await this.exchangeDatabase.rawPlainCursor(classType, {id: id} as FilterQuery<T>);
            return (await cursor.limit(1).toArray())[0];
        };

        const applyPagination = (cursor: Cursor<any>) => {
            if (jsonCollection.pagination.isActive()) {
                cursor.limit(jsonCollection.pagination.getItemsPerPage());
                cursor.skip((jsonCollection.pagination.getPage() * jsonCollection.pagination.getItemsPerPage()) - jsonCollection.pagination.getItemsPerPage());

                if (jsonCollection.pagination.hasOrder()) {
                    const sort: { [path: string]: 1 | -1 } = {};
                    for (const order of jsonCollection.pagination.getOrder()) {
                        sort[order.field] = order.direction === 'asc' ? 1 : -1;
                    }
                    cursor.sort(sort);
                }
            }
        };

        const updateCollection = async () => {
            const cursor = await getCursor(['id']);
            const total = await cursor.count(false);

            applyPagination(cursor);
            const items = await cursor.toArray();
            const copiedKnownIds = {...knownIDs};

            jsonCollection.batchStart();
            try {
                for (const item of items) {
                    delete copiedKnownIds[item.id];

                    if (!knownIDs[item.id]) {
                        knownIDs[item.id] = true;
                        this.increaseUsage(classType, item.id);

                        const fullItem = await getItem(item.id);

                        //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
                        if (fullItem) {
                            jsonCollection.add(fullItem);
                        } else {
                            console.warn('ID not found anymore', item.id);
                        }
                    }
                }

                //items left in copiedKnownIds have been deleted or filter doesn't match anylonger.
                for (const id of eachKey(copiedKnownIds)) {
                    delete knownIDs[id];
                    this.decreaseUsage(classType, id);
                }

                const idsToRemove = Object.keys(copiedKnownIds);
                if (idsToRemove.length > 0) {
                    jsonCollection.removeMany(idsToRemove);
                }

                jsonCollection.setSort(items.map(v => v.id));

                //todo, when total decreases and current page doesn't fit anymore, what to do?
                if (jsonCollection.pagination.getTotal() !== total) {
                    jsonCollection.pagination.setTotal(total);
                    jsonCollection.pagination.event.next({type: 'internal_server_change'});
                }

                //todo, update jsonCollection.pagination
            } finally {
                jsonCollection.batchEnd();
            }
        };

        jsonCollection.pagination.event.subscribe(async (event) => {
            if (event.type === 'client:apply' || event.type === 'apply') {
                await updateCollection();

                if (event.type === 'client:apply') {
                    jsonCollection.pagination.event.next({type: 'server:apply/finished'});
                }
            }
        });

        reactiveQuery.next.subscribe(async (nextQuery: { query: any }) => {
            currentQuery = nextQuery.query;
            await updateCollection();
        });

        if (!options.disableEntityChangeFeed) {
            this.subscribeEntity(classType);
        }

        const fieldSub: AsyncSubscription = await this.exchange.subscribeEntityFields(classType, initialClassQuery.fieldNames);

        const sub: Subscription = await this.exchange.subscribeEntity(classType, async (message: ExchangeEntity) => {
            // console.log(
            //     'subscribeEntity message', getEntityName(classType), (message as any)['id'],
            //     knownIDs[(message as any)['id']],
            //     (message as any).item ? findQuerySatisfied((message as any).item, currentQuery) : undefined,
            //     currentQuery,
            //     message
            // );

            if (message.type === 'removeMany') {
                if (jsonCollection.pagination.isActive()) {
                    //todo, we should probablt throttle that, so this is max every second called
                    updateCollection();
                } else {
                    for (const id of message.ids) {
                        delete knownIDs[id];
                        this.decreaseUsage(classType, id);
                    }

                    jsonCollection.removeMany(message.ids);
                }

                return;
            }

            if (!knownIDs[message.id] && message.type === 'add' && findQuerySatisfied(message.item, currentQuery)) {
                if (jsonCollection.pagination.isActive()) {
                    //todo, we should probablt throttle that, so this is max every second called
                    updateCollection();
                } else {
                    knownIDs[message.id] = true;
                    this.increaseUsage(classType, message.id);
                    //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
                    jsonCollection.add(message.item);
                }
            }

            if ((message.type === 'update' || message.type === 'patch') && message.item) {
                const querySatisfied = findQuerySatisfied(message.item, currentQuery);

                if (knownIDs[message.id] && !querySatisfied) {
                    if (jsonCollection.pagination.isActive()) {
                        //todo, we should probablt throttle that, so this is max every second called
                        updateCollection();
                    } else {
                        //got invalid after updates?
                        delete knownIDs[message.id];
                        this.decreaseUsage(classType, message.id);
                        jsonCollection.remove(message.id);
                    }
                } else if (!knownIDs[message.id] && querySatisfied) {
                    if (jsonCollection.pagination.isActive()) {
                        //todo, we should probablt throttle that, so this is max every second called
                        updateCollection();
                    } else {
                        //got valid after updates?
                        knownIDs[message.id] = true;
                        this.increaseUsage(classType, message.id);

                        let itemToSend = message.item;
                        if (message.type === 'patch') {
                            //message.item is not complete when message.type === 'patch', so load it
                            itemToSend = await getItem(message.id);
                        }

                        //we send on purpose the item as JSON object, so we don't double convert it back in ConnectionMiddleware.actionMessageOut
                        jsonCollection.add(itemToSend);
                    }
                }
            }

            if (message.type === 'remove' && knownIDs[message.id]) {
                if (jsonCollection.pagination.isActive()) {
                    //todo, we should probablt throttle that, so this is max every second called
                    updateCollection();
                } else {
                    delete knownIDs[message.id];
                    this.decreaseUsage(classType, message.id);
                    jsonCollection.remove(message.id);
                }
            }
        });

        jsonCollection.addTeardown(async () => {
            reactiveQuery.unsubscribe();
            for (const id of eachKey(knownIDs)) {
                this.decreaseUsage(classType, id);
            }
            sub.unsubscribe();
            await fieldSub.unsubscribe();
        });

        const cursor = await getCursor();
        const total = await cursor.count(false);
        jsonCollection.pagination.setTotal(total);
        applyPagination(cursor);

        const items = await cursor.toArray();

        for (const item of items) {
            knownIDs[item.id] = true;
            this.increaseUsage(classType, item.id);
        }

        jsonCollection.set(items);

        // if (options.fields) {
        //     const project: { [field: string]: number } = {};
        //     if ('string' === typeof options.fields) {
        //         project[options.fields as string] = 1;
        //     } else {
        //         for (const i of options.fields as string[]) {
        //             project[i] = 1;
        //         }
        //     }
        //     project['id'] = 1;
        //     project['version'] = 1;
        //
        //     const items = await cursor.project(project).toArray();
        //     for (const item of items) {
        //         knownIDs[item.id] = true;
        //         this.increaseUsage(classType, item.id);
        //     }
        //
        //     //warning: properties are not class instances, since we passed toClass=false. Fix that.
        //     jsonCollection.set(items);
        // } else {
        //     const items = await cursor.toArray();
        //
        //     for (const item of items) {
        //         knownIDs[item.id] = true;
        //         this.increaseUsage(classType, item.id);
        //     }
        //
        //     jsonCollection.set(items);
        // }

        return jsonCollection;
    }
}
