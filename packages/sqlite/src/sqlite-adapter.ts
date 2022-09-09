/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AbstractClassType, asyncOperation, ClassType, empty } from '@deepkit/core';
import {
    DatabaseAdapter,
    DatabaseError,
    DatabaseLogger,
    DatabasePersistenceChangeSet,
    DatabaseSession,
    DatabaseTransaction,
    DeleteResult,
    OrmEntity,
    PatchResult,
    UniqueConstraintFailure
} from '@deepkit/orm';
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
import { Changes, getPartialSerializeFunction, getSerializeFunction, ReceiveType, ReflectionClass, resolvePath } from '@deepkit/type';
import sqlite3 from 'better-sqlite3';
import { SQLitePlatform } from './sqlite-platform';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

export class SQLiteStatement extends SQLStatement {
    constructor(protected logger: DatabaseLogger, protected sql: string, protected stmt: sqlite3.Statement, protected stopwatch?: Stopwatch) {
        super();
    }

    async get(params: any[] = []): Promise<any> {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            const res = this.stmt.get(...params);
            this.logger.logQuery(this.sql, params);
            return res;
        } catch (error) {
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    async all(params: any[] = []): Promise<any[]> {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql: this.sql, sqlParams: params });
            const res = this.stmt.all(...params);
            this.logger.logQuery(this.sql, params);
            return res;
        } catch (error) {
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    release() {
    }
}

export class SQLiteDatabaseTransaction extends DatabaseTransaction {
    connection?: SQLiteConnection;

    async begin() {
        if (!this.connection) return;
        await this.connection.run('BEGIN');
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

export class SQLiteConnection extends SQLConnection {
    public platform = new SQLitePlatform();
    protected changes: number = 0;
    public db: sqlite3.Database;

    static DatabaseConstructor: any = sqlite3;

    constructor(
        connectionPool: SQLConnectionPool,
        protected dbPath: string,
        logger?: DatabaseLogger,
        transaction?: DatabaseTransaction,
        stopwatch?: Stopwatch,
    ) {
        super(connectionPool, logger, transaction, stopwatch);
        this.db = new SQLiteConnection.DatabaseConstructor(this.dbPath);
        this.db.exec('PRAGMA foreign_keys=ON');
    }

    async prepare(sql: string) {
        return new SQLiteStatement(this.logger, sql, this.db.prepare(sql), this.stopwatch);
    }

    protected handleError(error: Error | string): void {
        const message = 'string' === typeof error ? error : error.message;
        if (message.includes('UNIQUE constraint failed')) {
            //todo: extract table name, column name, and find ClassSchema
            throw new UniqueConstraintFailure();
        }
    }

    async run(sql: string, params: any[] = []) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql, sqlParams: params });
            const stmt = this.db.prepare(sql);
            this.logger.logQuery(sql, params);
            const result = stmt.run(...params);
            this.changes = result.changes;
        } catch (error: any) {
            this.handleError(error);
            this.logger.failedQuery(error, sql, params);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    async exec(sql: string) {
        const frame = this.stopwatch ? this.stopwatch.start('Query', FrameCategory.databaseQuery) : undefined;
        try {
            if (frame) frame.data({ sql });
            this.db.exec(sql);
            this.logger.logQuery(sql, []);
        } catch (error: any) {
            this.handleError(error);
            this.logger.failedQuery(error, sql, []);
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export class SQLiteConnectionPool extends SQLConnectionPool {
    public maxConnections: number = 10;

    protected queue: ((connection: SQLiteConnection) => void)[] = [];

    //we keep the first connection alive
    protected firstConnection?: SQLiteConnection;

    constructor(protected dbPath: string | ':memory:') {
        super();

        if (dbPath === ':memory:') {
            this.maxConnections = 1;
        }
    }

    close() {
        if (this.firstConnection) this.firstConnection.db.close();
    }

    protected createConnection(logger?: DatabaseLogger, transaction?: SQLiteDatabaseTransaction, stopwatch?: Stopwatch): SQLiteConnection {
        return new SQLiteConnection(this, this.dbPath, logger, transaction, stopwatch);
    }

    async getConnection(logger?: DatabaseLogger, transaction?: SQLiteDatabaseTransaction, stopwatch?: Stopwatch): Promise<SQLiteConnection> {
        //when a transaction object is given, it means we make the connection sticky exclusively to that transaction
        //and only release the connection when the transaction is commit/rollback is executed.

        if (transaction && transaction.connection) {
            transaction.connection.stopwatch = stopwatch;
            return transaction.connection;
        }

        const connection = this.firstConnection && this.firstConnection.released ? this.firstConnection :
            this.activeConnections >= this.maxConnections
                //we wait for the next query to be released and reuse it
                ? await asyncOperation<SQLiteConnection>((resolve) => {
                    this.queue.push(resolve);
                })
                : this.createConnection(logger, transaction, stopwatch);

        if (!this.firstConnection) this.firstConnection = connection;
        connection.released = false;
        connection.stopwatch = stopwatch;

        //first connection is always reused, so we update the logger
        if (logger) connection.logger = logger;

        this.activeConnections++;

        if (transaction) {
            transaction.connection = connection;
            connection.transaction = transaction;
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

    release(connection: SQLiteConnection) {
        //connections attached to a transaction are not automatically released.
        //only with commit/rollback actions
        if (connection.transaction && !connection.transaction.ended) return;

        super.release(connection);
        const resolve = this.queue.shift();
        if (resolve) {
            resolve(connection);
        } else if (this.firstConnection !== connection) {
            connection.db.close();
        }
    }
}

export class SQLitePersistence extends SQLPersistence {
    constructor(
        protected platform: DefaultPlatform,
        public connectionPool: SQLiteConnectionPool,
        database: DatabaseSession<any>,
    ) {
        super(platform, connectionPool, database);
    }

    protected getInsertSQL(classSchema: ReflectionClass<any>, fields: string[], values: string[]): string {
        if (fields.length === 0) {
            const pkName = this.platform.quoteIdentifier(classSchema.getPrimary().name);
            fields.push(pkName);
            values.fill('NULL');
        }

        return super.getInsertSQL(classSchema, fields, values);
    }

    async batchUpdate<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const partialSerialize = getPartialSerializeFunction(classSchema.type, this.platform.serializer.serializeRegistry);
        const tableName = this.platform.getTableIdentifier(classSchema);
        const pkName = classSchema.getPrimary().name;
        const pkField = this.platform.quoteIdentifier(pkName);

        const values: { [name: string]: any[] } = {};
        const setNames: string[] = [];
        const aggregateSelects: { [name: string]: { id: any, sql: string }[] } = {};
        const requiredFields: { [name: string]: 1 } = {};

        const assignReturning: { [name: string]: { item: any, names: string[] } } = {};
        const setReturning: { [name: string]: 1 } = {};

        for (const changeSet of changeSets) {
            const pk = partialSerialize(changeSet.primaryKey);
            for (const i in pk) {
                if (!pk.hasOwnProperty(i)) continue;
                requiredFields[i] = 1;
            }

            if (!values[pkName]) values[pkName] = [];
            values[pkName].push(pk[pkName]);

            const fieldAddedToValues: { [name: string]: 1 } = {};
            const id = changeSet.primaryKey[pkName];

            //todo: handle changes.$unset

            if (changeSet.changes.$set) {
                const value = partialSerialize(changeSet.changes.$set);
                for (const i in value) {
                    if (!value.hasOwnProperty(i)) continue;
                    if (!values[i]) {
                        values[i] = [];
                        setNames.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
                    }
                    requiredFields[i] = 1;
                    fieldAddedToValues[i] = 1;
                    values[i].push(value[i]);
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
                        values[i].push(null);
                    }
                }
            }
        }

        const placeholderStrategy = new this.platform.placeholderStrategy();
        const params: any[] = [];
        const selects: string[] = [];
        const valuesValues: string[] = [];
        const valuesNames: string[] = [];
        const _rename: string[] = [];

        let j = 1;
        for (const i in values) {
            valuesNames.push(i);
            _rename.push(`column${j++} as ${i}`);
        }

        for (let i = 0; i < values[pkName].length; i++) {
            valuesValues.push('(' + valuesNames.map(name => {
                params.push(values[name][i]);
                return placeholderStrategy.getPlaceholder();
            }).join(',') + ')');
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
                selects.push('_.' + i);
            }
        }

        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        await connection.exec(`DROP TABLE IF EXISTS _b`);

        const sql = `
              CREATE TEMPORARY TABLE _b AS
                SELECT ${selects.join(', ')}
                FROM (SELECT ${_rename.join(', ')} FROM (VALUES ${valuesValues.join(', ')})) as _
                INNER JOIN ${tableName} as _origin ON (_origin.${pkField} = _.${pkField});
        `;

        await connection.run(sql, params);

        await connection.exec(`
            UPDATE
            ${tableName}
            SET ${setNames.join(', ')}
            FROM
            _b
            WHERE ${tableName}.${pkField} = _b.${pkField};
        `);

        if (!empty(setReturning)) {
            const returnings = await connection.execAndReturnAll('SELECT * FROM _b');
            for (const returning of returnings) {
                const r = assignReturning[returning[pkName]];

                for (const name of r.names) {
                    r.item[name] = returning[name];
                }
            }
        }
    }

    protected async populateAutoIncrementFields<T>(classSchema: ReflectionClass<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrement();
        if (!autoIncrement) return;

        //SQLite returns the _last_ auto-incremented value for a batch insert as last_insert_rowid().
        //Since we know how many items were inserted, we can simply calculate for each item the auto-incremented value.
        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        const row = await connection.execAndReturnSingle(`SELECT last_insert_rowid() as rowid`);
        const lastInserted = row.rowid;
        let start = lastInserted - items.length + 1;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
    }
}

export class SQLiteQueryResolver<T extends OrmEntity> extends SQLQueryResolver<T> {
    constructor(
        protected connectionPool: SQLiteConnectionPool,
        protected platform: DefaultPlatform,
        classSchema: ReflectionClass<T>,
        session: DatabaseSession<DatabaseAdapter>) {
        super(connectionPool, platform, classSchema, session);
    }

    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        // if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const primaryKey = this.classSchema.getPrimary();
        const pkName = primaryKey.name;
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const sqlBuilder = new SqlBuilder(this.platform);
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const select = sqlBuilder.select(this.classSchema, model, { select: [pkField] });
        const primaryKeyConverted = getSerializeFunction(primaryKey.property, this.platform.serializer.deserializeRegistry);
        if (sqlBuilderFrame) sqlBuilderFrame.end();

        const connectionFrame = this.session.stopwatch ? this.session.stopwatch.start('Connection acquisition') : undefined;
        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        if (connectionFrame) connectionFrame.end();

        try {
            await connection.exec(`DROP TABLE IF EXISTS _tmp_d`);
            await connection.run(`CREATE TEMPORARY TABLE _tmp_d as ${select.sql};`, select.params);

            const sql = `DELETE FROM ${tableName} WHERE ${tableName}.${pkField} IN (SELECT * FROM _tmp_d)`;
            await connection.run(sql);
            const rows = await connection.execAndReturnAll('SELECT * FROM _tmp_d');

            deleteResult.modified = await connection.getChanges();
            for (const row of rows) {
                deleteResult.primaryKeys.push(primaryKeyConverted(row[pkName]));
            }
        } finally {
            connection.release();
        }
    }

    async patch(model: SQLQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const sqlBuilderFrame = this.session.stopwatch ? this.session.stopwatch.start('SQL Builder') : undefined;
        const select: string[] = [];
        const selectParams: any[] = [];
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const primaryKey = this.classSchema.getPrimary();
        const primaryKeyConverted = getSerializeFunction(primaryKey.property, this.platform.serializer.deserializeRegistry);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const partialSerialize = getPartialSerializeFunction(this.classSchema.type, this.platform.serializer.serializeRegistry);
        const $set = changes.$set ? partialSerialize(changes.$set) : undefined;

        if ($set) for (const i in $set) {
            if (!$set.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(` ? as ${this.platform.quoteIdentifier(i)}`);
            selectParams.push($set[i]);
        }

        if (changes.$unset) for (const i in changes.$unset) {
            if (!changes.$unset.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`NULL as ${this.platform.quoteIdentifier(i)}`);
        }

        for (const i of model.returning) {
            aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, this.classSchema.type), this.platform.serializer.deserializeRegistry) };
            select.push(`(${this.platform.quoteIdentifier(i)} ) as ${this.platform.quoteIdentifier(i)}`);
        }

        if (changes.$inc) for (const i in changes.$inc) {
            if (!changes.$inc.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            aggregateFields[i] = { converted: getSerializeFunction(resolvePath(i, this.classSchema.type), this.platform.serializer.serializeRegistry) };
            select.push(`(${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(i)}`);
        }

        const set: string[] = [];
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

        const sqlBuilder = new SqlBuilder(this.platform, selectParams);
        const selectSQL = sqlBuilder.select(this.classSchema, model, { select });
        if (!set.length) {
            throw new DatabaseError('SET is empty');
        }

        const sql = `
              UPDATE
                ${tableName}
              SET
                ${set.join(', ')}
              FROM
                _b
              WHERE ${tableName}.${this.platform.quoteIdentifier(primaryKey.name)} = _b.${this.platform.quoteIdentifier(bPrimaryKey)};
        `;
        if (sqlBuilderFrame) sqlBuilderFrame.end();

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);
        try {
            await connection.exec(`DROP TABLE IF EXISTS _b;`);

            const createBSQL = `CREATE TEMPORARY TABLE _b AS ${selectSQL.sql};`;
            await connection.run(createBSQL, selectSQL.params);

            await connection.run(sql);
            patchResult.modified = await connection.getChanges();

            const returnings = await connection.execAndReturnAll('SELECT * FROM _b');
            for (const i in aggregateFields) {
                patchResult.returning[i] = [];
            }

            for (const returning of returnings) {
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

export class SQLiteDatabaseQuery<T> extends SQLDatabaseQuery<T> {
}

export class SQLiteDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    constructor(protected connectionPool: SQLiteConnectionPool, platform: DefaultPlatform, databaseSession: DatabaseSession<any>) {
        super(connectionPool, platform, databaseSession);
    }

    createQuery<T extends OrmEntity>(type?: ReceiveType<T> | ClassType<T> | AbstractClassType<T> | ReflectionClass<T>): SQLiteDatabaseQuery<T> {
        return new SQLiteDatabaseQuery<T>(ReflectionClass.from(type), this.databaseSession,
            new SQLiteQueryResolver<T>(this.connectionPool, this.platform, ReflectionClass.from(type), this.databaseSession)
        );
    }
}

export class SQLiteDatabaseAdapter extends SQLDatabaseAdapter {
    public readonly connectionPool: SQLiteConnectionPool;
    public readonly platform = new SQLitePlatform();

    constructor(protected sqlitePath: string | ':memory:' = ':memory:') {
        super();

        this.connectionPool = new SQLiteConnectionPool(this.sqlitePath);
    }

    async getInsertBatchSize(schema: ReflectionClass<any>): Promise<number> {
        return Math.floor(32000 / schema.getProperties().length);
    }

    getName(): string {
        return 'sqlite';
    }

    getSchemaName(): string {
        return '';
    }

    createTransaction(session: DatabaseSession<this>): SQLiteDatabaseTransaction {
        return new SQLiteDatabaseTransaction();
    }

    createPersistence(session: DatabaseSession<any>): SQLPersistence {
        return new SQLitePersistence(this.platform, this.connectionPool, session);
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLiteDatabaseQueryFactory {
        return new SQLiteDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        if (!force && this.connectionPool.getActiveConnections() > 0) {
            throw new Error(`There are still active connections. Please release() any fetched connection first.`);
        }
        this.connectionPool.close();
    }
}
