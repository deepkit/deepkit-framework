import {SQLConnection, SQLConnectionPool, SQLDatabaseAdapter, SQLDatabaseQueryFactory, SQLPersistence, SQLStatement} from './sql-adapter';
import {DatabasePersistence, DatabaseSession} from '@super-hornet/marshal-orm';
import {PostgresPlatform} from './platform/postgres-platform';
import {ClassSchema} from '@super-hornet/marshal';
import {DefaultPlatform} from './platform/default-platform';
import {Pool, PoolClient, types} from 'pg';

types.setTypeParser(1700, parseFloat);
types.setTypeParser(20, BigInt);

export class PostgresStatement extends SQLStatement {
    protected released = false;
    constructor(protected sql: string, protected client: PoolClient) {
        super();
    }

    async get(params: any[] = []) {
        try {
            const res = await this.client.query(this.sql, params);
            return res.rows[0];
        } finally {
            this.released = true;
            this.client.release();
        }
    }

    async all(params: any[] = []) {
        try {
            const res = await this.client.query(this.sql, params);
            return res.rows;
        } finally {
            this.released = true;
            this.client.release();
        }
    }

    release() {
        if (this.released) return;

        this.released = true;
        this.client.release();
    }
}

export class PostgresConnection extends SQLConnection {
    protected changes: number = 0;
    public lastReturningRows: any[] = [];

    constructor(
        connectionPool: PostgresConnectionPool,
        protected getConnection: () => Promise<PoolClient>) {
        super(connectionPool);
    }

    async prepare(sql: string) {
        const connection = await this.getConnection();
        return new PostgresStatement(sql, connection);
    }

    async exec(sql: string) {
        const connection = await this.getConnection();
        try {
            const res = await connection.query(sql);
            this.lastReturningRows = res.rows;
            this.changes = res.rowCount;
        } finally {
            connection.release();
        }
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
        return new PostgresConnection(this, () => this.pool.connect());
    }
}

export class PostgresPersistence extends SQLPersistence {
    constructor(protected platform: DefaultPlatform, protected connection: PostgresConnection) {
        super(platform, connection);
    }

    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        const autoIncrement = classSchema.getAutoIncrementField();
        if (!autoIncrement) return;
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

export class PostgresDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = new Pool({
        host: this.host,
        database: 'postgres',
    });
    protected connectionPool = new PostgresConnectionPool(this.pool);
    protected platform = new PostgresPlatform();

    constructor(protected host: string) {
        super();
    }

    getName(): string {
        return 'postgres';
    }

    getSchemaName(): string {
        //todo extract schema name from connection options. This acts as default when a table has no schemaName defined.
        return '';
    }

    createPersistence(databaseSession: DatabaseSession<any>): SQLPersistence {
        return new PostgresPersistence(this.platform, this.connectionPool.getConnection());
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new SQLDatabaseQueryFactory(this.connectionPool.getConnection(), this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
    }
}