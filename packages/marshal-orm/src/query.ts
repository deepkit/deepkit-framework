import {ClassSchema, PropertySchema} from '@super-hornet/marshal';
import {Subject} from 'rxjs';
import {ClassType} from '@super-hornet/core';
import {FieldName, FlattenIfArray} from './utils';
import {PrimaryKey} from './identity-map';
import {DatabaseSession} from './database-session';
import {DatabaseAdapter} from './database';

export type SORT_ORDER = 'asc' | 'desc' | any;
export type Sort<T extends Entity, ORDER extends SORT_ORDER = SORT_ORDER> = { [P in keyof T]?: ORDER };

export interface DatabaseJoinModel {
    //this is the parent classSchema, the foreign classSchema is stored in `query`
    classSchema: ClassSchema<any>,
    propertySchema: PropertySchema,
    type: 'left' | 'inner' | string,
    populate: boolean,
    //defines the field name under which the database engine populated the results.
    //necessary for the formatter to pick it up, convert and set correct to the real field name
    as?: string,
    query: JoinDatabaseQuery<any, any, any>,
    foreignPrimaryKey: PropertySchema,
}

export class DatabaseQueryModel<T extends Entity, FILTER extends Partial<Entity>, SORT extends Sort<Entity>> {
    public withIdentityMap: boolean = true;
    public filter?: FILTER;
    public select: Set<string> = new Set<string>();
    public joins: DatabaseJoinModel[] = [];
    public skip?: number;
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT;
    public readonly change = new Subject<void>();

    changed() {
        this.change.next();
    }

    clone(parentQuery?: BaseQuery<T, any>): DatabaseQueryModel<T, FILTER, SORT> {
        const m = new DatabaseQueryModel<T, FILTER, SORT>();
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
            }
        });

        m.skip = this.skip;
        m.limit = this.limit;
        m.parameters = {...this.parameters};
        m.sort = this.sort ? {...this.sort} : undefined;

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
}

export class ItemNotFound extends Error {
}

export class BaseQuery<T extends Entity, MODEL extends DatabaseQueryModel<T, any, any>> {
    public format: 'class' | 'json' | 'raw' = 'class';

    constructor(
        public readonly classSchema: ClassSchema<T>,
        public model: MODEL
    ) {
    }

    select(...fields: FieldName<T>[]): this;
    select(fields: string[] | (FieldName<T>)[]): this;
    select(fields: string[] | FieldName<T>[] | FieldName<T>, ...moreFields: FieldName<T>[]): this {
        if ('string' === typeof fields) {
            this.model.select = new Set([fields as string, ...(moreFields as string[])]);
        } else {
            this.model.select = new Set([...fields as string[], ...(moreFields as string[])]);
        }
        this.model.changed();
        return this;
    }

    skip(value?: number): this {
        this.model.skip = value;
        this.model.changed();
        return this;
    }

    limit(value?: number): this {
        this.model.limit = value;
        this.model.changed();
        return this;
    }

    parameter(name: string, value: any): this {
        this.model.parameters[name] = value;
        this.model.changed();
        return this;
    }

    parameters(parameters: { [name: string]: any }): this {
        this.model.parameters = parameters;
        this.model.changed();
        return this;
    }

    /**
     * Identity mapping is used to store all created entity instances in a pool.
     * If a query fetches an already known entity instance, the old will be picked.
     * This ensures object instances uniqueness and generally saves CPU circles.
     *
     * This disabled entity tracking, forcing always to create new entity instances.
     */
    disableIdentityMap(): this {
        this.model.withIdentityMap = false;
        return this;
    }

    filter(filter?: MODEL['filter']): this {
        if (filter && !Object.keys(filter).length) filter = undefined;

        this.model.filter = filter;
        this.model.changed();
        return this;
    }

    sort(sort?: MODEL['sort']): this {
        this.model.sort = sort;
        this.model.changed();
        return this;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.model);
        cloned.model = this.model.clone(cloned) as MODEL;
        cloned.format = this.format;
        return cloned;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    join<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K, type: 'left' | 'inner' = 'left', populate: boolean = false): this {
        const propertySchema = this.classSchema.getProperty(field as string);
        if (!propertySchema.isReference && !propertySchema.backReference) {
            throw new Error(`Field ${field} is not marked as reference. Use @f.reference()`);
        }

        const model = new DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>();
        const query = new JoinDatabaseQuery<ENTITY, typeof model, this>(propertySchema.getResolvedClassSchema(), model, this);

        this.model.joins.push({
            propertySchema, query, populate, type,
            foreignPrimaryKey: propertySchema.getResolvedClassSchema().getPrimaryField(),
            classSchema: this.classSchema,
        });
        this.model.changed();
        return this;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K):
        JoinDatabaseQuery<ENTITY, DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>, this> {
        this.join(field, 'left');
        return this.model.joins[this.model.joins.length - 1].query;
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     */
    joinWith<K extends FieldName<T>>(field: K): this {
        return this.join(field, 'left', true);
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoinWith<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K):
        JoinDatabaseQuery<ENTITY, DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>, this> {
        this.join(field, 'left', true);
        return this.model.joins[this.model.joins.length - 1].query;
    }

    getJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K):
        JoinDatabaseQuery<ENTITY, DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>, this> {
        for (const join of this.model.joins) {
            if (join.propertySchema.name === field) return join.query;
        }
        throw new Error(`No join fo reference ${field} added.`);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     */
    innerJoinWith<K extends FieldName<T>>(field: K): this {
        return this.join(field, 'inner', true);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoinWith<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K):
        JoinDatabaseQuery<ENTITY, DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>, this> {
        this.join(field, 'inner', true);
        return this.model.joins[this.model.joins.length - 1].query;
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    innerJoin<K extends FieldName<T>>(field: K): this {
        return this.join(field, 'inner');
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K):
        JoinDatabaseQuery<ENTITY, DatabaseQueryModel<ENTITY, Partial<ENTITY>, Sort<ENTITY>>, this> {
        this.join(field, 'inner');
        return this.model.joins[this.model.joins.length - 1].query;
    }
}

export interface Entity {
}

export abstract class GenericQueryResolver<T, ADAPTER extends DatabaseAdapter, MODEL extends DatabaseQueryModel<T, any, any>> {
    constructor(
        protected classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<ADAPTER>,
    ) {
    }

    abstract async count(model: MODEL): Promise<number>;

    abstract async find(model: MODEL): Promise<T[]>;

    abstract async findOneOrUndefined(model: MODEL): Promise<T | undefined>;

    abstract async updateMany(model: MODEL, value: {}): Promise<number>;

    abstract async updateOne(model: MODEL, value: {}): Promise<boolean>;

    abstract async deleteMany(model: MODEL): Promise<number>;

    abstract async deleteOne(model: MODEL): Promise<boolean>;

    abstract async patchMany(model: MODEL, value: { [path: string]: any }): Promise<number>;

    abstract async patchOne(model: MODEL, value: { [path: string]: any }): Promise<boolean>;

    abstract async has(model: MODEL): Promise<boolean>;
    
}

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since  db agnostic consumers are probably
 * coding against this interface via using Database<DatabaseAdapter>.
 */
export class GenericQuery<T extends Entity, MODEL extends DatabaseQueryModel<T, any, any>, RESOLVER extends GenericQueryResolver<T, any, MODEL>> extends BaseQuery<T, MODEL> {
    constructor(classSchema: ClassSchema<T>, model: MODEL, protected resolver: RESOLVER) {
        super(classSchema, model);
    }

    clone(): this {
        const cloned = super.clone() as this;
        cloned.resolver = this.resolver;
        return cloned;
    }

    public async count(): Promise<number> {
        return this.resolver.count(this.model);
    }

    public async find(): Promise<T[]> {
        return this.resolver.find(this.model);
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        return this.resolver.findOneOrUndefined(this.model);
    }

    public async findOne(): Promise<T> {
        const item = await this.resolver.findOneOrUndefined(this.model);
        if (!item) throw new ItemNotFound('Item not found');
        return item;
    }

    public async updateMany(value: {}): Promise<number> {
        return this.resolver.updateMany(this.model, value);
    }

    public async updateOne(value: {}): Promise<boolean> {
        return this.resolver.updateOne(this.model, value);
    }

    public async deleteMany(): Promise<number> {
        return this.resolver.deleteMany(this.model);
    }

    public async deleteOne(): Promise<boolean> {
        return this.resolver.deleteOne(this.model);
    }

    public async patchMany(value: { [path: string]: any }): Promise<number> {
        return this.resolver.patchMany(this.model, value);
    }

    public async patchOne(value: { [path: string]: any }): Promise<boolean> {
        return this.resolver.patchOne(this.model, value);
    }

    public async has(): Promise<boolean> {
        return await this.count() > 0;
    }

    public async ids(singleKey: boolean = false): Promise<PrimaryKey<T>[]> {
        const pks = this.classSchema.getPrimaryFields().map(v => v.name) as FieldName<T>[];
        if (singleKey && pks.length > 1) {
            throw new Error(`Entity ${this.classSchema.getClassName()} has more than one primary key. singleKey impossible.`);
        }

        if (singleKey) {
            return (await this.clone().select(pks).find()).map(v => v[pks[0]]);
        }

        return await this.clone().select(pks).find();
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

export class JoinDatabaseQuery<T extends Entity,
    MODEL extends DatabaseQueryModel<T, any, any>,
    PARENT extends BaseQuery<any, any>> extends BaseQuery<T, MODEL> {
    constructor(
        public readonly foreignClassSchema: ClassSchema,
        public model: MODEL,
        public readonly parentQuery: PARENT,
    ) {
        super(foreignClassSchema, model);
        this.model.change.subscribe(parentQuery.model.change);
    }

    clone(parentQuery?: PARENT): this {
        const query: this = new (this['constructor'] as ClassType<this>)(this.foreignClassSchema, this.model, parentQuery!);
        query.model = this.model.clone(query) as MODEL;
        return query;
    }

    end(): PARENT {
        return this.parentQuery;
    }
}
