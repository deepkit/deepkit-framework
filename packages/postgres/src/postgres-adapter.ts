/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import type { Pool, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';

import { AbstractClassType, ClassType, asyncOperation, empty } from '@deepkit/core';
import {
    DatabaseLogger,
    DatabasePersistenceChangeSet,
    DatabaseSession,
    DatabaseTransaction,
    DeleteResult,
    OrmEntity,
    PatchResult,
    UniqueConstraintFailure,
    primaryKeyObjectConverter,
} from '@deepkit/orm';
import {
    DefaultPlatform,
    SQLConnection,
    SQLConnectionPool,
    SQLDatabaseAdapter,
    SQLDatabaseQuery,
    SQLDatabaseQueryFactory,
    SQLPersistence,
    SQLQueryModel,
    SQLQueryResolver,
    SQLStatement,
    SqlBuilder,
    asAliasName,
    prepareBatchUpdate,
    splitDotPath,
} from '@deepkit/sql';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import {
    Changes,
    ReceiveType,
    ReflectionClass,
    ReflectionKind,
    ReflectionProperty,
    getPatchSerializeFunction,
    getSerializeFunction,
    resolvePath,
} from '@deepkit/type';

import { PostgresPlatform } from './postgres-platform.js';

function handleError(error: Error | string): void {
    const message = 'string' === typeof error ? error : error.message;
    if (message.includes('violates unique constraint')) {
        //todo: extract table name, column name, and find ClassSchema
        throw new UniqueConstraintFailure();
    }
}

export class PostgresStatement extends SQLStatement {
    protected released = false;

    constructor(
        protected logger: DatabaseLogger,
        protected sql: string,
        protected client: PoolClient,
        protected stopwatch?: Stopwatch,
    ) {
        super();
    }

    async get(params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            this.logger.logQuery(this.sql, params);
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await asyncOperation<any>((resolve, reject) => {
                this.client.query(this.sql, params).then(resolve).catch(reject);
            });
            return res.rows[0];
        } catch (error: any) {
            handleError(error);
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
            const res = await asyncOperation<any>((resolve, reject) => {
                this.client.query(this.sql, params).then(resolve).catch(reject);
            });
            return res.rows;
        } catch (error: any) {
            handleError(error);
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    release() {}
}

export class PostgresConnection extends SQLConnection {
    protected changes: number = 0;
    public lastReturningRows: any[] = [];

    constructor(
        connectionPool: PostgresConnectionPool,
        public connection: PoolClient,
        logger?: DatabaseLogger,
        transaction?: DatabaseTransaction,
        stopwatch?: Stopwatch,
    ) {
        super(connectionPool, logger, transaction, stopwatch);
    }

    async prepare(sql: string) {
        return new PostgresStatement(this.logger, sql, this.connection, this.stopwatch);
    }

    async run(sql: string, params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql, sqlParams: params });
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await asyncOperation<any>((resolve, reject) => {
                this.connection.query(sql, params).then(resolve).catch(reject);
            });
            this.logger.logQuery(sql, params);
            this.lastReturningRows = res.rows;
            this.changes = res.rowCount;
        } catch (error: any) {
            handleError(error);
            this.logger.failedQuery(error, sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export type TransactionTypes = 'REPEATABLE READ' | 'READ COMMITTED' | 'SERIALIZABLE';

export class PostgresDatabaseTransaction extends DatabaseTransaction {
    connection?: PostgresConnection;

    setTransaction?: TransactionTypes;

    /**
     * This is the default for mysql databases.
     */
    repeatableRead(): this {
        this.setTransaction = 'REPEATABLE READ';
        return this;
    }

    readCommitted(): this {
        this.setTransaction = 'READ COMMITTED';
        return this;
    }

    serializable(): this {
        this.setTransaction = 'SERIALIZABLE';
        return this;
    }

    async begin() {
        if (!this.connection) return;
        const set = this.setTransaction ? 'SET TRANSACTION ISOLATION LEVEL ' + this.setTransaction + ';' : '';
        await this.connection.run(set + 'START TRANSACTION');
    }

    async commit() {
        if (!this.connection) return;
        if (this.ended) throw new Error('Transaction ended already');

        await this.connection.run('COMMIT');
        this.ended = true;
        this.connection.release();
    }

    async rollback() {
        if (!this.connection) return;

        if (this.ended) throw new Error('Transaction ended already');
        await this.connection.run('ROLLBACK');
        this.ended = true;
        this.connection.release();
    }
}

export class PostgresConnectionPool extends SQLConnectionPool {
    constructor(protected pool: Pool) {
        super();
    }

    async getConnection(
        logger?: DatabaseLogger,
        transaction?: PostgresDatabaseTransaction,
        stopwatch?: Stopwatch,
    ): Promise<PostgresConnection> {
        //when a transaction object is given, it means we make the connection sticky exclusively to that transaction
        //and only release the connection when the transaction is commit/rollback is executed.

        if (transaction && transaction.connection) return transaction.connection;

        const poolClient = await this.pool.connect();
        this.activeConnections++;
        const connection = new PostgresConnection(this, poolClient, logger, transaction, stopwatch);
        if (transaction) {
            transaction.connection = connection;
            try {
                await transaction.begin();
            } catch (error) {
                transaction.ended = true;
                connection.release();
                throw new Error('Could not start transaction: ' + error);
            }
        }
        return connection;
    }

    release(connection: PostgresConnection) {
        //connections attached to a transaction are not automatically released.
        //only with commit/rollback actions
        if (connection.transaction && !connection.transaction.ended) return;

        super.release(connection);
        connection.connection.release();
    }
}

function typeSafeDefaultValue(property: ReflectionProperty): any {
    if (property.type.kind === ReflectionKind.string) return '';
    if (property.type.kind === ReflectionKind.number) return 0;
    if (property.type.kind === ReflectionKind.boolean) return false;
    if (property.type.kind === ReflectionKind.class && property.type.classType === Date) return false;

    return null;
}

export class PostgresPersistence extends SQLPersistence {
    constructor(
        protected platform: DefaultPlatform,
        public connectionPool: PostgresConnectionPool,
        session: DatabaseSession<any>,
    ) {
        super(platform, connectionPool, session);
    }

    async batchUpdate<T extends OrmEntity>(
        classSchema: ReflectionClass<T>,
        changeSets: DatabasePersistenceChangeSet<T>[],
    ): Promise<void> {
        const prepared = prepareBatchUpdate(this.platform, classSchema, changeSets);
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
            let pkValue = placeholderStrategy.getPlaceholder() + this.platform.typeCast(classSchema, prepared.pkName);
            valuesValues.push(
                '(' +
                    pkValue +
                    ',' +
                    valuesNames
                        .map(name => {
                            params.push(prepared.values[name][i]);
                            return placeholderStrategy.getPlaceholder() + this.platform.typeCast(classSchema, name);
                        })
                        .join(',') +
                    ')',
            );
        }

        for (let i = 0; i < changeSets.length; i++) {
            params.push(prepared.primaryKeys[i]);
            let valuesSetValueSql =
                placeholderStrategy.getPlaceholder() + this.platform.typeCast(classSchema, prepared.pkName);
            for (const fieldName of prepared.changedFields) {
                valuesSetValueSql += ', ' + prepared.valuesSet[fieldName][i];
            }
            valuesSetValues.push('(' + valuesSetValueSql + ')');
        }

        for (const i of prepared.changedFields) {
            const col = this.platform.quoteIdentifier(i);
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

        const escapedValuesNames = valuesNames.map(v => this.platform.quoteIdentifier(v));

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

        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        const result = await connection.execAndReturnAll(sql, params);
        for (const returning of result) {
            const r = prepared.assignReturning[returning[prepared.pkName]];
            if (!r) continue;

            for (const name of r.names) {
                r.item[name] = returning[name];
            }
        }
    }

    protected async populateAutoIncrementFields<T>(classSchema: ReflectionClass<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrement();
        if (!autoIncrement) return;
        const connection = await this.getConnection(); //will automatically be released in SQLPersistence

        //We adjusted the INSERT SQL with additional RETURNING which returns all generated
        //auto-increment values. We read the result and simply assign the value.
        const name = autoIncrement.name;
        const insertedRows = connection.lastReturningRows;
        if (!insertedRows.length) return;

        for (let i = 0; i < items.length; i++) {
            items[i][name] = insertedRows[i][name];
        }
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

    protected placeholderPosition: number = 1;

    protected resetPlaceholderSymbol() {
        this.placeholderPosition = 1;
    }

    protected getPlaceholderSymbol() {
        return '$' + this.placeholderPosition++;
    }
}

export class PostgresSQLQueryResolver<T extends OrmEntity> extends SQLQueryResolver<T> {
    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const primaryKey = this.classSchema.getPrimary();
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const primaryKeyConverted = primaryKeyObjectConverter(
            this.classSchema,
            this.platform.serializer.deserializeRegistry,
        );

        const sqlBuilder = new SqlBuilder(this.platform);
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const select = sqlBuilder.select(this.classSchema, model, { select: [`${tableName}.${pkField}`] });

        const connection = await this.connectionPool.getConnection(
            this.session.logger,
            this.session.assignedTransaction,
            this.session.stopwatch,
        );
        try {
            const sql = `
                WITH _ AS (${select.sql})
                DELETE
                FROM ${tableName} USING _
                WHERE ${tableName}.${pkField} = _.${pkField}
                RETURNING ${tableName}.${pkField}
            `;

            const rows = await connection.execAndReturnAll(sql, select.params);
            deleteResult.modified = rows.length;
            for (const row of rows) {
                deleteResult.primaryKeys.push(primaryKeyConverted(row[primaryKey.name]));
            }
        } finally {
            connection.release();
        }
    }

    async patch(model: SQLQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const select: string[] = [];
        const selectParams: any[] = [];
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const primaryKey = this.classSchema.getPrimary();
        const primaryKeyConverted = primaryKeyObjectConverter(
            this.classSchema,
            this.platform.serializer.deserializeRegistry,
        );

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const patchSerialize = getPatchSerializeFunction(
            this.classSchema.type,
            this.platform.serializer.serializeRegistry,
        );
        const $set = changes.$set ? patchSerialize(changes.$set, undefined) : undefined;
        const set: string[] = [];

        if ($set)
            for (const i in $set) {
                if (!$set.hasOwnProperty(i)) continue;
                if ($set[i] === undefined || $set[i] === null) {
                    set.push(`${this.platform.quoteIdentifier(i)} = NULL`);
                } else {
                    fieldsSet[i] = 1;

                    select.push(
                        `$${selectParams.length + 1}${this.platform.typeCast(this.classSchema, i)} as ${this.platform.quoteIdentifier(asAliasName(i))}`,
                    );
                    selectParams.push($set[i]);
                }
            }

        if (changes.$unset)
            for (const i in changes.$unset) {
                if (!changes.$unset.hasOwnProperty(i)) continue;
                fieldsSet[i] = 1;
                select.push(`NULL as ${this.platform.quoteIdentifier(i)}`);
            }

        for (const i of model.returning) {
            aggregateFields[i] = {
                converted: getSerializeFunction(
                    resolvePath(i, this.classSchema.type),
                    this.platform.serializer.deserializeRegistry,
                ),
            };
            select.push(`(${this.platform.quoteIdentifier(i)} ) as ${this.platform.quoteIdentifier(i)}`);
        }

        if (changes.$inc)
            for (const i in changes.$inc) {
                if (!changes.$inc.hasOwnProperty(i)) continue;
                fieldsSet[i] = 1;
                aggregateFields[i] = {
                    converted: getSerializeFunction(
                        resolvePath(i, this.classSchema.type),
                        this.platform.serializer.serializeRegistry,
                    ),
                };
                select.push(
                    `((${this.platform.getColumnAccessor('', i)})${this.platform.typeCast(this.classSchema, i)} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(asAliasName(i))}`,
                );
            }

        for (const i in fieldsSet) {
            if (i.includes('.')) {
                let [firstPart, secondPart] = splitDotPath(i);
                const path = '{' + secondPart.replace(/\./g, ',').replace(/[\]\[]/g, '') + '}';
                set.push(
                    `${this.platform.quoteIdentifier(firstPart)} = jsonb_set(${this.platform.quoteIdentifier(firstPart)}, '${path}', to_jsonb(_b.${this.platform.quoteIdentifier(asAliasName(i))}))`,
                );
            } else {
                set.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
            }
        }
        let bPrimaryKey = primaryKey.name;
        //we need a different name because primaryKeys could be updated as well
        if (fieldsSet[primaryKey.name]) {
            select.unshift(this.platform.quoteIdentifier(primaryKey.name) + ' as __' + primaryKey.name);
            bPrimaryKey = '__' + primaryKey.name;
        } else {
            select.unshift(this.platform.quoteIdentifier(primaryKey.name));
        }

        const returningSelect: string[] = [];
        returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(primaryKey.name));

        if (!empty(aggregateFields)) {
            for (const i in aggregateFields) {
                returningSelect.push(this.platform.getColumnAccessor(tableName, i));
            }
        }

        const sqlBuilder = new SqlBuilder(this.platform, selectParams);
        const selectSQL = sqlBuilder.select(this.classSchema, model, { select });

        const sql = `
            WITH _b AS (${selectSQL.sql})
            UPDATE
                ${tableName}
            SET ${set.join(', ')}
            FROM _b
            WHERE ${tableName}.${this.platform.quoteIdentifier(primaryKey.name)} = _b.${this.platform.quoteIdentifier(bPrimaryKey)}
                RETURNING ${returningSelect.join(', ')}
        `;

        const connection = await this.connectionPool.getConnection(
            this.session.logger,
            this.session.assignedTransaction,
            this.session.stopwatch,
        );
        try {
            const result = await connection.execAndReturnAll(sql, selectSQL.params);

            patchResult.modified = result.length;
            for (const i in aggregateFields) {
                patchResult.returning[i] = [];
            }

            for (const returning of result) {
                patchResult.primaryKeys.push(primaryKeyConverted(returning[primaryKey.name]));
                for (const i in aggregateFields) {
                    patchResult.returning[i].push(aggregateFields[i].converted(returning[i]));
                }
            }
        } finally {
            connection.release();
        }
    }
}

export class PostgresSQLDatabaseQuery<T extends OrmEntity> extends SQLDatabaseQuery<T> {}

export class PostgresSQLDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends OrmEntity>(
        type?: ReceiveType<T> | ClassType<T> | AbstractClassType<T> | ReflectionClass<T>,
    ): PostgresSQLDatabaseQuery<T> {
        return new PostgresSQLDatabaseQuery<T>(
            ReflectionClass.from(type),
            this.databaseSession,
            new PostgresSQLQueryResolver<T>(
                this.connectionPool,
                this.platform,
                ReflectionClass.from(type),
                this.databaseSession,
            ),
        );
    }
}

export class PostgresDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = new pg.Pool(this.options);
    public connectionPool = new PostgresConnectionPool(this.pool);
    public platform = new PostgresPlatform();
    closed = false;

    constructor(protected options: PoolConfig) {
        super();

        pg.types.setTypeParser(1700, parseFloat);
        pg.types.setTypeParser(20, parseInt);
    }

    getName(): string {
        return 'postgres';
    }

    getSchemaName(): string {
        //todo extract schema name from connection options. This acts as default when a table has no schemaName defined.
        return '';
    }

    createPersistence(session: DatabaseSession<this>): SQLPersistence {
        return new PostgresPersistence(this.platform, this.connectionPool, session);
    }

    createTransaction(session: DatabaseSession<this>): PostgresDatabaseTransaction {
        return new PostgresDatabaseTransaction();
    }

    queryFactory(session: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new PostgresSQLDatabaseQueryFactory(this.connectionPool, this.platform, session);
    }

    disconnect(force?: boolean): void {
        if (this.closed) return;
        this.closed = true;
        this.pool.end().catch(console.error);
    }
}
