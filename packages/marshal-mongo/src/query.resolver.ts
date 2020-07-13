import {DatabaseSession, Entity, Formatter} from "@super-hornet/marshal-orm";
import {ClassSchema, getClassSchema, resolveClassTypeOrForward} from "@super-hornet/marshal";
import {MongoConnection, resolveCollectionName} from "./connection";
import {DEEP_SORT, MongoQueryModel} from "./query.model";
import {convertClassQueryToMongo,} from "./mapping";

export function getMongoFilter<T>(classSchema: ClassSchema<T>, model: MongoQueryModel<T>): any {
    return convertClassQueryToMongo(classSchema.classType, model.filter || {}, {}, {
        $parameter: (name, value) => {
            if (undefined === model.parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return model.parameters[value];
        }
    })
}

export class MongoQueryResolver<T extends Entity> {
    protected formatter = new Formatter(this.databaseSession, 'mongo');

    constructor(
        protected classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<any>,
        protected connection: MongoConnection,
    ) {
    }

    public async deleteMany(queryModel: MongoQueryModel<T>): Promise<number> {
        const connection = await this.connection.getCollection(this.classSchema.classType);
        const res = await connection.deleteMany(getMongoFilter(this.classSchema, queryModel));
        return res.deletedCount || 0;
    }

    public async patchMany(queryModel: MongoQueryModel<T>): Promise<number> {
        //todo
        return 0;
    }

    public async updateMany(queryModel: MongoQueryModel<T>): Promise<number> {
        //todo
        return 0;
    }

    public async count(queryModel: MongoQueryModel<T>) {
        const pipeline = this.buildAggregationPipeline(queryModel);
        pipeline.push({$count: 'count'});
        const collection = await this.connection.getCollection(this.classSchema.classType);
        const items = await collection.aggregate(pipeline).toArray();
        return items.length ? items[0].count : 0;
    }

    public async findOneOrUndefined(queryModel: MongoQueryModel<T>): Promise<T | undefined> {
        const pipeline = this.buildAggregationPipeline(queryModel);
        pipeline.push({$limit: 1});
        const collection = await this.connection.getCollection(this.classSchema.classType);
        const items = await collection.aggregate(pipeline).toArray();
        if (items.length) {
            return this.formatter.hydrate(this.classSchema, queryModel, items[0]);
        }
        return;
    }

    public async find(queryModel: MongoQueryModel<T>): Promise<T[]> {
        const pipeline = this.buildAggregationPipeline(queryModel);
        const collection = await this.connection.getCollection(this.classSchema.classType);
        const items = await collection.aggregate(pipeline).toArray();
        return items.map(v => this.formatter.hydrate(this.classSchema, queryModel, v));
    }

    protected buildAggregationPipeline(model: MongoQueryModel<T>) {
        const handleJoins = <T>(pipeline: any[], query: MongoQueryModel<T>) => {
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
                    handleJoins(joinPipeline, join.query.model);
                }

                if (join.query.model.filter) joinPipeline.push({$match: getMongoFilter(join.query.classSchema, join.query.model)});
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

        handleJoins(pipeline, model);

        if (model.filter) pipeline.push({$match: getMongoFilter(this.classSchema, model)});
        if (model.sort) pipeline.push({$sort: this.getSortFromModel(model.sort)});
        if (model.skip) pipeline.push({$skip: model.skip});
        if (model.limit) pipeline.push({$limit: model.limit});
        return pipeline;
    }

    protected getProjectModel<T>(select: Set<string>) {
        const res: { [name: string]: 0 | 1 } = {};
        for (const v of select.values()) {
            (res as any)[v] = 1;
        }
        return res;
    }

    protected getSortFromModel<T>(modelSort?: DEEP_SORT<T>) {
        const sort: { [name: string]: -1 | 1 | { $meta: "textScore" } } = {};
        if (modelSort) {
            for (const [i, v] of Object.entries(modelSort)) {
                sort[i] = v === 'asc' ? 1 : (v === 'desc' ? -1 : v);
            }
        }
        return sort;
    }
}
