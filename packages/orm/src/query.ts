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

import { ClassSchema, ExtractPrimaryKeyType, ExtractReferences, PrimaryKeyFields, PropertySchema } from '@deepkit/type';
import { Subject } from 'rxjs';
import { ClassType, empty } from '@deepkit/core';
import { FieldName, FlattenIfArray } from './utils';
import { DatabaseSession } from './database-session';
import { DatabaseAdapter } from './database';
import { QueryDatabaseDeleteEvent, QueryDatabaseEvent, QueryDatabasePatchEvent } from './event';
import { Changes, ChangesInterface } from './changes';
import { DeleteResult, Entity, PatchResult } from './type';
import { getSimplePrimaryKeyHashGenerator } from './converter';

export type SORT_ORDER = 'asc' | 'desc' | any;
export type Sort<T extends Entity, ORDER extends SORT_ORDER = SORT_ORDER> = { [P in keyof T & string]?: ORDER };

export interface DatabaseJoinModel<T, PARENT extends BaseQuery<any>> {
    //this is the parent classSchema, the foreign classSchema is stored in `query`
    classSchema: ClassSchema<T>,
    propertySchema: PropertySchema,
    type: 'left' | 'inner' | string,
    populate: boolean,
    //defines the field name under which the database engine populated the results.
    //necessary for the formatter to pick it up, convert and set correct to the real field name
    as?: string,
    query: JoinDatabaseQuery<T, PARENT>,
    foreignPrimaryKey: PropertySchema,
}

export type QuerySelector<T> = {
    // Comparison
    $eq?: T;
    $gt?: T;
    $gte?: T;
    $in?: T[];
    $lt?: T;
    $lte?: T;
    $ne?: T;
    $nin?: T[];
    // Logical
    $not?: T extends string ? (QuerySelector<T> | RegExp) : QuerySelector<T>;
    $regex?: T extends string ? (RegExp | string) : never;

    //special deepkit/type type
    $parameter?: string;
};

export type RootQuerySelector<T> = {
    $and?: Array<FilterQuery<T>>;
    $nor?: Array<FilterQuery<T>>;
    $or?: Array<FilterQuery<T>>;
    // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
    // this will mark all unrecognized properties as any (including nested queries)
    [key: string]: any;
};

type RegExpForString<T> = T extends string ? (RegExp | T) : T;
type MongoAltQuery<T> = T extends Array<infer U> ? (T | RegExpForString<U>) : RegExpForString<T>;
export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

export type FilterQuery<T> = {
    [P in keyof T & string]?: Condition<T[P]>;
} &
    RootQuerySelector<T>;

export class DatabaseQueryModel<T extends Entity, FILTER extends FilterQuery<Entity> = FilterQuery<Entity>, SORT extends Sort<Entity> = Sort<Entity>> {
    public withIdentityMap: boolean = true;
    public filter?: FILTER;
    public select: Set<string> = new Set<string>();
    public joins: DatabaseJoinModel<any, any>[] = [];
    public skip?: number;
    public itemsPerPage: number = 50;
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT;
    public readonly change = new Subject<void>();
    public returning: (keyof T & string)[] = [];

    changed(): void {
        this.change.next();
    }

    hasSort(): boolean {
        return this.sort !== undefined;
    }

    /**
     * Whether limit/skip is activated.
    */
    hasPaging(): boolean {
        return this.limit !== undefined || this.skip !== undefined;
    }

    clone(parentQuery: BaseQuery<T>): this {
        const constructor = this.constructor as ClassType<this>;
        const m = new constructor();
        m.filter = this.filter;
        m.withIdentityMap = this.withIdentityMap;
        m.select = new Set(this.select.values());

        m.joins = this.joins.map((v) => {
            return {
                classSchema: v.classSchema,
                propertySchema: v.propertySchema,
                type: v.type,
                populate: v.populate,
                query: v.query.clone(parentQuery),
                foreignPrimaryKey: v.foreignPrimaryKey,
            };
        });

        m.skip = this.skip;
        m.limit = this.limit;
        m.parameters = { ...this.parameters };
        m.sort = this.sort ? { ...this.sort } : undefined;

        return m;
    }

    /**
     * Whether only a subset of fields are selected.
     */
    isPartial() {
        return this.select.size > 0;
    }

    getFirstSelect() {
        return this.select.values().next().value;
    }

    isSelected(field: string): boolean {
        return this.select.has(field);
    }

    hasJoins() {
        return this.joins.length > 0;
    }

    hasParameters(): boolean {
        return !empty(this.parameters);
    }
}

export class ItemNotFound extends Error {
}

export interface QueryClassType<T> {
    create(query: BaseQuery<any>): QueryClassType<T>;
}

export class BaseQuery<T extends Entity> {
    public format: 'class' | 'json' | 'raw' = 'class';

    protected createModel<T>() {
        return new DatabaseQueryModel<T, FilterQuery<T>, Sort<T>>();
    }

    public model = this.createModel<T>();

    constructor(
        public readonly classSchema: ClassSchema<T>
    ) {
    }

    select(...fields: FieldName<T>[]): this;
    select(fields: string[] | (FieldName<T>)[]): this;
    select(fields: string[] | FieldName<T>[] | FieldName<T>, ...moreFields: FieldName<T>[]): this {
        const c = this.clone();
        if ('string' === typeof fields) {
            c.model.select = new Set([fields as string, ...(moreFields as string[])]);
        } else {
            c.model.select = new Set([...fields as string[], ...(moreFields as string[])]);
        }
        return c;
    }

    skip(value?: number): this {
        const c = this.clone();
        c.model.skip = value;
        return c;
    }

    itemsPerPage(value: number): this {
        const c = this.clone();
        c.model.itemsPerPage = value;
        return c;
    }

    /**
     * Applies limit/skip operations correctly to basically have a paging functionality.
     * Make sure to call itemsPerPage() before you call page.
     */
    page(page: number): this {
        const c = this.clone();
        const skip = (page * c.model.itemsPerPage) - c.model.itemsPerPage;
        c.model.skip = skip;
        c.model.limit = c.model.itemsPerPage;
        return c;
    }

    limit(value?: number): this {
        const c = this.clone();
        c.model.limit = value;
        return c;
    }

    parameter(name: string, value: any): this {
        const c = this.clone();
        c.model.parameters[name] = value;
        return c;
    }

    parameters(parameters: { [name: string]: any }): this {
        const c = this.clone();
        c.model.parameters = parameters;
        return c;
    }

    /**
     * Identity mapping is used to store all created entity instances in a pool.
     * If a query fetches an already known entity instance, the old will be picked.
     * This ensures object instances uniqueness and generally saves CPU circles.
     *
     * This disabled entity tracking, forcing always to create new entity instances.
     */
    disableIdentityMap(): this {
        const c = this.clone();
        c.model.withIdentityMap = false;
        return c;
    }

    // use(query: QueryClassType): ReturnType<typeof query['create']> {
    //     return query.create(this);
    // }


    // use2(query: { create: <T>() => T }): ReturnType<typeof query['create']> {
    //     return query.create(this);

    //     interface P<T> {
    //         create(): T
    //     }

    //     interface P2<T> {
    //         create(): P<T>
    //     }
    // }

    filter(filter?: this['model']['filter'] | T): this {
        const c = this.clone();
        if (filter && !Object.keys(filter as object).length) filter = undefined;

        if (filter instanceof this.classSchema.classType) {
            const primaryKey = this.classSchema.getPrimaryField();
            c.model.filter = { [primaryKey.name]: filter[primaryKey.name as FieldName<T>] } as this['model']['filter'];
        } else {
            c.model.filter = filter;
        }
        return c;
    }

    addFilter<K extends keyof T & string>(name: K, value: FilterQuery<T>[K]): this {
        const c = this.clone();
        if (!c.model.filter) c.model.filter = {};
        c.model.filter[name] = value;
        return c;
    }

    sort(sort?: this['model']['sort']): this {
        const c = this.clone();
        c.model.sort = sort;
        return c;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema);
        cloned.model = this.model.clone(cloned) as this['model'];
        cloned.format = this.format;
        return cloned;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    join<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K, type: 'left' | 'inner' = 'left', populate: boolean = false): this {
        const propertySchema = this.classSchema.getProperty(field as string);
        if (!propertySchema.isReference && !propertySchema.backReference) {
            throw new Error(`Field ${field} is not marked as reference. Use @f.reference()`);
        }
        const c = this.clone();

        const query = new JoinDatabaseQuery<ENTITY, this>(propertySchema.getResolvedClassSchema(), c, field as string);
        query.model.parameters = c.model.parameters;

        c.model.joins.push({
            propertySchema, query, populate, type,
            foreignPrimaryKey: propertySchema.getResolvedClassSchema().getPrimaryField(),
            classSchema: this.classSchema,
        });
        return c;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoin<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'left');
        return c.model.joins[c.model.joins.length - 1].query;
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     */
    joinWith<K extends ExtractReferences<T>>(field: K): this {
        return this.join(field, 'left', true);
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoinWith<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'left', true);
        return c.model.joins[c.model.joins.length - 1].query;
    }

    getJoin<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        for (const join of this.model.joins) {
            if (join.propertySchema.name === field) return join.query;
        }
        throw new Error(`No join fo reference ${field} added.`);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     */
    innerJoinWith<K extends ExtractReferences<T>>(field: K): this {
        return this.join(field, 'inner', true);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoinWith<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'inner', true);
        return c.model.joins[c.model.joins.length - 1].query;
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    innerJoin<K extends ExtractReferences<T>>(field: K): this {
        return this.join(field, 'inner');
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoin<K extends ExtractReferences<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'inner');
        return c.model.joins[c.model.joins.length - 1].query;
    }
}

export abstract class GenericQueryResolver<T, ADAPTER extends DatabaseAdapter = DatabaseAdapter, MODEL extends DatabaseQueryModel<T> = DatabaseQueryModel<T>> {
    constructor(
        protected classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<ADAPTER>,
    ) {
    }

    abstract count(model: MODEL): Promise<number>;

    abstract find(model: MODEL): Promise<T[]>;

    abstract findOneOrUndefined(model: MODEL): Promise<T | undefined>;

    abstract delete(model: MODEL, deleteResult: DeleteResult<T>): Promise<void>;

    abstract patch(model: MODEL, value: Changes<T>, patchResult: PatchResult<T>): Promise<void>;

    abstract has(model: MODEL): Promise<boolean>;
}

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since db agnostic consumers are probably
 * coded against this interface via Database<DatabaseAdapter> which uses this GenericQuery.
 */
export class GenericQuery<T extends Entity> extends BaseQuery<T> {
    item!: T;
    
    constructor(
        classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<DatabaseAdapter>,
        protected resolver: GenericQueryResolver<T>
    ) {
        super(classSchema);
        this.model.withIdentityMap = databaseSession.withIdentityMap;
    }

    static from<T extends typeof GenericQuery, B extends GenericQuery<any>>(this: T, base: B): InstanceType<T> & B {
        const result = (new this(base.classSchema, base.databaseSession, base.resolver)) as InstanceType<T> & B;
        result.model = base.model.clone(result);
        result.format = base.format;
        return result;
    }

    protected async callQueryEvent(): Promise<this> {
        const hasEvents = this.databaseSession.queryEmitter.onFetch.hasSubscriptions();
        if (!hasEvents) return this;

        const event = new QueryDatabaseEvent(this.databaseSession, this.classSchema, this);
        await this.databaseSession.queryEmitter.onFetch.emit(event);
        return event.query as this;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.databaseSession, this.resolver);
        cloned.model = this.model.clone(cloned) as this['model'];
        cloned.format = this.format;
        return cloned;
    }

    public async count(): Promise<number> {
        const query = await this.callQueryEvent();
        return await query.resolver.count(query.model);
    }

    public async find(): Promise<T[]> {
        const query = await this.callQueryEvent();
        return await query.resolver.find(query.model);
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        const query = await this.callQueryEvent();
        return await query.resolver.findOneOrUndefined(query.model);
    }

    public async findOne(): Promise<T> {
        const query = await this.callQueryEvent();
        const item = await query.resolver.findOneOrUndefined(query.model);
        if (!item) throw new ItemNotFound('Item not found');
        return item;
    }

    public async deleteMany(): Promise<DeleteResult<T>> {
        return this.delete(this);
    }

    public async deleteOne(): Promise<DeleteResult<T>> {
        return this.delete(this.limit(1));
    }

    protected async delete(query: this): Promise<DeleteResult<T>> {
        const hasEvents = this.databaseSession.queryEmitter.onDeletePre.hasSubscriptions() || this.databaseSession.queryEmitter.onDeletePost.hasSubscriptions();

        const deleteResult: DeleteResult<T> = {
            modified: 0,
            primaryKeys: []
        };

        if (!hasEvents) {
            await this.resolver.delete(query.model, deleteResult);
            this.databaseSession.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);
            return deleteResult;
        }
        const event = new QueryDatabaseDeleteEvent<any>(this.databaseSession, this.classSchema, query, deleteResult);

        if (this.databaseSession.queryEmitter.onDeletePre.hasSubscriptions()) {
            await this.databaseSession.queryEmitter.onDeletePre.emit(event);
            if (event.stopped) return deleteResult;
        }

        //whe need to use event.query in case someone overwrite it
        await event.query.resolver.delete(event.query.model, deleteResult);
        this.databaseSession.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);

        if (deleteResult.primaryKeys.length && this.databaseSession.queryEmitter.onDeletePost.hasSubscriptions()) {
            await this.databaseSession.queryEmitter.onDeletePost.emit(event);
            if (event.stopped) return deleteResult;
        }

        return deleteResult;
    }

    public async patchMany(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
        return this.patch(this, patch);
    }

    public async patchOne(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
        return this.patch(this.limit(1), patch);
    }

    protected async patch(query: this, patch: Partial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
        const changes: Changes<T> = new Changes<T>({
            $set: (patch as Changes<T>).$set || {},
            $inc: (patch as Changes<T>).$inc,
            $unset: (patch as Changes<T>).$unset,
        });

        for (const property of this.classSchema.getClassProperties().values()) {
            if (property.name in patch) {
                changes.set(property.name as any, (patch as any)[property.name]);
            }
        }

        const patchResult: PatchResult<T> = {
            modified: 0,
            returning: {},
            primaryKeys: []
        };

        const hasEvents = this.databaseSession.queryEmitter.onPatchPre.hasSubscriptions() || this.databaseSession.queryEmitter.onPatchPost.hasSubscriptions();
        if (!hasEvents) {
            await this.resolver.patch(query.model, changes, patchResult);
            return patchResult;
        }

        const event = new QueryDatabasePatchEvent<T>(this.databaseSession, this.classSchema, query, changes, patchResult);
        if (this.databaseSession.queryEmitter.onPatchPre.hasSubscriptions()) {
            await this.databaseSession.queryEmitter.onPatchPre.emit(event);
            if (event.stopped) return patchResult;
        }

        for (const field of event.returning) {
            if (!event.query.model.returning.includes(field)) event.query.model.returning.push(field);
        }
        event.query.model.returning.push(...event.returning);

        //whe need to use event.query in case someone overwrite it
        await event.query.resolver.patch(event.query.model, changes, patchResult);

        const pkHashGenerator = getSimplePrimaryKeyHashGenerator(this.classSchema);
        for (let i = 0; i < patchResult.primaryKeys.length; i++) {
            const item = this.databaseSession.identityMap.getByHash(this.classSchema, pkHashGenerator(patchResult.primaryKeys[i]));
            if (!item) continue;

            if (changes.$set) for (const name in changes.$set) {
                (item as any)[name] = (changes.$set as any)[name];
            }

            for (const name in patchResult.returning) {
                (item as any)[name] = (patchResult.returning as any)[name][i];
            }
        }

        if (this.databaseSession.queryEmitter.onPatchPost.hasSubscriptions()) {
            await this.databaseSession.queryEmitter.onPatchPost.emit(event);
            if (event.stopped) return patchResult;
        }

        return patchResult;
    }

    public async has(): Promise<boolean> {
        return await this.count() > 0;
    }

    public async ids(singleKey?: false): Promise<PrimaryKeyFields<T>[]>;
    public async ids(singleKey: true): Promise<ExtractPrimaryKeyType<T>[]>;
    public async ids(singleKey: boolean = false): Promise<PrimaryKeyFields<T>[] | ExtractPrimaryKeyType<T>[]> {
        const pks = this.classSchema.getPrimaryFields().map(v => v.name) as FieldName<T>[];
        if (singleKey && pks.length > 1) {
            throw new Error(`Entity ${this.classSchema.getClassName()} has more than one primary key. singleKey impossible.`);
        }

        if (singleKey) {
            return (await this.clone().select(pks).find()).map(v => v[pks[0]]) as any;
        }

        return await this.clone().select(pks).find() as any;
    }

    public async findField<K extends FieldName<T>>(name: K): Promise<T[K][]> {
        const items = await this.select(name).find();
        return items.map(v => v[name]);
    }

    public async findOneField<K extends FieldName<T>>(name: K): Promise<T[K]> {
        const item = await this.select(name).findOne();
        return item[name];
    }

    public async findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
        const item = await this.select(name).findOneOrUndefined();
        if (item) return item[name];
        return;
    }
}

export class JoinDatabaseQuery<T extends Entity, PARENT extends BaseQuery<any>> extends BaseQuery<T> {
    constructor(
        public readonly foreignClassSchema: ClassSchema,
        public parentQuery?: PARENT,
        public field?: string,
    ) {
        super(foreignClassSchema);
    }

    clone(parentQuery?: PARENT): this {
        const c = super.clone();
        c.parentQuery = parentQuery || this.parentQuery;
        c.field = this.field;
        return c;
    }

    end(): PARENT {
        if (!this.parentQuery) throw new Error('Join has no parent query');
        if (!this.field) throw new Error('Join has no field');
        //the parentQuery has not the updated JoinDatabaseQuery stuff, we need to move it now to there
        this.parentQuery.getJoin(this.field).model = this.model;
        return this.parentQuery;
    }
}
