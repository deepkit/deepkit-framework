/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, empty } from '@deepkit/core';
import { ClassSchema, ExtractPrimaryKeyType, ExtractReferences, PrimaryKeyFields, PropertySchema } from '@deepkit/type';
import { Subject } from 'rxjs';
import { Changes, ChangesInterface } from './changes';
import { getSimplePrimaryKeyHashGenerator } from './converter';
import { DatabaseAdapter } from './database';
import { DatabaseSession } from './database-session';
import { QueryDatabaseDeleteEvent, QueryDatabaseEvent, QueryDatabasePatchEvent } from './event';
import { DeleteResult, Entity, PatchResult } from './type';
import { FieldName, FlattenIfArray, Replace, Resolve } from './utils';

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

export class DatabaseQueryModel<T extends Entity, FILTER extends FilterQuery<T> = FilterQuery<T>, SORT extends Sort<T> = Sort<T>> {
    public withIdentityMap: boolean = true;
    public filter?: FILTER;
    public having?: FILTER;
    public groupBy: Set<string> = new Set<string>();
    public aggregate = new Map<string, {property: PropertySchema, func: string}>();
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

    setParameters(parameters: { [name: string]: any }) {
        for (const [i, v] of Object.entries(parameters)) {
            this.parameters[i] = v;
        }
    }

    clone(parentQuery: BaseQuery<T>): this {
        const constructor = this.constructor as ClassType<this>;
        const m = new constructor();
        m.filter = this.filter && {...this.filter};
        m.having = this.having && {...this.having};
        m.withIdentityMap = this.withIdentityMap;
        m.select = new Set(this.select);
        m.groupBy = new Set(this.groupBy);
        m.aggregate = new Map(this.aggregate);
        m.parameters = { ...this.parameters };

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

        for (const join of m.joins) {
            join.query.model.parameters = m.parameters;
        }

        m.skip = this.skip;
        m.limit = this.limit;
        m.itemsPerPage = this.itemsPerPage;
        m.sort = this.sort ? { ...this.sort } : undefined;

        return m;
    }

    /**
     * Whether only a subset of fields are selected.
     */
    isPartial() {
        return this.select.size > 0 || this.groupBy.size > 0 || this.aggregate.size > 0;
    }

    /**
     * Whether only a subset of fields are selected.
     */
    isAggregate() {
        return this.groupBy.size > 0 || this.aggregate.size > 0;
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
    //for higher kinded type
    _!: () => T;

    protected createModel<T>() {
        return new DatabaseQueryModel<T, FilterQuery<T>, Sort<T>>();
    }

    public model: DatabaseQueryModel<T>;

    constructor(
        public readonly classSchema: ClassSchema,
        model?: DatabaseQueryModel<T>
    ) {
        this.model = model || this.createModel<T>();
    }

    groupBy<K extends FieldName<T>[]>(...field: K): this {
        const c = this.clone();
        c.model.groupBy = new Set([...field as string[]]);
        return c as any;
    }

    withSum<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'sum', as);
    }

    withGroupConcat<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'group_concat', as);
    }

    withCount<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'count', as);
    }

    withMax<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'max', as);
    }

    withMin<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'min', as);
    }

    withAverage<K extends FieldName<T>>(field: K, as?: string): this {
        return this.aggregateField(field, 'avg', as);
    }

    aggregateField<K extends FieldName<T>>(field: K, func: string, as?: string): this {
        const c = this.clone();
        as ||= field;
        c.model.aggregate.set(as, {property: this.classSchema.getProperty(field), func});
        return c as any;
    }

    select<K extends (keyof Resolve<this>)[]>(...select: K): Replace<this, Pick<Resolve<this>, K[number]>> {
        const c = this.clone();
        c.model.select = new Set([...select as string[]]);
        return c as any;
    }

    returning(...fields: FieldName<T>[]): this {
        const c = this.clone();
        c.model.returning.push(...fields);
        return c;
    }

    skip(value?: number): this {
        const c = this.clone();
        c.model.skip = value;
        return c;
    }

    /** 
     * Sets the page size when `page(x)` is used.
    */
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

    having(filter?: this['model']['filter']): this {
        const c = this.clone();
        c.model.having = filter;
        return c;
    }

    filter(filter?: this['model']['filter'] | T): this {
        const c = this.clone();
        if (filter && !Object.keys(filter as object).length) filter = undefined;

        if (filter instanceof this.classSchema.classType) {
            const primaryKey = this.classSchema.getPrimaryField();
            c.model.filter = { [primaryKey.name]: (filter as any)[primaryKey.name] } as this['model']['filter'];
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

    orderBy<K extends FieldName<T>>(field: K, direction: 'asc' | 'desc' = 'asc'): this {
        const c = this.clone();
        if (!c.model.sort) c.model.sort = {};
        c.model.sort[field] = direction;
        return c;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema);
        cloned.model = this.model.clone(cloned) as this['model'];
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

export type Methods<T> = { [K in keyof T]: K extends keyof Query<any> ? never : T[K] extends ((...args: any[]) => any) ? K : never }[keyof T];

// This can live anywhere in your codebase:
function applyMixins(derivedCtor: any, constructors: any[]) {
    constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            Object.defineProperty(
                derivedCtor.prototype,
                name,
                Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
                Object.create(null)
            );
        });
    });
}

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since db agnostic consumers are probably
 * coded against this interface via Database<DatabaseAdapter> which uses this GenericQuery.
 */
export class Query<T extends Entity> extends BaseQuery<T> {
    protected lifts: ClassType[] = [];

    static is<T extends ClassType<Query<any>>>(v: Query<any>, type: T): v is InstanceType<T> {
        return v.lifts.includes(type) || v instanceof type;
    }

    constructor(
        classSchema: ClassSchema,
        protected databaseSession: DatabaseSession<DatabaseAdapter>,
        protected resolver: GenericQueryResolver<T>
    ) {
        super(classSchema);
        this.model.withIdentityMap = databaseSession.withIdentityMap;
    }

    static from<Q extends Query<any> & { _: () => T }, T extends ReturnType<InstanceType<B>['_']>, B extends ClassType<Query<any>>>(this: B, query: Q): Replace<InstanceType<B>, Resolve<Q>> {
        const result = (new this(query.classSchema, query.databaseSession, query.resolver));
        result.model = query.model.clone(result);
        return result as any;
    }

    public lift<B extends ClassType<Query<any>>, T extends ReturnType<InstanceType<B>['_']>, THIS extends Query<any> & { _: () => T }>(
        this: THIS, query: B
    ): Replace<InstanceType<B>, Resolve<this>> & Pick<this, Methods<this>> {
        const base = this['constructor'] as ClassType;
        //we create a custom class to have our own prototype
        const clazz = class extends base { };

        let obj: any = query;
        const wasSet: { [name: string]: true } = {}
        const lifts: any[] = [];
        do {
            if (obj === Query) break;
            lifts.push(obj);

            for (const i of Object.getOwnPropertyNames(obj.prototype)) {
                if (i === 'constructor') continue;
                if (wasSet[i]) continue;
                Object.defineProperty(clazz.prototype, i, {
                    configurable: true,
                    writable: true,
                    value: obj.prototype[i],
                })
                wasSet[i] = true;
            }
        } while (obj = Object.getPrototypeOf(obj));

        const cloned = new clazz(this.classSchema, this.databaseSession, this.resolver);

        const lift = new query(this.classSchema, this.databaseSession, this.resolver, this.model);
        for (const i in this) {
            (cloned)[i] = (this as any)[i];
        }
        for (const i in lift) {
            (cloned)[i] = (lift as any)[i];
        }
        cloned.model = this.model.clone(cloned as BaseQuery<any>);
        cloned.lifts = this.lifts;
        cloned.lifts.push(...lifts);

        return cloned as any;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.databaseSession, this.resolver);
        cloned.model = this.model.clone(cloned) as this['model'];
        cloned.lifts = this.lifts;
        return cloned;
    }

    protected async callQueryEvent(): Promise<this> {
        const hasEvents = this.databaseSession.queryEmitter.onFetch.hasSubscriptions();
        if (!hasEvents) return this;

        const event = new QueryDatabaseEvent(this.databaseSession, this.classSchema, this);
        await this.databaseSession.queryEmitter.onFetch.emit(event);
        return event.query as any;
    }

    public async count(): Promise<number> {
        const query = await this.callQueryEvent();
        return await query.resolver.count(query.model);
    }

    public async find(): Promise<Resolve<this>[]> {
        const query = await this.callQueryEvent();
        return await query.resolver.find(query.model) as Resolve<this>[];
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        const query = await this.callQueryEvent();
        return await query.resolver.findOneOrUndefined(query.model);
    }

    public async findOne(): Promise<Resolve<this>> {
        const query = await this.callQueryEvent();
        const item = await query.resolver.findOneOrUndefined(query.model);
        if (!item) throw new ItemNotFound(`Item ${this.classSchema.getClassName()} not found`);
        return item as Resolve<this>;
    }

    public async deleteMany(): Promise<DeleteResult<T>> {
        return this.delete(this) as any;
    }

    public async deleteOne(): Promise<DeleteResult<T>> {
        return this.delete(this.limit(1));
    }

    protected async delete(query: Query<T>): Promise<DeleteResult<T>> {
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

    protected async patch(query: Query<T>, patch: Partial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
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

        //whe need to use event.query in case someone overwrite it
        await event.query.resolver.patch(event.query.model, changes, patchResult);

        if (query.model.withIdentityMap) {
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
        const pks: any = this.classSchema.getPrimaryFields().map(v => v.name) as FieldName<T>[];
        if (singleKey && pks.length > 1) {
            throw new Error(`Entity ${this.classSchema.getClassName()} has more than one primary key`);
        }

        if (singleKey) {
            const pkName = pks[0] as keyof Resolve<this>;
            return (await this.clone().select(...pks).find() as Resolve<this>[]).map(v => v[pkName]) as any;
        }

        return await this.clone().select(...pks).find() as any;
    }

    public async findField<K extends FieldName<T>>(name: K): Promise<T[K][]> {
        const items = await this.select(name as keyof Resolve<this>).find() as T[];
        return items.map(v => v[name]);
    }

    public async findOneField<K extends FieldName<T>>(name: K): Promise<T[K]> {
        const item = await this.select(name as keyof Resolve<this>).findOne() as T;
        return item[name];
    }

    public async findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
        const item = await this.select(name as keyof Resolve<this>).findOneOrUndefined();
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
