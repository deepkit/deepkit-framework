/**
 * This is a collection object that contains items of an certain entity.
 * This collection "lives" in the sense that its items are automatically
 * updated, added and removed. When such a change happens, an event is triggered* you can listen on.
 */
import {Observable, ReplaySubject, Subject, Subscription} from "rxjs";
import {getEntityName, ClassType} from "@marcj/marshal";
import {first} from "rxjs/operators";
import {IdInterface} from "./contract";

class CollectionStreamEvent<T> {
    type: 'add' | 'remove' | 'update';
    item: T;

    constructor(type: 'add' | 'remove' | 'update', item: T) {
        this.type = type;
        this.item = item;
    }
}

export class Collection<T extends IdInterface> extends ReplaySubject<T[]> {
    public readonly event: Subject<CollectionStreamEvent<T>> = new Subject;

    public subscription?: Subscription;

    protected items: T[] = [];
    protected itemsMapped: { [id: string]: T} = {};

    // public readonly entityName: string;
    public readonly ready: Observable<T[]>;
    public readonly deepChange = new Subject<T>();

    constructor() {
        super(1);
        // this.entityName = getEntityName(classType);
        this.ready = this.pipe(first());
    }

    public has(id: string) {
        return 'undefined' !== typeof this.itemsMapped[id];
    }

    public get(id: string): T | undefined {
        return this.itemsMapped[id];
    }

    /**
     * Unsubscribe from the backend stream.
     */
    public unsubscribe() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            delete this.subscription;
        }
    }

    public index(item: T): number {
        return this.items.indexOf(item);
    }

    /**
     * Returns the page zero-based of the current item.
     */
    public getPageOf(item: T, itemsPerPage = 10): number {
        const index = this.index(item);

        if (-1 === index) return 0;

        return Math.floor(index / itemsPerPage);
    }

    public reset() {
        this.items = [];
        this.itemsMapped = {};
    }

    public all(): T[] {
        return this.items;
    }

    public count() {
        return this.items.length;
    }

    public ids(): string[] {
        const ids: string[] = [];
        for (const i of this.items) {
            ids.push(i.id);
        }

        return ids;
    }

    public empty() {
        return 0 === this.items.length;
    }

    public map() {
        return this.itemsMapped;
    }

    public loaded() {
        this.next(this.items);
    }

    public add(item: T, withEvent = true) {
        if (!item) {
            throw new Error(`Trying to insert a collection item without value`);
        }

        if (this.itemsMapped[item.id]) {
            const index = this.items.indexOf(this.itemsMapped[item.id]);
            this.items[index] = item;
            this.itemsMapped[item.id] = item;
        } else {
            this.items.push(item);
            this.itemsMapped[item.id] = item;
        }

        if (withEvent) {
            this.event.next(new CollectionStreamEvent('add', item));
            this.next(this.items);
        }
    }

    public remove(id: string, withEvent = true) {
        if (this.itemsMapped[id]) {
            const item = this.itemsMapped[id];
            const index = this.items.indexOf(item);
            if (-1 !== index) {
                this.items.splice(index, 1);

                if (withEvent) {
                    this.event.next(new CollectionStreamEvent('remove', item));
                    this.next(this.items);
                }
            }
        }
    }
}
