import { arrayRemoveItem, ClassType, getObjectKeysSize } from "@deepkit/core";
import { ClassSchema, getClassSchema } from "@deepkit/type";
import { RpcMessage } from "../protocol";
import { EntitySubject, IdInterface, RpcTypes, IdType } from "../model";

export class EntitySubjectStore<T extends IdInterface> {
    store = new Map<IdType, { item: T, forks: EntitySubject<T>[] }>();

    subjects: { [id: string]: EntitySubject<T> } = {};
    consumers: { [id: string]: { count: number } } = {};

    public isRegistered(id: IdType): boolean {
        return this.store.has(id);
    }

    public register(item: T): void {
        this.store.set(item.id, { item: item, forks: [] });
    }

    public deregister(id: IdType): void {
        this.store.delete(id);
    }

    public onDelete(id: IdType): void {
        const store = this.store.get(id);
        if (!store) return;
        for (const fork of store.forks) {
            fork.delete.next(true);
        }
        this.deregister(id);
    }

    public onSet(id: IdType, item: T): void {
        const store = this.store.get(id);
        if (!store) throw new Error('Could not onSet on unknown item');
        store.item = item;
        for (const fork of store.forks) {
            fork.next(item);
        }
    }

    public onPatch(id: IdType, patch: { [name: string]: any }): void {
        const store = this.store.get(id);
        if (!store) throw new Error('Could not onPatch on unknown item');
        for (const fork of store.forks) {
            fork.patches.next(patch);
            fork.next(store.item);
        }
    }

    protected forkUnregistered(id: IdType, fork: EntitySubject<T>) {
        const store = this.store.get(id);
        if (!store) return;
        arrayRemoveItem(store.forks, fork);

        if (store.forks.length === 0) {
            this.deregister(id);
        }
    }

    /**
     * Before calling createFork you must be sure the item is already registered.
     */
    public createFork(id: IdType): EntitySubject<T> {
        let store = this.store.get(id);
        if (!store) throw new Error('Could not create fork from unknown item ' + id);

        const fork = new EntitySubject<T>(store.item, () => {
            this.forkUnregistered(id, fork);
        });
        store.forks.push(fork);

        return fork;
    }

    public getForkCount(id: IdType): number {
        const store = this.store.get(id);
        return store ? store.forks.length : 0;
    }

    public getEntitySubjectCount(): number {
        return this.store.size;
    }
}

export class EntityState {
    private readonly items = new Map<ClassSchema, EntitySubjectStore<any>>();

    public getStore<T extends IdInterface>(classType: ClassType<T> | ClassSchema<T>): EntitySubjectStore<T> {
        const schema = getClassSchema(classType);
        let store = this.items.get(schema);

        if (!store) {
            store = new EntitySubjectStore;
            this.items.set(schema, store);
        }

        return store;
    }

    public createEntitySubject(classSchema: ClassSchema, bodySchema: ClassSchema<{v?: any}>, message: RpcMessage) {
        if (message.type !== RpcTypes.ResponseEntity) throw new Error('Not a response entity message');
        const item = message.parseBody(bodySchema).v;
        
        const store = this.getStore(classSchema);
        if (!store.isRegistered(item.id)) store.register(item);

        return store.createFork(item.id);
    }

    /**
     * Handles the RpcType.Entity, which is a composite per default.
     */
    public handle(entityMessage: RpcMessage) {
        for (const message of entityMessage.getBodies()) {
            switch (message.type) {
                case RpcTypes.EntityPatch: {

                    break;
                }

                case RpcTypes.EntityRemove: {
                    break;
                }
            }
        }
    }
}
