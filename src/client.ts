import {Collection, IdInterface, eachPair, arrayRemoveItem, empty, CountResult, StreamFileResult} from '@kamille/core';
import {Observable, Subscriber, Subscription} from 'rxjs';
import {classToPlain, ClassType, getEntityName, plainToClass, propertyPlainToClass} from "@marcj/marshal";
import {SocketClient, SocketClientConfig} from "./socket";
import {set} from 'dot-prop';

class StoreItem<T> {
    instance: T | undefined;
    deleted: boolean = false;
    observers: Subscriber<T>[] = [];

    constructor(instance: T | undefined) {
        this.instance = instance;
    }
}

interface FindOneStat<T> {
    observers: Subscriber<T>[];
    gotResult: boolean;
    result?: T;
    subscription?: Subscription;
}

class ItemsStore<T> {
    items: { [id: string]: StoreItem<any> } = {};
    protected observerId = 0;

    public getOrCreateItem(id: string): StoreItem<T> {
        if (!this.items[id]) {
            this.items[id] = new StoreItem(undefined);
        }

        return this.items[id];
    }

    public removeItemAndNotifyObservers(id: string) {
        delete this.items[id];
        for (const ob of this.items[id].observers) {
            ob.next(undefined);
            ob.complete();
        }
    }

    public notifyObservers(id: string) {
        for (const ob of this.items[id].observers) {
            ob.next(this.items[id].instance);
        }
    }

    public setItemAndNotifyObservers(id: string, item: T): StoreItem<T> {
        if (!this.items[id]) {
            this.items[id] = new StoreItem(item);
        } else {
            this.items[id].instance = item;
            //todo, add throttling
            for (const ob of this.items[id].observers) {
                ob.next(item);
            }
        }

        return this.items[id];
    }

    public hasItem(id: string): boolean {
        return !!this.items[id];
    }

    public addObserver(id: string, observer: Subscriber<T>) {
        const item = this.getOrCreateItem(id);
        item.observers.push(observer);
        (observer as any)['_id'] = ++this.observerId;
        // console.log('add observer', id, observer['_id'], item.observers.length);
    }

    public hasObservers(id: string): boolean {
        if (this.hasItem(id)) {
            const item = this.getOrCreateItem(id);
            return item.observers.length > 0;
        }

        return false;
    }

    public removeObserver(id: string, observer: Subscriber<T>) {
        if (this.hasItem(id)) {
            const item = this.getOrCreateItem(id);
            const index = item.observers.indexOf(observer);
            if (-1 !== index) {
                item.observers.splice(index, 1);
            }

            if (item.observers.length === 0) {
                delete this.items[id];
            }

            // console.log('remove observer', id, observer['_id'], item.observers.length);
        }
    }
}

export class StorageClient {
    private readonly items = new Map<ClassType<any>, ItemsStore<any>>();
    private readonly findOneStats = new Map<ClassType<any>, { [key: string]: FindOneStat<any> }>();

    private entitySubscriptions = new Map<ClassType<any>, Subscription>();

    private subscribeJobCollection: { [jobId: string]: {subscription?: Subscription, observers: Subscriber<any>[]} } = {};

    public readonly socketClient: SocketClient;

    constructor(public readonly config?: SocketClientConfig) {
        this.socketClient = new SocketClient(config || new SocketClientConfig());
    }

    private getSocketClient(): SocketClient {
        if (!this.socketClient) {
            throw new Error('No socketClient set on StorageClient');
        }

        return this.socketClient;
    }

    private getStore<T>(classType: ClassType<T>): ItemsStore<T> {
        let store = this.items.get(classType);

        if (!store) {
            store = new ItemsStore;
            this.items.set(classType, store);
        }

        return store;
    }

    private getFindOneStat<T>(classType: ClassType<T>, key: string): FindOneStat<T> {
        let stats = this.findOneStats.get(classType);

        if (!stats) {
            stats = {};
            this.findOneStats.set(classType, stats);
        }

        if (!stats[key]) {
            stats[key] = {observers: [], gotResult: false};
        }

        return stats[key];
    }

    private removeFindOneStat<T>(classType: ClassType<T>, key: string) {
        const stats = this.findOneStats.get(classType);

        if (!stats) {
            return;
        }

        delete stats[key];
    }

    public streamFile(filter: { [id: string]: any }, path: string): Observable<StreamFileResult> {
        //wrap with Observable to handle disconnects
        return this.getSocketClient().app().streamFile(filter, path);
    }

    // public streamFileCb(
    //     filter: { [id: string]: any },
    //     path: string,
    //     onSet: (v: string) => void,
    //     onAppend: (v: string) => void,
    //     onRemove: () => void,
    // ): Subscription {
    //     //wrap with Observable to handle disconnects
    //
    //     return this.getSocketClient().app().streamFile(filter, path).subscribe((message) => {
    //         console.log('message file', filter, path, message);
    //         if (message.type === 'set') {
    //             onSet(message.content);
    //         }
    //         if (message.type === 'append') {
    //             onAppend(message.content);
    //         }
    //         if (message.type === 'remove') {
    //             onRemove();
    //         }
    //     });
    // }

    // public streamJobFile(meta: {}, path: string): Observable<StreamFileResult> {
    //     //wrap with Observable to handle disconnects
    //     return this.streamFile(meta, path);
    // }

    public findOne<T extends IdInterface>(classType: ClassType<T>, filter: { [path: string]: any } = {}): Observable<T | undefined> {
        const key = JSON.stringify(filter);

        //use arguments.callee to detect whether someone wants to findOne again, although he has still an active one.
        //cool to detect missing unsubscribes

        return new Observable((observer) => {
            const store = this.getStore(classType);
            const stats = this.getFindOneStat(classType, key);
            // console.log('subscribe findOne', stats.observers.length, filter, stats.gotResult);

            this.subscribeEntity(classType);

            if (!stats.subscription || (stats.subscription && stats.subscription.closed)) {
                stats.observers.push(observer);

                stats.subscription = this.getSocketClient().api<>('_internal')
                    .findOne(getEntityName(classType), filter)
                    .subscribe((stream) => {
                        // console.log('findOne', stats.observers.length, stream);
                        try {
                            if (stream.type === 'item' && !stream.item) {
                                stats.gotResult = true;
                                stats.result = undefined;
                            }

                            if (stream.type === 'item' && stream.item) {
                                if (!store.hasItem(stream.item.id)) {
                                    store.setItemAndNotifyObservers(
                                        stream.item.id,
                                        plainToClass(classType, stream.item)
                                    );
                                }
                                stats.gotResult = true;
                            }

                            if (stats.gotResult && stream.item) {
                                const storeItem = store.getOrCreateItem(stream.item.id);
                                stats.result = storeItem.instance;

                                for (const subscriber of stats.observers) {
                                    subscriber.next(storeItem.instance);
                                    //subscribe for further updates
                                    store.addObserver(stream.item.id, subscriber);
                                }
                            } else {
                                for (const subscriber of stats.observers) {
                                    subscriber.next(undefined);
                                    subscriber.complete();
                                }
                            }
                        } catch (error) {
                            console.error('Error in findOne', getEntityName(classType), filter, error);
                            observer.error(error);
                        }
                    }, (error) => {
                        console.error('findOne errored', error);
                        this.removeFindOneStat(classType, key);
                    }, () => {
                        console.log('findOne completed');
                        this.removeFindOneStat(classType, key);
                    });
            } else {
                //we have already a feed subscriber running
                if (stats.gotResult) {
                    //and we got a result already
                    observer.next(stats.result);

                    if (stats.result) {
                        //subscribe for further changes
                        store.addObserver(stats.result.id, observer);
                    }
                } else {
                    //we still for response
                    stats.observers.push(observer);
                    //the findOne() above will subscribe for further updates already, so no need here
                }
            }

            return {
                unsubscribe: () => {
                    const index = stats.observers.indexOf(observer);
                    if (-1 !== index) {
                        stats.observers.splice(index, 1);
                    }

                    if (stats.observers.length === 0 && stats.subscription) {
                        //close sync with server, so he stops sending updates via subscribeEntity()
                        stats.subscription.unsubscribe();
                        delete stats.subscription;
                        this.removeFindOneStat(classType, key);
                    }

                    if (stats.result) {
                        store.removeObserver(stats.result.id, observer);
                    }
                }
            };
        });
    }

    /**
     * Subscribes a collection again to the entity change feed.
     */
    public subscribe<T extends IdInterface>(collection: Collection<T>): void {
        if (collection.subscription) {
            throw new Error(`Collection already subscribed.`);
        }

        const classType = collection.classType;
        const store = this.getStore(classType);

        this.subscribeEntity(classType);
        const observers: { [id: string]: Subscriber<T> } = {};

        const subscription = this.getSocketClient().app()
            .findAndSubscribe<T>(getEntityName(classType), collection.filter)
            .subscribe((stream) => {
                if (stream.type === 'items') {
                    for (const itemRaw of stream.items) {
                        if (!store.hasItem(itemRaw.id)) {
                            const item = plainToClass(classType, itemRaw);
                            store.setItemAndNotifyObservers(item.id, item);
                        }
                        const instance = store.getOrCreateItem(itemRaw.id).instance;
                        if (instance) {
                            collection.add(instance, false);
                            observers[itemRaw.id] = new Subscriber((i) => {
                                collection.deepChange.next(i);
                                collection.loaded();
                            });
                            store.addObserver(itemRaw.id, observers[itemRaw.id]);
                        }
                    }

                    if (collection.count() === stream.total) {
                        collection.loaded();
                    }
                }

                if (stream.type === 'remove') {
                    collection.remove(stream.id);
                    store.removeObserver(stream.id, observers[stream.id]);
                    collection.loaded();
                }

                if (stream.type === 'add') {
                    if (!store.hasItem(stream.item.id)) {
                        const item = plainToClass(classType, stream.item);
                        store.setItemAndNotifyObservers(stream.item.id, item);
                    }

                    const instance = store.getOrCreateItem(stream.item.id).instance;
                    if (instance) {
                        observers[stream.item.id] = new Subscriber((i) => {
                            collection.deepChange.next(i);
                            collection.loaded();
                        });
                        store.addObserver(stream.item.id, observers[stream.item.id]);
                        collection.add(instance);
                    }
                }
            }, (error) => {
                throw new error;
            }, () => {

            });

        collection.subscription = new Subscription(() => {
            subscription.unsubscribe();
            //remove usage of all items
            for (const [i, o] of eachPair(observers)) {
                store.removeObserver(i, o);
            }
        });
    }

    public subscribeJob(jobId: string): Observable<JobStream> {
        if (!this.subscribeJobCollection[jobId]) {
            this.subscribeJobCollection[jobId] = {observers: []};
        }

        return new Observable((o) => {
            this.subscribeJobCollection[jobId].observers.push(o);

            if (!this.subscribeJobCollection[jobId].subscription) {
                this.subscribeJobCollection[jobId].subscription = this.getSocketClient().app()
                    .subscribeJob(jobId)
                    .subscribe((stream) => {
                        for (const observer of this.subscribeJobCollection[jobId].observers) {
                            observer.next(stream);
                        }
                    }, (error) => {
                        for (const observer of this.subscribeJobCollection[jobId].observers) {
                            observer.error(error);
                        }
                    }, () => {
                        for (const observer of this.subscribeJobCollection[jobId].observers) {
                            observer.complete();
                        }
                    });
            }

            return {
                unsubscribe: () => {
                    arrayRemoveItem(this.subscribeJobCollection[jobId].observers, o);

                    if (this.subscribeJobCollection[jobId] && empty(this.subscribeJobCollection[jobId].observers)) {
                        const sub = this.subscribeJobCollection[jobId].subscription;
                        if (sub) {
                            sub.unsubscribe();
                        }
                        delete this.subscribeJobCollection[jobId];
                    }
                }
            };
        });
    }

    private subscribeEntity<T extends IdInterface>(classType: ClassType<T>) {
        if (this.entitySubscriptions.has(classType)) {
            return;
        }

        //todo, restart when connection breaks

        const store = this.getStore(classType);
        this.entitySubscriptions.set(classType, this.getSocketClient().app()
            .subscribeEntity(getEntityName(classType))
            .subscribe((stream) => {
                if (stream.type === 'update') {
                    if (store.hasItem(stream.id)) {
                        const item = plainToClass(classType, stream.item);
                        store.setItemAndNotifyObservers(stream.id, item);
                    }
                }

                if (stream.type === 'patch') {
                    if (store.hasItem(stream.id)) {
                        const toVersion = stream.version;
                        const storeItem = store.getOrCreateItem(stream.id);

                        if (storeItem.instance && storeItem.instance.version < toVersion) {
                            //it's important to not patch old versions

                            for (const [i, v] of eachPair(stream.patch)) {
                                const vc = propertyPlainToClass(classType, i, v, [], 0, {onFullLoadCallbacks: []});
                                set(storeItem.instance, i, vc);
                                // console.log('patch', i, vc);
                                // console.log('patch item', stream.id, i, (storeItem.instance as any)[i]);
                            }

                            storeItem.instance.version = toVersion;
                            store.notifyObservers(stream.id);
                            // console.log('item patched', stream.patch);
                        }
                    }
                }

                if (stream.type === 'remove') {
                    if (store.hasItem(stream.id)) {
                        store.removeItemAndNotifyObservers(stream.id);
                    }
                }
            })
        );
    }

    public async patch<T extends IdInterface>(classType: ClassType<T>, id: string, patches: { [field: string]: any }): Promise<void> {
        await this.getSocketClient().app().patch(getEntityName(classType), id, patches).toPromise();
    }

    public countAndSubscribe<T extends IdInterface>(classType: ClassType<T>, filters: { [id: string]: any }[]): Observable<CountResult> {
        return this.getSocketClient().app().countAndSubscribe(getEntityName(classType), filters);
    }

    public async add<T extends IdInterface>(classType: ClassType<T>, item: T): Promise<string> {
        return await this.getSocketClient().app().add(getEntityName(classType), classToPlain(classType, item)).toPromise();
    }

    public find<T extends IdInterface>(classType: ClassType<T>, filter?: { [id: string]: any }): Collection<T> {
        const collection = new Collection(classType, filter);

        this.subscribe(collection);

        return collection;
    }
}
