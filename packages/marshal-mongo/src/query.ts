import {ClassSchema, PartialField, PropertySchema} from "@super-hornet/marshal";
import {Subject} from "rxjs";

export type Query<T> = {
    $eq?: T;
    $ne?: T;
    $or?: Array<FilterQuery<T>>;
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $mod?: number[];
    $in?: Array<T>;
    $nin?: Array<T>;
    $not?: FilterQuery<T>;
    $type?: any;
    $all?: Array<Partial<T>>;
    $size?: number;
    $nor?: Array<FilterQuery<T>>;
    $and?: Array<FilterQuery<T>>;
    $regex?: RegExp | string;
    $exists?: boolean;
    $options?: "i" | "g" | "m" | "u";

    //special Marshal type
    $parameter?: string;
};

export type FilterQuery<T> = {
    [P in keyof T]?: Query<T[P]> | T[P];
} | Query<T>;


export type SORT_TYPE = 'asc' | 'desc' | { $meta: "textScore" };
export type SORT<T> = { [P in keyof T]: SORT_TYPE } | { [path: string]: SORT_TYPE };

export type QueryMode =
    'find'
    | 'findField'
    | 'findOne'
    | 'findOneOrUndefined'
    | 'findOneField'
    | 'findOneFieldOrUndefined'
    | 'has'
    | 'count'
    | 'ids'
    | 'updateOne'
    | 'deleteOne'
    | 'deleteMany'
    | 'patchOne'
    | 'patchMany'
    ;

export class DatabaseQueryModel<T> {
    public disableInstancePooling: boolean = false;
    public filter?: { [field: string]: any };
    public select: Set<string> = new Set<string>();
    public joins: {
        //this is the parent classSchema, the foreign classSchema is stored in `query`
        classSchema: ClassSchema<any>,
        propertySchema: PropertySchema,
        type: 'left' | 'inner',
        populate: boolean,
        //defines the field name under which the database engine populated the results
        //necessary for the formatter to pick it up, convert and set correct to the real field name
        as?: string,
        query: JoinDatabaseQuery<any, any>,
        foreignPrimaryKey: PropertySchema,
    }[] = [];
    public skip?: number;
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT<T>;
    public readonly change = new Subject<void>();

    changed() {
        this.change.next();
    }

    clone(parentQuery: BaseQuery<any>) {
        const m = new DatabaseQueryModel<T>();
        m.filter = this.filter;
        m.disableInstancePooling = this.disableInstancePooling;
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

type FlattenIfArray<T> = T extends (infer R)[] ? R : T

export class BaseQuery<T> {
    public format: 'class' | 'json' | 'raw' = 'class';

    /**
     * @internal
     */
    public model: DatabaseQueryModel<T> = new DatabaseQueryModel<T>();

    constructor(public readonly classSchema: ClassSchema<T>) {
    }

    select(...fields: (keyof T)[]): this;
    select(fields: string[] | (keyof T)[]): this;
    select(fields: string[] | (keyof T)[] | keyof T, ...moreFields: (keyof T)[]): this {
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

    sort(sort?: SORT<T>): this {
        this.model.sort = sort;
        this.model.changed();
        return this;
    }

    /**
     * Instace pooling is used to store all created entity instances in a pool.
     * If a query fetches an already known entity instance, the old will be picked.
     * This ensures object instances uniqueness and generally saves CPU circles.
     *
     * This disabled entity tracking, forcing always to create new entity instances.
     */
    disableInstancePooling(): this {
        this.model.disableInstancePooling = true;
        return this;
    }

    filter(filter?: { [field: string]: any } | FilterQuery<T>): this {
        if (filter && !Object.keys(filter).length) filter = undefined;

        this.model.filter = filter;
        this.model.changed();
        return this;
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    join<K extends keyof T>(field: K, type: 'left' | 'inner' = 'left', populate: boolean = false): this {
        const propertySchema = this.classSchema.getProperty(field as string);
        if (!propertySchema.isReference && !propertySchema.backReference) {
            throw new Error(`Field ${field} is not marked as reference. Use $f.reference()`);
        }
        const query = new JoinDatabaseQuery<any, this>(propertySchema.getResolvedClassSchema(), this);
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
    useJoin<K extends keyof T>(field: K): JoinDatabaseQuery<FlattenIfArray<T[K]>, this> {
        this.join(field, 'left');
        return this.model.joins[this.model.joins.length - 1].query;
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     */
    joinWith<K extends keyof T>(field: K): this {
        return this.join(field, 'left', true);
    }

    /**
     * Adds a left join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useJoinWith<K extends keyof T>(field: K): JoinDatabaseQuery<FlattenIfArray<T[K]>, this> {
        this.join(field, 'left', true);
        return this.model.joins[this.model.joins.length - 1].query;
    }

    getJoin<K extends keyof T>(field: K): JoinDatabaseQuery<FlattenIfArray<T[K]>, this> {
        for (const join of this.model.joins) {
            if (join.propertySchema.name === field) return join.query;
        }
        throw new Error(`No join fo reference ${field} added.`);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     */
    innerJoinWith<K extends keyof T>(field: K): this {
        return this.join(field, 'inner', true);
    }

    /**
     * Adds a inner join in the filter and populates the result set WITH reference field accordingly.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoinWith<K extends keyof T>(field: K): JoinDatabaseQuery<FlattenIfArray<T[K]>, this> {
        this.join(field, 'inner', true);
        return this.model.joins[this.model.joins.length - 1].query;
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    innerJoin<K extends keyof T>(field: K): this {
        return this.join(field, 'inner');
    }

    /**
     * Adds a inner join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     * Returns JoinDatabaseQuery to further specify the join, which you need to `.end()`
     */
    useInnerJoin<K extends keyof T>(field: K): JoinDatabaseQuery<FlattenIfArray<T[K]>, this> {
        this.join(field, 'inner');
        return this.model.joins[this.model.joins.length - 1].query;
    }
}

export class JoinDatabaseQuery<T, PARENT extends BaseQuery<any>> extends BaseQuery<T> {
    constructor(
        public readonly foreignClassSchema: ClassSchema,
        public readonly parentQuery: PARENT,
    ) {
        super(foreignClassSchema);
        this.model.change.subscribe(parentQuery.model.change);
    }

    clone(parentQuery: PARENT) {
        const query = new JoinDatabaseQuery<T, PARENT>(this.foreignClassSchema, parentQuery);
        query.model = this.model.clone(query);
        return query;
    }

    end(): PARENT {
        return this.parentQuery;
    }
}

export class DatabaseQuery<T> extends BaseQuery<T> {
    constructor(
        classSchema: ClassSchema<T>,
        protected readonly fetcher: (mode: QueryMode, query: DatabaseQuery<T>) => Promise<any>,
        protected readonly modifier: (mode: QueryMode, query: DatabaseQuery<T>, arg1?: any) => Promise<any>,
    ) {
        super(classSchema)
    }

    /**
     * Disable data conversion from mongodb value types to class types, and uses JSON representation instead.
     */
    asJSON(): DatabaseQuery<T> {
        this.format = 'json';
        return this;
    }

    /**
     * Disable data conversion from mongodb value types to class types, and keeps raw mongo data types instead.
     */
    asRaw(): DatabaseQuery<T> {
        this.format = 'raw';
        return this;
    }

    /**
     * Creates a copy of DatabaseQuery from current state.
     */
    clone(): DatabaseQuery<T> {
        const query = new DatabaseQuery(this.classSchema, this.fetcher, this.modifier);
        query.format = this.format;
        query.model = this.model.clone(query);
        return query;
    }

    async findOneOrUndefined(): Promise<T | undefined> {
        return await this.fetcher('findOneOrUndefined', this);
    }

    async findOne(): Promise<T> {
        return await this.fetcher('findOne', this);
    }

    async findOneField(fieldName: keyof T | string): Promise<any> {
        this.model.select = new Set([fieldName as string]);
        return await this.fetcher('findOneField', this);
    }

    async findOneFieldOrUndefined(fieldName: keyof T | string): Promise<any | undefined> {
        this.model.select = new Set([fieldName as string]);
        return await this.fetcher('findOneFieldOrUndefined', this);
    }

    async find(): Promise<T[]> {
        return await this.fetcher('find', this);
    }

    async findField(fieldName: keyof T | string): Promise<any[]> {
        this.model.select = new Set([fieldName as string]);
        return await this.fetcher('findField', this);
    }

    async count(): Promise<number> {
        return await this.fetcher('count', this);
    }

    async has(): Promise<boolean> {
        return await this.fetcher('has', this);
    }

    async ids(): Promise<any[]> {
        return await this.fetcher('ids', this);
    }

    async updateOne(item: T): Promise<void> {
        return await this.modifier('updateOne', this, item);
    }

    async deleteOne(): Promise<void> {
        return await this.modifier('deleteOne', this);
    }

    async deleteMany(): Promise<void> {
        return await this.modifier('deleteMany', this);
    }

    async patchOne(patch: PartialField<T>): Promise<void> {
        return await this.modifier('patchOne', this, patch);
    }

    async patchMany(patch: PartialField<T>): Promise<void> {
        return await this.modifier('patchMany', this, patch);
    }
}
