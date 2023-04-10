/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createPool, Pool, PoolConfig, PoolConnection, UpsertResult } from 'mariadb';
import {
    asAliasName,
    DefaultPlatform,
    prepareBatchUpdate,
    splitDotPath,
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
import {
    DatabaseLogger,
    DatabasePersistenceChangeSet,
    DatabaseSession,
    DatabaseTransaction,
    DeleteResult,
    OrmEntity,
    PatchResult,
    primaryKeyObjectConverter,
    UniqueConstraintFailure
} from '@deepkit/orm';
import { MySQLPlatform } from './mysql-platform.js';
import { Changes, getPatchSerializeFunction, getSerializeFunction, ReceiveType, ReflectionClass, resolvePath } from '@deepkit/type';
import { AbstractClassType, asyncOperation, ClassType, empty, isArray } from '@deepkit/core';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

function handleError(error: Error | string): void {
    const message = 'string' === typeof error ? error : error.message;
    if (message.includes('Duplicate entry')) {
        //todo: extract table name, column name, and find ClassSchema
        throw new UniqueConstraintFailure();
    }
}

export class MySQLStatement extends SQLStatement {
    constructor(protected logger: DatabaseLogger, protected sql: string, protected connection: PoolConnection, protected stopwatch?: Stopwatch) {
        super();
    }

    async get(params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            //mysql/mariadb driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const rows = await asyncOperation<any[]>((resolve, reject) => {
                this.connection.query(this.sql, params).then(resolve).catch(reject);
            });
            this.logger.logQuery(this.sql, params);
            return rows[0];
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
            //mysql/mariadb driver does not maintain error.stack when they throw errors, so
            //we have to manually convert it using asyncOperation.
            const rows = await asyncOperation<any[]>((resolve, reject) => {
                this.connection.query(this.sql, params).then(resolve).catch(reject);
            });
            this.logger.logQuery(this.sql, params);
            return rows;
        } catch (error: any) {
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

export class MySQLConnection extends SQLConnection {
    protected changes: number = 0;
    public lastExecResult?: UpsertResult[];
    protected connector?: Promise<PoolConnection>;

    constructor(
        public connection: PoolConnection,
        connectionPool: SQLConnectionPool,
        logger?: DatabaseLogger,
        transaction?: DatabaseTransaction,
        stopwatch?: Stopwatch,
    ) {
        super(connectionPool, logger, transaction, stopwatch);
    }

    async prepare(sql: string) {
        return new MySQLStatement(this.logger, sql, this.connection);
    }

    async run(sql: string, params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        //batch returns in reality a single UpsertResult if only one query is given
        try {
            if (frame) frame.data({ sql, sqlParams: params });
            const res = (await this.connection.query(sql, params)) as UpsertResult[] | UpsertResult;
            this.logger.logQuery(sql, params);
            this.lastExecResult = isArray(res) ? res : [res];
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

export type TransactionTypes = 'REPEATABLE READ' | 'READ UNCOMMITTED' | 'READ COMMITTED' | 'SERIALIZABLE';

export class MySQLDatabaseTransaction extends DatabaseTransaction {
    connection?: MySQLConnection;

    setTransaction?: TransactionTypes;

    /**
     * This is the default for mysql databases.
     */
    repeatableRead(): this {
        this.setTransaction = 'REPEATABLE READ';
        return this;
    }

    readUncommitted(): this {
        this.setTransaction = 'READ UNCOMMITTED';
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

export class MySQLConnectionPool extends SQLConnectionPool {
    constructor(protected pool: Pool) {
        super();
    }

    async getConnection(logger?: DatabaseLogger, transaction?: MySQLDatabaseTransaction, stopwatch?: Stopwatch): Promise<MySQLConnection> {
        //when a transaction object is given, it means we make the connection sticky exclusively to that transaction
        //and only release the connection when the transaction is commit/rollback is executed.

        if (transaction && transaction.connection) return transaction.connection;

        this.activeConnections++;
        const connection = new MySQLConnection(await this.pool.getConnection(), this, logger, transaction, stopwatch);
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

    release(connection: MySQLConnection) {
        //connections attached to a transaction are not automatically released.
        //only with commit/rollback actions
        if (connection.transaction && !connection.transaction.ended) return;

        connection.connection.release();
        super.release(connection);
    }
}

export class MySQLPersistence extends SQLPersistence {
    constructor(protected platform: DefaultPlatform, public connectionPool: MySQLConnectionPool, session: DatabaseSession<any>) {
        super(platform, connectionPool, session);
    }

    async batchUpdate<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const prepared = prepareBatchUpdate(this.platform, classSchema, changeSets, { setNamesWithTableName: true });
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
            let pkValue = placeholderStrategy.getPlaceholder();
            valuesValues.push('ROW(' + pkValue + ',' + prepared.changedFields.map(name => {
                params.push(prepared.values[name][i]);
                return placeholderStrategy.getPlaceholder();
            }).join(',') + ')');
        }

        for (let i = 0; i < changeSets.length; i++) {
            params.push(prepared.primaryKeys[i]);
            let valuesSetValueSql = placeholderStrategy.getPlaceholder();
            for (const fieldName of prepared.changedFields) {
                valuesSetValueSql += ', ' + prepared.valuesSet[fieldName][i];
            }
            valuesSetValues.push('ROW(' + valuesSetValueSql + ')');
        }

        for (const i of prepared.changedFields) {
            const col = this.platform.quoteIdentifier(i);
            const colChanged = this.platform.quoteIdentifier('_changed_' + i);
            if (prepared.aggregateSelects[i]) {
                const select: string[] = [];
                select.push('CASE');
                for (const item of prepared.aggregateSelects[i]) {
                    select.push(`WHEN _.${prepared.originPkField} = ${item.id} THEN ${item.sql}`);
                }

                select.push(`ELSE IF(_set.${colChanged} = 0, _origin.${col}, _.${col}) END as ${col}`);
                selects.push(select.join(' '));
            } else {
                selects.push(`IF(_set.${colChanged} = 0, _origin.${col}, _.${col}) as ${col}`);
            }
        }

        let setVars = '';
        let endSelect = '';
        if (!empty(prepared.setReturning)) {
            const vars: string[] = [];
            const endSelectVars: string[] = [];
            vars.push(`@_pk := JSON_ARRAYAGG(${prepared.originPkField})`);
            endSelectVars.push('@_pk');
            for (let i in prepared.setReturning) {
                i = asAliasName(i);
                endSelectVars.push(`@_f_${i}`);
                vars.push(`@_f_${i} := JSON_ARRAYAGG(${this.platform.quoteIdentifier(i)})`);
            }
            setVars = `,
                (SELECT ${vars.join(', ')} FROM _tmp GROUP BY '0') as _
            `;
            endSelect = `SELECT ${endSelectVars.join(', ')};`;
        }

        const sql = `
              WITH _tmp(${prepared.originPkField}, ${valuesNames.join(', ')}) AS (
                SELECT _.${prepared.originPkField}, ${selects.join(', ')} FROM
                    (VALUES ${valuesValues.join(', ')}) as _(${prepared.originPkField}, ${valuesNames.join(', ')})
                    INNER JOIN (VALUES ${valuesSetValues.join(', ')}) as _set(${prepared.pkField}, ${valuesSetNames.join(', ')}) ON (_.${prepared.originPkField} = _set.${prepared.pkField})
                    INNER JOIN ${prepared.tableName} as _origin ON (_origin.${prepared.pkField} = _.${prepared.originPkField})
              )
              UPDATE
                ${prepared.tableName}, _tmp as _b ${setVars}

              SET ${prepared.setNames.join(', ')}
              WHERE ${prepared.tableName}.${prepared.pkField} = _b.${prepared.originPkField};
              ${endSelect}
        `;

        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        const result = await connection.execAndReturnAll(sql, params);

        if (!empty(prepared.setReturning)) {
            const returning = result[1][0];
            const ids = JSON.parse(returning['@_pk']) as (number | string)[];
            const parsedReturning: { [name: string]: any[] } = {};
            for (const i in prepared.setReturning) {
                parsedReturning[i] = JSON.parse(returning['@_f_' + i]) as any[];
            }

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const r = prepared.assignReturning[id];
                if (!r) continue;

                for (const name of r.names) {
                    r.item[name] = parsedReturning[name][i];
                }
            }
        }
    }

    protected async populateAutoIncrementFields<T>(classSchema: ReflectionClass<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrement();
        if (!autoIncrement) return;
        const connection = await this.getConnection(); //will automatically be released in SQLPersistence

        if (!connection.lastExecResult || !connection.lastExecResult.length) throw new Error('No lastBatchResult found');

        //MySQL returns the _first_ auto-incremented value for a batch insert.
        //It's guaranteed to increment always by one (expect if the user provides a manual auto-increment value in between, which should be forbidden).
        //So since we know how many items were inserted, we can simply calculate for each item the auto-incremented value.
        const result = connection.lastExecResult[0];
        let start = result.insertId;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
    }
}

export class MySQLQueryResolver<T extends OrmEntity> extends SQLQueryResolver<T> {
    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        const primaryKey = this.classSchema.getPrimary();
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const primaryKeyConverted = primaryKeyObjectConverter(this.classSchema, this.platform.serializer.deserializeRegistry);

        const sqlBuilder = new SqlBuilder(this.platform);
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const select = sqlBuilder.select(this.classSchema, model, { select: [`${tableName}.${pkField}`] });

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        try {
            const sql = `
                WITH _ AS (${select.sql})
                DELETE ${tableName}
                FROM ${tableName} INNER JOIN _ INNER JOIN (SELECT @_pk := JSON_ARRAYAGG(${pkField}) FROM _ GROUP BY '0') as _pk
                WHERE ${tableName}.${pkField} = _.${pkField};
                SELECT @_pk
            `;

            const rows = await connection.execAndReturnAll(sql, select.params);
            const returning = rows[1];
            const pk = returning[0]['@_pk'];
            if (pk) deleteResult.primaryKeys = JSON.parse(pk).map(primaryKeyConverted);
            deleteResult.modified = deleteResult.primaryKeys.length;
        } finally {
            connection.release();
        }
    }

    async patch(model: SQLQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const select: string[] = [];
        const selectParams: any[] = [];
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const primaryKey = this.classSchema.getPrimary();
        const primaryKeyConverted = primaryKeyObjectConverter(this.classSchema, this.platform.serializer.deserializeRegistry);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const patchSerialize = getPatchSerializeFunction(this.classSchema.type, this.platform.serializer.serializeRegistry);
        const $set = changes.$set ? patchSerialize(changes.$set, undefined, {normalizeArrayIndex: true}) : undefined;

        if ($set) for (const i in $set) {
            if (!$set.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`? as ${this.platform.quoteIdentifier(asAliasName(i))}`);
            selectParams.push($set[i]);
        }

        if (changes.$unset) for (const i in changes.$unset) {
            if (!changes.$unset.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`NULL as ${this.platform.quoteIdentifier(asAliasName(i))}`);
        }

        for (const i of model.returning) {
            aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, this.classSchema.type), this.platform.serializer.deserializeRegistry) };
            select.push(`(${this.platform.quoteIdentifier(i)} ) as ${this.platform.quoteIdentifier(asAliasName(i))}`);
        }

        if (changes.$inc) for (const i in changes.$inc) {
            if (!changes.$inc.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, this.classSchema.type), this.platform.serializer.serializeRegistry) };
            select.push(`(${this.platform.getColumnAccessor('', i)} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(asAliasName(i))}`);
        }

        const set: string[] = [];
        for (const i in fieldsSet) {
            if (i.includes('.')) {
                let [firstPart, secondPart] = splitDotPath(i);
                if (!secondPart.startsWith('[')) secondPart = '.' + secondPart;
                set.push(`_target.${this.platform.quoteIdentifier(firstPart)} = json_set(${this.platform.quoteIdentifier(firstPart)}, '$${secondPart}', b.${this.platform.quoteIdentifier(asAliasName(i))})`);
            } else {
                set.push(`_target.${this.platform.quoteIdentifier(i)} = b.${this.platform.quoteIdentifier(asAliasName(i))}`);
            }
        }

        const extractSelect: string[] = [];
        const selectVars: string[] = [];
        let bPrimaryKey = primaryKey.name;
        //we need a different name because primaryKeys could be updated as well
        if (fieldsSet[primaryKey.name]) {
            select.unshift(this.platform.quoteIdentifier(primaryKey.name) + ' as __' + primaryKey.name);
            bPrimaryKey = '__' + primaryKey.name;
        } else {
            select.unshift(this.platform.quoteIdentifier(primaryKey.name));
        }

        extractSelect.push(`@_pk := JSON_ARRAYAGG(${this.platform.quoteIdentifier(primaryKey.name)})`);
        selectVars.push(`@_pk`);
        if (!empty(aggregateFields)) {
            for (let i in aggregateFields) {
                i = asAliasName(i);
                extractSelect.push(`@_f_${i} := JSON_ARRAYAGG(${this.platform.quoteIdentifier(i)})`);
                selectVars.push(`@_f_${i}`);
            }
        }
        const extractVarsSQL = `,
                (SELECT ${extractSelect.join(', ')} FROM _tmp GROUP BY '0') as _
            `;
        const selectVarsSQL = `SELECT ${selectVars.join(', ')};`;

        const sqlBuilder = new SqlBuilder(this.platform, selectParams);
        const selectSQL = sqlBuilder.select(this.classSchema, model, { select });

        const params = selectSQL.params;
        const sql = `
            WITH _tmp AS (${selectSQL.sql})
            UPDATE
                ${tableName} as _target, _tmp as b ${extractVarsSQL}
            SET
                ${set.join(', ')}
            WHERE _target.${this.platform.quoteIdentifier(primaryKey.name)} = b.${this.platform.quoteIdentifier(bPrimaryKey)};
            ${selectVarsSQL}
        `;

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        try {
            const result = await connection.execAndReturnAll(sql, params);
            const packet = result[0];
            patchResult.modified = packet.affectedRows;
            const returning = result[1][0];
            if (patchResult.modified > 0) {
                patchResult.primaryKeys = (JSON.parse(returning['@_pk']) as any[]).map(primaryKeyConverted as any);
            }

            for (const i in aggregateFields) {
                patchResult.returning[i] = (JSON.parse(returning['@_f_' + asAliasName(i)]) as any[]).map(aggregateFields[i].converted);
            }

        } finally {
            connection.release();
        }
    }
}

export class MySQLDatabaseQuery<T extends OrmEntity> extends SQLDatabaseQuery<T> {
}

export class MySQLDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends OrmEntity>(type?: ReceiveType<T> | ClassType<T> | AbstractClassType<T> | ReflectionClass<T>): MySQLDatabaseQuery<T> {
        return new MySQLDatabaseQuery<T>(ReflectionClass.from(type), this.databaseSession,
            new MySQLQueryResolver<T>(this.connectionPool, this.platform, ReflectionClass.from(type), this.databaseSession)
        );
    }
}

export class MySQLDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = createPool({ multipleStatements: true, maxAllowedPacket: 16_000_000, ...this.options });
    public connectionPool = new MySQLConnectionPool(this.pool);
    public platform = new MySQLPlatform(this.pool);

    constructor(
        protected options: PoolConfig = {}
    ) {
        super();
    }

    getName(): string {
        return 'mysql';
    }

    getSchemaName(): string {
        //todo extract schema name from connection options. This acts as default when a table has no schemaName defined.
        return '';
    }

    createPersistence(session: DatabaseSession<any>): SQLPersistence {
        return new MySQLPersistence(this.platform, this.connectionPool, session);
    }

    createTransaction(session: DatabaseSession<this>): MySQLDatabaseTransaction {
        return new MySQLDatabaseTransaction();
    }

    queryFactory(databaseSession: DatabaseSession<any>): MySQLDatabaseQueryFactory {
        return new MySQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
