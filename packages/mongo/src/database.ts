import {
    ClassSchema,
    getClassSchema,
    getClassTypeFromInstance,
    getCollectionName,
    getDatabaseName,
    getEntityName,
    getIdField,
    MarshalGlobal,
    PartialField,
    PropertySchema,
    resolveClassTypeOrForward
} from '@marcj/marshal';
import {
    classToMongo,
    convertClassQueryToMongo,
    mongoToClass,
    mongoToPlain,
    partialClassToMongo,
    partialMongoToClass,
    partialMongoToPlain,
    propertyClassToMongo,
    propertyMongoToClass
} from "./mapping";
import {Collection, Connection} from 'typeorm';
import {ClassType, eachPair, getClassName} from '@marcj/estdlib';
import {FindOneOptions} from "mongodb";
import {Subject} from "rxjs";
import * as weak from 'weak-napi';

export class NotFoundError extends Error {
}

export class NoIDDefinedError extends Error {
}

type PK = any;
type Store = {
    ref: any,
    stale: boolean
};

export class EntityRegistry {
    registry = new Map<ClassType<any>, Map<PK, Store>>();
    lastKnownPkInDB = new WeakMap<any, PK>();

    public getLastKnownPkInDB<T>(item: T): any {
        const pk = this.lastKnownPkInDB.get(item);
        if (undefined === pk) {
            throw new Error(`No pk known for item of ${getClassName(getClassTypeFromInstance(item))}.`);
        }
        return pk;
    }

    /**
     * This marks all stored entity items as stale.
     * Stale means we don't simply pick the item when user fetched it, but also
     * overwrite its values from the database.
     */
    markAsStale<T>(classSchema: ClassSchema<T>, pks: PK[]) {
        const store = this.getStore(classSchema);
        for (const pk of pks) {
            if (store.has(pk)) {
                store.get(pk)!.stale = true;
            }
        }
    }

    markAsFresh(classSchema: ClassSchema, pk: PK) {
        const store = this.getStore(classSchema);
        store.get(pk)!.stale = false;
    }

    isStale(classSchema: ClassSchema, pk: PK): boolean {
        const store = this.getStore(classSchema);
        return store.get(pk)!.stale;
    }

    deleteMany<T>(classSchema: ClassSchema<T>, pks: any[]) {
        const store = this.getStore(classSchema);
        for (const pk of pks) {
            const storeItem = store.get(pk);
            if (storeItem) {
                weak.removeCallbacks(storeItem.ref);
                store.delete(pk);
            }
        }
    }

    clear<T>() {
        this.registry.clear();
        this.lastKnownPkInDB = new WeakMap<any, any>();
    }

    deleteItem<T>(item: T) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        this.delete(classSchema, classSchema.getPrimaryFieldRepresentation(item));
    }

    delete<T>(classSchema: ClassSchema<T>, pk: any) {
        const store = this.getStore(classSchema);
        const storeItem = store.get(pk);

        if (storeItem) {
            weak.removeCallbacks(storeItem.ref);
            store.delete(pk);
        }
    }

    storeItem<T>(item: T) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        this.store(classSchema, item);
    }

    store<T>(classSchema: ClassSchema<T>, item: T) {
        const store = this.getStore(classSchema);
        const pk = classSchema.getPrimaryFieldRepresentation(item);
        this.lastKnownPkInDB.set(item, pk);

        const ref = weak(item as any, this.delete.bind(this, classSchema, pk));

        store.set(pk, {ref, stale: false});
    }

    get<T>(classSchema: ClassSchema<T>, pk: any): T | undefined {
        const store = this.getStore(classSchema);

        return store.has(pk) ? weak.get(store.get(pk)!.ref) : undefined;
    }

    public getStore(classSchema: ClassSchema): Map<PK, Store> {
        const store = this.registry.get(classSchema.classType);
        if (store) {
            return store;
        }

        const newStore = new Map();
        this.registry.set(classSchema.classType, newStore);
        return newStore;
    }

    isKnownItem<T>(item: T): boolean {
        return this.isKnown(getClassSchema(getClassTypeFromInstance(item)), item);
    }

    isKnown<T>(classSchema: ClassSchema<T>, item: T): boolean {
        const store = this.getStore(classSchema);
        const pk = this.lastKnownPkInDB.get(item);

        return store.has(pk) && !!weak.get(store.get(pk)!.ref);
    }

    isKnownByPk<T>(classSchema: ClassSchema<T>, pk: any): boolean {
        const store = this.getStore(classSchema);

        return store.has(pk) && !!weak.get(store.get(pk)!.ref);
    }
}

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


declare type SORT_TYPE = 'asc' | 'desc' | { $meta: "textScore" };
declare type SORT<T> = { [P in keyof T]: SORT_TYPE } | { [path: string]: SORT_TYPE };

declare type QueryMode =
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
        classSchema: ClassSchema<any>,
        propertySchema: PropertySchema,
        type: 'left' | 'inner',
        populate: boolean,
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

    select(fields: string[] | (keyof T)[]): this {
        this.model.select = new Set(fields as string[]);
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

export function getMongoFilter(query: BaseQuery<any>): any {
    return convertClassQueryToMongo(query.classSchema.classType, query.model.filter || {}, {}, {
        $parameter: (name, value) => {
            if (undefined === query.model.parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${getClassName(query.classSchema.classType)} query.`);
            }
            return query.model.parameters[value];
        }
    })
}

/**
 * Hydrates not completely populated items and makes them completely accessible.
 */
export async function hydrateEntity<T>(item: T) {
    if ((item as any).__database) {
        return await ((item as any).__database as Database).hydrateEntity(item);
    }
    throw new Error(`Given object is not a proxy object and thus can not be hydrated, or is already hydrated.`);
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

class Formatter {
    protected converter: (c: any, v: any) => any;
    protected partialConverter: (c: any, v: any) => any;
    protected proxyClasses: Map<ClassType<any>, ClassType<any>> = new Map();

    constructor(
        protected database: Database,
        protected query: BaseQuery<any>,
    ) {
        this.converter = this.query.format === 'class'
            ? mongoToClass : (this.query.format === 'json' ? mongoToPlain : (c, v) => v);

        this.partialConverter = this.query.format === 'class'
            ? partialMongoToClass : (this.query.format === 'json' ? partialMongoToPlain : (c, v) => v);
    }

    public hydrate<T>(value: any): any {
        return this.hydrateModel(this.query.model, this.query.classSchema, value);
    }

    protected withEntityTracking() {
        return this.query.format === 'class' && !this.query.model.disableInstancePooling;
    }

    protected makeInvalidReference(item: any, propertySchema: PropertySchema) {
        if (this.query.format !== 'class') return;

        const storeName = '$__' + propertySchema.name;
        Object.defineProperty(item, storeName, {
            enumerable: false,
            configurable: false,
            writable: true,
            value: undefined
        });

        Object.defineProperty(item, propertySchema.name, {
            enumerable: false,
            configurable: false,
            get() {
                if ('undefined' !== typeof this[storeName]) {
                    return this[storeName];
                }
                if (MarshalGlobal.unpopulatedCheckActive) {
                    throw new Error(`Reference ${propertySchema.name} was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
                }
            },
            set(v: any) {
                this[storeName] = v;
            }
        });
    }

    protected getProxyClass<T>(classSchema: ClassSchema<T>): ClassType<T> {
        if (!this.proxyClasses.has(classSchema.classType)) {
            const type = classSchema.classType as any;

            //note: this is necessary to give the anonymous class the same name when using toString().
            const temp: any = {};
            temp.Proxy = class extends type {
            };
            const Proxy = temp.Proxy;

            Object.defineProperty(Proxy.prototype, '__database', {
                enumerable: false,
                configurable: false,
                writable: true,
                value: this.database,
            });

            for (const propName of classSchema.propertyNames) {
                if (propName === classSchema.idField) continue;

                Object.defineProperty(Proxy.prototype, propName, {
                    enumerable: false,
                    configurable: true,
                    get() {
                        if (MarshalGlobal.unpopulatedCheckActive) {
                            throw new Error(`Reference ${getClassName(classSchema.classType)} was not completely populated (only primary keys). Use joinWith(), useJoinWith(), etc to populate the reference.`);
                        }
                    },
                    set() {
                        if (MarshalGlobal.unpopulatedCheckActive) {
                            throw new Error(`Reference ${getClassName(classSchema.classType)} was not completely populated (only primary keys). Use joinWith(), useJoinWith(), etc to populate the reference.`);
                        }
                    }
                });
            }
            this.proxyClasses.set(classSchema.classType, Proxy);
        }

        return this.proxyClasses.get(classSchema.classType)!;
    }

    protected setProxyClass(
        classSchema: ClassSchema,
        converted: any,
        dbItem: any,
        propertySchema: PropertySchema,
        isPartial: boolean
    ) {
        if (undefined === dbItem[propertySchema.getForeignKeyName()]) {
            if (propertySchema.isOptional) return;
            throw new Error(`Foreign key for ${propertySchema.name} is not projected.`);
        }

        const foreignSchema = propertySchema.getResolvedClassSchema();
        const fkn = propertySchema.getForeignKeyName();
        const pk = propertyMongoToClass(classSchema.classType, fkn, dbItem[fkn]);

        if (this.withEntityTracking() && !isPartial) {
            const item = this.database.entityRegistry.get(foreignSchema, pk);
            if (item) {
                converted[propertySchema.name] = item;
                return;
            }
        }

        const args: any[] = [];

        for (const prop of foreignSchema.getMethodProperties('constructor')) {
            args.push(propertyMongoToClass(classSchema.classType, prop.name, dbItem[prop.name]));
        }

        MarshalGlobal.unpopulatedCheckActive = false;
        const ref = new (this.getProxyClass(foreignSchema))(...args);
        ref[foreignSchema.getPrimaryField().name] = pk;
        converted[propertySchema.name] = ref;

        if (this.withEntityTracking() && !isPartial) {
            this.database.entityRegistry.store(foreignSchema, ref);
        }
        MarshalGlobal.unpopulatedCheckActive = true;
    }

    protected hydrateModel(model: DatabaseQueryModel<any>, classSchema: ClassSchema, value: any) {
        const primary = classSchema.getPrimaryField();
        const pk = propertyMongoToClass(classSchema.classType, primary.name, value[primary.name]);

        if (this.withEntityTracking() && !model.isPartial()) {
            const item = this.database.entityRegistry.get(classSchema, pk);

            if (item) {
                const stale = this.database.entityRegistry.isStale(classSchema, pk);

                if ((item as any).__database || stale) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const newItem = this.createObject(model, classSchema, value);

                    for (const propName of classSchema.propertyNames) {
                        if (propName === classSchema.idField) continue;

                        const prop = classSchema.classProperties[propName];
                        if (prop.isReference || prop.backReference) continue;

                        Object.defineProperty(item, propName, {
                            enumerable: true,
                            configurable: true,
                            value: newItem[propName],
                        });
                    }

                    (item as any).__database = undefined;
                }

                //check if we got new reference data we can apply to the instance
                for (const join of model.joins) {
                    if (join.populate) {
                        if (value[join.propertySchema.name]) {
                            if (join.propertySchema.backReference) {
                                item[join.propertySchema.name] = value[join.propertySchema.name].map(item => {
                                    return this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), item);
                                });
                            } else {
                                item[join.propertySchema.name] = this.hydrateModel(
                                    join.query.model, join.propertySchema.getResolvedClassSchema(), value[join.propertySchema.name]
                                );
                            }
                        }
                    }
                }

                if (stale) {
                    this.database.entityRegistry.markAsFresh(classSchema, pk);
                }

                return item;
            }
        }

        const converted = this.createObject(model, classSchema, value);

        if (this.withEntityTracking() && !model.isPartial()) {
            this.database.entityRegistry.store(classSchema, converted);
        }

        return converted;
    }

    protected createObject(model: DatabaseQueryModel<any>, classSchema: ClassSchema, value: any) {
        const converter = model.isPartial() ? this.partialConverter : this.converter;
        const converted = converter(classSchema.classType, value);

        const handledRelation: { [name: string]: true } = {};
        for (const join of model.joins) {
            handledRelation[join.propertySchema.name] = true;
            if (join.populate) {
                if (value[join.propertySchema.name]) {
                    if (join.propertySchema.backReference) {
                        converted[join.propertySchema.name] = value[join.propertySchema.name].map(item => {
                            return this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), item);
                        });
                    } else {
                        converted[join.propertySchema.name] = this.hydrateModel(
                            join.query.model, join.propertySchema.getResolvedClassSchema(), value[join.propertySchema.name]
                        );
                    }
                }
            } else {
                //not populated
                if (join.propertySchema.isReference) {
                    this.setProxyClass(classSchema, converted, value, join.propertySchema, model.isPartial());
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!model.isPartial()) {
                        this.makeInvalidReference(converted, join.propertySchema);
                    }
                }
            }
        }

        //all non-populated relations will be
        for (const propertySchema of classSchema.references.values()) {
            if (handledRelation[propertySchema.name]) continue;
            if (propertySchema.isReference) {
                this.setProxyClass(classSchema, converted, value, propertySchema, model.isPartial());
            } else {
                //unpopulated backReferences are inaccessible
                if (!model.isPartial()) {
                    this.makeInvalidReference(converted, propertySchema);
                }
            }
        }

        return converted;
    }

}

/**
 * Simple abstraction for MongoDB.
 *
 * All `filter` arguments require the actual class instance value.
 *
 * So, if you accept JSON, make sure to run `const filter = partialPlainToClass(Model, {...})` first.
 */
export class Database {
    public readonly entityRegistry = new EntityRegistry();

    constructor(private connection: Connection, private defaultDatabaseName = 'app') {
    }

    public async close() {
        await this.connection.mongoManager.queryRunner.databaseConnection.close(true);
        await this.connection.close();
    }

    public async hydrateEntity<T>(item: T) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const dbItem = await this.getCollection(classSchema.classType)
            .findOne(this.buildFindCriteria(classSchema.classType, item));

        for (const propName of classSchema.propertyNames) {
            if (propName === classSchema.idField) continue;

            Object.defineProperty(item, propName, {
                enumerable: true,
                configurable: true,
                value: propertyMongoToClass(classSchema.classType, propName, dbItem[propName]),
            });
        }

        (item as any).__database = undefined;
    }

    protected buildAggregationPipeline(query: BaseQuery<any>) {

        const handleJoins = (pipeline: any[], query: BaseQuery<any>) => {
            for (const join of query.model.joins) {
                const foreignSchema = join.propertySchema.getResolvedClassSchema();

                const joinPipeline: any[] = [];

                if (join.propertySchema.backReference) {
                    if (join.propertySchema.backReference.via) {
                    } else {
                        const backReference = foreignSchema.findForReference(
                            join.classSchema.classType,
                            join.propertySchema.backReference.mappedBy as string
                        );

                        joinPipeline.push({
                            $match: {$expr: {$eq: ['$' + backReference.getForeignKeyName(), '$$foreign_id']}}
                        });
                    }
                } else {
                    joinPipeline.push({
                        $match: {$expr: {$eq: ['$' + join.foreignPrimaryKey.name, '$$foreign_id']}}
                    });
                }

                if (join.query.model.hasJoins()) {
                    handleJoins(joinPipeline, join.query);
                }

                if (join.query.model.filter) joinPipeline.push({$match: getMongoFilter(join.query)});
                if (join.query.model.sort) joinPipeline.push({$sort: this.getSortFromModel(join.query.model.sort)});
                if (join.query.model.skip) joinPipeline.push({$skip: join.query.model.skip});
                if (join.query.model.limit) joinPipeline.push({$limit: join.query.model.limit});

                const project = this.getProjectModel(join.query.model.select);
                if (!join.classSchema.hasProperty('_id') || (join.query.model.isPartial() && !join.query.model.isSelected('_id'))) {
                    project['_id'] = 0;
                }
                if (Object.keys(project).length) {
                    joinPipeline.push({$project: project});
                }

                if (join.propertySchema.backReference) {
                    if (join.propertySchema.backReference.via) {
                        //many-to-many
                        const viaClassType = resolveClassTypeOrForward(join.propertySchema.backReference.via);
                        const as = join.propertySchema.name;

                        const backReference = getClassSchema(viaClassType).findForReference(
                            join.classSchema.classType,
                            //mappedBy is not for picot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $lookup: {
                                from: this.getCollectionName(viaClassType),
                                let: {localField: '$' + join.classSchema.getPrimaryField().name},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$' + backReference.getForeignKeyName(), '$$localField']}}}
                                ],
                                as: as,
                            },
                        });

                        const foreignSchema = join.propertySchema.getResolvedClassSchema();
                        const backReferenceForward = getClassSchema(viaClassType).findForReference(
                            foreignSchema.classType,
                            //mappedBy is not for picot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $addFields: {[as]: '$' + as + '.' + backReferenceForward.getForeignKeyName()},
                        });

                        pipeline.push({
                            $lookup: {
                                from: this.getCollectionName(foreignSchema.classType),
                                let: {localField: '$' + as},
                                pipeline: [
                                    {$match: {$expr: {$in: ['$' + foreignSchema.getPrimaryField().name, '$$localField']}}}
                                ].concat(joinPipeline),
                                as: join.propertySchema.name,
                            },
                        });
                    } else {
                        //one-to-many
                        pipeline.push({
                            $lookup: {
                                from: this.getCollectionName(foreignSchema.classType),
                                let: {foreign_id: '$' + foreignSchema.getPrimaryField().name},
                                pipeline: joinPipeline,
                                as: join.propertySchema.name,
                            },
                        });
                    }
                } else {
                    pipeline.push({
                        $lookup: {
                            from: this.getCollectionName(foreignSchema.classType),
                            let: {foreign_id: '$' + join.propertySchema.getForeignKeyName()},
                            pipeline: joinPipeline,
                            as: join.propertySchema.name,
                        },
                    });
                }

                //for *toOne relations, since mongodb joins always as array
                if (!join.propertySchema.isArray) {
                    pipeline.push({
                        $unwind: {
                            path: '$' + join.propertySchema.name,
                            preserveNullAndEmptyArrays: join.type === 'left'
                        }
                    });
                } else {
                    if (join.type === 'inner') {
                        pipeline.push({
                            $match: {[join.propertySchema.name]: {$ne: []}}
                        })
                    }
                }
            }
        };


        const pipeline: any[] = [];

        handleJoins(pipeline, query);

        if (query.model.filter) pipeline.push({$match: getMongoFilter(query)});
        if (query.model.sort) pipeline.push({$sort: this.getSortFromModel(query.model.sort)});
        if (query.model.skip) pipeline.push({$skip: query.model.skip});
        if (query.model.limit) pipeline.push({$limit: query.model.limit});
        return pipeline;
    }

    protected getProjectModel<T>(select: Set<string>) {
        const res: { [name: string]: 0 | 1 } = {};
        for (const v of select.values()) {
            (res as any)[v] = 1;
        }
        return res;
    }

    protected getSortFromModel<T>(modelSort?: SORT<T>) {
        const sort: { [name: string]: -1 | 1 | { $meta: "textScore" } } = {};
        if (modelSort) {
            for (const [i, v] of eachPair(modelSort)) {
                sort[i] = v === 'asc' ? 1 : (v === 'desc' ? -1 : v);
            }
        }
        return sort;
    }

    public async resolveQueryModifier<T>(mode: QueryMode, query: BaseQuery<T>, arg1: any) {
        const ids = await this.resolveQueryFetcher('ids', query);
        if (ids.length === 0) return;

        const primaryField = query.classSchema.getPrimaryField();

        let collection: Collection<T> = await this.getCollection(query.classSchema.classType);
        const mongoFilter = {id: {$in: ids.map(v => propertyClassToMongo(query.classSchema.classType, primaryField.name, v))}};

        if (mode === 'deleteOne') {
            await collection.deleteOne(mongoFilter);
            this.entityRegistry.deleteMany(query.classSchema, ids);
            return;
        }

        if (mode === 'deleteMany') {
            await collection.deleteMany(mongoFilter);
            this.entityRegistry.deleteMany(query.classSchema, ids);
            return;
        }

        if (mode === 'updateOne') {
            const updateStatement: { [name: string]: any } = {};
            updateStatement['$set'] = classToMongo(query.classSchema.classType, arg1);
            delete updateStatement['$set']['version'];
            await collection.updateOne(mongoFilter, updateStatement);
            this.entityRegistry.delete(query.classSchema, ids[0]);
            this.entityRegistry.store(query.classSchema, arg1);
            return;
        }

        if (mode === 'patchOne') {
            const updateStatement: { [name: string]: any } = {};
            updateStatement['$set'] = partialClassToMongo(query.classSchema.classType, arg1);
            await collection.updateOne(mongoFilter, updateStatement);
            this.entityRegistry.markAsStale(query.classSchema, [ids[0]]);
            return;
        }

        if (mode === 'patchMany') {
            const updateStatement: { [name: string]: any } = {};
            updateStatement['$set'] = partialClassToMongo(query.classSchema.classType, arg1);
            await collection.updateMany(mongoFilter, updateStatement);
            this.entityRegistry.markAsStale(query.classSchema, ids);
            return;
        }
    }

    public async resolveQueryFetcher<T>(mode: QueryMode, query: BaseQuery<T>) {
        let collection: Collection<T> = await this.getCollection(query.classSchema.classType);

        const formatter = new Formatter(this, query);

        function findOne() {
            return mode.startsWith('findOne');
        }

        function findOneField() {
            return mode.startsWith('findOneField');
        }

        function orUndefined() {
            return mode === 'findOneOrUndefined' || mode === 'findOneFieldOrUndefined';
        }

        const projection: { [name: string]: 1 | 0 } = {};

        if (query.model.isPartial()) {
            for (const name of query.model.select) projection[name as string] = 1;
        } else {
            if (!query.classSchema.hasProperty('_id') || (query.model.isPartial() && !query.model.isSelected('_id'))) {
                projection['_id'] = 0;
            }
        }

        const primaryField = query.classSchema.getPrimaryField();

        if (query.model.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(query);

            if (mode === 'ids') {
                pipeline.push({
                    $project: {
                        [primaryField.name]: 1
                    }
                });
            } else {
                if (Object.keys(projection).length) {
                    pipeline.push({$project: projection});
                }
            }

            if (mode === 'has') {
                pipeline.push({$limit: 1});
                pipeline.push({$count: 'count'});
            }

            if (mode === 'count') {
                pipeline.push({$count: 'count'});
            }

            if (findOne()) {
                pipeline.push({$limit: 1});
            }

            const items = await collection.aggregate(pipeline).toArray();

            if (mode === 'ids') {
                return items.map(v => propertyMongoToClass(query.classSchema.classType, primaryField.name, v[primaryField.name]));
            }

            if (findOne()) {
                if (items[0]) {
                    if (findOneField()) {
                        return formatter.hydrate(items[0])[query.model.getFirstSelect()];
                    }

                    return formatter.hydrate(items[0]);
                }

                if (orUndefined()) return;

                throw new NotFoundError(`${getClassName(query.classSchema.classType)} item not found.`);
            } else {
                if (mode === 'count') {
                    return items.length ? items[0].count : 0;
                }

                if (mode === 'has') {
                    return items.length ? items[0].count > 0 : false;
                }

                if (mode === 'findField') {
                    return items.map(v => formatter.hydrate(v)[query.model.getFirstSelect()]);
                }

                if (mode === 'find') {
                    return items.map(v => formatter.hydrate(v));
                }
            }
        }

        if (mode.startsWith('findOne')) {
            const item = await collection
                .findOne(
                    query.model.filter ? getMongoFilter(query) : {},
                    {
                        projection: projection,
                        sort: this.getSortFromModel(query.model.sort),
                        skip: query.model.skip,
                        limit: query.model.limit,
                    } as FindOneOptions
                );

            if (item) {
                if (findOneField()) {
                    return formatter.hydrate(item)[query.model.getFirstSelect()];
                }

                return formatter.hydrate(item);
            }

            if (orUndefined()) return;

            throw new NotFoundError(`${getClassName(query.classSchema.classType)} item not found.`);
        }

        if (mode === 'count') {
            return await collection
                .countDocuments(query.model.filter ? getMongoFilter(query) : {});
        }

        if (mode === 'has') {
            return await collection
                .countDocuments(query.model.filter ? getMongoFilter(query) : {}) > 0;
        }

        if (mode === 'find' || mode === 'findField' || mode === 'ids') {
            let items = await collection
                .find(query.model.filter ? getMongoFilter(query) : {})
                .project(mode === 'ids' ? {[primaryField.name]: 1} : projection);

            if (query.model.sort !== undefined) items = items.sort(this.getSortFromModel(query.model.sort));
            if (query.model.skip !== undefined) items = items.skip(query.model.skip);
            if (query.model.limit !== undefined) items = items.skip(query.model.limit);

            if (mode === 'ids') {
                return items.map(v => propertyMongoToClass(query.classSchema.classType, primaryField.name, v[primaryField.name])).toArray();
            }

            if (mode === 'findField') {
                return items.map(v => formatter.hydrate(v)[query.model.getFirstSelect()]).toArray();
            }

            return items.map(v => formatter.hydrate(v)).toArray();
        }

    }

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     */
    public query<T>(classType: ClassType<T>): DatabaseQuery<T> {
        const schema = getClassSchema(classType);

        return new DatabaseQuery(schema, this.resolveQueryFetcher.bind(this), this.resolveQueryModifier.bind(this));
    }

    public getCollectionName<T>(classType: ClassType<T>): string {
        return getCollectionName(classType) || getEntityName(classType);
    }

    public async dropDatabase(dbName: string) {
        const mongoConnection = this.connection.mongoManager.queryRunner.databaseConnection;
        await mongoConnection.db(dbName).dropDatabase();
    }

    public getCollection<T>(classType: ClassType<T>): Collection<T> {
        const mongoConnection = this.connection.mongoManager.queryRunner.databaseConnection;
        const db = mongoConnection.db(getDatabaseName(classType) || this.defaultDatabaseName);
        return db.collection(this.getCollectionName(classType));
    }

    /**
     * Removes ONE item from the database that has the given id. You need to use @f.primary() decorator
     * for at least and max one property at your entity to use this method.
     */
    public async remove<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        const collection = await this.getCollection(classSchema.classType);

        const pk = classSchema.getPrimaryField();
        const filter: { [name: string]: any } = {
            [pk.name]: item[pk.name]
        };

        const result = await collection.deleteOne(convertClassQueryToMongo(classSchema.classType, filter));
        this.entityRegistry.delete(classSchema, classSchema.getPrimaryFieldRepresentation(item));

        return result.deletedCount ? result.deletedCount > 0 : false;
    }

    public isKnownItem<T>(item: T): boolean {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        return this.entityRegistry.isKnown(classSchema, item);
    }

    /**
     * Adds or updates the item in the database. Populates primary key if necessary.
     */
    public async persist<T>(item: T): Promise<void> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        //make sure all reference are already added as well
        for (const relation of classSchema.references) {
            if (relation.isReference) {
                if (item[relation.name]) {
                    if (relation.isArray) {
                        // (item[relation.name] as any[]).forEach(v => this.add(v));
                        //todo, implement that feature, and create a foreignKey as (primaryKey)[].
                        throw new Error('Owning reference as arrays are not possible.');
                    } else {
                        if (undefined === (item[relation.name] as any).__database) {
                            //no proxy instances will be saved.
                            this.persist(item[relation.name]);
                        }
                    }
                } else if (!relation.isOptional) {
                    throw new Error(`Relation ${relation.name} in ${classSchema.getClassName()} is not set. If its optional, use @f.optional().`)
                }
            }
        }

        const collection = await this.getCollection(classSchema.classType);

        const mongoItem = classToMongo(classSchema.classType, item);

        if (!this.entityRegistry.isKnown(classSchema, item)) {
            const result = await collection.insertOne(mongoItem);

            if (result.insertedId) {
                if (classSchema.getPrimaryField().type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
                    (<any>item)[classSchema.getPrimaryField().name] = result.insertedId.toHexString();
                }
            }
            this.entityRegistry.store(classSchema, item);
            return;
        }

        const updateStatement: { [name: string]: any } = {};
        updateStatement['$set'] = mongoItem;
        const filterQuery = this.buildFindCriteria(classSchema.classType, item);
        await collection.updateOne(filterQuery, updateStatement);

        const oldPk = this.entityRegistry.lastKnownPkInDB.get(item);
        const newPk = item[classSchema.getPrimaryField().name];
        if (newPk !== oldPk) {
            this.entityRegistry.delete(classSchema, oldPk);
            this.entityRegistry.store(classSchema, item);
        }
    }

    protected buildFindCriteria<T>(classType: ClassType<T>, item: T): { [name: string]: any } {
        const criteria: { [name: string]: any } = {};
        const id = getIdField(classType);

        if (!id) {
            throw new NoIDDefinedError(`Class ${getClassName(classType)} has no @f.primary() defined.`);
        }

        criteria[id] = propertyClassToMongo(classType, id, this.entityRegistry.getLastKnownPkInDB(item));

        return criteria;
    }
}
