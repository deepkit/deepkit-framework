import {Changes, DeleteResult, Entity, Formatter, GenericQueryResolver, PatchResult} from '@deepkit/orm';
import {ClassSchema, getClassSchema, resolveClassTypeOrForward, t} from '@deepkit/type';
import {DEEP_SORT, MongoQueryModel} from './query.model';
import {convertClassQueryToMongo,} from './mapping';
import {FilterQuery} from 'mongodb';
import {MongoDatabaseAdapter} from './adapter';
import {DeleteCommand} from './client/command/delete';
import {UpdateCommand} from './client/command/update';
import {AggregateCommand} from './client/command/aggregate';
import {CountCommand} from './client/command/count';
import {FindCommand} from './client/command/find';
import {mongoSerializer} from './mongo-serializer';

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
    protected countSchema = t.schema({
        count: t.number
    });

    async has(model: MongoQueryModel<T>): Promise<boolean> {
        return await this.count(model) > 0;
    }

    protected getPrimaryKeysProjection(classSchema: ClassSchema) {
        const pk: { [name: string]: 1 | 0 } = {_id: 0};
        for (const property of classSchema.getPrimaryFields()) {
            pk[property.name] = 1;
        }
        return pk;
    }

    protected async fetchIds(queryModel: MongoQueryModel<T>, limit: number = 0): Promise<any[]> {
        const primaryKeyName = this.classSchema.getPrimaryField().name;
        const projection = {[primaryKeyName]: 1 as const};

        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            if (limit) pipeline.push({$limit: limit});
            pipeline.push({$project: projection});
            const items = await this.databaseSession.adapter.client.execute(new AggregateCommand(this.classSchema, pipeline));
            return items.map(v => v[primaryKeyName]);
            // return items.map(v => {
            //     return {[primaryKeyName]: v[primaryKeyName]}
            // }) as Partial<T>[];
        } else {
            const mongoFilter = getMongoFilter(this.classSchema, queryModel);
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(this.classSchema, mongoFilter, projection, undefined, limit));
            return items.map(v => v[primaryKeyName]);
            // return items.map(v => {
            //     return {[primaryKeyName]: v[primaryKeyName]}
            // }) as Partial<T>[];
        }
    }

    public async delete(queryModel: MongoQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const primaryKeys = await this.fetchIds(queryModel, queryModel.limit);

        if (primaryKeys.length === 0) return;
        deleteResult.modified = primaryKeys.length;
        deleteResult.primaryKeys = primaryKeys;
        const primaryKeyName = this.classSchema.getPrimaryField().name;

        const query = convertClassQueryToMongo(this.classSchema.classType, {[primaryKeyName]: {$in: primaryKeys}} as FilterQuery<T>);
        await this.databaseSession.adapter.client.execute(new DeleteCommand(this.classSchema, query, queryModel.limit));
    }

    public async patch(model: MongoQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        if (model.hasJoins()) {
            throw new Error('Not implemented: Use aggregate to retrieve ids, then do the query');
        }
        let filter = getMongoFilter(this.classSchema, model);
        //todo implement "returning"
        const res = await this.databaseSession.adapter.client.execute(new UpdateCommand(this.classSchema, [{
            q: filter || {},
            u: changes,
            multi: !model.limit
        }]));
        patchResult.modified = res;
    }

    public async count(queryModel: MongoQueryModel<T>) {
        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            pipeline.push({$count: 'count'});
            const items = await this.databaseSession.adapter.client.execute(new AggregateCommand(this.classSchema, pipeline, this.countSchema));
            return items.length ? items[0].count : 0;
        } else {
            return await this.databaseSession.adapter.client.execute(new CountCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, queryModel),
                queryModel.skip,
                queryModel.limit,
            ));
        }
    }

    public async findOneOrUndefined(queryModel: MongoQueryModel<T>): Promise<T | undefined> {
        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            pipeline.push({$limit: 1});
            const items = await this.databaseSession.adapter.client.execute(new AggregateCommand(this.classSchema, pipeline));
            if (items.length) {
                const formatter = this.createFormatter(queryModel.withIdentityMap);
                return formatter.hydrate(queryModel, items[0]);
            }
        } else {
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, queryModel),
                this.getProjection(this.classSchema, queryModel.select),
                this.getSortFromModel(queryModel.sort),
                1,
                queryModel.skip,
            ));
            if (items.length) {
                const formatter = this.createFormatter(queryModel.withIdentityMap);
                return formatter.hydrate(queryModel, items[0]);
            }
        }
        return;
    }

    public async find(queryModel: MongoQueryModel<T>): Promise<T[]> {
        const formatter = this.createFormatter(queryModel.withIdentityMap);
        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            const items = await this.databaseSession.adapter.client.execute(new AggregateCommand(this.classSchema, pipeline));
            return items.map(v => formatter.hydrate(queryModel, v));
        } else {
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, queryModel),
                this.getProjection(this.classSchema, queryModel.select),
                this.getSortFromModel(queryModel.sort),
                queryModel.limit,
                queryModel.skip,
            ));
            return items.map(v => formatter.hydrate(queryModel, v));
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
                    const projection = this.getPrimaryKeysProjection(foreignSchema);
                    joinPipeline.push({$project: projection});
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
                                from: this.databaseSession.adapter.client.resolveCollectionName(viaClassType),
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
                                from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
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
                                from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
                                let: {foreign_id: '$' + foreignSchema.getPrimaryField().name},
                                pipeline: joinPipeline,
                                as: join.as,
                            },
                        });
                    }
                } else {
                    pipeline.push({
                        $lookup: {
                            from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
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

    protected getProjection<T>(classSchema: ClassSchema, select: Set<string>): { [name: string]: 0 | 1 } | undefined {
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
            this.classSchema,
            mongoSerializer,
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
