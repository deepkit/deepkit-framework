/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * This is a collection object that contains items of an certain entity.
 * This collection "lives" in the sense that its items are automatically
 * updated, added and removed. When such a change happens, an event is triggered* you can listen on.
 */
import {ReplaySubject, Subject, TeardownLogic} from 'rxjs';
import {IdInterface} from './contract';
import {tearDown} from '@deepkit/core-rxjs';
import {ClassType, each, getClassName} from '@deepkit/core';
import {EntitySubject} from './core';

export type FilterParameters = {[name: string]: any | undefined};

export interface CollectionBatchStart {
    type: 'batch/start';
}

export interface CollectionBatchEnd {
    type: 'batch/end';
}

export interface CollectionAdd {
    type: 'add';
    item: any;
}

export interface CollectionRemove {
    type: 'remove';
    id: string | number;
}

export interface CollectionSetSort {
    type: 'sort';
    ids: (string|number)[];
}

export interface CollectionRemoveMany {
    type: 'removeMany';
    ids: (string|number)[];
}

export interface CollectionSet {
    type: 'set';
    items: any[];
}

export type CollectionEvent = CollectionBatchStart | CollectionBatchEnd | CollectionAdd | CollectionSetSort | CollectionRemove | CollectionRemoveMany | CollectionSet;

export type CollectionSortDirection = 'asc' | 'desc';

export interface CollectionSort {
    field: string;
    direction: CollectionSortDirection;
}

export interface CollectionPaginationEventApplyFinished {
    type: 'server:apply/finished';
}

export interface CollectionPaginationEventInternalChange {
    type: 'internal_server_change';
}

export interface CollectionPaginationEventChange {
    type: 'server:change';
    order: { field: string, direction: 'asc' | 'desc' }[];
    parameters: FilterParameters;
    itemsPerPage: number;
    total: number;
    page: number;
}

export interface CollectionPaginationEventApply {
    type: 'apply';
}

export interface CollectionPaginationEventClientApply {
    type: 'client:apply';
}

export type CollectionPaginationEvent = CollectionPaginationEventApplyFinished
    | CollectionPaginationEventChange
    | CollectionPaginationEventInternalChange
    | CollectionPaginationEventClientApply
    | CollectionPaginationEventApply;

export class CollectionPagination<T extends IdInterface> {
    public readonly event = new Subject<CollectionPaginationEvent>();

    public _parameters: FilterParameters = {};

    constructor(private collection: Collection<T>) {
    }

    protected page = 1;

    protected total = 0;
    protected itemsPerPage = 50;

    protected sort: CollectionSort[] = [];

    protected active = false;

    protected applyPromise?: Promise<void>;
    protected applyPromiseResolver?: () => void;

    public setParameters(values?: FilterParameters): CollectionPagination<T> {
        this._parameters = values || {};
        return this;
    }

    public resetParameters(): CollectionPagination<T> {
        this._parameters = {};
        return this;
    }

    public setParameter(name: string, value?: any): CollectionPagination<T> {
        this._parameters[name] = value;
        return this;
    }

    public getParameter(name: string): any {
        return this._parameters[name];
    }

    public getParameters(): FilterParameters {
        return this._parameters;
    }

    public getHash(): string {
        return JSON.stringify([
            this.page, this.itemsPerPage, this.sort, this._parameters
        ]);
    }

    public getPagingHash(): string {
        return JSON.stringify([
            this.page, this.itemsPerPage, this.sort
        ]);
    }

    public getParametersHash(): string {
        return JSON.stringify([
            this._parameters
        ]);
    }

    public setPage(page: number): CollectionPagination<T> {
        this.page = page;
        return this;
    }

    public hasSort(): boolean {
        return this.sort.length > 0;
    }

    public getSort(): CollectionSort[] {
        return this.sort;
    }

    public setSort(order: CollectionSort[]): CollectionPagination<T> {
        this.sort = order;
        return this;
    }

    public orderByField(field: string, direction: CollectionSortDirection = 'asc'): CollectionPagination<T> {
        this.sort = [{field: field, direction: direction}];
        return this;
    }

    /**
     * Sends current pagination setting to the server and refreshes the collection if necessary.
     */
    public apply(): Promise<void> {
        this.applyPromise = new Promise((resolve, reject) => {
            this.applyPromiseResolver = resolve;
            this.event.next({type: 'apply'});
        });

        return this.applyPromise;
    }

    /**
     * Triggered from the server when the apply() finished. Doesn't matter if we got actual updates or not. It's important
     * to distinguish because collection.nextStateChange is not reliable enough
     * (as entity updates could happen between apply and applyFinish, which would trigger nextStateChange).
     *
     * @private
     */
    public _applyFinished() {
        if (this.applyPromiseResolver) {
            this.applyPromiseResolver();
            delete this.applyPromise;
            delete this.applyPromiseResolver;
        }
    }

    public setTotal(total: number): CollectionPagination<T> {
        this.total = total;
        return this;
    }

    public setItemsPerPage(items: number): CollectionPagination<T> {
        this.itemsPerPage = items;
        return this;
    }

    public isActive(): boolean {
        return this.active;
    }

    /**
     * It's not possible to activate this later on. This is set on the server side only.
     */
    public _activate(): CollectionPagination<T> {
        this.active = true;
        return this;
    }

    public getPage(): number {
        return this.page;
    }

    public getItemsPerPage(): number {
        return this.itemsPerPage;
    }

    public getTotal(): number {
        return this.total;
    }

    public getPages(): number {
        return Math.ceil(this.getTotal() / this.getItemsPerPage());
    }

    public isPageValid(): boolean {
        return this.page > this.getPages();
    }
}

export interface CollectionEntitySubjectFetcher {
    fetch<T extends IdInterface>(classType: ClassType<T>, id: string | number): EntitySubject<T>;
}

export class Collection<T extends IdInterface> extends ReplaySubject<T[]> {
    public readonly event: Subject<CollectionEvent> = new Subject;

    public readonly removed = new Subject<T>();
    public readonly added = new Subject<T>();

    protected readonly teardowns: TeardownLogic[] = [];

    protected items: T[] = [];
    protected itemsMapped: { [id: string]: T } = {};

    public readonly deepChange = new Subject<T>();

    protected nextChange?: Subject<void>;

    public readonly pagination: CollectionPagination<T> = new CollectionPagination(this);

    protected batchActive = false;
    protected batchNeedLoaded = false;
    protected entitySubjectFetcher?: CollectionEntitySubjectFetcher;

    public readonly entitySubjects: {[id: string]: EntitySubject<T>} = {};

    constructor(
        public readonly classType: ClassType<T>,
    ) {
        super(1);
    }

    public getEntitySubject(idOrItem: string | number | T): EntitySubject<T> {
        const id: string | number = idOrItem instanceof this.classType ? idOrItem.id : String(idOrItem);
        return this.entitySubjects[id];
    }

    public has(id: string | number) {
        return 'undefined' !== typeof this.itemsMapped[id];
    }

    public get(id: string | number): T | undefined {
        return this.itemsMapped[id];
    }

    public batchStart() {
        this.batchActive = true;
        this.event.next({type: 'batch/start'});
    }

    public batchEnd() {
        this.batchActive = false;
        if (this.batchNeedLoaded) {
            this.loaded();
        }
        this.batchNeedLoaded = false;
        this.event.next({type: 'batch/end'});
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
    public async unsubscribe() {
        await super.unsubscribe();
        this.pagination.event.unsubscribe();

        for (const teardown of this.teardowns) {
            await tearDown(teardown);
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

    public ids(): (string|number)[] {
        const ids: (string|number)[] = [];
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
        if (this.batchActive) {
            this.batchNeedLoaded = true;
            return;
        }

        this.batchNeedLoaded = false;
        if (this.isStopped) {
            throw new Error('Collection already unsubscribed');
        }
        this.next(this.items);

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    public seItem(id: string | number, item: T) {
        if (this.itemsMapped[item.id]) {
            const index = this.items.indexOf(this.itemsMapped[item.id]);
            this.items[index] = item;
            this.itemsMapped[item.id] = item;
        } else {
            this.items.push(item);
            this.itemsMapped[item.id] = item;
        }
    }

    public set(items: T[], withEvent = true) {
        for (const item of items) {
            if (!this.itemsMapped[item.id]) {
                this.added.next(item);
            }
            delete this.itemsMapped[item.id];
        }

        for (const deleted of each(this.itemsMapped)) {
            this.removed.next(deleted);
        }

        this.itemsMapped = {};
        this.items = items;

        for (const item of items) {
            this.itemsMapped[item.id] = item;
        }

        if (withEvent) {
            this.event.next({type: 'set', items: items});
            this.loaded();
        }
    }

    public setSort(ids: (string | number)[]) {
        this.items.splice(0, this.items.length);
        for (const id of ids) {
            this.items.push(this.itemsMapped[id]);
        }

        this.event.next({type: 'sort', ids: ids});
        this.loaded();
    }

    public removeMany(ids: (string|number)[], withEvent = true) {
        for (const id of ids) {
            const item = this.itemsMapped[id];
            delete this.itemsMapped[id];
            const index = this.items.indexOf(item);
            if (-1 !== index) {
                this.removed.next(this.items[index]);
                this.items.splice(index, 1);
            }
        }

        if (withEvent) {
            this.event.next({type: 'removeMany', ids: ids});
            this.loaded();
        }
    }

    public add(item: T, withEvent = true) {
        if (!item) {
            throw new Error(`Trying to insert a ${getClassName(this.classType)} collection item without value`);
        }

        this.added.next(item);

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
            this.loaded();
        }
    }

    public remove(id: string | number, withEvent = true) {
        if (this.itemsMapped[id]) {
            const item = this.itemsMapped[id];
            delete this.itemsMapped[id];

            const index = this.items.indexOf(item);
            if (-1 !== index) {
                this.items.splice(index, 1);
            }

            if (withEvent) {
                this.event.next({type: 'remove', id: item.id});
                this.removed.next(item);
                this.loaded();
            }
        }
    }
}

type JSONObject<T> = Partial<T> & IdInterface;

export class JSONObjectCollection<T extends JSONObject<T>> extends Collection<T> {

}
