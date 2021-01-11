/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { createPool, Pool, PoolConfig, PoolConnection, UpsertResult } from 'mariadb';
import {
    SQLConnection,
    SQLConnectionPool,
    SQLDatabaseAdapter,
    SQLDatabaseQuery,
    SQLDatabaseQueryFactory,
    SQLPersistence,
    SQLQueryModel,
    SQLQueryResolver,
    SQLStatement
} from './sql-adapter';
import { Changes, DatabasePersistenceChangeSet, DatabaseSession, DeleteResult, Entity, PatchResult } from '@deepkit/orm';
import { MySQLPlatform } from './platform/mysql-platform';
import { ClassSchema, getClassSchema, getPropertyXtoClassFunction, isArray, resolvePropertySchema } from '@deepkit/type';
import { DefaultPlatform } from './platform/default-platform';
import { asyncOperation, ClassType, empty } from '@deepkit/core';
import { SqlBuilder } from './sql-builder';

export class MySQLStatement extends SQLStatement {
    constructor(protected sql: string, protected connection: PoolConnection) {
        super();
    }

    async get(params: any[] = []) {
        return asyncOperation<any[]>((resolve, reject) => {
            this.connection.query(this.sql, params).then((rows) => {
                resolve(rows[0]);
            }).catch(reject);
        });
    }

    async all(params: any[] = []) {
        //mysql/mariadb driver does not maintain error.stack when they throw errors, so
        //we have to manually convert it using asyncOperation.
        return asyncOperation<any[]>((resolve, reject) => {
            this.connection.query(this.sql, params).then(resolve).catch(reject);
        });
    }

    release() {
        this.connection.release();
    }
}

export class MySQLConnection extends SQLConnection {
    protected changes: number = 0;
    public lastExecResult?: UpsertResult[];
    protected connection?: PoolConnection = undefined;

    constructor(
        connectionPool: SQLConnectionPool,
        protected getConnection: () => Promise<PoolConnection>
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
        if (!this.connection) this.connection = await this.getConnection();
        return new MySQLStatement(sql, this.connection);
    }

    async run(sql: string, params: any[] = []) {
        if (!this.connection) this.connection = await this.getConnection();
        //batch returns in reality a single UpsertResult if only one query is given
        const res = (await this.connection.query(sql, params)) as UpsertResult[] | UpsertResult;
        if (isArray(res)) this.lastExecResult = res;
        else this.lastExecResult = [res];
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export class MySQLConnectionPool extends SQLConnectionPool {
    constructor(protected pool: Pool) {
        super();
    }

    getConnection(): MySQLConnection {
        this.activeConnections++;
        return new MySQLConnection(this, () => this.pool.getConnection());
    }
}

export class MySQLPersistence extends SQLPersistence {
    constructor(protected platform: DefaultPlatform, protected connection: MySQLConnection) {
        super(platform, connection);
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
                        setNames.push(`${tableName}.${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
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
                        setNames.push(`${tableName}.${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
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
                        values[i].push(this.platform.quoteValue(null));
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
            valuesValues.push('ROW(' + valuesNames.map(name => values[name][i]).join(',') + ')');
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

        let setVars = '';
        let endSelect = '';
        if (!empty(setReturning)) {
            const vars: string[] = [];
            const endSelectVars: string[] = [];
            vars.push(`@_pk := JSON_ARRAYAGG(${pkField})`);
            endSelectVars.push('@_pk');
            for (const i in setReturning) {
                endSelectVars.push(`@_f_${i}`);
                vars.push(`@_f_${i} := JSON_ARRAYAGG(${this.platform.quoteIdentifier(i)})`);
            }
            setVars = `,
                (SELECT ${vars.join(', ')} FROM _tmp GROUP BY '0') as _
            `;
            endSelect = `SELECT ${endSelectVars.join(', ')};`;
        }

        const sql = `
              WITH _tmp(${valuesNames.join(', ')}) AS (
                SELECT ${selects.join(', ')} FROM 
                    (VALUES ${valuesValues.join(', ')}) as _(${valuesNames.join(', ')})
                    INNER JOIN ${tableName} as _origin ON (_origin.${pkField} = _.${pkField})
              )
              UPDATE 
                ${tableName}, _tmp as _b ${setVars}
                
              SET ${setNames.join(', ')}
              WHERE ${tableName}.${pkField} = _b.${pkField};
              ${endSelect}
        `;

        // console.log(sql);
        const result = await this.connection.execAndReturnAll(sql);
        // console.log('result', result);

        if (!empty(setReturning)) {
            const returning = result[1][0];
            const ids = JSON.parse(returning['@_pk']) as (number | string)[];
            const parsedReturning: { [name: string]: any[] } = {};
            for (const i in setReturning) {
                parsedReturning[i] = JSON.parse(returning['@_f_' + i]) as any[];
            }

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const r = assignReturning[id];
                if (!r) continue;

                for (const name of r.names) {
                    r.item[name] = parsedReturning[name][i];
                }
            }
        }
    }

    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrementField();
        if (!autoIncrement) return;

        if (!this.connection.lastExecResult || !this.connection.lastExecResult.length) throw new Error('No lastBatchResult found');

        //MySQL returns the _first_ auto-incremented value for a batch insert.
        //It's guaranteed to increment always by one (expect if the user provides a manual auto-increment value in between, which should be forbidden).
        //So since we know how many items were inserted, we can simply calculate for each item the auto-incremented value.
        const result = this.connection.lastExecResult[0];
        let start = result.insertId;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
    }
}

export class MySQLQueryResolver<T extends Entity> extends SQLQueryResolver<T> {
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
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const primaryKey = this.classSchema.getPrimaryField();
        const pkField = this.platform.quoteIdentifier(primaryKey.name);
        const primaryKeyConverted = getPropertyXtoClassFunction(primaryKey, this.platform.serializer);
        select.push(pkField);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: { converted: (v: any) => any } } = {};

        const scopeSerializer = this.platform.serializer.for(this.classSchema);
        const $set = changes.$set ? scopeSerializer.partialSerialize(changes.$set) : undefined;

        if ($set) for (const i in $set) {
            if (!$set.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(`${this.platform.quoteValue($set[i])} as ${this.platform.quoteIdentifier(i)}`);
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
            set.push(`_target.${this.platform.quoteIdentifier(i)} = b.${this.platform.quoteIdentifier(i)}`);
        }

        const extractSelect: string[] = [];
        const selectVars: string[] = [];
        extractSelect.push(`@_pk := JSON_ARRAYAGG(${pkField})`);
        selectVars.push(`@_pk`);
        if (!empty(aggregateFields)) {
            for (const i in aggregateFields) {
                extractSelect.push(`@_f_${i} := JSON_ARRAYAGG(${this.platform.quoteIdentifier(i)})`);
                selectVars.push(`@_f_${i}`);
            }
        }
        const extractVarsSQL = `,
                (SELECT ${extractSelect.join(', ')} FROM _tmp GROUP BY '0') as _
            `;
        const selectVarsSQL = `SELECT ${selectVars.join(', ')};`;

        const sqlBuilder = new SqlBuilder(this.platform);
        const selectSQL = sqlBuilder.select(this.classSchema, model, { select });

        const params = selectSQL.params;
        const sql = `
            WITH _tmp AS (${selectSQL.sql})
            UPDATE
                ${tableName} as _target, _tmp as b ${extractVarsSQL}
            SET
                ${set.join(', ')}
            WHERE _target.${pkField} = b.${pkField};
            ${selectVarsSQL}
        `;

        const connection = this.connectionPool.getConnection();
        try {
            const result = await connection.execAndReturnAll(sql, params);
            const packet = result[0];
            patchResult.modified = packet.affectedRows;
            const returning = result[1][0];
            patchResult.primaryKeys = (JSON.parse(returning['@_pk']) as any[]).map(primaryKeyConverted as any);

            for (const i in aggregateFields) {
                patchResult.returning[i] = (JSON.parse(returning['@_f_' + i]) as any[]).map(aggregateFields[i].converted);
            }

        } finally {
            connection.release();
        }
    }
}

export class MySQLDatabaseQuery<T> extends SQLDatabaseQuery<T> {
    protected resolver = new MySQLQueryResolver(this.connectionPool, this.platform, this.classSchema, this.databaseSession);
}

export class MySQLDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends Entity>(classType: ClassType<T> | ClassSchema<T>): MySQLDatabaseQuery<T> {
        return new MySQLDatabaseQuery(getClassSchema(classType), this.databaseSession, this.connectionPool, this.platform);
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

    createPersistence(): SQLPersistence {
        return new MySQLPersistence(this.platform, this.connectionPool.getConnection());
    }

    queryFactory(databaseSession: DatabaseSession<any>): MySQLDatabaseQueryFactory {
        return new MySQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
