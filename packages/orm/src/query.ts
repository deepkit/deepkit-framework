/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, empty } from '@deepkit/core';
import {
    assertType,
    Changes,
    ChangesInterface,
    DeepPartial,
    getSimplePrimaryKeyHashGenerator,
    PrimaryKeyFields,
    PrimaryKeyType,
    ReferenceFields,
    ReflectionClass,
    ReflectionKind,
    ReflectionProperty,
    resolveForeignReflectionClass
} from '@deepkit/type';
import { Subject } from 'rxjs';
import { DatabaseAdapter } from './database-adapter.js';
import { DatabaseSession } from './database-session.js';
import { QueryDatabaseDeleteEvent, QueryDatabaseEvent, QueryDatabasePatchEvent } from './event.js';
import { DeleteResult, OrmEntity, PatchResult } from './type.js';
import { FieldName, FlattenIfArray, Replace, Resolve } from './utils.js';
import { FrameCategory } from '@deepkit/stopwatch';
import { EventToken } from '@deepkit/event';

export type SORT_ORDER = 'asc' | 'desc' | any;
export type Sort<T extends OrmEntity, ORDER extends SORT_ORDER = SORT_ORDER> = { [P in keyof T & string]?: ORDER };

export interface DatabaseJoinModel<T extends OrmEntity, PARENT extends BaseQuery<any>> {
    //this is the parent classSchema, the foreign classSchema is stored in `query`
    classSchema: ReflectionClass<T>,
    propertySchema: ReflectionProperty,
    type: 'left' | 'inner' | string,
    populate: boolean,
    //defines the field name under which the database engine populated the results.
    //necessary for the formatter to pick it up, convert and set correctly the real field name
    as?: string,
    query: JoinDatabaseQuery<T, PARENT>,
    foreignPrimaryKey: ReflectionProperty,
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
    $like?: T;
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
    [deepPath: string]: any;
};

type RegExpForString<T> = T extends string ? (RegExp | T) : T;
type MongoAltQuery<T> = T extends Array<infer U> ? (T | RegExpForString<U>) : RegExpForString<T>;
export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

export type FilterQuery<T> = {
    [P in keyof T & string]?: Condition<T[P]>;
} &
    RootQuerySelector<T>;

export class DatabaseQueryModel<T extends OrmEntity, FILTER extends FilterQuery<T> = FilterQuery<T>, SORT extends Sort<T> = Sort<T>> {
    public withIdentityMap: boolean = true;
    public withChangeDetection: boolean = true;
    public filter?: FILTER;
    public having?: FILTER;
    public groupBy: Set<string> = new Set<string>();
    public for?: 'update' | 'share';
    public aggregate = new Map<string, { property: ReflectionProperty, func: string }>();
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
        m.filter = this.filter && { ...this.filter };
        m.having = this.having && { ...this.having };
        m.withIdentityMap = this.withIdentityMap;
        m.select = new Set(this.select);
        m.groupBy = new Set(this.groupBy);
        m.for = this.for;
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
        m.returning = this.returning.slice(0);
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

type FindEntity<T> = FlattenIfArray<NonNullable<T>> extends infer V ? V extends OrmEntity ? V : OrmEntity : OrmEntity;

export interface QueryClassType<T> {
    create(query: BaseQuery<any>): QueryClassType<T>;
}

export class BaseQuery<T extends OrmEntity> {
    //for higher kinded type for selected fields
    _!: () => T;

    protected createModel<T extends OrmEntity>() {
        return new DatabaseQueryModel<T, FilterQuery<T>, Sort<T>>();
    }

    public model: DatabaseQueryModel<T>;

    constructor(
        public readonly classSchema: ReflectionClass<any>,
        model?: DatabaseQueryModel<T>
    ) {
        this.model = model || this.createModel<T>();
    }

    /**
     * For MySQL/Postgres SELECT FOR SHARE.
     * Has no effect in SQLite/MongoDB.
     */
    forShare(): this {
        const c = this.clone();
        c.model.for = 'share';
        return c as any;
    }

    /**
     * For MySQL/Postgres SELECT FOR UPDATE.
     * Has no effect in SQLite/MongoDB.
     */
    forUpdate(): this {
        const c = this.clone();
        c.model.for = 'update';
        return c as any;
    }

    groupBy<K extends FieldName<T>[]>(...field: K): this {
        const c = this.clone();
        c.model.groupBy = new Set([...field as string[]]);
        return c as any;
    }

    withSum<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'sum', as) as any;
    }

    withGroupConcat<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [C in [AS] as `${AS}`]: T[K][] }> {
        return this.aggregateField(field, 'group_concat', as);
    }

    withCount<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'count', as) as any;
    }

    withMax<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'max', as) as any;
    }

    withMin<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'min', as) as any;
    }

    withAverage<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'avg', as) as any;
    }

    aggregateField<K extends FieldName<T>, AS extends string>(field: K, func: string, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        const c = this.clone();
        (as as any) ||= field;
        c.model.aggregate.set((as as any), { property: this.classSchema.getProperty(field), func });
        return c as any;
    }

    select<K extends (keyof Resolve<this>)[]>(...select: K): Replace<this, Pick<Resolve<this>, K[number]>> {
        const c = this.clone();
        for (const field of select) {
            if (!this.classSchema.hasProperty(field)) throw new Error(`Field ${String(field)} unknown`);
        }
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
     *
     * For queries created on the database object (database.query(T)), this is disabled
     * per default. Only on sessions (const session = database.createSession(); session.query(T))
     * is the identity map enabled per default, and can be disabled with this method.
     */
    disableIdentityMap(): this {
        const c = this.clone();
        c.model.withIdentityMap = false;
        return c;
    }

    /**
     * When fetching objects from the database, for each object will a snapshot be generated,
     * on which change-detection happens. This behavior is not necessary when only fetching
     * data and never modifying its objects (when for example returning data to the client directly).
     * When this is the case, you can disable change-detection entirely for the returned objects.
     * Note: Persisting/committing (database.persist(), session.commit) won't detect any changes
     * when change-detection is disabled.
     */
    disableChangeDetection(): this {
        const c = this.clone();
        c.model.withChangeDetection = false;
        return c;
    }

    having(filter?: this['model']['filter']): this {
        const c = this.clone();
        c.model.having = filter;
        return c;
    }

    /**
     * Narrow the query result.
     *
     * Note: previous filter conditions are preserved.
     */
    filter(filter?: this['model']['filter']): this {
        const c = this.clone();

        if (filter && !Object.keys(filter as object).length) filter = undefined;
        if (filter instanceof this.classSchema.getClassType()) {
            const primaryKey = this.classSchema.getPrimary();
            filter = { [primaryKey.name]: (filter as any)[primaryKey.name] } as this['model']['filter'];
        }
        if (filter && c.model.filter) {
            filter = { $and: [filter, c.model.filter] } as this['model']['filter'];
        }

        c.model.filter = filter;
        return c;
    }

    /**
     * Narrow the query result by field-specific conditions.
     *
     * This can be helpful to work around the type issue that when `T` is another
     * generic type there must be a type assertion to use {@link filter}.
     *
     * Note: previous filter conditions are preserved.
     */
    filterField<K extends keyof T & string>(name: K, value: FilterQuery<T>[K]): this {
        return this.filter({ [name]: value } as any);
    }

    /**
     * Clear all filter conditions.
     */
    clearFilter(): this {
        const c = this.clone();
        c.model.filter = undefined;
        return c;
    }

    sort(sort?: this['model']['sort']): this {
        const c = this.clone();
        c.model.sort = {};
        for (const [key, value] of Object.entries(sort || {})) {
            this.applyOrderBy(c.model, key as FieldName<T>, value as 'asc' | 'desc');
        }
        return c;
    }

    protected applyOrderBy<K extends FieldName<T>>(model: this['model'], field: K, direction: 'asc' | 'desc' = 'asc'): void {
        if (!model.sort) model.sort = {};
        if (field.includes('.')) {
            const [relation, fieldName] = field.split(/\.(.*)/s);
            const property = this.classSchema.getProperty(relation);
            if (property.isReference() || property.isBackReference()) {
                let found = false;
                for (const join of model.joins) {
                    if (join.propertySchema === property) {
                        //join found
                        join.query = join.query.orderBy(fieldName, direction);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new Error(`Cannot order by ${field} because the relation '${relation}' is not joined. Use join('${relation}'), useJoin('${relation}'), or joinWith('${relation}') etc first.`);
                }
            } else {
                model.sort[field] = direction;
            }
        } else {
            model.sort[field] = direction;
        }
    }

    orderBy<K extends FieldName<T>>(field: K, direction: 'asc' | 'desc' = 'asc'): this {
        const c = this.clone();
        this.applyOrderBy(c.model, field, direction);
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
    join<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K, type: 'left' | 'inner' = 'left', populate: boolean = false): this {
        const propertySchema = this.classSchema.getProperty(field as string);
        if (!propertySchema.isReference() && !propertySchema.isBackReference()) {
            throw new Error(`Field ${String(field)} is not marked as reference. Use @t.reference()`);
        }
        const c = this.clone();

        const foreignReflectionClass = resolveForeignReflectionClass(propertySchema);
        const query = new JoinDatabaseQuery<ENTITY, this>(foreignReflectionClass, c, field as string);
        query.model.parameters = c.model.parameters;

        c.model.joins.push({
            propertySchema, query, populate, type,
            foreignPrimaryKey: foreignReflectionClass.getPrimary(),
            classSchema: this.classSchema,
        });
        return c;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoin<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'left');
        return c.model.joins[c.model.joins.length - 1].query;
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     */
    joinWith<K extends keyof ReferenceFields<T>>(field: K): this {
        return this.join(field, 'left', true);
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoinWith<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'left', true);
        return c.model.joins[c.model.joins.length - 1].query;
    }

    getJoin<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        for (const join of this.model.joins) {
            if (join.propertySchema.name === field) return join.query;
        }
        throw new Error(`No join fo reference ${String(field)} added.`);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     */
    innerJoinWith<K extends keyof ReferenceFields<T>>(field: K): this {
        return this.join(field, 'inner', true);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoinWith<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'inner', true);
        return c.model.joins[c.model.joins.length - 1].query;
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    innerJoin<K extends keyof ReferenceFields<T>>(field: K): this {
        return this.join(field, 'inner');
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoin<K extends keyof ReferenceFields<T>, ENTITY extends OrmEntity = FindEntity<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        const c = this.join(field, 'inner');
        return c.model.joins[c.model.joins.length - 1].query;
    }
}

export abstract class GenericQueryResolver<T extends object, ADAPTER extends DatabaseAdapter = DatabaseAdapter, MODEL extends DatabaseQueryModel<T> = DatabaseQueryModel<T>> {
    constructor(
        protected classSchema: ReflectionClass<T>,
        protected session: DatabaseSession<ADAPTER>,
    ) {
    }

    abstract count(model: MODEL): Promise<number>;

    abstract find(model: MODEL): Promise<T[]>;

    abstract findOneOrUndefined(model: MODEL): Promise<T | undefined>;

    abstract delete(model: MODEL, deleteResult: DeleteResult<T>): Promise<void>;

    abstract patch(model: MODEL, value: Changes<T>, patchResult: PatchResult<T>): Promise<void>;
}

export type Methods<T> = { [K in keyof T]: K extends keyof Query<any> ? never : T[K] extends ((...args: any[]) => any) ? K : never }[keyof T];

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since db agnostic consumers are probably
 * coded against this interface via Database<DatabaseAdapter> which uses this GenericQuery.
 */
export class Query<T extends OrmEntity> extends BaseQuery<T> {
    protected lifts: ClassType[] = [];

    public static readonly onFetch: EventToken<QueryDatabaseEvent<any>> = new EventToken('orm.query.fetch');

    public static readonly onDeletePre: EventToken<QueryDatabaseDeleteEvent<any>> = new EventToken('orm.query.delete.pre');
    public static readonly onDeletePost: EventToken<QueryDatabaseDeleteEvent<any>> = new EventToken('orm.query.delete.post');

    public static readonly onPatchPre: EventToken<QueryDatabasePatchEvent<any>> = new EventToken('orm.query.patch.pre');
    public static readonly onPatchPost: EventToken<QueryDatabasePatchEvent<any>> = new EventToken('orm.query.patch.post');

    static is<T extends ClassType<Query<any>>>(v: Query<any>, type: T): v is InstanceType<T> {
        return v.lifts.includes(type) || v instanceof type;
    }

    constructor(
        classSchema: ReflectionClass<T>,
        protected session: DatabaseSession<any>,
        protected resolver: GenericQueryResolver<T>
    ) {
        super(classSchema);
        this.model.withIdentityMap = session.withIdentityMap;
    }

    static from<Q extends Query<any> & { _: () => T }, T extends ReturnType<InstanceType<B>['_']>, B extends ClassType<Query<any>>>(this: B, query: Q): Replace<InstanceType<B>, Resolve<Q>> {
        const result = (new this(query.classSchema, query.session, query.resolver));
        result.model = query.model.clone(result);
        return result as any;
    }

    public lift<B extends ClassType<Query<any>>, T extends ReturnType<InstanceType<B>['_']>, THIS extends Query<any> & { _: () => T }>(
        this: THIS, query: B
    ): Replace<InstanceType<B>, Resolve<this>> & Pick<this, Methods<this>> {
        const base = this['constructor'] as ClassType;
        //we create a custom class to have our own prototype
        const clazz = class extends base {
        };

        let obj: any = query;
        const wasSet: { [name: string]: true } = {};
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
                });
                wasSet[i] = true;
            }
        } while (obj = Object.getPrototypeOf(obj));

        const cloned = new clazz(this.classSchema, this.session, this.resolver);

        const lift = new query(this.classSchema, this.session, this.resolver, this.model);
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
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.session, this.resolver);
        cloned.model = this.model.clone(cloned) as this['model'];
        cloned.lifts = this.lifts;
        return cloned;
    }

    protected async callOnFetchEvent(query: Query<any>): Promise<this> {
        const hasEvents = this.session.eventDispatcher.hasListeners(Query.onFetch);
        if (!hasEvents) return query as this;

        const event = new QueryDatabaseEvent(this.session, this.classSchema, query);
        await this.session.eventDispatcher.dispatch(Query.onFetch, event);
        return event.query as any;
    }

    protected onQueryResolve(query: Query<any>): this {
        if (query.classSchema.singleTableInheritance && query.classSchema.parent) {
            const discriminant = query.classSchema.parent.getSingleTableInheritanceDiscriminantName();
            const property = query.classSchema.getProperty(discriminant);
            assertType(property.type, ReflectionKind.literal);
            return query.filterField(discriminant as keyof T & string, property.type.literal) as this;
        }
        return query as this;
    }

    public async count(fromHas: boolean = false): Promise<number> {
        if (!this.session.stopwatch) {
            const query = this.onQueryResolve(await this.callOnFetchEvent(this));
            return await query.resolver.count(query.model);
        }

        const frame = this.session.stopwatch.start((fromHas ? 'Has:' : 'Count:') + this.classSchema.getClassName(), FrameCategory.database);
        try {
            frame.data({ collection: this.classSchema.getCollectionName(), className: this.classSchema.getClassName() });
            const eventFrame = this.session.stopwatch.start('Events');
            const query = this.onQueryResolve(await this.callOnFetchEvent(this));
            eventFrame.end();
            return await query.resolver.count(query.model);
        } finally {
            frame.end();
        }
    }

    public async find(): Promise<Resolve<this>[]> {
        if (!this.session.stopwatch) {
            const query = this.onQueryResolve(await this.callOnFetchEvent(this));
            return await query.resolver.find(query.model) as Resolve<this>[];
        }

        const frame = this.session.stopwatch.start('Find:' + this.classSchema.getClassName(), FrameCategory.database);
        try {
            frame.data({ collection: this.classSchema.getCollectionName(), className: this.classSchema.getClassName() });
            const eventFrame = this.session.stopwatch.start('Events');
            const query = this.onQueryResolve(await this.callOnFetchEvent(this));
            eventFrame.end();
            return await query.resolver.find(query.model) as Resolve<this>[];
        } finally {
            frame.end();
        }
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        if (!this.session.stopwatch) {
            const query = this.onQueryResolve(await this.callOnFetchEvent(this.limit(1)));
            return await query.resolver.findOneOrUndefined(query.model);
        }

        const frame = this.session.stopwatch.start('FindOne:' + this.classSchema.getClassName(), FrameCategory.database);
        try {
            frame.data({ collection: this.classSchema.getCollectionName(), className: this.classSchema.getClassName() });
            const eventFrame = this.session.stopwatch.start('Events');
            const query = this.onQueryResolve(await this.callOnFetchEvent(this.limit(1)));
            eventFrame.end();
            return await query.resolver.findOneOrUndefined(query.model);
        } finally {
            frame.end();
        }
    }

    public async findOne(): Promise<Resolve<this>> {
        const item = await this.findOneOrUndefined();
        if (!item) throw new ItemNotFound(`Item ${this.classSchema.getClassName()} not found`);
        return item as Resolve<this>;
    }

    public async deleteMany(): Promise<DeleteResult<T>> {
        return await this.delete(this) as any;
    }

    public async deleteOne(): Promise<DeleteResult<T>> {
        return await this.delete(this.limit(1));
    }

    protected async delete(query: Query<any>): Promise<DeleteResult<T>> {
        const hasEvents = this.session.eventDispatcher.hasListeners(Query.onDeletePre) || this.session.eventDispatcher.hasListeners(Query.onDeletePost);

        const deleteResult: DeleteResult<T> = {
            modified: 0,
            primaryKeys: []
        };

        const frame = this.session.stopwatch ? this.session.stopwatch.start('Delete:' + this.classSchema.getClassName(), FrameCategory.database) : undefined;
        if (frame) frame.data({ collection: this.classSchema.getCollectionName(), className: this.classSchema.getClassName() });

        try {
            if (!hasEvents) {
                query = this.onQueryResolve(query);
                await this.resolver.delete(query.model, deleteResult);
                this.session.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);
                return deleteResult;
            }

            const event = new QueryDatabaseDeleteEvent<T>(this.session, this.classSchema, query, deleteResult);

            if (this.session.eventDispatcher.hasListeners(Query.onDeletePre)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events') : undefined;
                await this.session.eventDispatcher.dispatch(Query.onDeletePre, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return deleteResult;
            }

            //we need to use event.query in case someone overwrite it
            event.query = this.onQueryResolve(event.query as this);
            await event.query.resolver.delete(event.query.model, deleteResult);
            this.session.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);

            if (deleteResult.primaryKeys.length && this.session.eventDispatcher.hasListeners(Query.onDeletePost)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events Post') : undefined;
                await this.session.eventDispatcher.dispatch(Query.onDeletePost, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return deleteResult;
            }

            return deleteResult;
        } finally {
            if (frame) frame.end();
        }
    }

    public async patchMany(patch: ChangesInterface<T> | DeepPartial<T>): Promise<PatchResult<T>> {
        return await this.patch(this, patch);
    }

    public async patchOne(patch: ChangesInterface<T> | DeepPartial<T>): Promise<PatchResult<T>> {
        return await this.patch(this.limit(1), patch);
    }

    protected async patch(query: Query<any>, patch: DeepPartial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
        const frame = this.session.stopwatch ? this.session.stopwatch.start('Patch:' + this.classSchema.getClassName(), FrameCategory.database) : undefined;
        if (frame) frame.data({ collection: this.classSchema.getCollectionName(), className: this.classSchema.getClassName() });

        try {
            const changes: Changes<T> = patch instanceof Changes ? patch as Changes<T> : new Changes<T>({
                $set: patch.$set || {},
                $inc: patch.$inc || {},
                $unset: patch.$unset || {},
            });

            for (const i in patch) {
                if (i.startsWith('$')) continue;
                changes.set(i as any, (patch as any)[i]);
            }

            const patchResult: PatchResult<T> = {
                modified: 0,
                returning: {},
                primaryKeys: []
            };

            if (changes.empty) return patchResult;

            const hasEvents = this.session.eventDispatcher.hasListeners(Query.onPatchPre) || this.session.eventDispatcher.hasListeners(Query.onPatchPost);
            if (!hasEvents) {
                query = this.onQueryResolve(query);
                await this.resolver.patch(query.model, changes, patchResult);
                return patchResult;
            }

            const event = new QueryDatabasePatchEvent<T>(this.session, this.classSchema, query, changes, patchResult);
            if (this.session.eventDispatcher.hasListeners(Query.onPatchPre)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events') : undefined;
                await this.session.eventDispatcher.dispatch(Query.onPatchPre, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return patchResult;
            }

            for (const field of event.returning) {
                if (!event.query.model.returning.includes(field)) event.query.model.returning.push(field);
            }

            //whe need to use event.query in case someone overwrite it
            query = this.onQueryResolve(query);
            await event.query.resolver.patch(event.query.model, changes, patchResult);

            if (query.model.withIdentityMap) {
                const pkHashGenerator = getSimplePrimaryKeyHashGenerator(this.classSchema);
                for (let i = 0; i < patchResult.primaryKeys.length; i++) {
                    const item = this.session.identityMap.getByHash(this.classSchema, pkHashGenerator(patchResult.primaryKeys[i]));
                    if (!item) continue;

                    if (changes.$set) for (const name in changes.$set) {
                        (item as any)[name] = (changes.$set as any)[name];
                    }

                    for (const name in patchResult.returning) {
                        (item as any)[name] = (patchResult.returning as any)[name][i];
                    }
                }
            }

            if (this.session.eventDispatcher.hasListeners(Query.onPatchPost)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events Post') : undefined;
                await this.session.eventDispatcher.dispatch(Query.onPatchPost, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return patchResult;
            }

            return patchResult;
        } finally {
            if (frame) frame.end();
        }
    }

    public async has(): Promise<boolean> {
        return await this.count(true) > 0;
    }

    public async ids(singleKey?: false): Promise<PrimaryKeyFields<T>[]>;
    public async ids(singleKey: true): Promise<PrimaryKeyType<T>[]>;
    public async ids(singleKey: boolean = false): Promise<PrimaryKeyFields<T>[] | PrimaryKeyType<T>[]> {
        const pks: any = this.classSchema.getPrimaries().map(v => v.name) as FieldName<T>[];
        if (singleKey && pks.length > 1) {
            throw new Error(`Entity ${this.classSchema.getClassName()} has more than one primary key`);
        }

        const data = await this.clone().select(...pks).find() as Resolve<this>[];
        if (singleKey) {
            const pkName = pks[0] as keyof Resolve<this>;
            return data.map(v => v[pkName]) as any;
        }

        return data;
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

export class JoinDatabaseQuery<T extends OrmEntity, PARENT extends BaseQuery<any>> extends BaseQuery<T> {
    constructor(
        public readonly foreignClassSchema: ReflectionClass<T>,
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
