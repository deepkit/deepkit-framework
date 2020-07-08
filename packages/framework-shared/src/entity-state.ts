import {getClassSchemaByName, partialPlainToClass, plainToClass} from "@super-hornet/marshal";
import {Collection, CollectionStream, EntitySubject, IdInterface, JSONEntity, ServerMessageEntity} from "../index";
import {set, delete as deleteByPath} from 'dot-prop';
import {ClassType, eachPair, getClassName} from "@super-hornet/core";
import {skip} from "rxjs/operators";
import {ObjectUnsubscribedError, Subject} from "rxjs";

class EntitySubjectStore<T extends IdInterface> {
    subjects: { [id: string]: EntitySubject<T> } = {};
    consumers: { [id: string]: { count: number } } = {};

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
     *  it would unsubscribe for ALL subscribers of that particular entity item.
     *  so we fork it. The fork can be unsubscribed without touching the origin.
     */
    public createFork(id: string, item?: T): EntitySubject<T> {
        const originSubject = this.getOrCreateSubject(id, item);

        if (!this.consumers[id]) {
            this.consumers[id] = {count: 0};
        }

        this.consumers[id].count++;

        const forkedSubject = new EntitySubject<T>(originSubject.getValue(), async () => {
            await this.forkUnsubscribed(id);
        });

        const sub = originSubject.subscribe((next) => {
            try {
                forkedSubject.next(next);
            } catch (error) {
                if (error instanceof ObjectUnsubscribedError) {
                    sub.unsubscribe();
                }
            }
        }, error => {
            forkedSubject.error(error);
        }, () => {
            forkedSubject.complete();
        });

        // originSubject.subscribe(forkedSubject);
        originSubject.delete.subscribe((v) => {
            forkedSubject.deleted = v;
            forkedSubject.delete.next(v);
        });
        const patchSub = originSubject.patches.subscribe((next) => {
            forkedSubject.patches.next(next);
        }, (error) => {
            forkedSubject.patches.error(error);
        }, () => {
            forkedSubject.patches.complete();
        });

        sub.add(() => {
            patchSub.unsubscribe();
        });

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

    protected getOrCreateSubject(id: string, item?: T): EntitySubject<T> {
        if (!this.subjects[id]) {
            if (item) {
                this.subjects[id] = new EntitySubject<T>(item);
            } else {
                throw new Error('Can not create a EntitySubject without item.');
            }
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
            try {
                this.subjects[id].next(undefined);
                this.subjects[id].complete();
            } catch (error) {
                console.error('Could not next subject for', id);
            }

            delete this.subjects[id];
        }
    }

    public notifyForks(id: string) {
        this.subjects[id].next(this.subjects[id].getValue());
    }

    public notifyForksAboutPatches(id: string, patches: { [path: string]: any }) {
        this.subjects[id].patches.next(patches);
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
    public readonly deleted = new Subject<IdInterface>();

    private readonly items = new Map<ClassType<any>, EntitySubjectStore<any>>();

    public clear() {
        this.items.clear();
    }

    public getStore<T extends IdInterface>(classType: ClassType<T>): EntitySubjectStore<T> {
        let store = this.items.get(classType);

        if (!store) {
            store = new EntitySubjectStore;
            this.items.set(classType, store);
        }

        return store;
    }

    public handleEntityMessage<T extends IdInterface>(stream: ServerMessageEntity) {
        const classSchema = getClassSchemaByName(stream.entityName);
        const classType = classSchema.classType as ClassType<IdInterface>;

        const store = this.getStore(classType);

        if (stream.type === 'entity/update') {
            if (store.hasStoreItem(stream.id)) {
                const item = plainToClass(classType, stream.data);
                //todo, we should not overwrite it, but modify the item in-place. This prevents bugs mis-expectations.
                store.setItemAndNotifyForks(stream.id, item);
            } else {
                throw new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Update not possible`);
            }
        }

        if (stream.type === 'entity/patch') {
            if (store.hasStoreItem(stream.id)) {
                const toVersion = stream.version;
                const item = store.getItem(stream.id);

                //we cant do a version check like `item.version < toVersion`, since exchange issues versions always from 0 when restarted
                //so we apply all incoming patches.
                if (item) {
                    const patches = partialPlainToClass(classType, stream.patch.set);

                    //it's important to not patch old versions
                    for (const [i, v] of eachPair(patches)) {
                        set(item, i, v);
                    }

                    for (const path of Object.keys(stream.patch.unset)) {
                        deleteByPath(item, path);
                        set(patches, path, undefined);
                    }

                    item.version = toVersion;

                    try {
                        store.notifyForksAboutPatches(stream.id, patches);
                        store.notifyForks(stream.id);
                    } catch (error) {
                        console.log(`Could not notify EntitySubject #${stream.id} forks, due to ${error}`);
                    }
                }
            } else {
                console.debug(new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Patch not possible`));
            }
        }

        if (stream.type === 'entity/remove') {
            if (store.hasStoreItem(stream.id)) {
                this.deleted.next(store.getItem(stream.id));
                store.removeItemAndNotifyObservers(stream.id);
            } else {
                console.debug(new Error(`${getClassName(classType)} item not found in store for ${stream.id}. Removing not possible`));
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
    public handleEntity<T extends IdInterface>(classType: ClassType<T>, jsonItem: JSONEntity<T>): EntitySubject<T> {
        const store = this.getStore(classType);
        const item = plainToClass(classType, jsonItem);

        return store.createFork(item.id, item);
    }

    public handleCollectionNext<T extends IdInterface>(collection: Collection<T>, stream: CollectionStream) {
        const classType = collection.classType;
        const store = this.getStore(classType);

        // console.log('collection next', stream);

        if (stream.type === 'set') {
            const setItems: T[] = [];
            for (const itemRaw of stream.items) {
                if (!collection.entitySubjects[itemRaw.id]) {
                    const item = plainToClass(classType, itemRaw);
                    const subject = store.createFork(item.id, item);

                    setItems.push(subject.getValue());
                    collection.entitySubjects[itemRaw.id] = subject;

                    subject.pipe(skip(1)).subscribe((i) => {
                        if (!subject.deleted) {
                            collection.deepChange.next(i);
                            //when item is removed, we get that signal before the collection gets that information. Which means we trigger loaded() twice
                            collection.seItem(i.id, i);
                            collection.loaded();
                        }
                    });
                } else {
                    setItems.push(collection.entitySubjects[itemRaw.id].value);
                }
            }
            collection.set(setItems);
        }

        if (stream.type === 'removeMany') {
            for (const id of stream.ids) {
                if (collection.entitySubjects[id]) {
                    collection.entitySubjects[id].unsubscribe();
                    delete collection.entitySubjects[id];
                }
            }
            collection.removeMany(stream.ids);
        }

        if (stream.type === 'sort') {
            collection.setSort(stream.ids);
        }

        if (stream.type === 'batch/start') {
            collection.batchStart();
        }

        if (stream.type === 'batch/end') {
            collection.batchEnd();
        }

        if (stream.type === 'pagination') {
            //when controller/entity-storage detected changes in those parameters, we set it without triggering an event.
            //triggering an event using setPage() etc would reload the current page.
            if (stream.event.type === 'server:change') {
                collection.pagination.setItemsPerPage(stream.event.itemsPerPage);
                collection.pagination.setPage(stream.event.page);
                collection.pagination.setTotal(stream.event.total);
                collection.pagination.setSort(stream.event.order);
                collection.pagination.setParameters(stream.event.parameters);
            }

            if (stream.event.type === 'server:apply/finished') {
                collection.pagination._applyFinished();
            }
        }

        if (stream.type === 'remove') {
            collection.remove(stream.id);

            if (collection.entitySubjects[stream.id]) {
                collection.entitySubjects[stream.id].unsubscribe();
                delete collection.entitySubjects[stream.id];
            }
        }

        if (stream.type === 'add') {
            if (!collection.entitySubjects[stream.item.id]) {
                const item = plainToClass(classType, stream.item);
                const subject = store.createFork(item.id, item);

                collection.entitySubjects[item.id] = subject;
                collection.add(subject.getValue());

                subject.pipe(skip(1)).subscribe((i) => {
                    if (!subject.deleted) {
                        collection.deepChange.next(i);
                        //when item is removed, we get that signal before the collection gets that information. Which means we trigger loaded() twice
                        collection.seItem(i.id, i);
                        collection.loaded();
                    }
                });
            }
        }
    }
}
