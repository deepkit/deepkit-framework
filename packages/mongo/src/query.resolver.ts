/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Changes, DeleteResult, Entity, Formatter, GenericQueryResolver, PatchResult } from '@deepkit/orm';
import { ClassSchema, createClassSchema, getClassSchema, resolveClassTypeOrForward, t } from '@deepkit/type';
import { MongoDatabaseAdapter } from './adapter';
import { AggregateCommand } from './client/command/aggregate';
import { CountCommand } from './client/command/count';
import { DeleteCommand } from './client/command/delete';
import { FindCommand } from './client/command/find';
import { FindAndModifyCommand } from './client/command/find-and-modify';
import { UpdateCommand } from './client/command/update';
import { convertClassQueryToMongo } from './mapping';
import { mongoSerializer } from './mongo-serializer';
import { DEEP_SORT, FilterQuery, MongoQueryModel } from './query.model';

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
        const pk: { [name: string]: 1 | 0 } = { _id: 0 };
        for (const property of classSchema.getPrimaryFields()) {
            pk[property.name] = 1;
        }
        return pk;
    }

    protected async fetchIds(queryModel: MongoQueryModel<T>, limit: number = 0): Promise<any[]> {
        const primaryKeyName = this.classSchema.getPrimaryField().name;
        const projection = { [primaryKeyName]: 1 as const };

        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            if (limit) pipeline.push({ $limit: limit });
            pipeline.push({ $project: projection });
            const command = new AggregateCommand(this.classSchema, pipeline);
            command.partial = true;
            const items = await this.databaseSession.adapter.client.execute(command);
            return items.map(v => v[primaryKeyName]);
        } else {
            const mongoFilter = getMongoFilter(this.classSchema, queryModel);
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(this.classSchema, mongoFilter, projection, undefined, limit));
            return items.map(v => v[primaryKeyName]);
        }
    }

    public async delete(queryModel: MongoQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const primaryKeys = await this.fetchIds(queryModel, queryModel.limit);

        if (primaryKeys.length === 0) return;
        deleteResult.modified = primaryKeys.length;
        deleteResult.primaryKeys = primaryKeys;
        const primaryKeyName = this.classSchema.getPrimaryField().name;

        const query = convertClassQueryToMongo(this.classSchema.classType, { [primaryKeyName]: { $in: primaryKeys } } as FilterQuery<T>);
        await this.databaseSession.adapter.client.execute(new DeleteCommand(this.classSchema, query, queryModel.limit));
    }

    public async patch(model: MongoQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        if (model.hasJoins()) {
            throw new Error('Not implemented: Use aggregate to retrieve ids, then do the query');
        }

        const filter = getMongoFilter(this.classSchema, model) || {};
        const serializer = mongoSerializer.for(this.classSchema);

        const u: any = {};
        if (changes.$set) u.$set = changes.$set;
        if (changes.$unset) u.$set = changes.$unset;
        if (changes.$inc) u.$inc = changes.$inc;
        if (u.$set) {
            u.$set = serializer.partialSerialize(u.$set);
        }
        const primaryKeyName = this.classSchema.getPrimaryField().name;

        const returning = new Set([...model.returning, ...changes.getReturning()]);

        if (model.limit === 1) {
            const command = new FindAndModifyCommand(
                this.classSchema,
                filter,
                u
            );
            command.returnNew = true;
            command.fields = [primaryKeyName, ...returning];
            const res = await this.databaseSession.adapter.client.execute(command);
            patchResult.modified = res.value ? 1 : 0;

            if (res.value) {
                const converted = serializer.partialDeserialize(res.value) as any;
                patchResult.primaryKeys = [converted[primaryKeyName]];
                for (const name of returning) {
                    patchResult.returning[name] = [converted[name]];
                }
            }
            return;
        }

        patchResult.modified = await this.databaseSession.adapter.client.execute(new UpdateCommand(this.classSchema, [{
            q: filter,
            u: u,
            multi: !model.limit
        }]));

        if (!returning.size) return;

        const projection: { [name: string]: 1 | 0 } = {};
        projection[primaryKeyName] = 1;
        for (const name of returning) {
            projection[name] = 1;
            patchResult.returning[name] = [];
        }

        const items = await this.databaseSession.adapter.client.execute(new FindCommand(this.classSchema, filter, projection, {}, model.limit));
        for (const item of items) {
            const converted = serializer.partialDeserialize(item);
            patchResult.primaryKeys.push(converted[primaryKeyName]);
            for (const name of returning) {
                patchResult.returning[name].push(converted[name]);
            }
        }
    }

    public async count(queryModel: MongoQueryModel<T>) {
        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            pipeline.push({ $count: 'count' });
            const command = new AggregateCommand(this.classSchema, pipeline, this.countSchema);
            const items = await this.databaseSession.adapter.client.execute(command);
            return items.length ? items[0].count : 0;
        } else {
            return await this.databaseSession.adapter.client.execute(new CountCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, queryModel),
                queryModel.limit,
                queryModel.skip,
            ));
        }
    }

    public async findOneOrUndefined(model: MongoQueryModel<T>): Promise<T | undefined> {
        if (model.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(model);
            pipeline.push({ $limit: 1 });
            const command = new AggregateCommand(this.classSchema, pipeline);
            command.partial = model.isPartial();
            const items = await this.databaseSession.adapter.client.execute(command);
            if (items.length) {
                const formatter = this.createFormatter(model.withIdentityMap);
                return formatter.hydrate(model, items[0]);
            }
        } else {
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, model),
                this.getProjection(this.classSchema, model.select),
                this.getSortFromModel(model.sort),
                1,
                model.skip,
            ));
            if (items.length) {
                const formatter = this.createFormatter(model.withIdentityMap);
                return formatter.hydrate(model, items[0]);
            }
        }
        return;
    }

    public async find(model: MongoQueryModel<T>): Promise<T[]> {
        const formatter = this.createFormatter(model.withIdentityMap);
        if (model.hasJoins() || model.isAggregate()) {
            const pipeline = this.buildAggregationPipeline(model);

            let resultsSchema = this.classSchema;
            if (model.isAggregate()) {
                //todo: cache this depending on the fields selected
                resultsSchema = createClassSchema();
                for (const g of model.groupBy.values()) {
                    resultsSchema.addProperty(g, t.any);
                }
                for (const g of model.aggregate.keys()) {
                    resultsSchema.addProperty(g, t.any);
                }
            }

            const command = new AggregateCommand(this.classSchema, pipeline, resultsSchema);
            command.partial = model.isPartial();
            const items = await this.databaseSession.adapter.client.execute(command);
            if (model.isAggregate()) {
                return items;
            }

            return items.map(v => formatter.hydrate(model, v));
        } else {
            const items = await this.databaseSession.adapter.client.execute(new FindCommand(
                this.classSchema,
                getMongoFilter(this.classSchema, model),
                this.getProjection(this.classSchema, model.select),
                this.getSortFromModel(model.sort),
                model.limit,
                model.skip,
            ));
            return items.map(v => formatter.hydrate(model, v));
        }
    }

    protected buildAggregationPipeline(model: MongoQueryModel<T>) {
        const handleJoins = <T>(pipeline: any[], query: MongoQueryModel<T>, schema: ClassSchema) => {
            for (const join of query.joins) {
                if (join.query.model.isPartial()) {
                    join.as = '__refp_' + join.propertySchema.name;
                } else {
                    join.as = '__ref_' + join.propertySchema.name;
                }

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
                            $match: { $expr: { $eq: ['$' + backReference.getForeignKeyName(), '$$foreign_id'] } }
                        });
                    }
                } else {
                    joinPipeline.push({
                        $match: { $expr: { $eq: ['$' + join.foreignPrimaryKey.name, '$$foreign_id'] } }
                    });
                }

                if (join.query.model.hasJoins()) {
                    handleJoins(joinPipeline, join.query.model, foreignSchema);
                }

                if (join.query.model.filter) joinPipeline.push({ $match: getMongoFilter(join.query.classSchema, join.query.model) });
                if (join.query.model.sort) joinPipeline.push({ $sort: this.getSortFromModel(join.query.model.sort) });
                if (join.query.model.skip) joinPipeline.push({ $skip: join.query.model.skip });
                if (join.query.model.limit) joinPipeline.push({ $limit: join.query.model.limit });

                if (join.populate) {
                    const projection = this.getProjection(join.query.classSchema, join.query.model.select);
                    // if (!join.classSchema.hasProperty('_id') || (join.query.model.isPartial() && !join.query.model.isSelected('_id'))) {
                    //     project['_id'] = 0;
                    // }
                    if (projection) joinPipeline.push({ $project: projection });
                } else {
                    //not populated, so only fetch primary key.
                    const projection = this.getPrimaryKeysProjection(foreignSchema);
                    joinPipeline.push({ $project: projection });
                }

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
                                let: { localField: '$' + join.classSchema.getPrimaryField().name },
                                pipeline: [
                                    { $match: { $expr: { $eq: ['$' + backReference.getForeignKeyName(), '$$localField'] } } }
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
                            $addFields: { [subAs]: '$' + subAs + '.' + backReferenceForward.getForeignKeyName() },
                        });

                        pipeline.push({
                            $lookup: {
                                from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
                                let: { localField: '$' + subAs },
                                pipeline: [
                                    { $match: { $expr: { $in: ['$' + foreignSchema.getPrimaryField().name, '$$localField'] } } }
                                ].concat(joinPipeline),
                                as: join.as,
                            },
                        });
                    } else {
                        //one-to-many
                        pipeline.push({
                            $lookup: {
                                from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
                                let: { foreign_id: '$' + join.classSchema.getPrimaryField().name },
                                pipeline: joinPipeline,
                                as: join.as,
                            },
                        });
                    }
                } else {
                    pipeline.push({
                        $lookup: {
                            from: this.databaseSession.adapter.client.resolveCollectionName(foreignSchema),
                            let: { foreign_id: '$' + join.propertySchema.getForeignKeyName() },
                            pipeline: joinPipeline,
                            as: join.as,
                        },
                    });
                }

                if (join.propertySchema.isArray) {
                    if (!schema.hasProperty(join.as)) {
                        //it's important that joins with partials have a different name. We set it at the beginngin
                        //of this for each join loop.
                        if (join.query.model.isPartial()) {
                            schema.addProperty(join.as, t.array(t.partial(foreignSchema)).noValidation.exclude('all'));
                        } else {
                            schema.addProperty(join.as, t.array(t.type(foreignSchema)).noValidation.exclude('all'));
                        }
                    }

                    if (join.type === 'inner') {
                        pipeline.push({
                            $match: { [join.as]: { $ne: [] } }
                        });
                    }
                } else {
                    if (!schema.hasProperty(join.as)) {
                        //it's important that joins with partials have a different name. We set it at the beginngin
                        //of this for each join loop.
                        if (join.query.model.isPartial()) {
                            schema.addProperty(join.as, t.partial(foreignSchema).noValidation.exclude('all'));
                        } else {
                            schema.addProperty(join.as, t.type(foreignSchema).noValidation.exclude('all'));
                        }
                    }

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

        if (model.filter) pipeline.push({ $match: getMongoFilter(this.classSchema, model) });

        if (model.isAggregate()) {
            const group: any = {_id: {}};
            const project: any = {};
            for (const g of model.groupBy.values()) {
                group._id[g] = '$' + g;
                project[g] = "$_id." + g;
            }

            for (const [as, a] of model.aggregate.entries()) {
                if (a.func === 'sum') {
                    group[as] = {$sum: '$' + a.property.name};
                } else if (a.func === 'min') {
                    group[as] = {$min: '$' + a.property.name};
                } else if (a.func === 'max') {
                    group[as] = {$max: '$' + a.property.name};
                } else if (a.func === 'avg') {
                    group[as] = {$avg: '$' + a.property.name};
                } else if (a.func === 'group_concat') {
                    group[as] = {$push: '$' + a.property.name};
                }

                project[as] = 1;
            }

            pipeline.push({$group: group});
            pipeline.push({$project: project});
        }

        if (model.sort) pipeline.push({ $sort: this.getSortFromModel(model.sort) });
        if (model.skip) pipeline.push({ $skip: model.skip });
        if (model.limit) pipeline.push({ $limit: model.limit });

        if (!model.isAggregate()) {
            const projection = this.getProjection(this.classSchema, model.select);
            if (projection) pipeline.push({ $project: projection });
        }

        return pipeline;
    }

    /** 
     * Returns undefined when no selection limitation has happened. When non-undefined 
     * the mongo driver returns a t.partial.
    */
    protected getProjection<T>(classSchema: ClassSchema, select: Set<string>): { [name: string]: 0 | 1 } | undefined {
        const res: { [name: string]: 0 | 1 } = {};

        //as soon as we provide a {} to find/aggregate command, it triggers t.partial()
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
