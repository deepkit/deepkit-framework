import {
    getClassSchema,
    getClassTypeFromInstance,
    getCollectionName,
    getEntityName,
    getIdField,
    resolveClassTypeOrForward
} from "@super-hornet/marshal";
import {
    classToMongo,
    convertClassQueryToMongo,
    partialClassToMongo,
    propertyClassToMongo,
    propertyMongoToClass
} from "./mapping";
import {NoIDDefinedError, NotFoundError} from "./database";
import {Formatter, markAsHydrated} from "./formatter";
import {ClassType, eachPair, getClassName} from "@super-hornet/core";
import {FilterQuery, FindOneOptions} from "mongodb";
import {BaseQuery, DatabaseQuery, QueryMode, SORT} from "./query";
import {
    EntityRegistry,
    getLastKnownPKInDatabase,
    isItemKnownInDatabase,
    markItemAsKnownInDatabase,
    unmarkItemAsKnownInDatabase
} from "./entity-register";
import {Connection} from "./connection";

/*
 * This file is hard coupled to MongoDB. We could decouple it to allow other database as well, like MySQL/PostgreSQL & co.
 */

export function resolveCollectionName<T>(classType: ClassType<T>): string {
    return getCollectionName(classType) || getEntityName(classType);
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

let SESSION_IDS = 0;

export class DatabaseSession {
    public readonly id = SESSION_IDS++;
    public readonly entityRegistry = new EntityRegistry();

    constructor(
        protected connection: Connection,
        public disabledInstancePooling = false,
    ) {
    }

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     */
    public query<T>(classType: ClassType<T>): DatabaseQuery<T> {
        const schema = getClassSchema(classType);

        return new DatabaseQuery(schema, this.resolveQueryFetcher.bind(this), this.resolveQueryModifier.bind(this));
    }

    protected buildFindCriteria<T>(classType: ClassType<T>, item: T): { [name: string]: any } {
        const criteria: { [name: string]: any } = {};
        const id = getIdField(classType) as keyof T & string;

        if (!id) {
            throw new NoIDDefinedError(`Class ${getClassName(classType)} has no @f.primary() defined.`);
        }

        if (isItemKnownInDatabase(item)) {
            criteria[id] = propertyClassToMongo(classType, id, getLastKnownPKInDatabase(item));
        } else {
            criteria[id] = propertyClassToMongo(classType, id, item[id]);
        }

        return criteria;
    }

    public async hydrateEntity<T>(item: T) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const dbItem = await (await this.connection.getCollection(classSchema.classType))
            .findOne(this.buildFindCriteria(classSchema.classType, item));

        for (const property of classSchema.classProperties.values()) {
            if (property.isId) continue;
            if (property.isReference || property.backReference) continue;

            //todo, what about its relations?
            // currently the entity item is not correctly instantiated, since access to relations result in an error.

            Object.defineProperty(item, property.name, {
                enumerable: true,
                configurable: true,
                value: propertyMongoToClass(classSchema.classType, property.name, dbItem[property.name]),
            });
        }

        markAsHydrated(item);
    }

    protected buildAggregationPipeline(query: BaseQuery<any>) {
        const handleJoins = (pipeline: any[], query: BaseQuery<any>) => {
            for (const join of query.model.joins) {
                const foreignSchema = join.propertySchema.getResolvedClassSchema();

                const joinPipeline: any[] = [];

                if (join.propertySchema.backReference) {
                    if (join.propertySchema.backReference.via) {
                    } else {
                        const backReference = foreignSchema.findReverseReference(
                            join.classSchema.classType,
                            join.propertySchema,
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

                if (join.populate) {
                    const project = this.getProjectModel(join.query.model.select);
                    if (!join.classSchema.hasProperty('_id') || (join.query.model.isPartial() && !join.query.model.isSelected('_id'))) {
                        project['_id'] = 0;
                    }
                    if (Object.keys(project).length) {
                        joinPipeline.push({$project: project});
                    }
                } else {
                    //not populated, so only fetch primary key.
                    joinPipeline.push({$project: {[foreignSchema.getPrimaryField().name]: 1}});
                }

                join.as = '__ref_' + join.propertySchema.name;

                if (join.propertySchema.backReference) {
                    if (join.propertySchema.backReference.via) {
                        //many-to-many
                        const viaClassType = resolveClassTypeOrForward(join.propertySchema.backReference.via);
                        const subAs = join.propertySchema.name;

                        const backReference = getClassSchema(viaClassType).findReverseReference(
                            join.classSchema.classType,
                            join.propertySchema,
                            //mappedBy is not for pivot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $lookup: {
                                from: resolveCollectionName(viaClassType),
                                let: {localField: '$' + join.classSchema.getPrimaryField().name},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$' + backReference.getForeignKeyName(), '$$localField']}}}
                                ],
                                as: subAs,
                            },
                        });

                        const foreignSchema = join.propertySchema.getResolvedClassSchema();
                        const backReferenceForward = getClassSchema(viaClassType).findReverseReference(
                            foreignSchema.classType,
                            join.propertySchema,
                            //mappedBy is not for pivot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $addFields: {[subAs]: '$' + subAs + '.' + backReferenceForward.getForeignKeyName()},
                        });

                        pipeline.push({
                            $lookup: {
                                from: resolveCollectionName(foreignSchema.classType),
                                let: {localField: '$' + subAs},
                                pipeline: [
                                    {$match: {$expr: {$in: ['$' + foreignSchema.getPrimaryField().name, '$$localField']}}}
                                ].concat(joinPipeline),
                                as: join.as,
                            },
                        });
                    } else {
                        //one-to-many
                        pipeline.push({
                            $lookup: {
                                from: resolveCollectionName(foreignSchema.classType),
                                let: {foreign_id: '$' + foreignSchema.getPrimaryField().name},
                                pipeline: joinPipeline,
                                as: join.as,
                            },
                        });
                    }
                } else {
                    pipeline.push({
                        $lookup: {
                            from: resolveCollectionName(foreignSchema.classType),
                            let: {foreign_id: '$' + join.propertySchema.getForeignKeyName()},
                            pipeline: joinPipeline,
                            as: join.as,
                        },
                    });
                }

                //for *toOne relations, since mongodb joins always as array
                if (!join.propertySchema.isArray) {
                    pipeline.push({
                        $unwind: {
                            path: '$' + join.as,
                            preserveNullAndEmptyArrays: join.type === 'left'
                        }
                    });
                } else {
                    if (join.type === 'inner') {
                        pipeline.push({
                            $match: {[join.as]: {$ne: []}}
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

        const collection = await this.connection.getCollection(query.classSchema.classType);
        const mongoFilter = {[primaryField.name]: {$in: ids.map((v: any) => propertyClassToMongo(query.classSchema.classType, primaryField.name, v))}};

        if (mode === 'deleteOne') {
            await collection.deleteOne(mongoFilter);
            if (!this.disabledInstancePooling) {
                this.entityRegistry.deleteMany(query.classSchema, ids);
            }
            return;
        }

        if (mode === 'deleteMany') {
            await collection.deleteMany(mongoFilter);
            if (!this.disabledInstancePooling) {
                this.entityRegistry.deleteMany(query.classSchema, ids);
            }
            return;
        }

        if (mode === 'updateOne') {
            await collection.findOneAndReplace(mongoFilter, classToMongo(query.classSchema.classType, arg1));
            if (!this.disabledInstancePooling) {
                this.entityRegistry.delete(query.classSchema, ids[0]);
                this.entityRegistry.store(query.classSchema, arg1);
            }
            return;
        }

        if (mode === 'patchOne') {
            const updateStatement: { [name: string]: any } = {};
            updateStatement['$set'] = partialClassToMongo(query.classSchema.classType, arg1);
            await collection.updateOne(mongoFilter, updateStatement);
            if (!this.disabledInstancePooling) {
                if (arg1[query.classSchema.getPrimaryField().name]) {
                    this.entityRegistry.changeLastKnownPK(query.classSchema, ids[0], arg1[query.classSchema.getPrimaryField().name]);
                }
            }
            return;
        }

        if (mode === 'patchMany') {
            if (arg1[query.classSchema.getPrimaryField().name]) {
                throw new Error(`Changing the primary key ${query.classSchema.getPrimaryField().name} of ${query.classSchema.getClassName()} is forbidden.`);
            }
            const updateStatement: { [name: string]: any } = {};
            updateStatement['$set'] = partialClassToMongo(query.classSchema.classType, arg1);
            await collection.updateMany(mongoFilter, updateStatement);
            return;
        }
    }

    /**
     * Adds or updates the item in the database.
     *
     * WARNING: This is an early stage implementation.
     * Modifying back-references are not detect. You have to persist the owning side of the reference separately.
     *
     *  - Populates primary key if necessary.
     *  - Persists references recursively if necessary.
     *  - Removes unlinked reference items from the database (when cascade is enabled).
     */
    // public async persist<T>(item: T): Promise<void> {
    //     if (this.disabledInstancePooling) {
    //         throw new Error(`DatabaseSession.persist is not possible with disabled instance pooling.`);
    //     }
    //
    //     const classSchema = getClassSchema(getClassTypeFromInstance(item));
    //     await this.ensureRelationsAreStored(classSchema, item);
    //
    //     const collection = await this.getCollection(classSchema.classType);
    //     const mongoItem = classToMongo(classSchema.classType, item);
    //
    //     //we can not use entityRegistry.isKnown as we allow
    //     //cross session entity item assignment.
    //     if (!isItemKnownInDatabase(item)) {
    //         await this.add(item);
    //         const result = await collection.insertOne(mongoItem);
    //
    //         if (result.insertedId) {
    //             if (classSchema.getPrimaryField().type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
    //                 (<any>item)[classSchema.getPrimaryField().name] = result.insertedId.toHexString();
    //             }
    //         }
    //         this.entityRegistry.store(classSchema, item);
    //         return;
    //     }
    //
    //     this.update(item);
    //     const updateStatement: { [name: string]: any } = {};
    //     updateStatement['$set'] = mongoItem;
    //     const filterQuery = this.buildFindCriteria(classSchema.classType, item);
    //     await collection.updateOne(filterQuery, updateStatement);
    //
    //     markItemAsKnownInDatabase(classSchema, item);
    // }
    //
    // protected async ensureRelationsAreStored<T>(classSchema: ClassSchema<T>, item: T) {
    //     //make sure all owning references are persisted as well
    //     for (const relation of classSchema.references) {
    //         if (relation.isReference) {
    //             if (item[relation.name]) {
    //                 if (relation.isArray) {
    //                     // (item[relation.name] as any[]).forEach(v => this.add(v));
    //                     //todo, implement that feature, and create a foreignKey as (primaryKey)[].
    //                     throw new Error('Owning reference as arrays are not possible.');
    //                 } else {
    //                     if (isHydrated(item[relation.name])) {
    //                         //no proxy instances will be saved.
    //                         await this.persist(item[relation.name]);
    //                     }
    //                 }
    //             } else if (!relation.isOptional) {
    //                 throw new Error(`Relation ${relation.name} in ${classSchema.getClassName()} is not set. If its optional, use @f.optional().`)
    //             }
    //         }
    //     }
    // }

    /**
     * Low level: add one item to the database.
     *  - Populates primary key if necessary.
     *  - DOES NOT add references automatically. You have to call on each new reference add() in order to save it.
     *  - DOES NOT update back-references.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async add<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const collection = await this.connection.getCollection(classSchema.classType);
        const mongoItem = classToMongo(classSchema.classType, item);

        const result = await collection.insertOne(mongoItem);

        if (result.insertedId) {
            if (classSchema.getPrimaryField().type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
                (<any>item)[classSchema.getPrimaryField().name] = result.insertedId.toHexString();
            }
        }

        markItemAsKnownInDatabase(classSchema, item);

        if (!this.disabledInstancePooling) {
            this.entityRegistry.store(classSchema, item);
        }

        return true;
    }

    /**
     * Low level: updates one item in the database.
     *  - DOES NOT update referenced items. You have to call on each changed reference update() in order to save it.
     *  - DOES NOT update back-references when primary key changes.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async update<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const collection = await this.connection.getCollection(classSchema.classType);
        const mongoItem = classToMongo(classSchema.classType, item);
        const filter = this.buildFindCriteria(classSchema.classType, item);
        await collection.findOneAndReplace(filter, mongoItem);

        markItemAsKnownInDatabase(classSchema, item);

        if (!this.disabledInstancePooling) {
            this.entityRegistry.store(classSchema, item);
        }

        return true;
    }

    /**
     * Low level: removes one item from the database that has the given id.
     *  - DOES NOT remove referenced items. You have to call on each reference delete() in order to remove it.
     *  - DOES NOT update back-references.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async remove<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        const collection = await this.connection.getCollection(classSchema.classType);

        const result = await collection.deleteOne(this.buildFindCriteria(classSchema.classType, item));

        unmarkItemAsKnownInDatabase(item);

        if (!this.disabledInstancePooling) {
            this.entityRegistry.delete(classSchema, classSchema.getPrimaryFieldRepresentation(item));
        }

        return result.deletedCount ? result.deletedCount > 0 : false;
    }


    public async resolveQueryFetcher<T>(mode: QueryMode, query: BaseQuery<T>) {
        const collection = await this.connection.getCollection(query.classSchema.classType);

        //todo, use it from the DatabaseSession to share identity-map
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
            return await collection.countDocuments((query.model.filter ? getMongoFilter(query) : {}) as FilterQuery<any>);
        }

        if (mode === 'has') {
            return await collection.countDocuments((query.model.filter ? getMongoFilter(query) : {}) as FilterQuery<any>) > 0;
        }

        if (mode === 'find' || mode === 'findField' || mode === 'ids') {
            let items = await collection
                .find(query.model.filter ? getMongoFilter(query) : {})
                .project(mode === 'ids' ? {[primaryField.name]: 1} : projection);

            if (query.model.sort !== undefined) items = items.sort(this.getSortFromModel(query.model.sort));
            if (query.model.skip !== undefined) items = items.skip(query.model.skip);
            if (query.model.limit !== undefined) items = items.limit(query.model.limit);

            if (mode === 'ids') {
                return items.map(v => propertyMongoToClass(query.classSchema.classType, primaryField.name, v[primaryField.name])).toArray();
            }

            if (mode === 'findField') {
                return items.map(v => formatter.hydrate(v)[query.model.getFirstSelect()]).toArray();
            }

            return items.map(v => formatter.hydrate(v)).toArray();
        }

    }

}
