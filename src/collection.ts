/**
 * This is a collection object that contains items of an certain entity.
 * This collection "lives" in the sense that its items are automatically
 * updated, added and removed. When such a change happens, an event is triggered* you can listen on.
 */
import {Observable, ReplaySubject, Subject, TeardownLogic} from "rxjs";
import {getEntityName} from "@marcj/marshal";
import {first, map} from "rxjs/operators";
import {IdInterface} from "./contract";
import {tearDown} from "@marcj/estdlib-rxjs";
import {ClassType} from "@marcj/estdlib";

export interface CollectionAdd {
    type: 'add';
    item: any;
}

export interface CollectionRemove {
    type: 'remove';
    id: string;
}


export interface CollectionRemoveMany {
    type: 'removeMany';
    ids: string[];
}

export interface CollectionSet {
    type: 'set';
    items: any[];
}

export type CollectionEvent = CollectionAdd | CollectionRemove | CollectionRemoveMany | CollectionSet;

export class Collection<T extends IdInterface> extends ReplaySubject<T[]> {
    public readonly event: Subject<CollectionEvent> = new Subject;

    protected readonly teardowns: TeardownLogic[] = [];

    protected items: T[] = [];
    protected itemsMapped: { [id: string]: T } = {};

    public readonly entityName: string;

    public readonly ready: Observable<void>;
    public isLoaded: boolean = false;

    public readonly deepChange = new Subject<T>();
    protected nextChange?: Subject<void>;

    constructor(
        public readonly classType: ClassType<T>,
    ) {
        super(1);
        this.entityName = getEntityName(classType);
        this.ready = this.pipe(first(), map(() => undefined));
    }

    public has(id: string) {
        return 'undefined' !== typeof this.itemsMapped[id];
    }

    public get(id: string): T | undefined {
        return this.itemsMapped[id];
    }

    /**
     * Once the collection has completely loaded for the first time, this
     * promise is resolved.
     */
    get readyState(): Promise<void> {
        return this.ready.toPromise();
    }

    /**
     * Resolves when next change happened.
     */
    get nextStateChange(): Promise<void> {
        if (!this.nextChange) {
            this.nextChange = new Subject<void>();
        }
        return this.nextChange.toPromise();
    }

    /**
     * Unsubscribe from the backend stream.
     */
    public unsubscribe() {
        super.unsubscribe();

        for (const teardown of this.teardowns) {
            tearDown(teardown);
        }

        this.teardowns.splice(0, this.teardowns.length);
    }

    public addTeardown(teardown: TeardownLogic) {
        this.teardowns.push(teardown);
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
        this.isLoaded = true;
        this.next(this.items);
        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    public set(items: T[], withEvent = true) {
        this.itemsMapped = {};
        this.items = items;

        for (const item of items) {
            this.itemsMapped[item.id] = item;
        }

        if (withEvent) {
            this.event.next({type: 'set', items: items});
            if (this.isLoaded) {
                this.loaded();
            }
        }
    }

    public removeMany(ids: string[], withEvent = true) {
        for (const id of ids) {
            const item = this.itemsMapped[id];
            const index = this.items.indexOf(item);
            if (-1 !== index) {
                this.items.splice(index, 1);
            }
        }

        if (withEvent) {
            this.event.next({type: 'removeMany', ids: ids});
        }
    }

    public add(item: T, withEvent = true) {
        if (!item) {
            throw new Error(`Trying to insert a ${this.entityName} collection item without value`);
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
            this.event.next({type: 'add', item: item});

            if (this.isLoaded) {
                this.loaded();
            }
        }
    }

    public remove(id: string, withEvent = true) {
        if (this.itemsMapped[id]) {
            const item = this.itemsMapped[id];
            const index = this.items.indexOf(item);
            if (-1 !== index) {
                this.items.splice(index, 1);

                if (withEvent) {
                    this.event.next({type: 'remove', id: item.id});
                    if (this.isLoaded) {
                        this.loaded();
                    }
                }
            }
        }
    }
}
