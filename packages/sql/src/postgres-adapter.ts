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
import {Changes, DatabasePersistenceChangeSet, DatabaseSession, Entity, PatchResult} from '@deepkit/orm';
import {PostgresPlatform} from './platform/postgres-platform';
import {ClassSchema, getClassSchema, PropertySchema} from '@deepkit/type';
import {DefaultPlatform} from './platform/default-platform';
import {Pool, PoolClient, PoolConfig, types} from 'pg';
import {ClassType, empty} from '@deepkit/core';

types.setTypeParser(1700, parseFloat);
types.setTypeParser(20, BigInt);

export class PostgresStatement extends SQLStatement {
    protected released = false;

    constructor(protected sql: string, protected client: PoolClient) {
        super();
    }

    async get(params: any[] = []) {
        const res = await this.client.query(this.sql, params);
        return res.rows[0];
    }

    async all(params: any[] = []) {
        const res = await this.client.query(this.sql, params);
        return res.rows;
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
        if (!this.connection) this.connection = await this.getConnection();
        return new PostgresStatement(sql, this.connection);
    }

    async run(sql: string) {
        if (!this.connection) this.connection = await this.getConnection();
        const res = await this.connection.query(sql);
        this.lastReturningRows = res.rows;
        this.changes = res.rowCount;

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
    constructor(protected platform: DefaultPlatform, protected connection: PostgresConnection) {
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
                        assignReturning[id] = {item: changeSet.item, names: []};
                    }

                    assignReturning[id].names.push(i);
                    setReturning[i] = 1;

                    aggregateSelects[i].push({id: changeSet.primaryKey[pkName], sql: `_origin.${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(value)}`});
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
                selects.push('_.' + i);
            }
        }

        const returningSelect: string[] = [];
        returningSelect.push(tableName + '.' + pkField);
        if (!empty(setReturning)) {
            for (const i in setReturning) {
                returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(i));
            }
        }

        const sql = `
              WITH _b(${valuesNames.join(', ')}) AS (
                SELECT ${selects.join(', ')} FROM 
                    (VALUES ${valuesValues.join(', ')}) as _(${valuesNames.join(', ')})
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
}

export class PostgresSQLQueryResolver<T extends Entity> extends SQLQueryResolver<T> {
    async patch(model: SQLQueryModel<T>, changes: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        const select: string[] = [];
        const tableName = this.platform.getTableIdentifier(this.classSchema);
        const pkName = this.classSchema.getPrimaryField().name;
        const pkField = this.platform.quoteIdentifier(pkName);
        select.push(pkField);

        const fieldsSet: { [name: string]: 1 } = {};
        const aggregateFields: { [name: string]: 1 } = {};

        if (changes.$set) for (const i in changes.$set) {
            if (!changes.$set.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            select.push(this.platform.quoteIdentifier(i));
        }

        if (changes.$inc) for (const i in changes.$inc) {
            if (!changes.$inc.hasOwnProperty(i)) continue;
            fieldsSet[i] = 1;
            aggregateFields[i] = 1;
            select.push(`(${this.platform.quoteIdentifier(i)} + ${this.platform.quoteValue(changes.$inc[i])}) as ${this.platform.quoteIdentifier(i)}`);
        }

        const set: string[] = [];
        for (const i in fieldsSet) {
            set.push(`${this.platform.quoteIdentifier(i)} = _b.${this.platform.quoteIdentifier(i)}`);
        }

        // let extractVarsSQL = '';
        // let selectVarsSQL = '';
        // if (!empty(aggregateFields)) {
        //     const extractSelect: string[] = [];
        //     const selectVars: string[] = [];
        //     extractSelect.push(`@_pk := JSON_ARRAYAGG(${pkField})`);
        //     selectVars.push(`@_pk`);
        //     for (const i in aggregateFields) {
        //         extractSelect.push(`@_f_${i} := JSON_ARRAYAGG(${this.platform.quoteIdentifier(i)})`);
        //         selectVars.push(`@_f_${i}`);
        //     }
        //     extractVarsSQL = `,
        //         (SELECT ${extractSelect.join(', ')} FROM _tmp GROUP BY '0') as _
        //     `;
        //     selectVarsSQL = `SELECT ${selectVars.join(', ')};`;
        // }
        const returningSelect: string[] = [];
        returningSelect.push(tableName + '.' + pkField);
        if (!empty(aggregateFields)) {
            for (const i in aggregateFields) {
                returningSelect.push(tableName + '.' + this.platform.quoteIdentifier(i));
            }
        }

        const selectSQL = this.sqlBuilder.select(this.classSchema, model, {select});
        const sql = `
            WITH _b AS (${selectSQL})
            UPDATE
                ${tableName}
            SET
                ${set.join(', ')}
            FROM _b
            WHERE ${tableName}.${pkField} = _b.${pkField}
            RETURNING ${returningSelect.join(', ')}
        `;

        const connection = this.connectionPool.getConnection();
        try {
            const result = await connection.execAndReturnAll(sql);

            patchResult.modified = result.length;
            for (const i in aggregateFields) {
                patchResult.returning[i] = [];
            }

            for (const returning of result) {
                patchResult.primaryKeys.push(returning[pkName]);
                for (const i in aggregateFields) {
                    patchResult.returning[i].push(returning[i]);
                }
            }
        } finally {
            connection.release();
        }
    }
}

export class PostgresSQLDatabaseQuery<T> extends SQLDatabaseQuery<T> {
    protected resolver = new PostgresSQLQueryResolver(this.connectionPool, this.platform, this.classSchema, this.databaseSession);
}

export class PostgresSQLDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends Entity>(classType: ClassType<T> | ClassSchema<T>): PostgresSQLDatabaseQuery<T> {
        return new PostgresSQLDatabaseQuery(getClassSchema(classType), this.databaseSession, this.connectionPool, this.platform);
    }
}

export class PostgresDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = new Pool(this.options);
    public connectionPool = new PostgresConnectionPool(this.pool);
    public platform = new PostgresPlatform();

    constructor(protected options: PoolConfig) {
        super();
    }

    getName(): string {
        return 'postgres';
    }

    getSchemaName(): string {
        //todo extract schema name from connection options. This acts as default when a table has no schemaName defined.
        return '';
    }

    createPersistence(): SQLPersistence {
        return new PostgresPersistence(this.platform, this.connectionPool.getConnection());
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new PostgresSQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
