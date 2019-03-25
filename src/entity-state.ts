import {plainToClass, propertyPlainToClass, RegisteredEntities} from "@marcj/marshal";
import {Subscription} from "rxjs";
import {Collection, CollectionStream, EntitySubject, IdInterface, JSONEntity, ServerMessageEntity} from "@marcj/glut-core";
import {set} from 'dot-prop';
import {ClassType, eachPair, each, getClassName} from "@marcj/estdlib";

class EntitySubjectStore<T extends IdInterface> {
    subjects: { [id: string]: EntitySubject<T | undefined> } = {};
    consumers: { [id: string]: { count: number } } = {};

    public getSubject(id: string): EntitySubject<any> {
        if (!this.subjects[id]) {
            throw new Error(`No Entitysubject found for ${id}`);
        }

        return this.subjects[id];
    }


    public async forkUnsubscribed(id: string) {
        if (!this.consumers[id]) {
            return;
        }
        this.consumers[id].count--;

        if (this.consumers[id].count === 0 && this.subjects[id]) {
            const subject = this.subjects[id];
            delete this.subjects[id];
            await subject.unsubscribe();
        }
    }

    /**
     *  If we would return the original EntitySubject and one of the consumers unsubscribes()
     *  it would be it unsubscribes for ALL subscribers of that particular entity item.
     *  so we fork it. The fork can be unsubscribed without touching the origin.
     */
    public createFork(id: string, item?: T): EntitySubject<T | undefined> {
        this.getOrCreateSubject(id, item);

        if (!this.consumers[id]) {
            this.consumers[id] = {count: 0};
        }

        this.consumers[id].count++;

        const originSubject = this.getSubject(id);
        const forkedSubject = new EntitySubject(originSubject.getValue(), async () => {
            await this.forkUnsubscribed(id);
        });
        originSubject.subscribe(forkedSubject);

        return forkedSubject;
    }

    public getEntitySubjectCount(): number {
        return Object.keys(this.subjects).length;
    }

    public getForkCount(id: string): number {
        if (this.consumers[id]) {
            return this.consumers[id].count;
        }

        return 0;
    }

    protected getOrCreateSubject(id: string, item?: T): EntitySubject<T | undefined> {
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

    public notifyForks(id: string) {
        this.subjects[id].next(this.subjects[id].getValue());
    }

    public setItemAndNotifyForks(id: string, item: T) {
        if (!this.subjects[id]) {
            throw new Error(`Item not found in store for $id}`);
        }

        //by calling next on the origin EntitySubject all forks get that as well.
        this.subjects[id].next(item);
    }

    public hasStoreItem(id: string): boolean {
        return !!this.subjects[id];
    }
}

export class EntityState {
    private readonly items = new Map<ClassType<any>, EntitySubjectStore<any>>();
    private readonly collectionSubjectsForks = new Map<Collection<any>, { [id: string]: EntitySubject<any> }>();

    public getStore<T extends IdInterface>(classType: ClassType<T>): EntitySubjectStore<T> {
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
                store.setItemAndNotifyForks(stream.id, item);
            } else {
                throw new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Update not possible`);
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
                    store.notifyForks(stream.id);
                }
            } else {
                throw new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Patch not possible`);
            }
        }

        if (stream.type === 'entity/remove') {
            if (store.hasStoreItem(stream.id)) {
                store.removeItemAndNotifyObservers(stream.id);
            } else {
                throw new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Removing not possible`);
            }
        }
    }

    // public hasEntitySubject<T extends IdInterface>(classType: ClassType<T>, id: string): boolean {
    //     const store = this.getStore(classType);
    //     return store.hasStoreItem(id);
    // }

    /**
     * Creates the origin EntitySubject and returns a fork from it.
     * Origin will be removed as soon as all forks have unsubscribed.
     *
     * @param classType
     * @param jsonItem
     */
    public handleEntity<T extends IdInterface>(classType: ClassType<T>, jsonItem: JSONEntity<T>): EntitySubject<T | undefined> {
        const store = this.getStore(classType);
        const item = plainToClass(classType, jsonItem);

        return store.createFork(item.id, item);
    }

    public async unsubscribeCollection<T extends IdInterface>(collection: Collection<T>) {
        const subs = this.collectionSubjectsForks.get(collection);

        if (subs) {
            for (const sub of each(subs)) {
                await sub.unsubscribe();
            }
        }
    }

    protected getOrCreateCollectionSubjectsForks<T extends IdInterface>(collection: Collection<T>): { [id: string]: EntitySubject<any> } {
        let subs = this.collectionSubjectsForks.get(collection);

        if (!subs) {
            subs = {};
            this.collectionSubjectsForks.set(collection, subs);
        }

        return subs;
    }

    public handleCollectionNext<T extends IdInterface>(collection: Collection<T>, stream: CollectionStream) {
        const classType = collection.classType;
        const store = this.getStore(classType);

        console.log('collection next', stream);
        const forks = this.getOrCreateCollectionSubjectsForks(collection);

        if (stream.type === 'set') {
            for (const itemRaw of stream.items) {

                const item = plainToClass(classType, itemRaw);
                collection.add(item, false);

                const subject = store.createFork(item.id, item);
                forks[itemRaw.id] = subject;

                subject.subscribe((i) => {
                    collection.deepChange.next(i);
                    collection.loaded();
                });
            }
        }

        if (stream.type === 'removeMany') {
            collection.removeMany(stream.ids);

            collection.loaded();
        }

        if (stream.type === 'remove') {
            collection.remove(stream.id);

            if (forks[stream.id]) {
                forks[stream.id].unsubscribe();
            }

            collection.loaded();
        }

        if (stream.type === 'add') {
            const item = plainToClass(classType, stream.item);
            collection.add(item, false);

            const subject = store.createFork(item.id, item);
            forks[item.id] = subject;

            subject.subscribe((i) => {
                collection.deepChange.next(i);

                collection.loaded();
            });
        }
    }
}
