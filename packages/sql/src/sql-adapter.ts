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
    DatabaseAdapterQueryFactory,
    DatabasePersistence,
    DatabasePersistenceChangeSet,
    DatabaseQueryModel,
    DatabaseSession, DeleteResult,
    Entity,
    Query,
    GenericQueryResolver,
    PatchResult,
    SORT_ORDER,
    DatabaseError
} from '@deepkit/orm';
import { ClassType } from '@deepkit/core';
import { Changes, ClassSchema, getClassSchema, plainToClass, t } from '@deepkit/type';
import { DefaultPlatform } from './platform/default-platform';
import { SqlBuilder } from './sql-builder';
import { SqlFormatter } from './sql-formatter';
import { sqlSerializer } from './serializer/sql-serializer';
import { DatabaseComparator, DatabaseModel } from './schema/table';

export type SORT_TYPE = SORT_ORDER | { $meta: 'textScore' };
export type DEEP_SORT<T extends Entity> = { [P in keyof T]?: SORT_TYPE } & { [P: string]: SORT_TYPE };

type FilterQuery<T> = Partial<T>;

export class SQLQueryModel<T extends Entity> extends DatabaseQueryModel<T, FilterQuery<T>, DEEP_SORT<T>> {
}

export abstract class SQLStatement {
    abstract get(params?: any[]): Promise<any>;

    abstract all(params?: any[]): Promise<any[]>;

    abstract release(): void
}

export abstract class SQLConnection {
    released: boolean = false;

    constructor(protected connectionPool: SQLConnectionPool) {
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
        const row = await stmt.get(params);
        stmt.release();
        return row;
    }

    async execAndReturnAll(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        const rows = await stmt.all(params);
        stmt.release();
        return rows;
    }
}

export abstract class SQLConnectionPool {
    protected activeConnections = 0;

    /**
     * Reserves an existing or new connection. It's important to call `.release()` on it when
     * done. When release is not called a resource leak occurs and server crashes.
     */
    abstract getConnection(): SQLConnection;

    public getActiveConnections() {
        return this.activeConnections;
    }

    release(connection: SQLConnection) {
        this.activeConnections--;
        connection.released = true;
    }
}

function buildSetFromChanges(platform: DefaultPlatform, classSchema: ClassSchema, changes: Changes<any>): string[] {
    const set: string[] = [];
    const scopeSerializer = platform.serializer.for(classSchema);

    if (changes.$set) {
        const value = scopeSerializer.partialSerialize(changes.$set);
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

export class SQLQueryResolver<T extends Entity> extends GenericQueryResolver<T> {
    protected tableId = this.platform.getTableIdentifier.bind(this.platform);
    protected quoteIdentifier = this.platform.quoteIdentifier.bind(this.platform);
    protected quote = this.platform.quoteValue.bind(this.platform);

    constructor(
        protected connectionPool: SQLConnectionPool,
        protected platform: DefaultPlatform,
        classSchema: ClassSchema<T>,
        databaseSession: DatabaseSession<DatabaseAdapter>
    ) {
        super(classSchema, databaseSession);
    }

    protected createFormatter(withIdentityMap: boolean = false) {
        return new SqlFormatter(
            this.classSchema,
            sqlSerializer,
            this.databaseSession.getHydrator(),
            withIdentityMap ? this.databaseSession.identityMap : undefined
        );
    }

    protected getTableIdentifier(schema: ClassSchema) {
        return this.platform.getTableIdentifier(schema);
    }

    async count(model: SQLQueryModel<T>): Promise<number> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'SELECT COUNT(*) as count');
        const connection = this.connectionPool.getConnection();
        try {
            const row = await connection.execAndReturnSingle(sql.sql, sql.params);
            //postgres has bigint as return type of COUNT, so we need to convert always
            return Number(row.count);
        } finally {
            connection.release();
        }
    }

    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'DELETE');
        const connection = this.connectionPool.getConnection();
        try {
            await connection.run(sql.sql, sql.params);
            deleteResult.modified = await connection.getChanges();
            //todo, implement deleteResult.primaryKeys
        } finally {
            connection.release();
        }
    }

    async find(model: SQLQueryModel<T>): Promise<T[]> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.select(this.classSchema, model);
        const connection = this.connectionPool.getConnection();
        try {
            const rows = await connection.execAndReturnAll(sql.sql, sql.params);
            const results: T[] = [];
            if (model.isAggregate()) {
                //when aggregate the field types could be completely different, so don't normalize
                for (const row of rows) results.push(row); //mysql returns not a real array, so we have to iterate
                return results;
            }
            const formatter = this.createFormatter(model.withIdentityMap);
            if (model.hasJoins()) {
                const converted = sqlBuilder.convertRows(this.classSchema, model, rows);
                for (const row of converted) results.push(formatter.hydrate(model, row));
            } else {
                for (const row of rows) results.push(formatter.hydrate(model, row));
            }
            return results;
        } catch (error) {
            throw new DatabaseError(`Could not query ${this.classSchema.getClassName()} due to SQL error ${error}.\nSQL: ${sql.sql}\nParams: ${JSON.stringify(sql.params)}`);
        } finally {
            connection.release();
        }
    }

    async findOneOrUndefined(model: SQLQueryModel<T>): Promise<T | undefined> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.select(this.classSchema, model);

        const connection = this.connectionPool.getConnection();
        try {
            const row = await connection.execAndReturnSingle(sql.sql, sql.params);
            if (!row) return;

            if (model.isAggregate()) {
                //when aggregate the field types could be completely different, so don't normalize
                return row;
            }

            const formatter = this.createFormatter(model.withIdentityMap);
            if (model.hasJoins()) {
                const [converted] = sqlBuilder.convertRows(this.classSchema, model, [row]);
                return formatter.hydrate(model, converted);
            } else {
                return formatter.hydrate(model, row);
            }
        } catch (error) {
            throw new DatabaseError(`Could not query ${this.classSchema.getClassName()} due to SQL error ${error}.\nSQL: ${sql.sql}\nParams: ${JSON.stringify(sql.params)}`);
        } finally {
            connection.release();
        }
    }

    async has(model: SQLQueryModel<T>): Promise<boolean> {
        return await this.count(model) > 0;
    }

    async patch(model: SQLQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        //this is the default SQL implementation that does not support RETURNING functionality (e.g. returning values from changes.$inc)
        const set = buildSetFromChanges(this.platform, this.classSchema, changes);
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.update(this.classSchema, model, set);
        const connection = this.connectionPool.getConnection();
        try {
            await connection.run(sql.sql, sql.params);
            patchResult.modified = await connection.getChanges();
        } finally {
            connection.release();
        }
    }
}

export class SQLDatabaseQuery<T extends Entity> extends Query<T> {
    constructor(
        classSchema: ClassSchema<T>,
        protected databaseSession: DatabaseSession<DatabaseAdapter>,
        protected resolver: SQLQueryResolver<T>
    ) {
        super(classSchema, databaseSession, resolver);
        if (!databaseSession.withIdentityMap) this.model.withIdentityMap = false;
    }
}

export class SQLDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(protected connectionPool: SQLConnectionPool, protected platform: DefaultPlatform, protected databaseSession: DatabaseSession<any>) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T> | ClassSchema<T>
    ): SQLDatabaseQuery<T> {
        return new SQLDatabaseQuery(getClassSchema(classType), this.databaseSession,
            new SQLQueryResolver(this.connectionPool, this.platform, getClassSchema(classType), this.databaseSession)
        );
    }
}

export class SqlMigrationHandler {
    protected migrationEntity: ClassSchema;

    constructor(protected database: Database<SQLDatabaseAdapter>) {
        this.migrationEntity = t.schema({
            version: t.number.primary,
            created: t.date,
        }, { name: database.adapter.platform.getMigrationTableName() });
    }

    public async setLatestMigrationVersion(version: number): Promise<void> {
        const session = this.database.createSession();
        session.add(plainToClass(this.migrationEntity, {
            version: version,
            created: new Date,
        }));
        await session.commit();
    }

    public async removeMigrationVersion(version: number): Promise<void> {
        const session = this.database.createSession();
        await session.query(this.migrationEntity).filter({ version }).deleteOne();
    }

    public async getLatestMigrationVersion(): Promise<number> {
        const session = this.database.createSession();
        try {
            const version = await session.query(this.migrationEntity).sort({ version: 'desc' }).findOneOrUndefined();
            return version ? version.version : 0;
        } catch (error) {
            const connection = await this.database.adapter.connectionPool.getConnection();
            try {
                const [table] = this.database.adapter.platform.createTables([this.migrationEntity]);
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

export abstract class SQLDatabaseAdapter extends DatabaseAdapter {
    public abstract platform: DefaultPlatform;
    public abstract connectionPool: SQLConnectionPool;

    abstract queryFactory(databaseSession: DatabaseSession<this>): SQLDatabaseQueryFactory;

    abstract createPersistence(): SQLPersistence;

    abstract getSchemaName(): string;

    isNativeForeignKeyConstraintSupported() {
        return true;
    }

    /**
     * Creates (and re-creates already existing) tables in the database.
     * This is only for testing purposes useful.
     *
     * WARNING: THIS DELETES ALL AFFECTED TABLES AND ITS CONTENT.
     */
    public async createTables(classSchemas: ClassSchema[]): Promise<void> {
        const connection = await this.connectionPool.getConnection();
        try {
            const database = new DatabaseModel();
            database.schemaName = this.getSchemaName();
            this.platform.createTables(classSchemas, database);
            const DDLs = this.platform.getAddTablesDDL(database);
            for (const sql of DDLs) {
                await connection.run(sql);
            }
        } finally {
            connection.release();
        }
    }

    public async migrate(classSchemas: ClassSchema[]): Promise<void> {
        const connection = await this.connectionPool.getConnection();

        try {
            const databaseModel = new DatabaseModel();
            databaseModel.schemaName = this.getSchemaName();
            this.platform.createTables(classSchemas, databaseModel);

            const schemaParser = new this.platform.schemaParserType(connection, this.platform);

            const parsedDatabaseModel = new DatabaseModel();
            parsedDatabaseModel.schemaName = this.getSchemaName();
            await schemaParser.parse(parsedDatabaseModel);

            const databaseDiff = DatabaseComparator.computeDiff(parsedDatabaseModel, databaseModel);
            if (!databaseDiff) {
                return;
            }

            const upSql = this.platform.getModifyDatabaseDDL(databaseDiff);
            if (!upSql.length) return;

            for (const sql of upSql) {
                try {
                    await connection.run(sql);
                } catch (error) {
                    console.error('Could not execute migration SQL', sql);
                    throw error;
                }
            }
        } finally {
            connection.release();
        }
    }
}

export class SQLPersistence extends DatabasePersistence {
    constructor(
        protected platform: DefaultPlatform,
        protected connection: SQLConnection,
    ) {
        super();
    }

    release() {
        this.connection.release();
    }

    protected prepareAutoIncrement(classSchema: ClassSchema, count: number) {
    }

    protected populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
    }

    async insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        await this.prepareAutoIncrement(classSchema, items.length);
        await this.doInsert(classSchema, items);
        await this.populateAutoIncrementFields(classSchema, items);
    }

    async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        //simple update implementation that is not particular performant nor does it support atomic updates (like $inc)

        const scopeSerializer = this.platform.serializer.for(classSchema);
        const updates: string[] = [];

        for (const changeSet of changeSets) {
            const set: string[] = [];
            const where: string[] = [];

            const pk = scopeSerializer.partialSerialize(changeSet.primaryKey);
            for (const i in pk) {
                if (!pk.hasOwnProperty(i)) continue;
                where.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(pk[i])}`);
            }
            const value = scopeSerializer.partialSerialize(changeSet.changes.$set || {});
            for (const i in value) {
                if (!value.hasOwnProperty(i)) continue;
                set.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(value[i])}`);
            }

            updates.push(`UPDATE ${this.platform.getTableIdentifier(classSchema)} SET ${set.join(', ')} WHERE ${where.join(' AND ')}`);
        }

        //try bulk update via https://stackoverflow.com/questions/11563869/update-multiple-rows-with-different-values-in-a-single-sql-query
        await this.connection.run(updates.join(';\n'));
    }

    protected async doInsert<T>(classSchema: ClassSchema<T>, items: T[]) {
        const scopeSerializer = this.platform.serializer.for(classSchema);
        const fields = this.platform.getEntityFields(classSchema).filter(v => !v.isAutoIncrement).map(v => v.name);
        const insert: string[] = [];
        const params: any[] = [];
        this.resetPlaceholderSymbol();

        for (const item of items) {
            const converted = scopeSerializer.serialize(item);

            insert.push(fields.map(v => {
                v = converted[v];
                params.push(v === undefined ? null : v);
                return this.getPlaceholderSymbol();
            }).join(', '));
        }

        const sql = this.getInsertSQL(classSchema, fields.map(v => this.platform.quoteIdentifier(v)), insert);
        try {
            await this.connection.run(sql, params);
        } catch (error) {
            console.warn('Insert failed', sql, params, error);
            throw error;
        }
    }

    protected resetPlaceholderSymbol() {
    }

    protected getPlaceholderSymbol() {
        return '?';
    }

    protected getInsertSQL(classSchema: ClassSchema, fields: string[], values: string[]): string {
        return `INSERT INTO ${this.platform.getTableIdentifier(classSchema)} (${fields.join(', ')}) VALUES (${values.join('), (')})`;
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const pks: any[] = [];
        const pk = classSchema.getPrimaryField();
        for (const item of items) {
            pks.push(item[pk.name]);
        }

        const inValues = pks.map(v => this.platform.quoteValue(v)).join(', ');
        await this.connection.run(`DELETE FROM ${this.platform.getTableIdentifier(classSchema)} WHERE ${this.platform.quoteIdentifier(pk.name)} IN (${inValues})`);
    }
}
