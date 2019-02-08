import {Exchange} from "./exchange";
import {FS} from "./fs";
import {ClassType, getEntityName, plainToClass} from "@marcj/marshal";
import {Subscription} from "rxjs";
import {convertPlainQueryToMongo} from "@marcj/marshal-mongo";
import sift, {SiftQuery} from "sift";
import {AsyncSubscription, Collection, ExchangeEntity, IdInterface, Subscriptions} from "@kamille/core";
import {ExchangeDatabase} from "./exchange-database";
import {Injectable} from "injection-js";
import {Connection} from "./connection";

interface SentState {
    lastSentVersion: number;
    listeners: number;
}

function findQuerySatisfied<T extends { [index: string]: any }>(target: T, query: SiftQuery<T[]>): boolean {
    return sift(query, [target]).length > 0;
}

@Injectable()
export class EntityStorage {
    private subs = new Subscriptions();

    protected sentEntities = new Map<ClassType<any>, { [id: string]: SentState }>();

    constructor(
        protected readonly connection: Connection,
        protected readonly exchange: Exchange,
        protected readonly database: ExchangeDatabase,
        protected readonly fs: FS,
    ) {
    }

    public async destroy() {
        this.subs.unsubscribe();
    }

    private getSentStateStore<T>(classType: ClassType<T>): { [id: string]: SentState } {
        let store = this.sentEntities.get(classType);
        if (!store) {
            store = {};
            this.sentEntities.set(classType, store);
        }

        return store;
    }

    private hasSentState<T>(classType: ClassType<T>, id: string): boolean {
        return !!this.getSentStateStore(classType)[id];
    }

    private getSentState<T>(classType: ClassType<T>, id: string): SentState {
        const store = this.getSentStateStore(classType);

        if (!store[id]) {
            store[id] = {
                lastSentVersion: 0,
                listeners: 0,
            };
        }

        return store[id];
    }

    private setSent<T>(classType: ClassType<T>, id: string, version: number) {
        this.getSentState(classType, id).lastSentVersion = version;
    }

    private needsToBeSend<T>(classType: ClassType<T>, id: string, version: number): boolean {
        if (!this.hasSentState(classType, id)) return false;

        const state = this.getSentState(classType, id);
        return state.listeners > 0 && version > state.lastSentVersion;
    }

    private decreaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners--;
        if (state.listeners <= 0) {
            const store = this.getSentStateStore(classType);
            delete store[id];
        }
    }

    private increaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners++;
    }

    // /**
    //  *
    //  * @param classType
    //  */
    // @Action()
    // @Role(RoleType.regular)

    protected entitySubscription = new Map<ClassType<any>, Subscription>();

    subscribeEntity<T extends IdInterface>(classType: ClassType<T>) {
        if (this.entitySubscription.has(classType)) {
            return;
        }

        const entityName = getEntityName(classType);

        const sub = this.exchange.subscribeEntity(classType, (message: ExchangeEntity) => {
            if (this.needsToBeSend(classType, message.id, message.version)) {
                this.setSent(classType, message.id, message.version);

                if (message.type === 'patch') {
                    this.connection.write({
                        type: 'entity/patch',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                        patch: message.patch
                    });
                } else if (message.type === 'remove') {
                    this.connection.write({
                        type: 'entity/remove',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                    });
                } else if (message.type === 'update') {
                    this.connection.write({
                        type: 'entity/update',
                        entityName: entityName,
                        id: message.id,
                        version: message.version,
                        item: message.item
                    });
                } else if (message.type === 'add') {
                    //nothing to do.
                }
            }
        });

        this.entitySubscription.set(classType, sub);
    }

    //
    // @Action()
    // @Role(RoleType.regular)
    // streamFile(filter: FileMetaData, path: string): Observable<StreamFileResult> {
    //     return new Observable((observer) => {
    //
    //         const fits = (message: StreamFileResult): boolean => {
    //             if (path !== message.path) {
    //                 return false;
    //             }
    //
    //             //todo, limit access to filter.accountId
    //
    //             if (filter.job && message.context.job !== filter.job) {
    //                 return false;
    //             }
    //
    //             if (filter.project && message.context.project !== filter.project) {
    //                 return false;
    //             }
    //
    //             if (filter.type && message.context.type !== filter.type) {
    //                 return false;
    //             }
    //
    //
    //             return true;
    //         };
    //
    //         let started = false;
    //         const sub = this.exchange.subscribeFile((message) => {
    //             if (!started) return;
    //             if (!fits(message)) return;
    //
    //             observer.next(message);
    //         });
    //
    //         (async () => {
    //             //read initial content
    //             const data = await this.fs.read(path, filter);
    //             observer.next({
    //                 type: 'set',
    //                 path: path,
    //                 context: filter,
    //                 content: data ? data.toString('utf8') : ''
    //             });
    //             started = true;
    //         })();
    //
    //         return {
    //             unsubscribe: async () => {
    //                 sub.unsubscribe();
    //             }
    //         };
    //     });
    // }
    //
    // @Action()
    // @Role(RoleType.regular)
    // countAndSubscribe<T extends IdInterface>(classType: ClassType<T>, filters: { [p: string]: any }[] = []): Observable<CountResult> {
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
    //                 const cursor = await this.database.cursor(classType, filter);
    //                 cursor.project({id: 1}).batchSize(64);
    //
    //                 while (running && await cursor.hasNext()) {
    //                     const next = await cursor.next();
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

    async find<T extends IdInterface>(classType: ClassType<T>, filter: { [field: string]: any } = {}): Promise<Collection<T>> {
        const collection = new Collection(classType);

        const IDsInThisList: { [id: string]: boolean } = {};
        const filterFields: { [name: string]: boolean } = {};
        const mongoFilter = convertPlainQueryToMongo(classType, filter, filterFields);

        //todo, subscribe to Entity
        this.subscribeEntity(classType);

        const fieldSub: AsyncSubscription = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));

        const sub: Subscription = this.exchange.subscribeEntity(classType, async (message: ExchangeEntity) => {
            console.log(
                'subscribeEntity',
                IDsInThisList[message.id],
                (message as any).item ? findQuerySatisfied((message as any).item, filter) : undefined,
                filter,
                message
            );

            if (!IDsInThisList[message.id] && message.type === 'add' && findQuerySatisfied(message.item, filter)) {
                IDsInThisList[message.id] = true;
                // addToLastValues(message.id, message.item);
                this.increaseUsage(classType, message.id);

                //todo, we double convert here. first to class and when we do it again to plain
                // this unnecessary when the controller doesn't do anything with that entity.
                console.log('add to collection', collection.isLoaded);
                collection.add(plainToClass(classType, message.item));
            }

            if ((message.type === 'update' || message.type === 'patch') && message.item) {
                const querySatisfied = findQuerySatisfied(message.item, filter);

                if (IDsInThisList[message.id] && !querySatisfied) {
                    //got invalid after updates?
                    delete IDsInThisList[message.id];
                    this.decreaseUsage(classType, message.id);
                    console.log('send removal because filter doesnt fit anymore',
                        filter,
                        message.item,
                    );
                    collection.remove(message.id);

                } else if (!IDsInThisList[message.id] && querySatisfied) {
                    //got valid after updates?
                    IDsInThisList[message.id] = true;
                    // addToLastValues(message.id, message.item);
                    this.increaseUsage(classType, message.id);

                    let itemToSend = message.item;
                    if (message.type === 'patch') {
                        //message.item is not complete when message.type === 'patch', so load it
                        itemToSend = await this.database.get(classType, {id: message.id});
                    }

                    //todo, we double convert here. first to class and when we do it again to plain
                    // this unnecessary when the controller doesn't do anything with that entity.
                    collection.add(plainToClass(classType, itemToSend));
                }
            }

            if (message.type === 'remove' && IDsInThisList[message.id]) {
                delete IDsInThisList[message.id];
                this.decreaseUsage(classType, message.id);
                // observer.next({type: 'remove', id: message.id});
                collection.remove(message.id);
                // console.log('Removed entity', entityName, message.id);
            }
        });

        collection.subscribe(() => {
        }, () => {
        }, async () => {
            await fieldSub.unsubscribe();
            sub.unsubscribe();
        });

        setTimeout(async () => {
            //do async
            console.log('find', mongoFilter);
            //todo, here again, we convert mongo to class and from class back to plain
            // not necessary.

            const items = await this.database.find(classType, mongoFilter, true);
            for (const item of items) {
                IDsInThisList[item.id] = true;
                this.increaseUsage(classType, item.id);
            }

            collection.set(items);
            collection.loaded();
            console.log('collection loaded', collection.all());
        });

        return collection;
    }

    // @Action()
    // @Role(RoleType.regular)
    // findAndSubscribe<T extends IdInterface>(classType: ClassType<T>, filter: { [field: string]: any } = {}): Observable<FindResult> {
    //     return new Observable((observer) => {
    //         let running = true;
    //         let sub: Subscription;
    //         let fieldSub: AsyncSubscription;
    //         const IDsInThisList: { [id: string]: boolean } = {};
    //         let cursor: Cursor<IdInterface>;
    //         const filterFields: { [name: string]: boolean } = {};
    //         const mongoFilter = convertPlainQueryToMongo(classType, filter, filterFields);
    //
    //         (async () => {
    //             try {
    //                 fieldSub = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));
    //
    //                 sub = this.exchange.subscribeEntity(classType, async (message) => {
    //
    //                     // console.log(
    //                     //     'subscribeEntity',
    //                     //     IDsInThisList[message.id],
    //                     //     (message as any).item ? findQuerySatisfied((message as any).item, filter) : undefined,
    //                     //     filter,
    //                     //     message
    //                     // );
    //
    //                     if (!IDsInThisList[message.id] && message.type === 'add' && findQuerySatisfied(message.item, filter)) {
    //                         IDsInThisList[message.id] = true;
    //                         // addToLastValues(message.id, message.item);
    //                         this.increaseUsage(classType, message.id);
    //                         observer.next({type: 'add', item: message.item});
    //                     }
    //
    //                     if ((message.type === 'update' || message.type === 'patch') && message.item) {
    //                         const querySatisfied = findQuerySatisfied(message.item, filter);
    //
    //                         if (IDsInThisList[message.id] && !querySatisfied) {
    //                             //got invalid after updates?
    //                             delete IDsInThisList[message.id];
    //                             this.decreaseUsage(classType, message.id);
    //                             console.log('send removal because filter doesnt fit anymore',
    //                                 filter,
    //                                 message.item,
    //                             );
    //                             observer.next({type: 'remove', id: message.id});
    //
    //                         } else if (!IDsInThisList[message.id] && querySatisfied) {
    //                             //got valid after updates?
    //                             IDsInThisList[message.id] = true;
    //                             // addToLastValues(message.id, message.item);
    //                             this.increaseUsage(classType, message.id);
    //
    //                             let itemToSend = message.item;
    //                             if (message.type === 'patch') {
    //                                 //message.item is not complete when message.type === 'patch', so load it
    //                                 itemToSend = await this.database.get(classType, {id: message.id});
    //                             }
    //
    //                             observer.next({type: 'add', item: itemToSend});
    //                         }
    //                     }
    //
    //                     if (message.type === 'remove' && IDsInThisList[message.id]) {
    //                         delete IDsInThisList[message.id];
    //                         this.decreaseUsage(classType, message.id);
    //                         observer.next({type: 'remove', id: message.id});
    //                         // console.log('Removed entity', entityName, message.id);
    //                     }
    //                 });
    //
    //                 const batchSize = 64;
    //
    //                 (async () => {
    //                     cursor = (await this.database.plainCursor(classType, mongoFilter))
    //                         .batchSize(batchSize);
    //
    //                     const total = await cursor.count();
    //
    //                     if (total) {
    //                         let items = [];
    //                         while (running && await cursor.hasNext()) {
    //                             const item = mongoToPlain(classType, await cursor.next());
    //                             IDsInThisList[item.id] = true;
    //                             this.increaseUsage(classType, item.id);
    //
    //                             items.push(mongoToPlain(classType, item));
    //
    //                             if (items.length >= batchSize) {
    //                                 observer.next({type: 'items', items: items, total: total});
    //                                 items = [];
    //                             }
    //                         }
    //
    //                         if (items.length) {
    //                             //send rest
    //                             observer.next({type: 'items', items: items, total: total});
    //                         }
    //                     } else {
    //                         observer.next({type: 'items', items: [], total: 0});
    //                     }
    //                 })();
    //             } catch (err) {
    //                 observer.error(err);
    //             }
    //         })();
    //
    //         return {
    //             unsubscribe: async () => {
    //                 sub.unsubscribe();
    //
    //                 for (const i in IDsInThisList) {
    //                     if (!IDsInThisList.hasOwnProperty(i)) continue;
    //                     this.decreaseUsage(classType, i);
    //                 }
    //
    //                 running = false;
    //                 if (cursor) {
    //                     cursor.close();
    //                 }
    //
    //                 await fieldSub.unsubscribe();
    //             }
    //         };
    //     });
    // }

    // @Action()
    // @Role(RoleType.regular)
    // find<T extends IdInterface>(classType: ClassType<T>, filter: { [field: string]: any }): Observable<T[]> {
    //     return promiseToObservable(async () => {
    //         const items = await this.database.find(classType, filter, false);
    //
    //         return items.map(v => {
    //             return mongoToPlain(classType, v);
    //         });
    //     });
    // }
}
