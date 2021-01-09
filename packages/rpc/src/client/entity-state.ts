import { arrayRemoveItem, ClassType, deletePathValue, getPathValue, setPathValue } from "@deepkit/core";
import { ClassSchema, getClassSchema, jsonSerializer } from "@deepkit/type";
import { EntityPatch, EntitySubject, IdType, IdVersionInterface, rpcEntityPatch, rpcEntityRemove, RpcTypes } from "../model";
import { RpcMessage } from "../protocol";

export class EntitySubjectStore<T extends IdVersionInterface> {
    store = new Map<IdType, { item: T, forks: EntitySubject<T>[] }>();

    constructor(protected schema: ClassSchema<T>) {}

    public isRegistered(id: IdType): boolean {
        return this.store.has(id);
    }

    public register(item: T): void {
        this.store.set(item.id, { item: item, forks: [] });
    }

    public deregister(id: IdType): void {
        this.store.delete(id);
    }

    public getItem(id: IdType): T | undefined {
        return this.store.get(id)?.item;
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

    public onPatch(id: IdType, version: number, patch: EntityPatch): void {
        const store = this.store.get(id);
        if (!store) throw new Error('Could not onPatch on unknown item');

        store.item.version = version;
        if (patch.$set) {
            const $set = jsonSerializer.for(this.schema).patchDeserialize(patch.$set);

            for (const i in $set) {
                setPathValue(store.item, i, $set[i]);
            }
        }

        if (patch.$inc) for (const i in patch.$inc) {
            setPathValue(store.item, i, getPathValue(store.item, i, patch.$inc[i]));
        }

        if (patch.$unset) for (const i in patch.$unset) {
            deletePathValue(store.item, i);
        }

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
    private readonly store = new Map<ClassSchema, EntitySubjectStore<any>>();
    private readonly storeByName = new Map<string, EntitySubjectStore<any>>();

    public getStore<T extends IdVersionInterface>(classType: ClassType<T> | ClassSchema<T>): EntitySubjectStore<T> {
        const schema = getClassSchema(classType);
        let store = this.store.get(schema);

        if (!store) {
            store = new EntitySubjectStore(schema);
            this.store.set(schema, store);
            this.storeByName.set(schema.getName(), store);
        }

        return store;
    }

    public getStoreByName<T extends IdVersionInterface>(name: string): EntitySubjectStore<T> {
        let store = this.storeByName.get(name);
        if (!store) throw new Error(`No store for entity ${name}`);

        return store;
    }

    public createEntitySubject(classSchema: ClassSchema, bodySchema: ClassSchema<{ v?: any }>, message: RpcMessage) {
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
                    //todo, use specialized ClassSchema, so we get correct instance types returned. We need however first deepkit/bson patch support
                    const body = message.parseBody(rpcEntityPatch);
                    const store = this.getStoreByName(body.entityName);
                    store.onPatch(body.id, body.version, body.patch);
                    break;
                }

                case RpcTypes.EntityRemove: {
                    const body = message.parseBody(rpcEntityRemove);
                    for (const id of body.ids) {
                        const store = this.getStoreByName(body.entityName);
                        store.onDelete(id);
                    }
                    break;
                }
            }
        }
    }
}
