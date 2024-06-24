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
    Database,
    DatabaseAdapter,
    DatabaseDeleteError,
    DatabaseEntityRegistry,
    DatabaseError,
    DatabaseInsertError,
    DatabaseLogger,
    DatabasePersistence,
    DatabasePersistenceChangeSet,
    DatabaseSession,
    DatabaseTransaction,
    DatabaseUpdateError,
    DeleteResult,
    filter,
    MigrateOptions,
    orderBy,
    OrmEntity,
    PatchResult,
    Select,
    SelectorResolver,
    SelectorState,
} from '@deepkit/orm';
import { isClass } from '@deepkit/core';
import {
    Changes,
    entity,
    getPartialSerializeFunction,
    getSerializeFunction,
    PrimaryKey,
    ReflectionClass,
} from '@deepkit/type';
import { DefaultPlatform, SqlPlaceholderStrategy } from './platform/default-platform.js';
import { SqlBuilder } from './sql-builder.js';
import { SqlFormatter } from './sql-formatter.js';
import { DatabaseComparator, DatabaseModel } from './schema/table.js';
import { Stopwatch } from '@deepkit/stopwatch';
import { getPreparedEntity, PreparedAdapter, PreparedEntity, PreparedField } from './prepare.js';
import { SqlBuilderRegistry } from './sql-builder-registry.js';

/**
 * user.address[0].street => [user, address[0].street]
 * address[0].street => [address, [0].street]
 */
export function splitDotPath(path: string): [string, string] {
    const first1 = path.indexOf('[');
    const first2 = path.indexOf('.');
    const first = first1 === -1 ? first2 : first2 === -1 ? first1 : Math.min(first1, first2);
    return [path.substr(0, first), path.substr(first + (first === first2 ? 1 : 0))];
}

export function asAliasName(path: string): string {
    return path.replace(/[\[\]\.]/g, '__');
}


export abstract class SQLStatement {
    abstract get(params?: any[]): Promise<any>;

    abstract all(params?: any[]): Promise<any[]>;

    abstract release(): void
}

export abstract class SQLConnection {
    released: boolean = false;

    constructor(
        protected connectionPool: SQLConnectionPool,
        public logger: DatabaseLogger = new DatabaseLogger,
        public transaction?: DatabaseTransaction,
        public stopwatch?: Stopwatch,
    ) {
    }

    release() {
        this.connectionPool.release(this);
    }

    abstract prepare(sql: string): Promise<SQLStatement>;

    /**
     * Runs a single SQL query.
     */
    abstract run(sql: string, params?: any[]): Promise<any>;

    abstract getChanges(): Promise<number>;

    async execAndReturnSingle(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        try {
            return await stmt.get(params);
        } finally {
            stmt.release();
        }
    }

    async execAndReturnAll(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        try {
            return await stmt.all(params);
        } finally {
            stmt.release();
        }
    }
}

export abstract class SQLConnectionPool {
    protected activeConnections = 0;

    /**
     * Reserves an existing or new connection. It's important to call `.release()` on it when
     * done. When release is not called a resource leak occurs and server crashes.
     */
    abstract getConnection(logger?: DatabaseLogger, transaction?: DatabaseTransaction, stopwatch?: Stopwatch): Promise<SQLConnection>;

    public getActiveConnections() {
        return this.activeConnections;
    }

    release(connection: SQLConnection) {
        this.activeConnections--;
        connection.released = true;
    }
}

function buildSetFromChanges(platform: DefaultPlatform, classSchema: ReflectionClass<any>, changes: Changes<any>): string[] {
    const set: string[] = [];
    const scopeSerializer = getPartialSerializeFunction(classSchema.type, platform.serializer.serializeRegistry);

    if (changes.$set) {
        const value = scopeSerializer(changes.$set);
        for (const i in value) {
            if (!value.hasOwnProperty(i)) continue;
            set.push(`${platform.quoteIdentifier(i)} = ${platform.quoteValue(value[i])}`);
        }
    }

    if (changes.$inc) {
        for (const i in changes.$inc) {
            if (!changes.$inc.hasOwnProperty(i)) continue;
            set.push(`${platform.quoteIdentifier(i)} = ${platform.quoteIdentifier(i)} + ${platform.quoteValue(changes.$inc[i])}`);
        }
    }

    if (changes.$unset) {
        for (const i in changes.$unset) {
            if (!changes.$unset.hasOwnProperty(i)) continue;
            set.push(`${platform.quoteIdentifier(i)} = NULL`);
        }
    }

    return set;
}

export class SQLQueryResolver<T extends object> extends SelectorResolver<T> {
    protected tableId = this.platform.getTableIdentifier.bind(this.platform);
    protected quoteIdentifier = this.platform.quoteIdentifier.bind(this.platform);
    protected quote = this.platform.quoteValue.bind(this.platform);

    constructor(
        protected connectionPool: SQLConnectionPool,
        protected platform: DefaultPlatform,
        protected adapter: SQLDatabaseAdapter,
        session: DatabaseSession<DatabaseAdapter>,
    ) {
        super(session);
    }

    protected createFormatter(state: SelectorState<T>, withIdentityMap: boolean = false) {
        return new SqlFormatter(
            state.schema,
            this.platform.serializer,
            this.session.getHydrator(),
            withIdentityMap ? this.session.identityMap : undefined,
        );
    }

    protected getTableIdentifier(schema: ReflectionClass<any>) {
        return this.platform.getTableIdentifier(schema);
    }

    /**
     * If possible, this method should handle specific SQL errors and convert
     * them to more specific error classes with more information, e.g. unique constraint.
     */
    handleSpecificError(error: Error): Error {
        return error;
    }

    async count(model: SelectorState<T>): Promise<number> {
        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const sqlBuilder = new SqlBuilder(this.adapter);
        const sql = sqlBuilder.buildSql(model, 'SELECT COUNT(*) as count');
        if (sqlBuilderFrame) sqlBuilderFrame.end();

        const connectionFrame = this.session.stopwatch ? this.session.stopwatch.start('Connection acquisition') : undefined;
        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        if (connectionFrame) connectionFrame.end();

        try {
            const row = await connection.execAndReturnSingle(sql.sql, sql.params);

            //postgres has bigint as return type of COUNT, so we need to convert always
            return Number(row.count);
        } catch (error: any) {
            throw this.handleSpecificError(error);
        } finally {
            connection.release();
        }
    }

    async delete(model: SelectorState<T>, deleteResult: DeleteResult<T>): Promise<void> {
        if (model.joins?.length) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');

        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const sqlBuilder = new SqlBuilder(this.adapter);
        const sql = sqlBuilder.buildSql(model, 'DELETE');
        if (sqlBuilderFrame) sqlBuilderFrame.end();

        const connectionFrame = this.session.stopwatch ? this.session.stopwatch.start('Connection acquisition') : undefined;
        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        if (connectionFrame) connectionFrame.end();

        try {
            await connection.run(sql.sql, sql.params);
            deleteResult.modified = await connection.getChanges();
            //todo, implement deleteResult.primaryKeys
        } catch (error: any) {
            error = new DatabaseDeleteError(model.schema, `Could not delete ${model.schema.getClassName()} in database`, { cause: error });
            error.query = model;
            throw this.handleSpecificError(error);
        } finally {
            connection.release();
        }
    }

    protected lastPreparedStatement?: SQLStatement;

    async find(model: SelectorState<T>): Promise<T[]> {
        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const sqlBuilder = new SqlBuilder(this.adapter);
        const sql = sqlBuilder.select(model);
        if (sqlBuilderFrame) sqlBuilderFrame.end();

        const connectionFrame = this.session.stopwatch ? this.session.stopwatch.start('Connection acquisition') : undefined;
        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        if (connectionFrame) connectionFrame.end();

        let rows: any[] = [];
        try {
            // todo: find a way to cache prepared statements. this is just a test for best case scenario:
            let stmt = this.adapter.cache.lastPreparedStatement;
            if (!stmt) {
                this.adapter.cache.lastPreparedStatement = stmt = await connection.prepare(sql.sql);
            }

            rows = await stmt.all(sql.params);
            // rows = await connection.execAndReturnAll(sql.sql, sql.params);
        } catch (error: any) {
        //     error = this.handleSpecificError(error);
        //     console.log(sql.sql, sql.params);
        //     throw new DatabaseError(`Could not query ${model.schema.getClassName()} due to SQL error ${error.message}`, { cause: error });
        } finally {
            connection.release();
        }

        const formatterFrame = this.session.stopwatch ? this.session.stopwatch.start('Formatter') : undefined;
        const results: T[] = [];
        // if (model.isAggregate() || model.sqlSelect) {
        //     //when aggregate the field types could be completely different, so don't normalize
        //     for (const row of rows) results.push(row); //mysql returns not a real array, so we have to iterate
        //     if (formatterFrame) formatterFrame.end();
        //     return results;
        // }
        // const formatter = this.createFormatter(model);
        // if (model.joins?.length) {
        //     const converted = sqlBuilder.convertRows(model.schema, model, rows);
        //     for (const row of converted) results.push(formatter.hydrate(model, row));
        // } else {
        //     for (const row of rows) results.push(formatter.hydrate(model, row));
        // }
        for (const row of rows) results.push(row);

        if (formatterFrame) formatterFrame.end();

        return results;
    }

    async findOneOrUndefined(model: SelectorState<T>): Promise<T | undefined> {
        //when joins are used, it's important to fetch all rows
        const items = await this.find(model);
        return items[0];
    }

    async has(model: SelectorState<T>): Promise<boolean> {
        return await this.count(model) > 0;
    }

    async patch(model: SelectorState<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        //this is the default SQL implementation that does not support RETURNING functionality (e.g. returning values from changes.$inc)

        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const set = buildSetFromChanges(this.platform, model.schema, changes);
        const sqlBuilder = new SqlBuilder(this.adapter);
        // const sql = sqlBuilder.update(this.classSchema, model, set);
        // if (sqlBuilderFrame) sqlBuilderFrame.end();
        //
        // const connectionFrame = this.session.stopwatch ? this.session.stopwatch.start('Connection acquisition') : undefined;
        // const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        // if (connectionFrame) connectionFrame.end();
        //
        // try {
        //     await connection.run(sql.sql, sql.params);
        //     patchResult.modified = await connection.getChanges();
        // } catch (error: any) {
        //     error = new DatabasePatchError(this.classSchema, model, changes, `Could not patch ${this.classSchema.getClassName()} in database`, { cause: error });
        //     throw this.handleSpecificError(error);
        // } finally {
        //     connection.release();
        // }
    }
}

type QueryPart = string | SqlQuery | SqlQueryParameter | SQLQueryIdentifier;

export class SqlQueryParameter {
    constructor(public value: any) {
    }
}

export class SQLQueryIdentifier {
    constructor(public id: any) {
    }
}

export function identifier(id: string) {
    return new SQLQueryIdentifier(id);
}

export type SqlStatement = { sql: string, params: any[] };

export class SqlQuery {
    constructor(public parts: ReadonlyArray<QueryPart>) {
    }

    public clone(): SqlQuery {
        return new SqlQuery(this.parts.slice());
    }

    convertToSQL(
        platform: DefaultPlatform,
        placeholderStrategy: SqlPlaceholderStrategy,
        tableName?: string,
    ): SqlStatement {
        let sql = '';
        const params: any[] = [];

        for (const part of this.parts) {
            if (part instanceof SqlQuery) {
                sql += part.convertToSQL(platform, placeholderStrategy);
            } else if (part instanceof SQLQueryIdentifier) {
                const column = platform.quoteIdentifier(part.id);
                if (tableName) {
                    sql += tableName + '.' + column;
                } else {
                    sql += column;
                }
            } else if (part instanceof SqlQueryParameter) {
                if (part.value instanceof ReflectionClass) {
                    sql += platform.getTableIdentifier(part.value);
                } else if (isClass(part.value)) {
                    sql += platform.getTableIdentifier(ReflectionClass.from(part.value));
                } else {
                    sql += placeholderStrategy.getPlaceholder();
                    params.push(part.value);
                }
            } else {
                sql += part;
            }
        }

        return { sql, params };
    }
}

export function sql(strings: TemplateStringsArray, ...params: ReadonlyArray<any>) {
    const parts: QueryPart[] = [strings[0]];

    for (let i = 1; i < strings.length; i++) {
        if (
            params[i - 1] instanceof SqlQuery
            || params[i - 1] instanceof SqlQueryParameter
            || params[i - 1] instanceof SQLQueryIdentifier
        ) {
            parts.push(params[i - 1]);
        } else {
            parts.push(new SqlQueryParameter(params[i - 1]));
        }

        parts.push(strings[i]);
    }

    return new SqlQuery(parts);
}

@entity.name('migration_state')
export class MigrationStateEntity {
    created: Date = new Date;

    constructor(public version: number & PrimaryKey) {
    }
}

export class SqlMigrationHandler {
    constructor(protected database: Database<SQLDatabaseAdapter>) {
    }

    public async setLatestMigrationVersion(version: number): Promise<void> {
        const session = this.database.createSession();
        session.add(new MigrationStateEntity(version));
        await session.commit();
    }

    public async removeMigrationVersion(version: number): Promise<void> {
        const session = this.database.createSession();
        await session.query2((m: Select<MigrationStateEntity>) => {
            filter(m, { version });
        }).deleteOne();
    }

    public async getLatestMigrationVersion(): Promise<number> {
        const session = this.database.createSession();
        try {
            const version = await session.query2((m: Select<MigrationStateEntity>) => {
                orderBy(m.version, 'desc');
            }).findOneOrUndefined();
            return version ? version.version : 0;
        } catch (error) {
            const connection = await this.database.adapter.connectionPool.getConnection();
            try {
                const [table] = this.database.adapter.platform.createTables(DatabaseEntityRegistry.from([MigrationStateEntity]));
                const createSql = this.database.adapter.platform.getAddTableDDL(table);
                for (const sql of createSql) {
                    await connection.run(sql);
                }
                return 0;
            } finally {
                connection.release();
            }
        }
    }
}

export abstract class SQLDatabaseAdapter extends DatabaseAdapter implements PreparedAdapter {
    public abstract platform: DefaultPlatform;
    public abstract connectionPool: SQLConnectionPool;

    public preparedEntities = new Map<ReflectionClass<any>, PreparedEntity>();
    public builderRegistry: SqlBuilderRegistry = new SqlBuilderRegistry;

    public cache: {[name: string]: any} = {};

    abstract createPersistence(databaseSession: DatabaseSession<this>): SQLPersistence;

    abstract getSchemaName(): string;

    async getInsertBatchSize(schema: ReflectionClass<any>): Promise<number> {
        return Math.floor(30000 / schema.getProperties().length);
    }

    async getUpdateBatchSize(schema: ReflectionClass<any>): Promise<number> {
        return Math.floor(30000 / schema.getProperties().length);
    }

    isNativeForeignKeyConstraintSupported() {
        return true;
    }

    /**
     * Creates (and re-creates already existing) tables in the database.
     * This is only for testing purposes useful.
     *
     * WARNING: THIS DELETES ALL AFFECTED TABLES AND ITS CONTENT.
     */
    public async createTables(entityRegistry: DatabaseEntityRegistry): Promise<void> {
        const connection = await this.connectionPool.getConnection();
        try {
            const database = new DatabaseModel([], this.getName());
            database.schemaName = this.getSchemaName();
            this.platform.createTables(entityRegistry, database);
            const DDLs = this.platform.getAddTablesDDL(database);
            for (const sql of DDLs) {
                try {
                    await connection.run(sql);
                } catch (error) {
                    throw new DatabaseError(`Could not create table: ${error}\n${sql}`, { cause: error });
                }
            }
        } finally {
            connection.release();
        }
    }

    public async getMigrations(options: MigrateOptions, entityRegistry: DatabaseEntityRegistry): Promise<{
        [name: string]: { sql: string[], diff: string }
    }> {
        const migrations: { [name: string]: { sql: string[], diff: string } } = {};

        const connection = await this.connectionPool.getConnection();

        try {
            const databaseModel = new DatabaseModel([], this.getName());
            databaseModel.schemaName = this.getSchemaName();
            this.platform.createTables(entityRegistry, databaseModel);
            const schemaParser = new this.platform.schemaParserType(connection, this.platform);

            const parsedDatabaseModel = new DatabaseModel([], this.getName());
            parsedDatabaseModel.schemaName = this.getSchemaName();
            await schemaParser.parse(parsedDatabaseModel);
            parsedDatabaseModel.removeUnknownTables(databaseModel);
            parsedDatabaseModel.removeTable(ReflectionClass.from(MigrationStateEntity).getCollectionName());

            for (const entity of entityRegistry.forMigration()) {
                const databaseDiff = DatabaseComparator.computeDiff(parsedDatabaseModel, databaseModel);
                if (databaseDiff) {
                    const table = databaseModel.getTableForClass(entity);
                    databaseDiff.forTable(table);
                    const diff = databaseDiff.getDiff(table);

                    const upSql = this.platform.getModifyDatabaseDDL(databaseDiff, options);
                    if (upSql.length) {
                        migrations[entity.getName()] = { sql: upSql, diff: diff ? diff.toString() : '' };
                    }
                }
            }
        } finally {
            connection.release();
        }

        return migrations;
    }

    public async migrate(options: MigrateOptions, entityRegistry: DatabaseEntityRegistry): Promise<void> {
        const migrations = await this.getMigrations(options, entityRegistry);
        const connection = await this.connectionPool.getConnection();

        try {
            for (const [databaseName, migration] of Object.entries(migrations)) {
                for (const sql of migration.sql) {
                    try {
                        await connection.run(sql);
                    } catch (error) {
                        console.error('Could not execute migration SQL', sql, error);
                        throw error;
                    }
                }
            }
        } finally {
            connection.release();
        }
    }
}

export class SQLPersistence extends DatabasePersistence {
    protected connection?: SQLConnection;

    constructor(
        protected platform: DefaultPlatform,
        public connectionPool: SQLConnectionPool,
        protected session: DatabaseSession<SQLDatabaseAdapter>,
    ) {
        super();
    }

    /**
     * If possible, this method should handle specific SQL errors and convert
     * them to more specific error classes with more information, e.g. unique constraint.
     */
    handleSpecificError(error: Error): Error {
        return error;
    }

    async getConnection(): Promise<ReturnType<this['connectionPool']['getConnection']>> {
        if (!this.connection) {
            this.connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        }
        return this.connection as any;
    }

    release() {
        if (this.connection) this.connection.release();
    }

    protected prepareAutoIncrement(classSchema: ReflectionClass<any>, count: number) {
    }

    protected populateAutoIncrementFields<T>(classSchema: ReflectionClass<T>, items: T[]) {
    }

    async insert<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        await this.prepareAutoIncrement(classSchema, items.length);
        await this.doInsert(classSchema, items);
    }

    async update<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const batchSize = await this.session.adapter.getUpdateBatchSize(classSchema);
        const entity = getPreparedEntity(this.session.adapter, classSchema);

        if (batchSize > changeSets.length) {
            await this.batchUpdate(entity, changeSets);
        } else {
            for (let i = 0; i < changeSets.length; i += batchSize) {
                await this.batchUpdate(entity, changeSets.slice(i, i + batchSize));
            }
        }
    }

    protected async doInsert<T>(classSchema: ReflectionClass<T>, items: T[]) {
        const batchSize = await this.session.adapter.getInsertBatchSize(classSchema);

        if (batchSize > items.length) {
            await this.batchInsert(classSchema, items);
            await this.populateAutoIncrementFields(classSchema, items);
        } else {
            for (let i = 0; i < items.length; i += batchSize) {
                const batched = items.slice(i, i + batchSize);
                await this.batchInsert(classSchema, batched);
                await this.populateAutoIncrementFields(classSchema, batched);
            }
        }
    }

    async batchUpdate<T extends OrmEntity>(entity: PreparedEntity, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        //simple update implementation that is not particular performant nor does it support atomic updates (like $inc)
        const scopeSerializer = getPartialSerializeFunction(entity.type, this.platform.serializer.serializeRegistry);
        const updates: string[] = [];

        for (const changeSet of changeSets) {
            const set: string[] = [];
            const where: string[] = [];

            const pk = scopeSerializer(changeSet.primaryKey) as { [name: string]: any };
            for (const i in pk) {
                if (!pk.hasOwnProperty(i)) continue;
                where.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(pk[i])}`);
            }
            const value = scopeSerializer(changeSet.changes.$set || {}) as { [name: string]: any };
            for (const i in value) {
                if (!value.hasOwnProperty(i)) continue;
                set.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(value[i])}`);
            }

            updates.push(`UPDATE ${entity.tableNameEscaped}
                          SET ${set.join(', ')}
                          WHERE ${where.join(' AND ')}`);
        }

        const sql = updates.join(';\n');

        try {
            await (await this.getConnection()).run(sql);
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

    protected async batchInsert<T>(classSchema: ReflectionClass<T>, items: T[]) {
        const scopeSerializer = getSerializeFunction(classSchema.type, this.platform.serializer.serializeRegistry);
        const placeholder = new this.platform.placeholderStrategy;

        const insert: string[] = [];
        const params: any[] = [];
        const names: string[] = [];
        const prepared = getPreparedEntity(this.session.adapter, classSchema);

        for (const property of prepared.fields) {
            if (property.autoIncrement) continue;
            names.push(property.columnNameEscaped);
        }

        for (const item of items) {
            const converted = scopeSerializer(item);
            const row: string[] = [];

            for (const property of prepared.fields) {
                if (property.autoIncrement) continue;

                const v = converted[property.name];
                params.push(v === undefined ? null : v);
                row.push(property.sqlTypeCast(placeholder.getPlaceholder()));
            }

            insert.push(row.join(', '));
        }

        const sql = this.getInsertSQL(classSchema, names, insert);
        try {
            await (await this.getConnection()).run(sql, params);
        } catch (error: any) {
            error = new DatabaseInsertError(
                classSchema,
                items as OrmEntity[],
                `Could not insert ${classSchema.getClassName()} into database`,
                { cause: error },
            );
            throw this.handleSpecificError(error);
        }
    }

    protected getInsertSQL(classSchema: ReflectionClass<any>, fields: string[], values: string[]): string {
        return `INSERT INTO ${this.platform.getTableIdentifier(classSchema)} (${fields.join(', ')})
                VALUES (${values.join('), (')})`;
    }

    async remove<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const scopeSerializer = getSerializeFunction(classSchema.type, this.platform.serializer.serializeRegistry);
        const pks: any[] = [];
        const primary = classSchema.getPrimary();
        const pkName = primary.name;
        const params: any[] = [];
        const placeholder = new this.platform.placeholderStrategy;

        for (const item of items) {
            const converted = scopeSerializer(item);
            pks.push(placeholder.getPlaceholder());
            params.push(converted[pkName]);
        }

        const sql = `DELETE
                     FROM ${this.platform.getTableIdentifier(classSchema)}
                     WHERE ${this.platform.quoteIdentifier(pkName)} IN (${pks})`;
        try {
            await (await this.getConnection()).run(sql, params);
        } catch (error: any) {
            error = new DatabaseDeleteError(
                classSchema,
                `Could not delete ${classSchema.getClassName()} from database`,
                { cause: error },
            );
            error.items = items;
            throw this.handleSpecificError(error);
        }
    }
}

export function prepareBatchUpdate(
    platform: DefaultPlatform,
    entity: PreparedEntity,
    changeSets: DatabasePersistenceChangeSet<any>[],
    options: { setNamesWithTableName?: true } = {},
) {
    const partialSerialize = getPartialSerializeFunction(entity.type, platform.serializer.serializeRegistry);
    const tableName = entity.tableNameEscaped;
    const pkName = entity.primaryKey.name;
    const pkField = entity.primaryKey.columnNameEscaped;
    const originPkName = '_origin_' + pkName;
    const originPkField = platform.quoteIdentifier(originPkName);

    const primaryKeys: any[] = [];
    const values: { [name: string]: any[] } = {};
    const valuesSet: { [name: string]: any[] } = {};
    const setNames: string[] = [];
    const aggregateSelects: { [name: string]: { id: any, sql: string }[] } = {};

    const assignReturning: { [name: string]: { item: any, names: string[] } } = {};
    const setReturning: { [name: string]: 1 } = {};
    const changedFields: string[] = [];
    const changedProperties: PreparedField[] = [];

    for (const changeSet of changeSets) {
        for (const fieldName of changeSet.changes.fieldNames) {
            if (!changedFields.includes(fieldName)) {
                changedProperties.push(entity.fieldMap[fieldName]);
                changedFields.push(fieldName);
                if (!values[fieldName]) {
                    values[fieldName] = [];
                    valuesSet[fieldName] = [];

                    setNames.push((options.setNamesWithTableName ? tableName + '.' : '') + `${entity.fieldMap[fieldName].columnNameEscaped} = _b.${entity.fieldMap[fieldName].columnNameEscaped}`);
                }
            }
        }
    }

    if (!changedFields) {
        return;
    }

    for (const changeSet of changeSets) {
        const pk = partialSerialize(changeSet.primaryKey);
        primaryKeys.push(pk[pkName]);

        const id = changeSet.primaryKey[pkName];

        if (changeSet.changes.$set) {
            const value = partialSerialize(changeSet.changes.$set);
            for (const fieldName of changedFields) {
                values[fieldName].push(value[fieldName] ?? null);
                valuesSet[fieldName].push(fieldName in value ? 1 : 0);
            }
        }

        if (changeSet.changes.$inc) {
            for (const fieldName in changeSet.changes.$inc) {
                if (!changeSet.changes.$inc.hasOwnProperty(fieldName)) continue;
                const value = changeSet.changes.$inc[fieldName];
                if (!aggregateSelects[fieldName]) aggregateSelects[fieldName] = [];

                if (!assignReturning[id]) {
                    assignReturning[id] = { item: changeSet.item, names: [] };
                }

                assignReturning[id].names.push(fieldName);
                setReturning[fieldName] = 1;
                values[fieldName].push(value[fieldName] ?? null);
                valuesSet[fieldName].push(1);

                aggregateSelects[fieldName].push({
                    id: changeSet.primaryKey[pkName],
                    sql: `_origin.${platform.quoteIdentifier(fieldName)} + ${platform.quoteValue(value)}`,
                });
            }
        }
    }

    return {
        changedFields,
        changedProperties,
        primaryKeys,
        values,
        valuesSet,
        pkField,
        pkName,
        aggregateSelects,
        originPkField,
        originPkName,
        setReturning,
        assignReturning,
        setNames,
        tableName,
    };

}
