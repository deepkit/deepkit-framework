import {Entity, FieldName, Formatter, GenericQueryResolver, PrimaryKey} from '@super-hornet/marshal-orm';
import {ClassSchema, getClassSchema, resolveClassTypeOrForward, t} from '@super-hornet/marshal';
import {resolveCollectionName} from './connection';
import {DEEP_SORT, MongoQueryModel} from './query.model';
import {convertClassQueryToMongo, mongoToClass, partialMongoToClass,} from './mapping';
import {FilterQuery} from 'mongodb';
import {MongoDatabaseAdapter} from './adapter';

export function getMongoFilter<T>(classSchema: ClassSchema<T>, model: MongoQueryModel<T>): any {
    return convertClassQueryToMongo(classSchema.classType, (model.filter || {}) as FilterQuery<T>, {}, {
        $parameter: (name, value) => {
            if (undefined === model.parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return model.parameters[value];
        }
    });
}

export class MongoQueryResolver<T extends Entity> extends GenericQueryResolver<T, MongoDatabaseAdapter, MongoQueryModel<T>> {
    public async deleteOne(queryModel: MongoQueryModel<T>): Promise<boolean> {
        return await this.delete(queryModel, false) === 1;
    }

    findField<K extends FieldName<T>>(name: K): Promise<T[K][]> {
        throw new Error('Not implemented');
    }

    findOneField<K extends FieldName<T>>(name: K): Promise<T[K]> {
        throw new Error('Not implemented');
    }

    findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
        return Promise.resolve(undefined);
    }

    has(model: MongoQueryModel<T>): Promise<boolean> {
        return Promise.resolve(false);
    }

    public async deleteMany(queryModel: MongoQueryModel<T>): Promise<number> {
        return await this.delete(queryModel, true);
    }

    protected getPrimaryKeysProjection() {
        const pk: { [name: string]: 1 | 0 } = {_id: 0};
        for (const property of this.classSchema.getPrimaryFields()) {
            pk[property.name] = 1;
        }
        return pk;
    }

    protected async fetchIds(queryModel: MongoQueryModel<T>, many: boolean = false) {
        const pipeline = this.buildAggregationPipeline(queryModel);
        if (!many) pipeline.push({$limit: 1});
        pipeline.push({$project: this.getPrimaryKeysProjection()});
        const collection = await this.databaseSession.getConnection().getCollection(this.classSchema.classType);
        const ids = await collection.aggregate(pipeline).toArray();
        return {
            // mongoFilter: {$or: ids},
            primaryKeys: ids.map(v => partialMongoToClass(this.classSchema, v)) as Partial<T>[]
        };
    }

    public async delete(queryModel: MongoQueryModel<T>, many: boolean = false): Promise<number> {
        const collection = await this.databaseSession.getConnection().getCollection(this.classSchema.classType);

        const {primaryKeys} = await this.fetchIds(queryModel, many);
        if (primaryKeys.length === 0) return 0;
        this.databaseSession.identityMap.deleteMany(this.classSchema, primaryKeys);

        const mongoFilter = getMongoFilter(this.classSchema, queryModel);

        if (many) {
            const res = await collection.deleteMany(mongoFilter);
            return res.deletedCount || 0;
        }
        const res = await collection.deleteOne(mongoFilter);
        return res.deletedCount || 0;
    }

    public async patchOne(queryModel: MongoQueryModel<T>, value: { [path: string]: any }): Promise<boolean> {
        return await this.update(queryModel, {$set: value}) === 1;
    }

    public async patchMany(queryModel: MongoQueryModel<T>, value: { [path: string]: any }): Promise<number> {
        return await this.update(queryModel, {$set: value}, true);
    }

    public async updateOne(queryModel: MongoQueryModel<T>, value: { [path: string]: any }): Promise<boolean> {
        return await this.update(queryModel, {$set: value}) === 1;
    }

    public async updateMany(queryModel: MongoQueryModel<T>, value: { [path: string]: any }): Promise<number> {
        return await this.update(queryModel, {$set: value}, true);
    }

    public async update(queryModel: MongoQueryModel<T>, value: { [path: string]: any }, many: boolean = false): Promise<number> {
        const collection = await this.databaseSession.getConnection().getCollection(this.classSchema.classType);
        let filter = getMongoFilter(this.classSchema, queryModel);

        if (queryModel.hasJoins()) {
            throw new Error('Not implemented: Use aggregate to retrieve ids, then do the query');
        }
        if (many) {
            const res = await collection.updateMany(filter || {}, value);
            return res.modifiedCount;
        }

        const res = await collection.updateOne(filter, value);
        return res.modifiedCount;
    }

    public async count(queryModel: MongoQueryModel<T>) {
        const pipeline = this.buildAggregationPipeline(queryModel);
        pipeline.push({$count: 'count'});
        const collection = await this.databaseSession.getConnection().getCollection(this.classSchema.classType);
        const items = await collection.aggregate(pipeline).toArray();
        return items.length ? items[0].count : 0;
    }

    public async findOneOrUndefined(queryModel: MongoQueryModel<T>): Promise<T | undefined> {
        const pipeline = this.buildAggregationPipeline(queryModel);
        pipeline.push({$limit: 1});
        const collection = await this.databaseSession.getConnection().getCollection(this.classSchema.classType);
        const items = await collection.aggregate(pipeline).toArray();
        if (items.length) {
            const formatter = this.createFormatter(queryModel.withIdentityMap);
            return formatter.hydrate(this.classSchema, queryModel, items[0]);
        }
        return;
    }

    public async find(queryModel: MongoQueryModel<T>): Promise<T[]> {
        const formatter = this.createFormatter(queryModel.withIdentityMap);
        if (queryModel.joins.length) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            const items = await this.databaseSession.getConnection().aggregate(this.classSchema.classType, pipeline);
            return items.map(v => formatter.hydrate(this.classSchema, queryModel, v));
        } else {
            const items = await this.databaseSession.getConnection().find(
                this.classSchema.classType,
                getMongoFilter(this.classSchema, queryModel),
                this.getProjection(this.classSchema, queryModel.select),
                this.getSortFromModel(queryModel.sort),
                queryModel.skip,
                queryModel.limit,
            );
            return items.map(v => formatter.hydrate(this.classSchema, queryModel, v));
        }
    }

    protected buildAggregationPipeline(model: MongoQueryModel<T>) {
        const handleJoins = <T>(pipeline: any[], query: MongoQueryModel<T>, schema: ClassSchema) => {
            for (const join of query.joins) {
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
                    handleJoins(joinPipeline, join.query.model, foreignSchema);
                }

                if (join.query.model.filter) joinPipeline.push({$match: getMongoFilter(join.query.classSchema, join.query.model)});
                if (join.query.model.sort) joinPipeline.push({$sort: this.getSortFromModel(join.query.model.sort)});
                if (join.query.model.skip) joinPipeline.push({$skip: join.query.model.skip});
                if (join.query.model.limit) joinPipeline.push({$limit: join.query.model.limit});

                if (join.populate) {
                    const projection = this.getProjection(join.query.classSchema, join.query.model.select);
                    // if (!join.classSchema.hasProperty('_id') || (join.query.model.isPartial() && !join.query.model.isSelected('_id'))) {
                    //     project['_id'] = 0;
                    // }
                    if (projection) joinPipeline.push({$project: projection});
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

                if (join.propertySchema.isArray) {
                    if (!schema.hasProperty(join.as)) schema.addProperty(join.as, t.array(t.type(foreignSchema)));

                    if (join.type === 'inner') {
                        pipeline.push({
                            $match: {[join.as]: {$ne: []}}
                        });
                    }
                } else {
                    if (!schema.hasProperty(join.as)) schema.addProperty(join.as, t.type(foreignSchema));

                    //for *toOne relations, since mongodb joins always as array
                    pipeline.push({
                        $unwind: {
                            path: '$' + join.as,
                            preserveNullAndEmptyArrays: join.type === 'left'
                        }
                    });
                }
            }
        };

        const pipeline: any[] = [];

        handleJoins(pipeline, model, this.classSchema);

        if (model.filter) pipeline.push({$match: getMongoFilter(this.classSchema, model)});
        if (model.sort) pipeline.push({$sort: this.getSortFromModel(model.sort)});
        if (model.skip) pipeline.push({$skip: model.skip});
        if (model.limit) pipeline.push({$limit: model.limit});

        const projection = this.getProjection(this.classSchema, model.select);
        if (projection) pipeline.push({$project: projection});

        return pipeline;
    }

    protected getProjection<T>(classSchema: ClassSchema<any>, select: Set<string>): { [name: string]: 0 | 1 } | undefined {
        const res: { [name: string]: 0 | 1 } = {};

        if (select.size) {
            res['_id'] = 0;
            for (const v of select.values()) {
                (res as any)[v] = 1;
            }
            for (const property of this.classSchema.getPrimaryFields()) {
                (res as any)[property.name] = 1;
            }
            return res;
        } else {
            // for (const v of classSchema.getClassProperties().keys()) {
            //     (res as any)[v] = 1;
            // }
            return undefined;
        }
    }

    protected createFormatter(withIdentityMap: boolean = false) {
        return new Formatter(
            'mongo',
            this.databaseSession.getHydrator(),
            withIdentityMap ? this.databaseSession.identityMap : undefined
        );
    }

    protected getSortFromModel<T>(modelSort?: DEEP_SORT<T>) {
        const sort: { [name: string]: -1 | 1 | { $meta: 'textScore' } } = {};
        if (modelSort) {
            for (const [i, v] of Object.entries(modelSort)) {
                sort[i] = v === 'asc' ? 1 : (v === 'desc' ? -1 : v);
            }
        }
        return sort;
    }
}
