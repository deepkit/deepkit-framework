import {
    ClassSchema,
    getClassSchema,
    getClassTypeFromInstance,
    getCollectionName,
    getDatabaseName,
    getEntityName,
    getIdField,
    getReflectionType, MarshalGlobal,
    PropertySchema, resolveClassTypeOrForward
} from '@marcj/marshal';
import {
    classToMongo,
    convertClassQueryToMongo,
    mongoToClass,
    mongoToPlain,
    partialClassToMongo,
    partialMongoToClass,
    partialMongoToPlain,
    propertyClassToMongo
} from "./mapping";
import {Collection, Connection} from 'typeorm';
import {ClassType, eachPair, getClassName} from '@marcj/estdlib';
import {FindOneOptions} from "mongodb";

export class NotFoundError extends Error {
}

export class NoIDDefinedError extends Error {
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

    //special glut types
    // $sub?: ReactiveSubQuery<any>;
    // $parameter?: string;
};

export type FilterQuery<T> = {
    [P in keyof T]?: Query<T[P]> | T[P];
} | Query<T>;


declare type SORT_TYPE = 'asc' | 'desc' | { $meta: "textScore" };
declare type SORT<T> = { [P in keyof T]: SORT_TYPE } | { [path: string]: SORT_TYPE };

declare type QueryMode =
    'find'
    | 'findOne'
    | 'findOneOrUndefined'
    | 'findOneField'
    | 'findOneFieldOrUndefined'
    | 'has'
    | 'count';

export class DatabaseQueryModel<T> {
    public filter?: { [field: string]: any };
    public select: string[] | (keyof T)[] = [];
    public joins: {
        classSchema: ClassSchema<any>;
        propertySchema: PropertySchema;
        type: 'left' | 'inner';
        populate: boolean;
        query: JoinDatabaseQuery<any, any>,
        foreignPrimaryKey: PropertySchema,
    }[] = [];
    public skip?: number;
    public limit?: number;
    public sort?: SORT<T>;

    clone() {
        //todo clone joins as well
        return {...this};
    }

    isPartial() {
        return this.select.length > 0;
    }

    hasJoins() {
        return this.joins.length > 0;
    }
}

type FlattenIfArray<T> = T extends (infer R)[] ? R : T

export class BaseQuery<T> {
    /**
     * @internal
     */
    public model: DatabaseQueryModel<T> = new DatabaseQueryModel<T>();

    constructor(public readonly classSchema: ClassSchema<T>) {
    }

    select(fields: string[] | (keyof T)[]): this {
        this.model.select = fields;
        return this;
    }

    skip(value?: number): this {
        this.model.skip = value;
        return this;
    }

    limit(value?: number): this {
        this.model.limit = value;
        return this;
    }

    sort(sort?: SORT<T>): this {
        this.model.sort = sort;
        return this;
    }

    filter(filter?: { [field: string]: any } | FilterQuery<T>): this {
        if (filter && !Object.keys(filter).length) filter = undefined;

        this.model.filter = filter;
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
        const query = new JoinDatabaseQuery<any, this>(propertySchema, this);
        this.model.joins.push({
            propertySchema, query, populate, type,
            foreignPrimaryKey: propertySchema.getResolvedClassSchema().getPrimaryField(),
            classSchema: this.classSchema,
        });
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

export class JoinDatabaseQuery<T, PARENT> extends BaseQuery<T> {
    constructor(
        public readonly propertySchema: PropertySchema,
        public readonly parentQuery: PARENT,
    ) {
        super(propertySchema.getResolvedClassSchema());
    }

    end(): PARENT {
        return this.parentQuery;
    }
}

export class DatabaseQuery<T> extends BaseQuery<T> {
    public format: 'class' | 'json' | 'raw' = 'class';

    constructor(
        classSchema: ClassSchema<T>,
        protected readonly executor: (mode: QueryMode, query: DatabaseQuery<T>) => Promise<any>,
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
        const query = new DatabaseQuery(this.classSchema, this.executor);
        query.model = this.model.clone();
        return query;
    }

    async findOneOrUndefined(): Promise<T | undefined> {
        return await this.executor('findOneOrUndefined', this);
    }

    async findOne(): Promise<T> {
        return await this.executor('findOne', this);
    }

    async findOneField(fieldName: keyof T | string): Promise<any> {
        this.model.select = [fieldName as string];
        return await this.executor('findOne', this);
    }

    async findOneFieldOrUndefined(fieldName: keyof T | string): Promise<any | undefined> {
        this.model.select = [fieldName as string];
        return await this.executor('findOneFieldOrUndefined', this);
    }

    async find(): Promise<T[]> {
        return await this.executor('find', this);
    }

    async count(): Promise<number> {
        return await this.executor('count', this);
    }

    async has(): Promise<boolean> {
        return await this.executor('has', this);
    }
}

class Formatter {
    protected entityReferences = new Map<string, any>();
    protected converter: (c: any, v: any) => any;
    protected partialConverter: (c: any, v: any) => any;

    constructor(protected query: DatabaseQuery<any>) {
        this.converter = this.query.format === 'class'
            ? mongoToClass : (this.query.format === 'json' ? mongoToPlain : (c, v) => v);

        this.partialConverter = this.query.format === 'class'
            ? partialMongoToClass : (this.query.format === 'json' ? partialMongoToPlain : (c, v) => v);
    }

    public hydrate<T>(classSchema: ClassSchema, value: any): any {
        return this.hydrateModel(this.query.model, classSchema, value);
    }

    protected hydrateModel(model: DatabaseQueryModel<any>, classSchema: ClassSchema, value: any) {
        const converter = model.select.length ? this.partialConverter : this.converter;
        const converted = converter(classSchema.classType, value);

        const makeInvalidReference = (item, propertySchema: PropertySchema) => {
            if (this.query.format !== 'class') return;
            if (model.select.length) return;

            const storeName = '$__' + propertySchema.name;
            Object.defineProperty(item, storeName, {
                enumerable: false,
                configurable: false,
                value: undefined
            });
            Object.defineProperty(item, propertySchema.name, {
                enumerable: true,
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
        };

        const handledRelation: { [name: string]: true } = {};
        for (const join of model.joins) {
            handledRelation[join.propertySchema.name] = true;
            if (join.populate) {
                if (value[join.propertySchema.name]) {
                    if (join.propertySchema.backReference) {
                        converted[join.propertySchema.name] = value[join.propertySchema.name].map(item => {
                            return this.hydrateReference(join.query, join.propertySchema, item);
                        });
                    } else {
                        converted[join.propertySchema.name] = this.hydrateReference(
                            join.query, join.propertySchema, value[join.propertySchema.name]
                        );
                    }
                }
            } else {
                makeInvalidReference(converted, join.propertySchema);
            }
        }

        //all non-populated relations will be
        for (const propertySchema of classSchema.references.values()) {
            if (handledRelation[propertySchema.name]) continue;
            makeInvalidReference(converted, propertySchema);
        }

        return converted;
    }

    public hydrateReference(joinQuery: BaseQuery<any>, propertySchema: PropertySchema, value: any) {
        const classSchema = propertySchema.getResolvedClassSchema();

        const primaryKey = JSON.stringify(value[classSchema.getPrimaryField().name]);

        if (!this.entityReferences.has(primaryKey)) {
            this.entityReferences.set(primaryKey, this.hydrateModel(joinQuery.model, classSchema, value));
        }

        return this.entityReferences.get(primaryKey);
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

    constructor(private connection: Connection, private defaultDatabaseName = 'app') {
    }

    public async close() {
        await this.connection.mongoManager.queryRunner.databaseConnection.close(true);
        await this.connection.close();
    }

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     */
    public query<T>(classType: ClassType<T>): DatabaseQuery<T> {
        const schema = getClassSchema(classType);

        return new DatabaseQuery(schema, async (mode: QueryMode, query) => {
            let collection: Collection<T> = await this.getCollection(classType);

            const formatter = new Formatter(query);

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
            const sort: { [name: string]: -1 | 1 | { $meta: "textScore" } } = {};
            if (query.model.sort) {
                for (const [i, v] of eachPair(query.model.sort)) {
                    sort[i] = v === 'asc' ? 1 : (v === 'desc' ? -1 : v);
                }
            }

            if (query.model.select.length) {
                if (schema.idField) {
                    //we require ID always for hydration
                    projection[schema.idField] = 1;
                }
                for (const name of query.model.select) projection[name as string] = 1;
            }

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

                    if (join.query.model.filter) joinPipeline.push({$match: convertClassQueryToMongo(join.query.classSchema.classType, join.query.model.filter)});
                    if (join.query.model.skip) joinPipeline.push({$skip: join.query.model.skip});
                    if (join.query.model.limit) joinPipeline.push({$limit: join.query.model.limit});

                    if (join.propertySchema.backReference) {
                        if (join.propertySchema.backReference.via) {
                            //many-to-many
                            const viaClassType = resolveClassTypeOrForward(join.propertySchema.backReference.via);
                            const as = join.propertySchema.name;

                            const backReference = getClassSchema(viaClassType).findForReference(
                                join.classSchema.classType,
                                join.propertySchema.backReference.mappedBy as string
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

                            pipeline.push({
                                $addFields: {[as]: '$' + as + '.organisationId'},
                            });

                            const foreignSchema = join.propertySchema.getResolvedClassSchema();
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

            if (query.model.hasJoins()) {
                const pipeline: any[] = [];

                handleJoins(pipeline, query);

                if (query.model.filter) pipeline.push({$match: convertClassQueryToMongo(query.classSchema.classType, query.model.filter)});
                if (query.model.skip) pipeline.push({$skip: query.model.skip});
                if (query.model.limit) pipeline.push({$limit: query.model.limit});

                function handleJoinFields(query: BaseQuery<any>, prefix = '') {
                    prefix = prefix ? prefix + '.' : '';
                    for (const join of query.model.joins) {
                        if (join.populate && query.model.select.length) {
                            projection[prefix + join.propertySchema.name + '.' + join.foreignPrimaryKey.name] = 1;
                        }
                        if (!join.populate) {
                            projection[prefix + join.propertySchema.name as string] = 0;
                        } else {
                            for (const field of join.query.model.select) {
                                projection[prefix + join.propertySchema.name + '.' + (field as string)] = 1;
                            }
                            if (join.query.model.hasJoins()) {
                                handleJoinFields(join.query, join.propertySchema.name);
                            }
                        }
                    }
                }

                handleJoinFields(query, '');

                if (Object.keys(projection).length) {
                    pipeline.push({$project: projection});
                }

                if (mode === 'has') {
                    pipeline.push({$limit: 1});
                    pipeline.push({$count: 'count'});
                }

                if (mode === 'count') {
                    pipeline.push({$count: 'count'});
                }

                const items = await collection.aggregate(pipeline).toArray();
                // console.log('pipeline', JSON.stringify(pipeline, null, 4));
                // console.log('aggregate items', items);

                if (findOne()) {
                    if (items[0]) {
                        if (findOneField()) {
                            return formatter.hydrate(schema, items[0])[query.model.select[0]];
                        }

                        return formatter.hydrate(schema, items[0]);
                    }

                    if (orUndefined()) return;

                    throw new NotFoundError(`${getClassName(classType)} item not found.`);
                } else {
                    if (mode === 'count') {
                        return items.length ? items[0].count : 0;
                    }

                    if (mode === 'has') {
                        return items.length ? items[0].count > 0 : false;
                    }

                    if (mode === 'find') {
                        return items.map(v => formatter.hydrate(schema, v));
                    }
                }
            }

            if (mode.startsWith('findOne')) {
                const item = await collection
                    .findOne(
                        query.model.filter ? convertClassQueryToMongo(classType, query.model.filter) : {},
                        {
                            projection: projection,
                            sort: sort,
                            skip: query.model.skip,
                            limit: query.model.limit,
                        } as FindOneOptions
                    );

                if (item) {
                    if (findOneField()) {
                        return formatter.hydrate(schema, item)[query.model.select[0]];
                    }

                    return formatter.hydrate(schema, item);
                }

                if (orUndefined()) return;

                throw new NotFoundError(`${getClassName(classType)} item not found.`);
            }

            if (mode === 'count') {
                return await collection
                    .countDocuments(query.model.filter ? convertClassQueryToMongo(classType, query.model.filter) : {});
            }

            if (mode === 'has') {
                return await collection
                    .countDocuments(query.model.filter ? convertClassQueryToMongo(classType, query.model.filter) : {}) > 0;
            }

            if (mode === 'find') {
                let items = await collection
                    .find(query.model.filter ? convertClassQueryToMongo(classType, query.model.filter) : {})
                    .project(projection);

                if (query.model.skip !== undefined) items = items.skip(query.model.skip);
                if (query.model.limit !== undefined) items = items.skip(query.model.limit);
                if (query.model.sort !== undefined) items = items.sort(sort);

                return items.map(v => formatter.hydrate(schema, v)).toArray();
            }

        });
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
     * Removes ONE item from the database that has the given id. You need to use @ID() decorator
     * for at least and max one property at your entity to use this method.
     */
    public async remove<T>(classType: ClassType<T>, id: string): Promise<boolean> {
        const collection = await this.getCollection(classType);
        const idName = getIdField(classType);
        if (!idName) return false;

        const filter: { [name: string]: any } = {};
        filter[idName] = id;

        const result = await collection.deleteOne(convertClassQueryToMongo(classType, filter));

        return result.deletedCount ? result.deletedCount > 0 : false;
    }

    /**
     * Removes ONE item from the database that matches given filter.
     */
    public async deleteOne<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = await this.getCollection(classType);
        await collection.deleteOne(convertClassQueryToMongo(classType, filter));
    }

    /**
     * Removes ALL items from the database that matches given filter.
     */
    public async deleteMany<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = await this.getCollection(classType);
        await collection.deleteMany(convertClassQueryToMongo(classType, filter));
    }

    /**
     * @see add
     */
    public async addEntity<T>(item: T): Promise<boolean> {
        return this.add(getClassTypeFromInstance(item), item);
    }

    /**
     * Adds a new item to the database. Sets _id if defined at your entity.
     */
    public async add<T>(classType: ClassType<T>, item: T): Promise<boolean> {
        //todo, check WeakMap if that was already added
        const collection = await this.getCollection(classType);

        const id = getIdField(classType);
        const obj = classToMongo(classType, item);

        const result = await collection.insertOne(obj);
        //todo add to WeakMap, so we know we already added it

        if (id === '_id' && result.insertedId) {
            const {type} = getReflectionType(classType, id);

            if (type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
                (<any>item)['_id'] = result.insertedId.toHexString();
            }
        }

        return true;
    }

    /**
     * Updates an entity in the database and returns the new version number if successful, or null if not successful.
     *
     * If no filter is given, the ID of `update` is used.
     */
    public async update<T>(classType: ClassType<T>, update: T, filter?: { [field: string]: any }): Promise<number | undefined> {
        const collection = await this.getCollection(classType);

        const updateStatement: { [name: string]: any } = {
            $inc: {version: +1},
        };

        updateStatement['$set'] = classToMongo(classType, update);
        delete updateStatement['$set']['version'];

        const filterQuery = filter ? convertClassQueryToMongo(classType, filter) : this.buildFindCriteria(classType, update);

        const response = await collection.findOneAndUpdate(filterQuery, updateStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return undefined;
        }

        (<any>update)['version'] = (<any>doc)['version'];

        return (<any>update)['version'];
    }

    private buildFindCriteria<T>(classType: ClassType<T>, data: T): { [name: string]: any } {
        const criteria: { [name: string]: any } = {};
        const id = getIdField(classType);

        if (!id) {
            throw new NoIDDefinedError(`Class ${getClassName(classType)} has no @f.primary() defined.`);
        }

        criteria[id] = propertyClassToMongo(classType, id, (<any>data)[id]);

        return criteria;
    }

    /**
     * Patches a single entity in the collection and returns the new version number if successful, or null if not successful.
     * It's possible to provide nested key-value pairs, where the path should be based on dot symbol separation.
     *
     * Example
     *
     * await patch(SimpleEntity, {
     *     ['children.0.label']: 'Changed label'
     * });
     */
    public async patch<T>(classType: ClassType<T>, filter: { [field: string]: any }, patch: Partial<T>): Promise<number | undefined> {
        const collection = await this.getCollection(classType);

        const patchStatement: { [name: string]: any } = {
            $inc: {version: +1}
        };

        delete (<any>patch)['id'];
        delete (<any>patch)['_id'];
        delete (<any>patch)['version'];

        patchStatement['$set'] = partialClassToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(convertClassQueryToMongo(classType, filter), patchStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return undefined;
        }

        return (<any>doc)['version'];
    }

    /**
     * Patches all items in the collection and returns the count of modified items.
     * It's possible to provide nested key-value pairs, where the path should be based on dot symbol separation.
     *
     * Example
     *
     * await patch(SimpleEntity, {
     *     ['children.0.label']: 'Changed label'
     * });
     */
    public async patchAll<T>(classType: ClassType<T>, filter: { [field: string]: any }, patch: Partial<T>): Promise<number> {
        const collection = await this.getCollection(classType);

        const patchStatement: { [name: string]: any } = {
            $inc: {version: +1}
        };

        delete (<any>patch)['id'];
        delete (<any>patch)['_id'];
        delete (<any>patch)['version'];

        patchStatement['$set'] = partialClassToMongo(classType, patch);

        const response = await collection.updateMany(convertClassQueryToMongo(classType, filter), patchStatement, {});

        return response.modifiedCount;
    }
}
