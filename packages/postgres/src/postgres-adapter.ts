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
    DefaultPlatform,
    SqlBuilder,
    SQLConnection,
    SQLConnectionPool,
    SQLDatabaseAdapter,
    SQLDatabaseQuery,
    SQLDatabaseQueryFactory,
    SQLPersistence,
    SQLQueryModel,
    SQLQueryResolver,
    SQLStatement
} from '@deepkit/sql';
import { DatabaseLogger, DatabasePersistenceChangeSet, DatabaseSession, DatabaseTransaction, DeleteResult, Entity, PatchResult, UniqueConstraintFailure } from '@deepkit/orm';
import { PostgresPlatform } from './postgres-platform';
import { Changes, ClassSchema, getClassSchema, getPropertyXtoClassFunction, PropertySchema, resolvePropertySchema } from '@deepkit/type';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';
import { asyncOperation, ClassType, empty } from '@deepkit/core';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

function handleError(error: Error | string): void {
    const message = 'string' === typeof error ? error : error.message;
    if (message.includes('violates unique constraint')) {
        //todo: extract table name, column name, and find ClassSchema
        throw new UniqueConstraintFailure();
    }
}

export class PostgresStatement extends SQLStatement {
    protected released = false;

    constructor(protected logger: DatabaseLogger, protected sql: string, protected client: PoolClient, protected stopwatch?: Stopwatch) {
        super();
    }

    async get(params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({sql: this.sql, sqlParams: params});
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await asyncOperation<any>((resolve, reject) => {
                this.client.query(this.sql, params).then(resolve).catch(reject);
            });
            return res.rows[0];
        } catch (error) {
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
            if (frame) frame.data({sql: this.sql, sqlParams: params});
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await asyncOperation<any>((resolve, reject) => {
                this.client.query(this.sql, params).then(resolve).catch(reject);
            });
            return res.rows;
        } catch (error) {
            handleError(error);
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    release() {
    }
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
            if (frame) frame.data({sql, sqlParams: params});
            //postgres driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const res = await asyncOperation<any>((resolve, reject) => {
                this.connection.query(sql, params).then(resolve).catch(reject);
            });
            this.logger.logQuery(sql, params);
            this.lastReturningRows = res.rows;
            this.changes = res.rowCount;
        } catch (error) {
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

    async getConnection(logger?: DatabaseLogger, transaction?: PostgresDatabaseTransaction, stopwatch?: Stopwatch): Promise<PostgresConnection> {
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

function typeSafeDefaultValue(property: PropertySchema): any {
    if (property.type === 'string') return '';
    if (property.type === 'number') return 0;
    if (property.type === 'boolean') return false;
    if (property.type === 'date') return new Date;

    return null;
}

export class PostgresPersistence extends SQLPersistence {
    constructor(protected platform: DefaultPlatform, public connectionPool: PostgresConnectionPool, session: DatabaseSession<any>) {
        super(platform, connectionPool, session);
    }

    async batchUpdate<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const scopeSerializer = this.platform.serializer.for(classSchema);
        const tableName = this.platform.getTableIdentifier(classSchema);
        const pkName = classSchema.getPrimaryField().name;
        const pkField = this.platform.quoteIdentifier(pkName);

        const values: { [name: string]: any[] } = {};
        const setNames: string[] = [];
        const aggregateSelects: { [name: string]: { id: any, sql: string }[] } = {};
        const requiredFields: { [name: string]: 1 } = {};

        const assignReturning: { [name: string]: { item: any, names: string[] } } = {};
        const setReturning: { [name: string]: 1 } = {};

        for (const changeSet of changeSets) {
            const where: string[] = [];

            const pk = scopeSerializer.partialSerialize(changeSet.primaryKey);
            for (const i in pk) {
                if (!pk.hasOwnProperty(i)) continue;
                where.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(pk[i])}`);
                requiredFields[i] = 1;
            }

            if (!values[pkName]) values[pkName] = [];
            values[pkName].push(this.platform.quoteValue(changeSet.primaryKey[pkName]));

            const fieldAddedToValues: { [name: string]: 1 } = {};
            const id = changeSet.primaryKey[pkName];

            if (changeSet.changes.$set) {
                const value = scopeSerializer.partialSerialize(changeSet.changes.$set);
                for (const i in value) {
                    if (!value.hasOwnProperty(i)) continue;
                    if (!values[i]) {
                        values[i] = [];
                        setNames.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
                    }
                    requiredFields[i] = 1;
                    fieldAddedToValues[i] = 1;
                    let v = value[i];

                    //special postgres check to avoid an error like:
                    /// column "deletedAt" is of type timestamp without time zone but expression is of type text
                    if (v === undefined || v === null) {
                        values[i].push('null' + this.platform.typeCast(classSchema, i));
                    } else {
                        values[i].push(this.platform.quoteValue(v));
                    }
                }
            }

            if (changeSet.changes.$inc) {
                for (const i in changeSet.changes.$inc) {
                    if (!changeSet.changes.$inc.hasOwnProperty(i)) continue;
                    const value = changeSet.changes.$inc[i];
                    if (!aggregateSelects[i]) aggregateSelects[i] = [];

                    if (!values[i]) {
                        values[i] = [];
                        setNames.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
                    }

                    if (!assignReturning[id]) {
                        assignReturning[id] = { item: changeSet.item, names: [] };
                    }

                    assignReturning[id].names.push(i);
                    setReturning[i] = 1;

                    aggregateSelects[i].push({
                        id: changeSet.primaryKey[pkName],
                        sql: `_origin.${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(value)}`
                    });
                    requiredFields[i] = 1;
                    if (!fieldAddedToValues[i]) {
                        fieldAddedToValues[i] = 1;
                        values[i].push(this.platform.quoteValue(typeSafeDefaultValue(classSchema.getProperty(i))));
                    }
                }
            }
        }

        const selects: string[] = [];
        const valuesValues: string[] = [];
        const valuesNames: string[] = [];
        for (const i in values) {
            valuesNames.push(i);
        }

        for (let i = 0; i < values[pkName].length; i++) {
            valuesValues.push('(' + valuesNames.map(name => values[name][i]).join(',') + ')');
        }

        for (const i in requiredFields) {
            if (aggregateSelects[i]) {
                const select: string[] = [];
                select.push('CASE');
                for (const item of aggregateSelects[i]) {
                    select.push(`WHEN _.${pkField} = ${item.id} THEN ${item.sql}`);
                }
                select.push(`ELSE _.${this.platform.quoteIdentifier(i)} END as ${this.platform.quoteIdentifier(i)}`);
                selects.push(select.join(' '));
            } else {
                selects.push('_.' + this.platform.quoteIdentifier(i));
            }
        }

        const returningSelect: string[] = [];
        returningSelect.push(tableName + '.' + pkField);
        if (!empty(setReturning)) {
            for (const i in setReturning) {
                returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(i));
            }
        }

        const escapedValuesNames = valuesNames.map(v => this.platform.quoteIdentifier(v));

        const sql = `
              WITH _b(${escapedValuesNames.join(', ')}) AS (
                SELECT ${selects.join(', ')} FROM
                    (VALUES ${valuesValues.join(', ')}) as _(${escapedValuesNames.join(', ')})
                    INNER JOIN ${tableName} as _origin ON (_origin.${pkField} = _.${pkField})
              )
              UPDATE ${tableName}
              SET ${setNames.join(', ')}
              FROM _b
              WHERE ${tableName}.${pkField} = _b.${pkField}
              RETURNING ${returningSelect.join(', ')};
        `;

        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        const result = await connection.execAndReturnAll(sql);
        for (const returning of result) {
            const r = assignReturning[returning[pkName]];
            if (!r) continue;

            for (const name of r.names) {
                r.item[name] = returning[name];
            }
        }
    }

    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrementField();
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

    protected getInsertSQL(classSchema: ClassSchema, fields: string[], values: string[]): string {
        const autoIncrement = classSchema.getAutoIncrementField();
        const returning = autoIncrement ? ` RETURNING ${this.platform.quoteIdentifier(autoIncrement.name)}` : '';

        if (fields.length === 0) {
            const pkName = this.platform.quoteIdentifier(classSchema.getPrimaryFieldName());
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

export class PostgresSQLQueryResolver<T extends Entity> extends SQLQueryResolver<T> {

    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const primaryKey = this.classSchema.getPrimaryField();
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const primaryKeyConverted = getPropertyXtoClassFunction(primaryKey, this.platform.serializer);

        const sqlBuilder = new SqlBuilder(this.platform);
        const select = sqlBuilder.select(this.classSchema, model, { select: [pkField] });
        const tableName = this.platform.getTableIdentifier(this.classSchema);

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
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
        const primaryKey = this.classSchema.getPrimaryField();
        const primaryKeyConverted = getPropertyXtoClassFunction(primaryKey, this.platform.serializer);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const scopeSerializer = this.platform.serializer.for(this.classSchema);
        const $set = changes.$set ? scopeSerializer.partialSerialize(changes.$set) : undefined;
        const set: string[] = [];

        if ($set) for (const i in $set) {
            if (!$set.hasOwnProperty(i)) continue;
            if ($set[i] === undefined || $set[i] === null) {
                set.push(`${this.platform.quoteIdentifier(i)} = NULL`);
            } else {
                fieldsSet[i] = 1;

                select.push(`$${selectParams.length + 1}${this.platform.typeCast(this.classSchema, i)} as ${this.platform.quoteIdentifier(i)}`);
                selectParams.push($set[i]);
            }
        }

        if (changes.$unset) for (const i in changes.$unset) {
            if (!changes.$unset.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`NULL as ${this.platform.quoteIdentifier(i)}`);
        }

        for (const i of model.returning) {
            aggregateFields[i] = { converted: getPropertyXtoClassFunction(resolvePropertySchema(this.classSchema, i), this.platform.serializer) };
            select.push(`(${this.platform.quoteIdentifier(i)} ) as ${this.platform.quoteIdentifier(i)}`);
        }

        if (changes.$inc) for (const i in changes.$inc) {
            if (!changes.$inc.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            aggregateFields[i] = { converted: getPropertyXtoClassFunction(resolvePropertySchema(this.classSchema, i), this.platform.serializer) };
            select.push(`(${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(i)}`);
        }

        for (const i in fieldsSet) {
            set.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
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
                returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(i));
            }
        }

        const sqlBuilder = new SqlBuilder(this.platform, selectParams);
        const selectSQL = sqlBuilder.select(this.classSchema, model, { select });

        const sql = `
            WITH _b AS (${selectSQL.sql})
            UPDATE
                ${tableName}
            SET
                ${set.join(', ')}
            FROM _b
            WHERE ${tableName}.${this.platform.quoteIdentifier(primaryKey.name)} = _b.${this.platform.quoteIdentifier(bPrimaryKey)}
            RETURNING ${returningSelect.join(', ')}
        `;

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
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

export class PostgresSQLDatabaseQuery<T> extends SQLDatabaseQuery<T> {
}

export class PostgresSQLDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends Entity>(classType: ClassType<T> | ClassSchema<T>): PostgresSQLDatabaseQuery<T> {
        return new PostgresSQLDatabaseQuery(getClassSchema(classType), this.databaseSession,
            new PostgresSQLQueryResolver(this.connectionPool, this.platform, getClassSchema(classType), this.databaseSession)
        );
    }
}

export class PostgresDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = new pg.Pool(this.options);
    public connectionPool = new PostgresConnectionPool(this.pool);
    public platform = new PostgresPlatform();

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
        return new PostgresDatabaseTransaction;
    }

    queryFactory(session: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new PostgresSQLDatabaseQueryFactory(this.connectionPool, this.platform, session);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
