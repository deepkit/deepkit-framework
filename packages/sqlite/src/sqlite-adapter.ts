/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, empty, Mutex } from '@deepkit/core';
import { DatabaseAdapter, DatabaseLogger, DatabasePersistenceChangeSet, DatabaseSession, DatabaseTransaction, DeleteResult, Entity, PatchResult } from '@deepkit/orm';
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
import { Changes, ClassSchema, getClassSchema, getPropertyXtoClassFunction, resolvePropertySchema } from '@deepkit/type';
import sqlite3 from 'better-sqlite3';
import { SQLitePlatform } from './sqlite-platform';

export class SQLiteStatement extends SQLStatement {
    constructor(protected logger: DatabaseLogger, protected sql: string, protected stmt: sqlite3.Statement) {
        super();
    }

    async get(params: any[] = []): Promise<any> {
        try {
            const res = this.stmt.get(...params);
            this.logger.logQuery(this.sql, params);
            return res;
        } catch (error) {
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        }
    }

    async all(params: any[] = []): Promise<any[]> {
        try {
            const res = this.stmt.all(...params);
            this.logger.logQuery(this.sql, params);
            return res;
        } catch (error) {
            this.logger.failedQuery(error, this.sql, params);
            throw error;
        }
    }

    release() {
    }
}

export class SQLiteConnection extends SQLConnection {
    public platform = new SQLitePlatform();
    protected changes: number = 0;

    constructor(connectionPool: SQLConnectionPool, protected db:sqlite3.Database, logger?: DatabaseLogger) {
        super(connectionPool, logger);
    }

    async prepare(sql: string) {
        return new SQLiteStatement(this.logger, sql, this.db.prepare(sql));
    }

    async run(sql: string, params: any[] = []) {
        try {
            const stmt = this.db.prepare(sql);
            this.logger.logQuery(sql, params);
            const result = stmt.run(...params);
            this.changes = result.changes;
        } catch (error) {
            this.logger.failedQuery(error, sql, params);
            throw error;
        }
    }

    async exec(sql: string) {
        try {
            this.db.exec(sql);
            this.logger.logQuery(sql, []);
        } catch (error) {
            this.logger.failedQuery(error, sql, []);
            throw error;
        }
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export class SQLiteConnectionPool extends SQLConnectionPool {
    protected connectionMutex = new Mutex();

    constructor(protected db: sqlite3.Database) {
        super();
    }

    async getConnection(logger?: DatabaseLogger, transaction?: DatabaseTransaction): Promise<SQLiteConnection> {
        //todo: handle transaction, when given we make sure we return a sticky connection to the transaction
        // and release the stickiness when transaction finished.

        await this.connectionMutex.lock();
        this.activeConnections++;

        return new SQLiteConnection(this, this.db, logger);
    }

    release(connection: SQLConnection) {
        super.release(connection);
        this.connectionMutex.unlock();
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

            //todo: handle changes.$unset

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
                    values[i].push(this.platform.quoteValue(value[i]));
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
                        values[i].push(this.platform.quoteValue(null));
                    }
                }
            }
        }

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
                selects.push('_.' + i);
            }
        }

        const sql = `
              DROP TABLE IF EXISTS _b;
              CREATE TEMPORARY TABLE _b AS
                SELECT ${selects.join(', ')}
                FROM (SELECT ${_rename.join(', ')} FROM (VALUES ${valuesValues.join(', ')})) as _
                INNER JOIN ${tableName} as _origin ON (_origin.${pkField} = _.${pkField});
              UPDATE
                ${tableName}
                SET ${setNames.join(', ')}
              FROM
                _b
              WHERE ${tableName}.${pkField} = _b.${pkField};
        `;

        const connection = await this.getConnection(); //will automatically be released in SQLPersistence
        await connection.exec(sql);

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

    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrementField();
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

export class SQLiteQueryResolver<T extends Entity> extends SQLQueryResolver<T> {
    constructor(
        protected connectionPool: SQLiteConnectionPool,
        protected platform: DefaultPlatform,
        classSchema: ClassSchema<T>,
        databaseSession: DatabaseSession<DatabaseAdapter>) {
        super(connectionPool, platform, classSchema, databaseSession);
    }

    async delete(model: SQLQueryModel<T>, deleteResult: DeleteResult<T>): Promise<void> {
        // if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const pkName = this.classSchema.getPrimaryField().name;
        const primaryKey = this.classSchema.getPrimaryField();
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const sqlBuilder = new SqlBuilder(this.platform);
        const select = sqlBuilder.select(this.classSchema, model, { select: [pkField] });
        const primaryKeyConverted = getPropertyXtoClassFunction(primaryKey, this.platform.serializer);

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.transaction);
        try {
            await connection.exec(`DROP TABLE IF EXISTS _tmp_d`);
            await connection.run(`CREATE TEMPORARY TABLE _tmp_d as ${select.sql};`, select.params);

            const sql = `DELETE FROM ${this.platform.getTableIdentifier(this.classSchema)} WHERE ${pkField} IN (SELECT * FROM _tmp_d)`;
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
        const select: string[] = [];
        const selectParams: any[] = [];
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const primaryKey = this.classSchema.getPrimaryField();
        const primaryKeyConverted = getPropertyXtoClassFunction(primaryKey, this.platform.serializer);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const scopeSerializer = this.platform.serializer.for(this.classSchema);
        const $set = changes.$set ? scopeSerializer.partialSerialize(changes.$set) : undefined;

        if ($set) for (const i in $set) {
            if (!$set.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`? as ${this.platform.quoteIdentifier(i)}`);
            selectParams.push($set[i]);
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

        const sql = `
              UPDATE
                ${tableName}
              SET
                ${set.join(', ')}
              FROM
                _b
              WHERE ${tableName}.${this.platform.quoteIdentifier(primaryKey.name)} = _b.${this.platform.quoteIdentifier(bPrimaryKey)};
        `;

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.transaction);
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

    createQuery<T extends Entity>(
        classType: ClassType<T> | ClassSchema<T>
    ): SQLiteDatabaseQuery<T> {
        return new SQLiteDatabaseQuery(getClassSchema(classType), this.databaseSession,
            new SQLiteQueryResolver(this.connectionPool, this.platform, getClassSchema(classType), this.databaseSession)
        );
    }
}

export class SQLiteDatabaseAdapter extends SQLDatabaseAdapter {
    public readonly db: sqlite3.Database;
    public readonly connectionPool: SQLiteConnectionPool;
    public readonly platform = new SQLitePlatform();

    constructor(protected sqlitePath: string = ':memory:') {
        super();
        this.db = new sqlite3(sqlitePath);
        this.db.exec('PRAGMA foreign_keys=ON');

        this.connectionPool = new SQLiteConnectionPool(this.db);
    }

    async getInsertBatchSize(schema: ClassSchema): Promise<number> {
        return Math.floor(32000 / schema.getProperties().length);
    }

    getName(): string {
        return 'sqlite';
    }

    getSchemaName(): string {
        return '';
    }

    createPersistence(session: DatabaseSession<any>): SQLPersistence {
        return new SQLitePersistence(this.platform, this.connectionPool, session);
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new SQLiteDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        if (this.connectionPool.getActiveConnections() > 0) {
            throw new Error(`There are still active connections. Please release() any fetched connection first.`);
        }
        this.db.close();
    }
}
