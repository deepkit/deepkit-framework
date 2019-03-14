import {plainToClass, propertyPlainToClass, RegisteredEntities} from "@marcj/marshal";
import {Subscription} from "rxjs";
import {Collection, CollectionStream, EntitySubject, IdInterface, JSONEntity, ServerMessageEntity} from "@marcj/glut-core";
import {set} from 'dot-prop';
import {ClassType, eachPair, each} from "@marcj/estdlib";

class EntitySubjectStore<T extends IdInterface> {
    subjects: { [id: string]: EntitySubject<T | undefined> } = {};

    public getOrCreateSubject(id: string, item?: T): EntitySubject<T | undefined> {
        if (!this.subjects[id]) {
            this.subjects[id] = new EntitySubject<T | undefined>(item);
        }

        return this.subjects[id];
    }

    public getItem(id: string): T {
        if (this.subjects[id]) {
            const item = this.subjects[id].getValue();

            if (item) {
                return item;
            }
        }

        throw new Error(`Not non-undefined item for in SubjectStore for ${id}`);
    }

    public removeItemAndNotifyObservers(id: string) {
        if (this.subjects[id]) {
            this.subjects[id].next(undefined);
            this.subjects[id].complete();

            delete this.subjects[id];
        }
    }

    public notifyObservers(id: string) {
        this.subjects[id].next(this.subjects[id].getValue());
    }

    public setItemAndNotifyObservers(id: string, item: T) {
        if (!this.subjects[id]) {
            throw new Error(`Item not found in store for $id}`);
        }

        this.subjects[id].next(item);
    }

    public hasStoreItem(id: string): boolean {
        return !!this.subjects[id];
    }
}

export class EntityState {
    private readonly items = new Map<ClassType<any>, EntitySubjectStore<any>>();
    private readonly collectionSubscriptions = new Map<Collection<any>, { [id: string]: Subscription }>();

    private getStore<T extends IdInterface>(classType: ClassType<T>): EntitySubjectStore<T> {
        let store = this.items.get(classType);

        if (!store) {
            store = new EntitySubjectStore;
            this.items.set(classType, store);
        }

        return store;
    }

    public handleEntityMessage<T extends IdInterface>(stream: ServerMessageEntity) {
        const classType = RegisteredEntities[stream.entityName];
        const store = this.getStore(classType);

        if (stream.type === 'entity/update') {
            if (store.hasStoreItem(stream.id)) {
                const item = plainToClass(classType, stream.data);
                store.setItemAndNotifyObservers(stream.id, item);
            }
        }

        if (stream.type === 'entity/patch') {
            if (store.hasStoreItem(stream.id)) {
                const toVersion = stream.version;
                const item = store.getItem(stream.id);

                if (item && (toVersion === 0 || item.version < toVersion)) {
                    //it's important to not patch old versions
                    for (const [i, v] of eachPair(stream.patch)) {
                        const vc = propertyPlainToClass(classType, i, v, [], 0, {onFullLoadCallbacks: []});
                        set(item, i, vc);
                    }

                    item.version = toVersion;
                    store.notifyObservers(stream.id);
                }
            }
        }

        if (stream.type === 'entity/remove') {
            if (store.hasStoreItem(stream.id)) {
                store.removeItemAndNotifyObservers(stream.id);
            }
        }
    }

    public hasEntitySubject<T extends IdInterface>(classType: ClassType<T>, id: string): boolean {
        const store = this.getStore(classType);
        return store.hasStoreItem(id);
    }

    public handleEntity<T extends IdInterface>(classType: ClassType<T>, jsonItem: JSONEntity<T>): EntitySubject<T | undefined> {
        const store = this.getStore(classType);
        const item = plainToClass(classType, jsonItem);

        return store.getOrCreateSubject(item.id, item);
    }

    public unsubscribeCollection<T extends IdInterface>(collection: Collection<T>) {
        const subs = this.collectionSubscriptions.get(collection);

        if (subs) {
            for (const sub of each(subs)) {
                sub.unsubscribe();
            }
        }
    }

    protected getOrCreateCollectionSubscriptions<T extends IdInterface>(collection: Collection<T>): { [id: string]: Subscription } {
        let subs = this.collectionSubscriptions.get(collection);

        if (!subs) {
            subs = {};
            this.collectionSubscriptions.set(collection, subs);
        }

        return subs;
    }

    public handleCollectionNext<T extends IdInterface>(collection: Collection<T>, stream: CollectionStream) {
        const classType = collection.classType;
        const store = this.getStore(classType);

        const observers = this.getOrCreateCollectionSubscriptions(collection);

        if (stream.type === 'set') {
            for (const itemRaw of stream.items) {

                const item = plainToClass(classType, itemRaw);
                collection.add(item, false);

                if (store.hasStoreItem(itemRaw.id)) {
                    store.setItemAndNotifyObservers(item.id, item);
                }

                const subject = store.getOrCreateSubject(item.id, item);

                observers[itemRaw.id] = subject.subscribe((i) => {
                    collection.deepChange.next(i);
                    if (collection.isLoaded) {
                        collection.loaded();
                    }
                });
            }
        }

        if (stream.type === 'ready') {
            collection.loaded();
        }

        if (stream.type === 'removeMany') {
            for (const id of stream.ids) {
                collection.remove(id);

                if (observers[id]) {
                    observers[id].unsubscribe();
                }
            }

            if (collection.isLoaded) {
                collection.loaded();
            }
        }

        if (stream.type === 'remove') {
            collection.remove(stream.id);

            if (observers[stream.id]) {
                observers[stream.id].unsubscribe();
            }

            if (collection.isLoaded) {
                collection.loaded();
            }
        }

        if (stream.type === 'add') {
            const item = plainToClass(classType, stream.item);
            collection.add(item, false);

            if (store.hasStoreItem(item.id)) {
                store.setItemAndNotifyObservers(item.id, item);
            }

            const subject = store.getOrCreateSubject(item.id, item);

            if (observers[item.id]) {
                throw new Error(`Item with id ${item.id} already known in that state-collection.`);
            }

            observers[item.id] = subject.subscribe((i) => {
                collection.deepChange.next(i);

                if (collection.isLoaded) {
                    collection.loaded();
                }
            });
        }
    }
}
