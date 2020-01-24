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
import {Subject} from "rxjs";

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
    | 'findField'
    | 'findOne'
    | 'findOneOrUndefined'
    | 'findOneField'
    | 'findOneFieldOrUndefined'
    | 'has'
    | 'count';

export class DatabaseQueryModel<T> {
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
        query.format = this.format;
        query.model = this.model.clone(query);
        return query;
    }

    async findOneOrUndefined(): Promise<T | undefined> {
        return await this.executor('findOneOrUndefined', this);
    }

    async findOne(): Promise<T> {
        return await this.executor('findOne', this);
    }

    async findOneField(fieldName: keyof T | string): Promise<any> {
        this.model.select = new Set([fieldName as string]);
        return await this.executor('findOneField', this);
    }

    async findOneFieldOrUndefined(fieldName: keyof T | string): Promise<any | undefined> {
        this.model.select = new Set([fieldName as string]);
        return await this.executor('findOneFieldOrUndefined', this);
    }

    async find(): Promise<T[]> {
        return await this.executor('find', this);
    }

    async findField(fieldName: keyof T | string): Promise<any[]> {
        this.model.select = new Set([fieldName as string]);
        return await this.executor('findField', this);
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

    constructor(protected query: BaseQuery<any>) {
        this.converter = this.query.format === 'class'
            ? mongoToClass : (this.query.format === 'json' ? mongoToPlain : (c, v) => v);

        this.partialConverter = this.query.format === 'class'
            ? partialMongoToClass : (this.query.format === 'json' ? partialMongoToPlain : (c, v) => v);
    }

    public hydrate<T>(value: any): any {
        return this.hydrateModel(this.query.model, this.query.classSchema, value);
    }

    protected hydrateModel(model: DatabaseQueryModel<any>, classSchema: ClassSchema, value: any) {
        const converter = model.isPartial() ? this.partialConverter : this.converter;
        const converted = converter(classSchema.classType, value);

        const makeInvalidReference = (item, propertySchema: PropertySchema) => {
            if (this.query.format !== 'class') return;
            if (model.isPartial()) return;

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

    public async resolveQuery<T>(mode: QueryMode, query: BaseQuery<T>) {
        let collection: Collection<T> = await this.getCollection(query.classSchema.classType);

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

        function getProjectModel<T>(select: Set<string>) {
            const res: { [name: string]: 0 | 1 } = {};
            for (const v of select.values()) {
                (res as any)[v] = 1;
            }
            return res;
        }

        function getSortFromModel<T>(modelSort?: SORT<T>) {
            const sort: { [name: string]: -1 | 1 | { $meta: "textScore" } } = {};
            if (modelSort) {
                for (const [i, v] of eachPair(modelSort)) {
                    sort[i] = v === 'asc' ? 1 : (v === 'desc' ? -1 : v);
                }
            }
            return sort;
        }


        if (query.model.isPartial()) {
            if (query.classSchema.idField) {
                //we require ID always for hydration
                projection[query.classSchema.idField] = 1;
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
                if (join.query.model.sort) joinPipeline.push({$sort: getSortFromModel(join.query.model.sort)});
                if (join.query.model.skip) joinPipeline.push({$skip: join.query.model.skip});
                if (join.query.model.limit) joinPipeline.push({$limit: join.query.model.limit});

                const project = getProjectModel(join.query.model.select);
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

        if (query.model.hasJoins()) {
            const pipeline: any[] = [];

            handleJoins(pipeline, query);

            if (query.model.filter) pipeline.push({$match: convertClassQueryToMongo(query.classSchema.classType, query.model.filter)});
            if (query.model.sort) pipeline.push({$sort: getSortFromModel(query.model.sort)});
            if (query.model.skip) pipeline.push({$skip: query.model.skip});
            if (query.model.limit) pipeline.push({$limit: query.model.limit});

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
                    query.model.filter ? convertClassQueryToMongo(query.classSchema.classType, query.model.filter) : {},
                    {
                        projection: projection,
                        sort: getSortFromModel(query.model.sort),
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
                .countDocuments(query.model.filter ? convertClassQueryToMongo(query.classSchema.classType, query.model.filter) : {});
        }

        if (mode === 'has') {
            return await collection
                .countDocuments(query.model.filter ? convertClassQueryToMongo(query.classSchema.classType, query.model.filter) : {}) > 0;
        }

        if (mode === 'find' || mode === 'findField') {
            let items = await collection
                .find(query.model.filter ? convertClassQueryToMongo(query.classSchema.classType, query.model.filter) : {})
                .project(projection);

            if (query.model.sort !== undefined) items = items.sort(getSortFromModel(query.model.sort));
            if (query.model.skip !== undefined) items = items.skip(query.model.skip);
            if (query.model.limit !== undefined) items = items.skip(query.model.limit);

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

        return new DatabaseQuery(schema, this.resolveQuery.bind(this));
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
