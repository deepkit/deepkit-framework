import { ClassSchema } from "@deepkit/type";
import { ConnectionWriter, IdInterface, IdType } from "../model";

interface Store<T> {
    item: T,
    listeners: number;
    lastSentVersion: number
}

class SubscriptionHandler<T extends IdInterface> {
    protected store = new Map<string | number, Store<T>>();

    constructor(
        protected writer: ConnectionWriter
    ) {
    }

    public isRegistered(id: IdType): boolean {
        return this.store.has(id);
    }

    public register(item: T): void {
        this.store.set(item.id, { item: item, listeners: 0, lastSentVersion: -1 });
    }

    public deregister(id: IdType): void {
        this.store.delete(id);
    }

    public onDelete(id: IdType): void {
        const store = this.store.get(id);
        if (!store) return;
        
        this.deregister(id);
    }

    public onSet(id: IdType, item: T): void {
        const store = this.store.get(id);
        if (!store) throw new Error('Could not onSet on unknown item');
        store.item = item;
    }

    public onPatch(id: IdType, patch: { [name: string]: any }): void {
        const store = this.store.get(id);
        if (!store) throw new Error('Could not onPatch on unknown item');
    }

    /**
     * Handle incoming change feeds.
     * This is usualy fed from a message bus.
     */
    public feed() {

    }
}

class SubscriptionHandlers {
    protected handler = new Map<ClassSchema, SubscriptionHandler<any>>();

    constructor(
        protected writer: ConnectionWriter,
    ) {
    }

    get<T extends IdInterface>(classSchema: ClassSchema<T>): SubscriptionHandler<T> {
        let handler = this.handler.get(classSchema);
        if (!handler) {
            handler = new SubscriptionHandler(this.writer);
            this.handler.set(classSchema, handler);
        }

        return handler;
    }

    feed<T extends IdInterface>(classSchema: ClassSchema<T>) {
        this.get(classSchema).feed();
    }
}