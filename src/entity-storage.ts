import {Exchange} from "./exchange";
import {FS} from "./fs";
import {plainToClass, getEntityName} from "@marcj/marshal";
import {Observable, Subscription} from "rxjs";
import {convertPlainQueryToMongo, partialMongoToPlain} from "@marcj/marshal-mongo";
import sift, {SiftQuery} from "sift";
import {Collection, EntitySubject, ExchangeEntity, File, FilterQuery, IdInterface} from "@marcj/glut-core";
import {ClassType} from "@marcj/estdlib";
import {AsyncSubscription} from "@marcj/estdlib-rxjs";
import {ExchangeDatabase} from "./exchange-database";
import {Injectable} from "injection-js";
import {ConnectionWriter} from "./connection-writer";
import {StreamBehaviorSubject} from "@marcj/glut-core/src/core";

interface SentState {
    lastSentVersion: number;
    listeners: number;
}

function findQuerySatisfied<T extends { [index: string]: any }>(target: { [index: string]: any }, query: FilterQuery<T>): boolean {
    return sift(query as SiftQuery<T[]>, [target]).length > 0;
}

@Injectable()
export class EntityStorage {
    protected sentEntities = new Map<ClassType<any>, { [id: string]: SentState }>();

    protected entitySubscription = new Map<ClassType<any>, Subscription>();

    constructor(
        protected readonly writer: ConnectionWriter,
        protected readonly exchange: Exchange,
        protected readonly database: ExchangeDatabase,
        protected readonly fs: FS,
    ) {
    }

    public destroy() {
        for (const sub of this.entitySubscription.values()) {
            sub.unsubscribe();
        }
    }

    protected getSentStateStore<T>(classType: ClassType<T>): { [id: string]: SentState } {
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

    protected setSent<T>(classType: ClassType<T>, id: string, version: number) {
        this.getSentState(classType, id).lastSentVersion = version;
    }

    public needsToBeSend<T>(classType: ClassType<T>, id: string, version: number): boolean {
        if (!this.hasSentState(classType, id)) return false;

        const state = this.getSentState(classType, id);
        return state.listeners > 0 && (version === 0 || version > state.lastSentVersion);
    }

    public decreaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners--;

        if (state.listeners <= 0) {
            const store = this.getSentStateStore(classType);
            const entitySubscription = this.entitySubscription.get(classType);
            if (entitySubscription) {
                entitySubscription.unsubscribe();
            }
            delete store[id];
        }
    }

    private increaseUsage<T>(classType: ClassType<T>, id: string) {
        const state = this.getSentState(classType, id);
        state.listeners++;
    }

    subscribeEntity<T extends IdInterface>(classType: ClassType<T>) {

        if (this.entitySubscription.has(classType)) {
            //already subscribed, nothing to do here
            return;
        }

        const entityName = getEntityName(classType);

        const sub = this.exchange.subscribeEntity(classType, (message: ExchangeEntity) => {
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

    public count<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>): Observable<number> {
        return new Observable((observer) => {
            console.log('new count subscription');
            let fieldSub: AsyncSubscription;
            let sub: Subscription;
            let running = true;

            (async () => {
                const knownIDs: { [id: string]: boolean } = {};
                const filterFields: { [name: string]: boolean } = {};
                convertPlainQueryToMongo(classType, filter, filterFields);
                let counter = 0;

                fieldSub = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));

                sub = this.exchange.subscribeEntity(classType, (message) => {
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

                const cursor = await this.database.cursor(classType, filter);
                cursor.project({id: 1}).batchSize(64);

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
        const item = await this.database.get(classType, filter);

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
        const item = await this.database.get(classType, filter);

        if (item) {
            const foundId = item.id;
            this.increaseUsage(classType, foundId);
            this.setSent(classType, item.id, item.version);
            this.subscribeEntity(classType);

            //todo, teardown is not called when item has been removed. mh
            return new EntitySubject(item, () => {
                this.decreaseUsage(classType, foundId);
            });
        } else {
            throw new Error('Item not found');
        }
    }

    async find<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T> = {}): Promise<Collection<T>> {
        const collection = new Collection<T>(classType);

        const KnownIDs: { [id: string]: boolean } = {};
        const filterFields: { [name: string]: boolean } = {};
        const mongoFilter = convertPlainQueryToMongo(classType, filter, filterFields);

        this.subscribeEntity(classType);

        const fieldSub: AsyncSubscription = await this.exchange.subscribeEntityFields(classType, Object.keys(filterFields));

        const sub: Subscription = this.exchange.subscribeEntity(classType, async (message: ExchangeEntity) => {
            // console.log(
            //     'subscribeEntity',
            //     IDsInThisList[message.id],
            //     (message as any).item ? findQuerySatisfied((message as any).item, filter) : undefined,
            //     filter,
            //     message
            // );

            if (message.type === 'removeMany') {
                collection.removeMany(message.ids);
                for (const id of message.ids) {
                    delete KnownIDs[id];
                }

                return;
            }

            if (!KnownIDs[message.id] && message.type === 'add' && findQuerySatisfied(message.item, filter)) {
                KnownIDs[message.id] = true;
                // addToLastValues(message.id, message.item);
                this.increaseUsage(classType, message.id);

                //todo, we double convert here. first to class and when we do it again to plain
                // this unnecessary when the controller doesn't do anything with that entity.
                collection.add(plainToClass(classType, message.item));
            }

            if ((message.type === 'update' || message.type === 'patch') && message.item) {
                const querySatisfied = findQuerySatisfied(message.item, filter);

                if (KnownIDs[message.id] && !querySatisfied) {
                    //got invalid after updates?
                    delete KnownIDs[message.id];
                    this.decreaseUsage(classType, message.id);
                    // console.log('send removal because filter doesnt fit anymore',
                    //     filter,
                    //     message.item,
                    // );
                    collection.remove(message.id);

                } else if (!KnownIDs[message.id] && querySatisfied) {
                    //got valid after updates?
                    KnownIDs[message.id] = true;
                    // addToLastValues(message.id, message.item);
                    this.increaseUsage(classType, message.id);

                    let itemToSend = message.item;
                    if (message.type === 'patch') {
                        //message.item is not complete when message.type === 'patch', so load it
                        itemToSend = await this.database.get(classType, {id: message.id} as T);
                    }

                    //todo, we double convert here. first to class and when we do it again to plain
                    // this unnecessary when the controller doesn't do anything with that entity.
                    collection.add(plainToClass(classType, itemToSend));
                }
            }

            if (message.type === 'remove' && KnownIDs[message.id]) {
                delete KnownIDs[message.id];
                this.decreaseUsage(classType, message.id);
                collection.remove(message.id);
                // console.log('Removed entity', entityName, message.id);
            }
        });

        collection.addTeardown(() => {
            sub.unsubscribe();
            fieldSub.unsubscribe();
        });

        setTimeout(async () => {
            //todo, here again, we convert mongo to class and from class back to plain.
            // not necessary, so add option to same with plain values.
            const items = await this.database.find(classType, mongoFilter, true);
            for (const item of items) {
                KnownIDs[item.id] = true;
                this.increaseUsage(classType, item.id);
            }

            collection.set(items);
            collection.loaded();
        });

        return collection;
    }

    async fileContent(path: string, additionalFilter?: FilterQuery<File>): Promise<StreamBehaviorSubject<string | undefined>> {
        const subject = new StreamBehaviorSubject<string | undefined>('');
        const file = await this.findOne(File, {path: path, ...additionalFilter});
        let exchangeSubscription: Subscription | undefined;
        let fileSubscription: Subscription | undefined;

        fileSubscription = file.subscribe(() => {
            //file changed, but we don't care. we care about content
        }, (error) => {
            subject.error(error);
        }, () => {
            //file has been deleted or filter doesn't match anymore
            subject.complete();

            if (exchangeSubscription) {
                exchangeSubscription.unsubscribe();
            }
        });

        exchangeSubscription = this.exchange.subscribeFile(file.getValue().id, (message) => {
            if (message.type === 'set') {
                subject.next(message.content);
            } else if (message.type === 'append') {
                subject.next(subject.getValue() + message.content);
            } else if (message.type === 'remove') {
                subject.next(undefined);
            }
        });

        subject.addTearDown(() => {
            if (exchangeSubscription) {
                exchangeSubscription.unsubscribe();
            }

            if (fileSubscription) {
                fileSubscription.unsubscribe();
            }
        });

        //read initial content
        const data = await this.fs.read(path, additionalFilter);

        //todo, support binary
        subject.next(data ? data.toString('utf8') : undefined);

        return subject;
    }
}
