import {ClassSchema, PropertySchema} from '@deepkit/type';
import {Subject} from 'rxjs';
import {ClassType} from '@deepkit/core';
import {FieldName, FlattenIfArray} from './utils';
import {PrimaryKeyFields} from './identity-map';
import {DatabaseSession} from './database-session';
import {DatabaseAdapter} from './database';
import {QueryDatabaseDeleteEvent, QueryDatabasePatchEvent} from './event';
import {Changes, ChangesInterface} from './changes';
import {DeleteResult, Entity, PatchResult} from './type';
import {getSimplePrimaryKeyHashGenerator} from './converter';

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
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT;
    public readonly change = new Subject<void>();

    changed() {
        this.change.next();
    }

    clone(parentQuery?: BaseQuery<T>): DatabaseQueryModel<T, FILTER, SORT> {
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
            };
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

    filter(filter?: this['model']['filter'] | T): this {
        if (filter && !Object.keys(filter as object).length) filter = undefined;

        if (filter instanceof this.classSchema.classType) {
            const primaryKey = this.classSchema.getPrimaryField();
            this.model.filter = {[primaryKey.name]: filter[primaryKey.name as FieldName<T>]} as this['model']['filter'];
        } else {
            this.model.filter = filter;
        }
        this.model.changed();
        return this;
    }

    sort(sort?: this['model']['sort']): this {
        this.model.sort = sort;
        this.model.changed();
        return this;
    }

    clone(): this {
        const cloned = new (this['constructor'] as ClassType<this>)(this.classSchema, this.model);
        cloned.model = this.model.clone(cloned) as this['model'];
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

        const query = new JoinDatabaseQuery<ENTITY, this>(propertySchema.getResolvedClassSchema(), this);

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
    useJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
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
    useJoinWith<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        this.join(field, 'left', true);
        return this.model.joins[this.model.joins.length - 1].query;
    }

    getJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
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
    useInnerJoinWith<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
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
    useInnerJoin<K extends FieldName<T>, ENTITY = FlattenIfArray<T[K]>>(field: K): JoinDatabaseQuery<ENTITY, this> {
        this.join(field, 'inner');
        return this.model.joins[this.model.joins.length - 1].query;
    }
}

export abstract class GenericQueryResolver<T, ADAPTER extends DatabaseAdapter = DatabaseAdapter, MODEL extends DatabaseQueryModel<T> = DatabaseQueryModel<T>> {
    constructor(
        protected classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<ADAPTER>,
    ) {
    }

    abstract async count(model: MODEL): Promise<number>;

    abstract async find(model: MODEL): Promise<T[]>;

    abstract async findOneOrUndefined(model: MODEL): Promise<T | undefined>;

    abstract async delete(model: MODEL, deleteResult: DeleteResult<T>): Promise<void>;

    abstract async patch(model: MODEL, value: Changes<T>, patchResult: PatchResult<T>): Promise<void>;

    abstract async has(model: MODEL): Promise<boolean>;
}

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since db agnostic consumers are probably
 * coded against this interface via Database<DatabaseAdapter> which uses this GenericQuery.
 */
export abstract class GenericQuery<T extends Entity, RESOLVER extends GenericQueryResolver<T, DatabaseAdapter, DatabaseQueryModel<T>> = GenericQueryResolver<T, DatabaseAdapter, DatabaseQueryModel<T>>> extends BaseQuery<T> {
    protected abstract resolver: RESOLVER;

    constructor(classSchema: ClassSchema<T>, protected databaseSession: DatabaseSession<DatabaseAdapter>) {
        super(classSchema);
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

    public async deleteMany(): Promise<DeleteResult<T>> {
        return this.delete(this.model);
    }

    public async deleteOne(): Promise<DeleteResult<T>> {
        const model = this.model.clone();
        model.limit = 1;
        return this.delete(model);
    }

    protected async delete(model: this['model']): Promise<DeleteResult<T>> {
        const hasEvents = this.databaseSession.queryEmitter.onDeletePre.hasSubscriptions() || this.databaseSession.queryEmitter.onDeletePre.hasSubscriptions();

        const deleteResult: DeleteResult<T> = {
            modified: 0,
            primaryKeys: []
        };

        if (!hasEvents) {
            await this.resolver.delete(model, deleteResult);
            this.databaseSession.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);
            return deleteResult;
        }

        if (this.databaseSession.queryEmitter.onDeletePre.hasSubscriptions()) {
            const event = new QueryDatabaseDeleteEvent<any>(this.databaseSession, this.classSchema, deleteResult);
            await this.databaseSession.queryEmitter.onDeletePre.emit(event);
            if (event.stopped) return deleteResult;
        }

        await this.resolver.delete(model, deleteResult);
        this.databaseSession.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);

        if (this.databaseSession.queryEmitter.onDeletePost.hasSubscriptions()) {
            const event = new QueryDatabaseDeleteEvent<any>(this.databaseSession, this.classSchema, deleteResult);
            await this.databaseSession.queryEmitter.onDeletePost.emit(event);
            if (event.stopped) return deleteResult;
        }

        return deleteResult;
    }

    public async patchMany(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
        return this.patch(this.model, patch);
    }

    public async patchOne(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
        const model = this.model.clone();
        model.limit = 1;
        return this.patch(model, patch);
    }

    protected async patch(model: this['model'], patch: Partial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
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
            await this.resolver.patch(model, changes, patchResult);
            return patchResult;
        }

        if (this.databaseSession.queryEmitter.onPatchPre.hasSubscriptions()) {
            const event = new QueryDatabasePatchEvent<any>(this.databaseSession, this.classSchema, changes, patchResult);
            await this.databaseSession.queryEmitter.onPatchPre.emit(event);
            if (event.stopped) return patchResult;
        }

        await this.resolver.patch(model, changes, patchResult);

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
            const event = new QueryDatabasePatchEvent<any>(this.databaseSession, this.classSchema, changes, patchResult);
            await this.databaseSession.queryEmitter.onPatchPost.emit(event);
            if (event.stopped) return patchResult;
        }

        return patchResult;
    }

    public async has(): Promise<boolean> {
        return await this.count() > 0;
    }

    public async ids(singleKey?: false): Promise<PrimaryKeyFields<T>[]>;
    public async ids<T = string>(singleKey: true): Promise<T[]>;
    public async ids(singleKey: boolean = false): Promise<(PrimaryKeyFields<T> | any)[]> {
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

export class JoinDatabaseQuery<T extends Entity, PARENT extends BaseQuery<any>> extends BaseQuery<T> {
    constructor(
        public readonly foreignClassSchema: ClassSchema,
        public readonly parentQuery: PARENT,
    ) {
        super(foreignClassSchema);
        this.model.change.subscribe(parentQuery.model.change);
    }

    clone(parentQuery?: PARENT): this {
        const query: this = new (this['constructor'] as ClassType<this>)(this.foreignClassSchema, parentQuery!);
        query.model = this.model.clone(query);
        return query;
    }

    end(): PARENT {
        return this.parentQuery;
    }
}
