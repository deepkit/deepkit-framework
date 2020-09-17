import * as sqlite3 from 'sqlite3';
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
import {DatabaseSession, Entity} from '@deepkit/orm';
import {SQLitePlatform} from './platform/sqlite-platform';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {asyncOperation, ClassType} from '@deepkit/core';
import {SqlBuilder} from './sql-builder';

export class SQLiteStatement extends SQLStatement {
    constructor(protected stmt: sqlite3.Statement) {
        super();
    }

    async get(params: any[] = []): Promise<any> {
        return asyncOperation((resolve, reject) => {
            this.stmt.get(...params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async all(params: any[] = []): Promise<any[]> {
        return asyncOperation((resolve, reject) => {
            this.stmt.all(params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    release() {
        this.stmt.finalize();
    }
}

export class SQLiteConnection extends SQLConnection {
    public platform = new SQLitePlatform();
    protected changes: number = 0;

    constructor(connectionPool: SQLConnectionPool, protected db: sqlite3.Database) {
        super(connectionPool);
    }

    async prepare(sql: string) {
        return await asyncOperation<SQLiteStatement>((resolve, reject) => {
            this.db.prepare(sql, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(new SQLiteStatement(this));
                }
            });
        });
    }

    async exec(sql: string) {
        const self = this;
        await asyncOperation((resolve, reject) => {
            this.db.run(sql, function (err) {
                if (err) {
                    console.log('exec error', sql, err);
                    reject(err);
                } else {
                    self.changes = this.changes;
                    resolve(self.changes);
                }
            });
        });
    }

    async getChanges(): Promise<number> {
        return this.changes;
    }
}

export class SQLiteConnectionPool extends SQLConnectionPool {
    constructor(protected db: sqlite3.Database) {
        super();
    }

    getConnection(): SQLConnection {
        this.activeConnections++;
        return new SQLiteConnection(this, this.db);
    }
}

export class SQLitePersistence extends SQLPersistence {
    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        //it might be that between this call and the previous INSERT we have additional sql commands on the same
        //connection, which would break this algo. So its better to lock this connection until we are done.
        const row = await this.connection.execAndReturnSingle(`SELECT last_insert_rowid() as rowid`);
        const lastInserted = row.rowid;
        let start = lastInserted - items.length + 1;
        const autoIncrement = classSchema.getAutoIncrementField();
        if (!autoIncrement) return;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
    }
}

export class SQLiteQueryResolver<T> extends SQLQueryResolver<T> {

    async deleteMany(model: SQLQueryModel<T>): Promise<number> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const sqlBuilder = new SqlBuilder(this.platform);

        const selectQuery = sqlBuilder.select(this.classSchema, model, {select: ['rowid']});
        const sql = `DELETE FROM ${this.platform.getTableIdentifier(this.classSchema)} WHERE rowid IN (${selectQuery})`;
        const connection = this.connectionPool.getConnection();
        try {
            await connection.exec(sql);
            return await connection.getChanges();
        } finally {
            connection.release();
        }
    }
}

export class SQLiteDatabaseQueryFactory extends SQLDatabaseQueryFactory {
    createQuery<T extends Entity>(
        classType: ClassType<T> | ClassSchema<T>
    ): SQLDatabaseQuery<T> {
        const schema = getClassSchema(classType);
        return new SQLDatabaseQuery(schema, new SQLQueryModel(), new SQLiteQueryResolver(this.connectionPool, this.platform, schema, this.databaseSession));
    }
}

export class SQLiteDatabaseAdapter extends SQLDatabaseAdapter {
    public readonly db: sqlite3.Database;
    public readonly connectionPool: SQLiteConnectionPool;
    public readonly platform = new SQLitePlatform();

    constructor(protected sqlitePath: string) {
        super();
        this.db = new sqlite3.Database(sqlitePath);
        this.db.exec('PRAGMA foreign_keys = ON');

        this.connectionPool = new SQLiteConnectionPool(this.db);
    }

    getName(): string {
        return 'sqlite';
    }

    getSchemaName(): string {
        return '';
    }

    createPersistence(): SQLPersistence {
        return new SQLitePersistence(this.platform, this.connectionPool.getConnection());
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
