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
import { DatabasePersistenceChangeSet, DatabaseSession, DeleteResult, Entity, PatchResult } from '@deepkit/orm';
import { PostgresPlatform } from './postgres-platform';
import { Changes, ClassSchema, getClassSchema, getPropertyXtoClassFunction, PropertySchema, resolvePropertySchema } from '@deepkit/type';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';
import { asyncOperation, ClassType, empty } from '@deepkit/core';

export class PostgresStatement extends SQLStatement {
    protected released = false;

    constructor(protected sql: string, protected client: PoolClient) {
        super();
    }

    async get(params: any[] = []) {
        return asyncOperation<any>((resolve, reject) => {
            this.client.query(this.sql, params).then((res) => {
                resolve(res.rows[0]);
            }).catch(reject);
        });
    }

    async all(params: any[] = []) {
        return asyncOperation<any>((resolve, reject) => {
            this.client.query(this.sql, params).then((res) => {
                resolve(res.rows);
            }).catch(reject);
        });
    }

    release() {
    }
}

export class PostgresConnection extends SQLConnection {
    protected changes: number = 0;
    public lastReturningRows: any[] = [];
    protected connection?: PoolClient = undefined;

    constructor(
        connectionPool: PostgresConnectionPool,
        protected getConnection: () => Promise<PoolClient>
    ) {
        super(connectionPool);
    }

    release() {
        super.release();
        if (this.connection) {
            this.connection.release();
            this.connection = undefined;
        }
    }

    async prepare(sql: string) {
        this.connection ||= await this.getConnection();
        return new PostgresStatement(sql, this.connection);
    }

    async run(sql: string, params: any[] = []) {
        await asyncOperation(async (resolve, reject) => {
            this.connection ||= await this.getConnection();

            this.connection.query(sql, params).then((res) => {
                this.lastReturningRows = res.rows;
                this.changes = res.rowCount;
                resolve(undefined);
            }, reject);
        });
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export class PostgresConnectionPool extends SQLConnectionPool {
    constructor(protected pool: Pool) {
        super();
    }

    getConnection(): PostgresConnection {
        this.activeConnections++;
        return new PostgresConnection(this, () => this.pool.connect());
    }
}

function typeSafeDefaultValue(property: PropertySchema): any {
    if (property.type === 'number') return 0;
    if (property.type === 'boolean') return false;
    if (property.type === 'date') return new Date;

    return null;
}

export class PostgresPersistence extends SQLPersistence {
    constructor(protected platform: DefaultPlatform, protected connection: PostgresConnection, session: DatabaseSession<any>) {
        super(platform, connection, session);
    }

    async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
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
                        if (classSchema.getProperty(i).type === 'date') {
                            values[i].push('null::timestamp');
                        } else {
                            values[i].push('null');
                        }
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

                    aggregateSelects[i].push({ id: changeSet.primaryKey[pkName], sql: `_origin.${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(value)}` });
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

        const result = await this.connection.execAndReturnAll(sql);
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

        //We adjusted the INSERT SQL with additional RETURNING which returns all generated
        //auto-increment values. We read the result and simply assign the value.
        const name = autoIncrement.name;
        const insertedRows = this.connection.lastReturningRows;
        if (!insertedRows.length) return;

        for (let i = 0; i < items.length; i++) {
            items[i][name] = insertedRows[i][name];
        }
    }

    protected getInsertSQL(classSchema: ClassSchema, fields: string[], values: string[]): string {
        const autoIncrement = classSchema.getAutoIncrementField();
        const returning = autoIncrement ? ` RETURNING ${this.platform.quoteIdentifier(autoIncrement.name)}` : '';

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

        const connection = this.connectionPool.getConnection();
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
                select.push(`${this.platform.quoteValue($set[i])} as ${this.platform.quoteIdentifier(i)}`);
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

        const sqlBuilder = new SqlBuilder(this.platform);
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

        const connection = this.connectionPool.getConnection();
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

    createPersistence(databaseSession: DatabaseSession<this>): SQLPersistence {
        return new PostgresPersistence(this.platform, this.connectionPool.getConnection(), databaseSession);
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new PostgresSQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
