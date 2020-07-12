import {ClassSchema, PropertySchema} from "@super-hornet/marshal";
import {Subject} from "rxjs";
import {ClassType} from "@super-hornet/core";
import {FieldName, FlattenIfArray} from './utils';

export type SORT_ORDER = 'asc' | 'desc' | any;
export type Sort<T extends Entity, ORDER extends SORT_ORDER = SORT_ORDER> = { [P in keyof T]?: ORDER };

export class DatabaseQueryModel<T extends Entity, FILTER extends Partial<Entity>, SORT extends Sort<Entity>> {
    public withEntityTracking: boolean = true;
    public filter?: FILTER;
    public select: Set<string> = new Set<string>();
    public joins: {
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
    }[] = [];
    public skip?: number;
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT;
    public readonly change = new Subject<void>();

    changed() {
        this.change.next();
    }

    clone(parentQuery: BaseQuery<T, any>) {
        const m = new DatabaseQueryModel<T, FILTER, SORT>();
        m.filter = this.filter;
        m.withEntityTracking = this.withEntityTracking;
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

export interface ResolverInterface {
}

export class ItemNotFound extends Error {
}

export abstract class BaseQuery<T extends Entity, MODEL extends DatabaseQueryModel<T, any, any>> {
    public format: 'class' | 'json' | 'raw' = 'class';

    protected constructor(
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
     * Instance pooling/Entity tracking is used to store all created entity instances in a pool.
     * If a query fetches an already known entity instance, the old will be picked.
     * This ensures object instances uniqueness and generally saves CPU circles.
     *
     * This disabled entity tracking, forcing always to create new entity instances.
     */
    disableEntityTracking(): this {
        this.model.withEntityTracking = false;
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

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since  db agnostic consumers are probably
 * coding against this interface via using Database<DatabaseAdapter>.
 */
export abstract class GenericQuery<T extends Entity, MODEL extends DatabaseQueryModel<T, any, any>> extends BaseQuery<T, MODEL> {
    abstract async count(): Promise<number>;

    abstract async find(): Promise<T[]>;

    abstract async findOneOrUndefined(): Promise<T | undefined>;

    public async findOne(): Promise<T> {
        const item = await this.findOneOrUndefined();
        if (!item) throw new ItemNotFound('Item not found');
        return item;
    }

    public abstract async updateMany(value: {}): Promise<number>;

    public async updateOne(value: {}): Promise<boolean> {
        return await this.clone().limit(1).updateMany(value) >= 1;
    }

    public abstract async patchMany(value: {}): Promise<number>;

    public async patchOne(value: {}): Promise<boolean> {
        return await this.clone().limit(1).patchMany(value) >= 1;
    }

    public async has(): Promise<boolean> {
        return await this.count() > 0;
    }

    public async findIds<PK extends any[]>(): Promise<PK> {
        const primaryFields = this.classSchema.getPrimaryFields();
        const names = primaryFields.map(v => v.name) as FieldName<T>[];

        const items = await this.clone().select(...names).find();
        if (names.length > 1) return items as PK;
        return items.map(v => v[names[0]]) as PK;
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
