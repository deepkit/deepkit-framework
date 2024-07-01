/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    createTables,
    DefaultPlatform,
    getPreparedEntity,
    prepareBatchUpdate,
    PreparedAdapter,
    PreparedEntity,
    SqlBuilder,
    SqlBuilderRegistry,
    SQLStatement,
} from '@deepkit/sql';
import {
    DatabaseAdapter,
    DatabaseEntityRegistry,
    DatabaseError,
    DatabaseLogger,
    DatabasePersistence,
    DatabasePersistenceChangeSet,
    DatabaseSession,
    DatabaseUpdateError,
    DeleteResult,
    ensureDatabaseError,
    getStateCacheId,
    MigrateOptions,
    OrmEntity,
    PatchResult,
    SelectorResolver,
    SelectorState,
    UniqueConstraintFailure,
} from '@deepkit/orm';
import { PostgresPlatform } from './postgres-platform.js';
import { empty } from '@deepkit/core';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { Changes, ReflectionClass } from '@deepkit/type';
import { PostgresClientConfig } from './config.js';
import {
    FindCommand,
    InsertCommand,
    PostgresClient,
    PostgresClientConnection,
    PostgresClientPrepared,
    PostgresConnectionPool,
    PostgresDatabaseTransaction,
} from './client.js';

/**
 * Converts a specific database error to a more specific error, if possible.
 */
function handleSpecificError(session: DatabaseSession, error: DatabaseError): Error {
    let cause: any = error;
    while (cause) {
        if (cause instanceof Error) {
            if (cause.message.includes('duplicate key value')
                && 'table' in cause && 'string' === typeof cause.table
                && 'detail' in cause && 'string' === typeof cause.detail
            ) {
                return new UniqueConstraintFailure(`${cause.message}: ${cause.detail}`, { cause: error });
            }
            cause = cause.cause;
        }
    }

    return error;
}

export class PostgresStatement extends SQLStatement {
    protected released = false;

    constructor(protected logger: DatabaseLogger, protected sql: string, protected prepared: PostgresClientPrepared, protected stopwatch?: Stopwatch) {
        super();
    }

    async get(params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            this.logger.logQuery(this.sql, params);
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await this.prepared.execute(params);
            return res.rows[0];
        } catch (error: any) {
            error = ensureDatabaseError(error);
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    async all(params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            this.logger.logQuery(this.sql, params);
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await this.prepared.execute(params);
            return res.rows;
        } catch (error: any) {
            error = ensureDatabaseError(error, `Query: ${this.sql}\nParams: ${params}`);
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    release() {
    }
}

// function typeSafeDefaultValue(property: ReflectionProperty): any {
//     if (property.type.kind === ReflectionKind.string) return '';
//     if (property.type.kind === ReflectionKind.number) return 0;
//     if (property.type.kind === ReflectionKind.boolean) return false;
//     if (property.type.kind === ReflectionKind.class && property.type.classType === Date) return false;
//
//     return null;
// }

export class PostgresPersistence extends DatabasePersistence {
    protected connection?: PostgresClientConnection;

    constructor(protected platform: DefaultPlatform, public pool: PostgresConnectionPool, public session: DatabaseSession<any>) {
        super();
    }

    async getInsertBatchSize(schema: ReflectionClass<any>): Promise<number> {
        return Math.floor(30000 / schema.getProperties().length);
    }

    async insert<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const batchSize = await this.getInsertBatchSize(classSchema);
        const prepared = getPreparedEntity(this.session.adapter, classSchema);

        if (batchSize > items.length) {
            await this.batchInsert(prepared, items);
            await this.populateAutoIncrementFields(prepared, items);
        } else {
            for (let i = 0; i < items.length; i += batchSize) {
                const batched = items.slice(i, i + batchSize);
                await this.batchInsert(prepared, batched);
                await this.populateAutoIncrementFields(prepared, batched);
            }
        }
    }

    protected async batchInsert<T>(prepared: PreparedEntity, items: T[]) {
        const connection = await this.getConnection();
        try {
            await connection.execute(new InsertCommand(this.platform, prepared, items));
        } finally {
            connection.release();
        }

        // const scopeSerializer = getSerializeFunction(classSchema.type, this.platform.serializer.serializeRegistry);
        // const placeholder = new this.platform.placeholderStrategy;
        //
        // const insert: string[] = [];
        // const params: any[] = [];
        // const names: string[] = [];
        // const prepared = getPreparedEntity(this.session.adapter, classSchema);
        //
        // for (const property of prepared.fields) {
        //     if (property.autoIncrement) continue;
        //     names.push(property.columnNameEscaped);
        // }
        //
        // for (const item of items) {
        //     const converted = scopeSerializer(item);
        //     const row: string[] = [];
        //
        //     for (const property of prepared.fields) {
        //         if (property.autoIncrement) continue;
        //
        //         const v = converted[property.name];
        //         params.push(v === undefined ? null : v);
        //         row.push(property.sqlTypeCast(placeholder.getPlaceholder()));
        //     }
        //
        //     insert.push(row.join(', '));
        // }

        // const sql = this.getInsertSQL(classSchema, names, insert);
        // try {
        //     await (await this.getConnection()).run(sql, params);
        // } catch (error: any) {
        //     error = new DatabaseInsertError(
        //         classSchema,
        //         items as OrmEntity[],
        //         `Could not insert ${classSchema.getClassName()} into database: ${formatError(error)}`,
        //         { cause: error },
        //     );
        //     throw this.handleSpecificError(error);
        // }
    }

    release(): void {
        this.connection?.release();
    }

    async getConnection(): Promise<PostgresClientConnection> {
        if (!this.connection) {
            return this.connection = await this.pool.getConnection();
        }

        return this.connection;
    }

    remove<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        return Promise.resolve(undefined);
    }

    update<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        return Promise.resolve(undefined);
    }

    handleSpecificError(error: Error): Error {
        return handleSpecificError(this.session, error);
    }

    async batchUpdate<T extends OrmEntity>(entity: PreparedEntity, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const prepared = prepareBatchUpdate(this.platform, entity, changeSets);
        if (!prepared) return;

        const placeholderStrategy = new this.platform.placeholderStrategy();
        const params: any[] = [];
        const selects: string[] = [];
        const valuesValues: string[] = [];
        const valuesSetValues: string[] = [];
        const valuesNames: string[] = [];
        const valuesSetNames: string[] = [];
        for (const fieldName of prepared.changedFields) {
            valuesNames.push(fieldName);
            valuesSetNames.push('_changed_' + fieldName);
        }

        for (let i = 0; i < changeSets.length; i++) {
            params.push(prepared.primaryKeys[i]);
            let pkValue = entity.primaryKey.sqlTypeCast(placeholderStrategy.getPlaceholder());

            valuesValues.push('(' + pkValue + ',' + prepared.changedProperties.map(property => {
                params.push(prepared.values[property.name][i]);
                return property.sqlTypeCast(placeholderStrategy.getPlaceholder());
            }).join(',') + ')');
        }

        for (let i = 0; i < changeSets.length; i++) {
            params.push(prepared.primaryKeys[i]);
            let valuesSetValueSql = entity.primaryKey.sqlTypeCast(placeholderStrategy.getPlaceholder());
            for (const fieldName of prepared.changedFields) {
                valuesSetValueSql += ', ' + prepared.valuesSet[fieldName][i];
            }
            valuesSetValues.push('(' + valuesSetValueSql + ')');
        }

        for (const i of prepared.changedFields) {
            const col = entity.fieldMap[i].columnNameEscaped;
            const colChanged = '_changed_' + i;
            if (prepared.aggregateSelects[i]) {
                const select: string[] = [];
                select.push('CASE');
                for (const item of prepared.aggregateSelects[i]) {
                    select.push(`WHEN _.${prepared.originPkField} = ${item.id} THEN ${item.sql}`);
                }

                select.push(`ELSE (CASE WHEN ${colChanged} = 0 THEN _origin.${col} ELSE _.${col} END) END as ${col}`);
                selects.push(select.join(' '));
            } else {
                //if(check, true, false) => COALESCE(NULLIF(check, true), false)
                selects.push(`(CASE WHEN ${colChanged} = 0 THEN _origin.${col} ELSE _.${col} END) as ${col}`);
            }
        }

        const returningSelect: string[] = [];
        returningSelect.push(prepared.tableName + '.' + prepared.pkField);
        if (!empty(prepared.setReturning)) {
            for (const i in prepared.setReturning) {
                returningSelect.push(prepared.tableName + '.' + this.platform.quoteIdentifier(i));
            }
        }

        const escapedValuesNames = valuesNames.map(v => entity.fieldMap[v].columnNameEscaped);

        const sql = `
              WITH _b(${prepared.originPkField}, ${escapedValuesNames.join(', ')}) AS (
                SELECT _.${prepared.originPkField}, ${selects.join(', ')} FROM
                    (VALUES ${valuesValues.join(', ')}) as _(${prepared.originPkField}, ${escapedValuesNames.join(', ')})
                    INNER JOIN (VALUES ${valuesSetValues.join(', ')}) as _set(${prepared.pkField}, ${valuesSetNames.join(', ')}) ON (_.${prepared.originPkField} = _set.${prepared.pkField})
                    INNER JOIN ${prepared.tableName} as _origin ON (_origin.${prepared.pkField} = _.${prepared.originPkField})
              )
              UPDATE ${prepared.tableName}
              SET ${prepared.setNames.join(', ')}
              FROM _b
              WHERE ${prepared.tableName}.${prepared.pkField} = _b.${prepared.originPkField}
              RETURNING ${returningSelect.join(', ')};
        `;

        try {
            // const connection = await this.getConnection(); //will automatically be released in SQLPersistence
            // const result = await connection.execAndReturnAll(sql, params);
            // for (const returning of result) {
            //     const r = prepared.assignReturning[returning[prepared.pkName]];
            //     if (!r) continue;
            //
            //     for (const name of r.names) {
            //         r.item[name] = returning[name];
            //     }
            // }
        } catch (error: any) {
            const reflection = ReflectionClass.from(entity.type);
            error = new DatabaseUpdateError(
                reflection,
                changeSets,
                `Could not update ${reflection.getClassName()} in database`,
                { cause: error },
            );
            throw this.handleSpecificError(error);
        }
    }

    protected async populateAutoIncrementFields<T>(prepared: PreparedEntity, items: T[]) {
        // const autoIncrement = classSchema.getAutoIncrement();
        // if (!autoIncrement) return;
        // const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        //
        // //We adjusted the INSERT SQL with additional RETURNING which returns all generated
        // //auto-increment values. We read the result and simply assign the value.
        // const name = autoIncrement.name;
        // const insertedRows = connection.lastReturningRows;
        // if (!insertedRows.length) return;
        //
        // for (let i = 0; i < items.length; i++) {
        //     items[i][name] = insertedRows[i][name];
        // }
    }

    protected getInsertSQL(classSchema: ReflectionClass<any>, fields: string[], values: string[]): string {
        const autoIncrement = classSchema.getAutoIncrement();
        const returning = autoIncrement ? ` RETURNING ${this.platform.quoteIdentifier(autoIncrement.name)}` : '';

        if (fields.length === 0) {
            const pkName = this.platform.quoteIdentifier(classSchema.getPrimary().name);
            fields.push(pkName);
            values.fill('DEFAULT');
        }

        return `INSERT INTO ${this.platform.getTableIdentifier(classSchema)} (${fields.join(', ')}) VALUES (${values.join('), (')}) ${returning}`;
    }
}

export class PostgresSelectorResolver<T extends OrmEntity> extends SelectorResolver<T> {
    constructor(
        public connectionPool: PostgresConnectionPool,
        public platform: DefaultPlatform,
        public adapter: PreparedAdapter,
        public session: DatabaseSession<PostgresDatabaseAdapter>,
    ) {
        super(session);
    }

    count(model: SelectorState): Promise<number> {
        return Promise.resolve(0);
    }

    async find(model: SelectorState): Promise<T[]> {
        const cacheId = getStateCacheId(model);
        const connection = await this.connectionPool.getConnection({}, cacheId);

        try {
            let findCommand = connection.getCache(cacheId) as FindCommand<T[]> | undefined;
            if (!findCommand) {
                const sqlBuilder = new SqlBuilder(this.adapter);
                const sql = sqlBuilder.select(model);
                const prepared = getPreparedEntity(this.adapter, model.schema);
                findCommand = new FindCommand(sql.sql, prepared, model, '');
                connection.setCache(cacheId, findCommand);
            }

            findCommand.setParameters(model.params);

            //todo identity map + stuff that the Formatter did
            return await connection.execute(findCommand);
        } finally {
            connection.release();
        }
    }

    async findOneOrUndefined(model: SelectorState): Promise<T | undefined> {
        model = { ...model, limit: 1 };
        const rows = await this.find(model);
        return rows[0];
    }

    async delete(model: SelectorState<T>, deleteResult: DeleteResult<T>): Promise<void> {
        // const primaryKey = model.schema.getPrimary();
        // const pkField = this.platform.quoteIdentifier(primaryKey.name);
        // const primaryKeyConverted = primaryKeyObjectConverter(model.schema, this.platform.serializer.deserializeRegistry);
        //
        // const sqlBuilder = new SqlBuilder(this.adapter);
        // const tableName = this.platform.getTableIdentifier(model.schema);
        // const select = sqlBuilder.select(model, { select: [`${tableName}.${pkField}`] });
        //
        // const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        // try {
        //     const sql = `
        //         WITH _ AS (${select.sql})
        //         DELETE
        //         FROM ${tableName} USING _
        //         WHERE ${tableName}.${pkField} = _.${pkField}
        //         RETURNING ${tableName}.${pkField}
        //     `;
        //
        //     const rows = await connection.execAndReturnAll(sql, select.params);
        //     deleteResult.modified = rows.length;
        //     // for (const row of rows) {
        //     //     deleteResult.primaryKeys.push(primaryKeyConverted(row[primaryKey.name]));
        //     // }
        // } catch (error: any) {
        //     error = new DatabaseDeleteError(model.schema, 'Could not delete in database', { cause: error });
        //     error.query = model;
        //     throw this.handleSpecificError(error);
        // } finally {
        //     connection.release();
        // }
    }

    handleSpecificError(error: Error): Error {
        // return handleSpecificError(this.session, error);
        return error;
    }

    async patch(model: SelectorState<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const select: string[] = [];
        const selectParams: any[] = [];
        const entity = getPreparedEntity(this.adapter, model.schema);
        const tableName = entity.tableNameEscaped;
        // const primaryKey = model.schema.getPrimary();
        // const primaryKeyConverted = primaryKeyObjectConverter(model.schema, this.platform.serializer.deserializeRegistry);
        //
        // const fieldsSet: { [name: string]: 1 } = {};
        // const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};
        //
        // const patchSerialize = getPatchSerializeFunction(model.schema.type, this.platform.serializer.serializeRegistry);
        // const $set = changes.$set ? patchSerialize(changes.$set, undefined) : undefined;
        // const set: string[] = [];
        //
        // if ($set) for (const i in $set) {
        //     if (!$set.hasOwnProperty(i)) continue;
        //     if ($set[i] === undefined || $set[i] === null) {
        //         set.push(`${this.platform.quoteIdentifier(i)} = NULL`);
        //     } else {
        //         fieldsSet[i] = 1;
        //         select.push(`$${selectParams.length + 1} as ${this.platform.quoteIdentifier(asAliasName(i))}`);
        //         selectParams.push($set[i]);
        //     }
        // }
        //
        // if (changes.$unset) for (const i in changes.$unset) {
        //     if (!changes.$unset.hasOwnProperty(i)) continue;
        //     fieldsSet[i] = 1;
        //     select.push(`NULL as ${this.platform.quoteIdentifier(i)}`);
        // }
        //
        // // todo readd
        // // for (const i of model.returning) {
        // //     aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, model.schema.type), this.platform.serializer.deserializeRegistry) };
        // //     select.push(`(${this.platform.quoteIdentifier(i)} ) as ${this.platform.quoteIdentifier(i)}`);
        // // }
        //
        // if (changes.$inc) for (const i in changes.$inc) {
        //     if (!changes.$inc.hasOwnProperty(i)) continue;
        //     fieldsSet[i] = 1;
        //     aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, model.schema.type), this.platform.serializer.serializeRegistry) };
        //     const sqlTypeCast = getDeepTypeCaster(entity, i);
        //     select.push(`(${sqlTypeCast('(' + this.platform.getColumnAccessor('', i) + ')')} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(asAliasName(i))}`);
        // }
        //
        // for (const i in fieldsSet) {
        //     if (i.includes('.')) {
        //         let [firstPart, secondPart] = splitDotPath(i);
        //         const path = '{' + secondPart.replace(/\./g, ',').replace(/[\]\[]/g, '') + '}';
        //         set.push(`${this.platform.quoteIdentifier(firstPart)} = jsonb_set(${this.platform.quoteIdentifier(firstPart)}, '${path}', to_jsonb(_b.${this.platform.quoteIdentifier(asAliasName(i))}))`);
        //     } else {
        //         const property = entity.fieldMap[i];
        //         const ref = '_b.' + this.platform.quoteIdentifier(asAliasName(i));
        //         set.push(`${this.platform.quoteIdentifier(i)} = ${property.sqlTypeCast(ref)}`);
        //     }
        // }
        // let bPrimaryKey = primaryKey.name;
        // //we need a different name because primaryKeys could be updated as well
        // if (fieldsSet[primaryKey.name]) {
        //     select.unshift(this.platform.quoteIdentifier(primaryKey.name) + ' as __' + primaryKey.name);
        //     bPrimaryKey = '__' + primaryKey.name;
        // } else {
        //     select.unshift(this.platform.quoteIdentifier(primaryKey.name));
        // }
        //
        // const returningSelect: string[] = [];
        // returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(primaryKey.name));
        //
        // if (!empty(aggregateFields)) {
        //     for (const i in aggregateFields) {
        //         returningSelect.push(this.platform.getColumnAccessor(tableName, i));
        //     }
        // }
        //
        // const sqlBuilder = new SqlBuilder(this.adapter, selectParams.slice());
        // const selectSQL = sqlBuilder.select(model, { select });
        //
        // const sql = `
        //     WITH _b AS (${selectSQL.sql})
        //     UPDATE
        //         ${tableName}
        //     SET ${set.join(', ')}
        //     FROM _b
        //     WHERE ${tableName}.${this.platform.quoteIdentifier(primaryKey.name)} = _b.${this.platform.quoteIdentifier(bPrimaryKey)}
        //         RETURNING ${returningSelect.join(', ')}
        // `;
        //
        // const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        // try {
        //     const result = await connection.execAndReturnAll(sql, selectSQL.params);
        //
        //     patchResult.modified = result.length;
        //     for (const i in aggregateFields) {
        //         patchResult.returning[i] = [];
        //     }
        //
        //     for (const returning of result) {
        //         patchResult.primaryKeys.push(primaryKeyConverted(returning[primaryKey.name]));
        //         for (const i in aggregateFields) {
        //             patchResult.returning[i].push(aggregateFields[i].converted(returning[i]));
        //         }
        //     }
        // } catch (error: any) {
        //     error = new DatabasePatchError(model.schema, model, changes, `Could not patch ${model.schema.getClassName()} in database`, { cause: error });
        //     throw this.handleSpecificError(error);
        // } finally {
        //     connection.release();
        // }
    }
}

export class PostgresDatabaseAdapter extends DatabaseAdapter implements PreparedAdapter {
    public client: PostgresClient;
    public platform = new PostgresPlatform();
    closed = false;

    builderRegistry = new SqlBuilderRegistry;
    cache = {};
    preparedEntities = new Map<ReflectionClass<any>, PreparedEntity>;

    isNativeForeignKeyConstraintSupported(): boolean {
        return false;
    }

    migrate(options: MigrateOptions, entityRegistry: DatabaseEntityRegistry): Promise<void> {
        return Promise.resolve(undefined);
    }

    constructor(options: PostgresClientConfig | string) {
        super();
        this.client = new PostgresClient(options);
    }

    public async createTables(entityRegistry: DatabaseEntityRegistry): Promise<void> {
        await createTables(entityRegistry, this.client.pool, this.platform, this);
    }

    createSelectorResolver(session: DatabaseSession<this>): SelectorResolver<any> {
        return new PostgresSelectorResolver(this.client.pool, this.platform, this, session);
    }

    getName(): string {
        return 'postgres';
    }

    getSchemaName(): string {
        //todo extract schema name from connection options. This acts as default when a table has no schemaName defined.
        return '';
    }

    createPersistence(session: DatabaseSession<this>): PostgresPersistence {
        return new PostgresPersistence(this.platform, this.client.pool, session);
    }

    createTransaction(session: DatabaseSession<this>): PostgresDatabaseTransaction {
        return new PostgresDatabaseTransaction;
    }

    disconnect(force?: boolean): void {
        if (this.closed) return;
        this.closed = true;
        this.client.pool.close();
    }
}
