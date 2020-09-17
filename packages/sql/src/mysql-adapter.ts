import {createPool, Pool, PoolConnection, UpsertResult} from 'mariadb';
import {SQLConnection, SQLConnectionPool, SQLDatabaseAdapter, SQLDatabaseQueryFactory, SQLPersistence, SQLStatement} from './sql-adapter';
import {DatabaseSession} from '@deepkit/orm';
import {MySQLPlatform} from './platform/mysql-platform';
import {ClassSchema, isArray} from '@deepkit/type';
import {DefaultPlatform} from './platform/default-platform';

export class MySQLStatement extends SQLStatement {
    constructor(protected sql: string, protected connection: PoolConnection) {
        super();
    }

    async get(params: any[] = []) {
        const rows = await this.connection.query(this.sql, params);
        return rows[0];
    }

    async all(params: any[] = []) {
        return await this.connection.query(this.sql, params);
    }

    release() {
        this.connection.release();
    }
}

export class MySQLConnection extends SQLConnection {
    protected changes: number = 0;
    public lastBatchResult?: UpsertResult[];
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

    async exec(sql: string) {
        if (!this.connection) this.connection = await this.getConnection();
        //batch returns in reality a single UpsertResult if only one query is given
        const res = (await this.connection.batch(sql, [])) as UpsertResult[] | UpsertResult;
        if (isArray(res)) this.lastBatchResult = res;
        else this.lastBatchResult = [res];
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

    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        if (!this.connection.lastBatchResult || !this.connection.lastBatchResult.length) throw new Error('No lastBatchResult found');
        const result = this.connection.lastBatchResult[0];
        let start = result.insertId;
        const autoIncrement = classSchema.getAutoIncrementField();
        if (!autoIncrement) return;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
    }
}

export class MySQLDatabaseAdapter extends SQLDatabaseAdapter {
    protected pool = createPool({
        host: this.host,
        user: 'root',
        database: 'default',
    });
    public connectionPool = new MySQLConnectionPool(this.pool);
    public platform = new MySQLPlatform(this.pool);

    constructor(protected host: string) {
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

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new SQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.pool.end().catch(console.error);
    }
}
