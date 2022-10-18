/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseAdapter, DatabaseSession, DeleteResult, Formatter, GenericQueryResolver, OrmEntity, PatchResult } from '@deepkit/orm';
import { Changes, getPartialSerializeFunction, ReflectionClass, ReflectionKind, ReflectionVisibility, resolveForeignReflectionClass, serializer, typeOf } from '@deepkit/type';
import { MongoClient } from './client/client.js';
import { AggregateCommand } from './client/command/aggregate.js';
import { CountCommand } from './client/command/count.js';
import { DeleteCommand } from './client/command/delete.js';
import { FindCommand } from './client/command/find.js';
import { FindAndModifyCommand } from './client/command/findAndModify.js';
import { UpdateCommand } from './client/command/update.js';
import { convertClassQueryToMongo } from './mapping.js';
import { DEEP_SORT, FilterQuery, MongoQueryModel } from './query.model.js';
import { MongoConnection } from './client/connection.js';
import { MongoDatabaseAdapter } from './adapter.js';
import { empty } from '@deepkit/core';
import { mongoSerializer } from './mongo-serializer.js';

export function getMongoFilter<T>(classSchema: ReflectionClass<T>, model: MongoQueryModel<T>): any {
    return convertClassQueryToMongo(classSchema, (model.filter || {}) as FilterQuery<T>, {}, {
        $parameter: (name, value) => {
            if (undefined === model.parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return model.parameters[value];
        }
    });
}

interface CountSchema {
    count: number;
}

export class MongoQueryResolver<T extends OrmEntity> extends GenericQueryResolver<T, DatabaseAdapter, MongoQueryModel<T>> {

    protected countSchema = ReflectionClass.from(typeOf<CountSchema>());

    constructor(
        classSchema: ReflectionClass<T>,
        protected session: DatabaseSession<MongoDatabaseAdapter>,
        protected client: MongoClient,
    ) {
        super(classSchema, session);
    }

    async has(model: MongoQueryModel<T>): Promise<boolean> {
        return await this.count(model) > 0;
    }

    protected getPrimaryKeysProjection(classSchema: ReflectionClass<any>) {
        const pk: { [name: string]: 1 | 0 } = { _id: 0 };
        for (const property of classSchema.getPrimaries()) {
            pk[property.name] = 1;
        }
        return pk;
    }

    protected async fetchIds(queryModel: MongoQueryModel<T>, limit: number = 0, connection: MongoConnection): Promise<any[]> {
        const primaryKeyName = this.classSchema.getPrimary().name;
        const projection = { [primaryKeyName]: 1 as const };

        if (queryModel.hasJoins()) {
            const pipeline = this.buildAggregationPipeline(queryModel);
            if (limit) pipeline.push({ $limit: limit });
            pipeline.push({ $project: projection });
            const command = new AggregateCommand(this.classSchema, pipeline);
            command.partial = true;
            const items = await connection.execute(command);
            return items.map(v => v[primaryKeyName]);
        } else {
            const mongoFilter = getMongoFilter(this.classSchema, queryModel);
            const items = await connection.execute(new FindCommand(this.classSchema, mongoFilter, projection, undefined, limit || queryModel.limit, queryModel.skip));
            return items.map(v => v[primaryKeyName]);
        }
    }

    public async delete(queryModel: MongoQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const connection = await this.client.getConnection(undefined, this.session.assignedTransaction);

        try {
            const primaryKeys = await this.fetchIds(queryModel, queryModel.limit, connection);

            if (primaryKeys.length === 0) return;
            deleteResult.modified = primaryKeys.length;
            deleteResult.primaryKeys = primaryKeys;
            const primaryKeyName = this.classSchema.getPrimary().name;

            const query = convertClassQueryToMongo(this.classSchema, { [primaryKeyName]: { $in: primaryKeys } } as FilterQuery<T>);
            await connection.execute(new DeleteCommand(this.classSchema, query, queryModel.limit));
        } finally {
            connection.release();
        }
    }

    public async patch(model: MongoQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        if (model.hasJoins()) {
            throw new Error('Not implemented: Use aggregate to retrieve ids, then do the query');
        }

        const filter = getMongoFilter(this.classSchema, model) || {};

        const partialSerialize = getPartialSerializeFunction(this.classSchema.type, mongoSerializer.serializeRegistry);
        const partialDeserialize = getPartialSerializeFunction(this.classSchema.type, serializer.deserializeRegistry);

        const u: any = {};
        if (changes.$set) u.$set = changes.$set;
        if (changes.$unset) u.$set = changes.$unset;
        if (changes.$inc) u.$inc = changes.$inc;

        if (u.$set) {
            u.$set = partialSerialize(u.$set);
        }

        const primaryKeyName = this.classSchema.getPrimary().name;

        const returning = new Set([...model.returning, ...changes.getReturning()]);

        const connection = await this.client.getConnection(undefined, this.session.assignedTransaction);

        try {
            if (model.limit === 1) {
                const command = new FindAndModifyCommand(
                    this.classSchema,
                    filter,
                    u
                );
                command.returnNew = true;
                command.fields = [primaryKeyName, ...returning];
                const res = await connection.execute(command);
                patchResult.modified = res.value ? 1 : 0;

                if (res.value) {
                    const converted = partialDeserialize(res.value) as any;
                    patchResult.primaryKeys = [converted[primaryKeyName]];
                    for (const name of returning) {
                        patchResult.returning[name] = [converted[name]];
                    }
                }
                return;
            }

            patchResult.modified = await connection.execute(new UpdateCommand(this.classSchema, [{
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

            const items = await connection.execute(new FindCommand(this.classSchema, filter, projection, {}, model.limit, model.skip));
            for (const item of items) {
                const converted = partialDeserialize(item);
                patchResult.primaryKeys.push(converted[primaryKeyName]);
                for (const name of returning) {
                    patchResult.returning[name].push(converted[name]);
                }
            }
        } finally {
            connection.release();
        }
    }

    public async count(queryModel: MongoQueryModel<T>) {
        const connection = await this.client.getConnection(undefined, this.session.assignedTransaction);

        try {
            //count command is not supported for transactions
            if (queryModel.hasJoins() || this.session.assignedTransaction) {
                const pipeline = this.buildAggregationPipeline(queryModel);
                pipeline.push({ $count: 'count' });
                const command = new AggregateCommand<any, CountSchema>(this.classSchema, pipeline, this.countSchema);
                const items = await connection.execute(command);
                return items.length ? items[0].count : 0;
            } else {
                const query = getMongoFilter(this.classSchema, queryModel);
                if (empty(query)) {
                    //when a query is empty, mongo returns an estimated count from meta-data.
                    //we don't want estimates, we want deterministic results, so we add a query
                    const primaryKey = this.classSchema.getPrimary().name;
                    query[primaryKey] = { $nin: [] };
                }
                return await connection.execute(new CountCommand(
                    this.classSchema,
                    query,
                    queryModel.limit,
                    queryModel.skip,
                ));
            }
        } finally {
            connection.release();
        }
    }

    protected getSchemaWithJoins(): ReflectionClass<any> {
        const jit = this.classSchema.getJitContainer();
        if (jit.ormMongoSchemaWithJoins) return jit.ormMongoSchemaWithJoins;

        const schema = this.classSchema.clone();

        for (const property of schema.getProperties().slice()) {
            if (property.isReference() || property.isBackReference()) {
                const name = '__ref_' + property.name;
                schema.addProperty({
                    name,
                    type: { kind: ReflectionKind.any },
                    visibility: ReflectionVisibility.public
                });
            }
        }

        return jit.ormMongoSchemaWithJoins = schema;
    }

    public async findOneOrUndefined(model: MongoQueryModel<T>): Promise<T | undefined> {
        const connection = await this.client.getConnection(undefined, this.session.assignedTransaction);

        try {
            if (model.hasJoins() || model.isAggregate()) {
                const pipeline = this.buildAggregationPipeline(model);
                pipeline.push({ $limit: 1 });
                const resultsSchema = model.isAggregate() ? this.getCachedAggregationSchema(model) : this.getSchemaWithJoins();
                const command = new AggregateCommand(this.classSchema, pipeline, resultsSchema);
                command.partial = model.isPartial();
                const items = await connection.execute(command);
                if (items.length) {
                    const formatter = this.createFormatter(model.withIdentityMap);
                    return formatter.hydrate(model, items[0]);
                }
            } else {
                const items = await connection.execute(new FindCommand(
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
        } finally {
            connection.release();
        }
    }

    protected getCachedAggregationSchema(model: MongoQueryModel<T>): ReflectionClass<any> {
        const jit = this.classSchema.getJitContainer();
        const keys: string[] = [...model.groupBy.values()];
        for (const [g, a] of model.aggregate.entries()) {
            keys.push(g + ':' + a.func);
        }

        const cacheKey = 'ormMongoAggregation' + keys.join('/');
        if (jit[cacheKey]) return jit[cacheKey];

        const schema = this.getSchemaWithJoins().clone();
        for (const g of model.groupBy.values()) {
            schema.addProperty({
                name: g,
                type: { kind: ReflectionKind.any },
                visibility: ReflectionVisibility.public
            });
        }
        for (const g of model.aggregate.keys()) {
            schema.addProperty({
                name: g,
                type: { kind: ReflectionKind.any },
                visibility: ReflectionVisibility.public
            });
        }

        return jit[cacheKey] = schema;
    }

    public async find(model: MongoQueryModel<T>): Promise<T[]> {
        const formatter = this.createFormatter(model.withIdentityMap);
        const connection = await this.client.getConnection(undefined, this.session.assignedTransaction);

        try {
            if (model.hasJoins() || model.isAggregate()) {
                const pipeline = this.buildAggregationPipeline(model);
                const resultsSchema = model.isAggregate() ? this.getCachedAggregationSchema(model) : this.getSchemaWithJoins();
                const command = new AggregateCommand(this.classSchema, pipeline, resultsSchema);
                command.partial = model.isPartial();
                const items = await connection.execute(command);
                if (model.isAggregate()) {
                    return items;
                }

                return items.map(v => formatter.hydrate(model, v));
            } else {
                const items = await connection.execute(new FindCommand(
                    this.classSchema,
                    getMongoFilter(this.classSchema, model),
                    this.getProjection(this.classSchema, model.select),
                    this.getSortFromModel(model.sort),
                    model.limit,
                    model.skip,
                ));
                return items.map(v => formatter.hydrate(model, v));
            }
        } finally {
            connection.release();
        }
    }

    protected buildAggregationPipeline(model: MongoQueryModel<T>) {
        const joinRefs: string[] = [];
        const handleJoins = <T>(pipeline: any[], query: MongoQueryModel<T>, schema: ReflectionClass<any>) => {
            for (const join of query.joins) {
                //refs are deserialized as `any` and then further deserialized using the default serializer
                join.as = '__ref_' + join.propertySchema.name;
                joinRefs.push(join.as);

                const foreignSchema = resolveForeignReflectionClass(join.propertySchema);
                const joinPipeline: any[] = [];

                if (join.propertySchema.isBackReference()) {
                    if (join.propertySchema.getBackReference().via) {
                    } else {
                        const backReference = foreignSchema.findReverseReference(
                            join.classSchema.getClassType(),
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

                if (join.propertySchema.isBackReference()) {
                    if (join.propertySchema.getBackReference().via) {
                        //many-to-many
                        const viaClassSchema = ReflectionClass.from(join.propertySchema.getBackReference().via);
                        const subAs = join.propertySchema.name;

                        const backReference = viaClassSchema.findReverseReference(
                            join.classSchema.getClassType(),
                            join.propertySchema,
                            //mappedBy is not for pivot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $lookup: {
                                from: this.client.resolveCollectionName(viaClassSchema),
                                let: { localField: '$' + join.classSchema.getPrimary().name },
                                pipeline: [
                                    { $match: { $expr: { $eq: ['$' + backReference.getForeignKeyName(), '$$localField'] } } }
                                ],
                                as: subAs,
                            },
                        });

                        const foreignSchema = resolveForeignReflectionClass(join.propertySchema);
                        const backReferenceForward = viaClassSchema.findReverseReference(
                            foreignSchema.getClassType(),
                            join.propertySchema,
                            //mappedBy is not for pivot tables. We would need 2 different mappedBy
                            // join.propertySchema.backReference.mappedBy as string
                        );

                        pipeline.push({
                            $addFields: { [subAs]: '$' + subAs + '.' + backReferenceForward.getForeignKeyName() },
                        });

                        pipeline.push({
                            $lookup: {
                                from: this.client.resolveCollectionName(foreignSchema),
                                let: { localField: '$' + subAs },
                                pipeline: [
                                    { $match: { $expr: { $in: ['$' + foreignSchema.getPrimary().name, '$$localField'] } } }
                                ].concat(joinPipeline),
                                as: join.as,
                            },
                        });

                        //important to unset the actual property in the database since its type is incompatible with the declared type in TS. (foreign key vs objects)
                        pipeline.push({
                            $unset: [join.propertySchema.name],
                        });
                    } else {
                        //one-to-many
                        pipeline.push({
                            $lookup: {
                                from: this.client.resolveCollectionName(foreignSchema),
                                let: { foreign_id: '$' + join.classSchema.getPrimary().name },
                                pipeline: joinPipeline,
                                as: join.as,
                            },
                        });
                    }
                } else {
                    pipeline.push({
                        $lookup: {
                            from: this.client.resolveCollectionName(foreignSchema),
                            let: { foreign_id: '$' + join.propertySchema.getForeignKeyName() },
                            pipeline: joinPipeline,
                            as: join.as,
                        },
                    });
                }

                if (join.propertySchema.isArray()) {
                    if (join.type === 'inner') {
                        pipeline.push({
                            $match: { [join.as]: { $ne: [] } }
                        });
                    }
                } else {
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
            const group: any = { _id: {} };
            const project: any = {};
            for (const g of model.groupBy.values()) {
                group._id[g] = '$' + g;
                project[g] = '$_id.' + g;
            }

            for (const [as, a] of model.aggregate.entries()) {
                if (a.func === 'sum') {
                    group[as] = { $sum: '$' + a.property.name };
                } else if (a.func === 'min') {
                    group[as] = { $min: '$' + a.property.name };
                } else if (a.func === 'max') {
                    group[as] = { $max: '$' + a.property.name };
                } else if (a.func === 'avg') {
                    group[as] = { $avg: '$' + a.property.name };
                } else if (a.func === 'count') {
                    group[as] = { $sum: 1 };
                } else if (a.func === 'group_concat') {
                    group[as] = { $push: '$' + a.property.name };
                }

                project[as] = 1;
            }

            pipeline.push({ $group: group });
            pipeline.push({ $project: project });
        }

        if (model.sort) pipeline.push({ $sort: this.getSortFromModel(model.sort) });
        if (model.skip) pipeline.push({ $skip: model.skip });
        if (model.limit) pipeline.push({ $limit: model.limit });

        if (!model.isAggregate()) {
            const projection = this.getProjection(this.classSchema, model.select);
            if (projection) {
                for (const name of joinRefs) {
                    (projection as any)[name] = 1;
                }
            }
            if (projection) pipeline.push({ $project: projection });
        }

        return pipeline;
    }

    /**
     * Returns undefined when no selection limitation has happened. When non-undefined
     * the mongo driver returns a t.partial.
     */
    protected getProjection<T>(classSchema: ReflectionClass<any>, select: Set<string>): { [name: string]: 0 | 1 } | undefined {
        const res: { [name: string]: 0 | 1 } = {};

        //as soon as we provide a {} to find/aggregate command, it triggers t.partial()
        if (select.size) {
            res['_id'] = 0;
            for (const v of select.values()) {
                (res as any)[v] = 1;
            }
            // for (const property of this.classSchema.getPrimaries()) {
            //     (res as any)[property.name] = 1;
            // }
            return res;
        } else {
            // for (const v of classSchema.getPropertiesMap().keys()) {
            //     (res as any)[v] = 1;
            // }
            return undefined;
        }
    }

    protected createFormatter(withIdentityMap: boolean = false) {
        return new Formatter(
            this.classSchema,
            serializer,
            this.session.getHydrator(),
            withIdentityMap ? this.session.identityMap : undefined
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
