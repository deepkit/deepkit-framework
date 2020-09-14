import * as sqlite3 from 'sqlite3';
import {SQLConnection, SQLConnectionPool, SQLDatabaseAdapter, SQLDatabaseQueryFactory, SQLPersistence, SQLStatement} from './sql-adapter';
import {DatabaseSession} from '@deepkit/marshal-orm';
import {SQLitePlatform} from './platform/sqlite-platform';
import {ClassSchema} from '@deepkit/marshal';
import {asyncOperation} from '@deepkit/core';

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
    }
}

export class SQLiteConnection extends SQLConnection {
    public platform = new SQLitePlatform();
    protected changes: number = 0;

    constructor(connectionPool: SQLConnectionPool, protected db: sqlite3.Database) {
        super(connectionPool);
    }

    async prepare(sql: string) {
        // console.log('prepare', sql);
        return new SQLiteStatement(this.db.prepare(sql));
    }

    async exec(sql: string) {
        try {
            const self = this;
            await asyncOperation((resolve, reject) => {
                this.db.run(sql, function (err) {
                    if (err) reject(err);
                    else {
                        self.changes = this.changes;
                        resolve(self.changes);
                    }
                });
            });
        } catch (error) {
            console.error('sql', sql);
            throw error;
        }
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
        return new SQLiteConnection(this, this.db);
    }
}

export class SQLitePersistence extends SQLPersistence {
    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        //it might be that between this call and the previous INSERT we have additional sql commands on the same
        //connection, which would break this algo. So its better to lock this connection until we are done.
        const stmt = await this.connection.prepare(`SELECT last_insert_rowid() as rowid`);
        const lastInserted = (await stmt.get()).rowid;
        let start = lastInserted - items.length + 1;
        const autoIncrement = classSchema.getAutoIncrementField();
        if (!autoIncrement) return;

        for (const item of items) {
            item[autoIncrement.name] = start++;
        }
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
        return 'mongo';
    }

    getSchemaName(): string {
        return '';
    }

    createPersistence(databaseSession: DatabaseSession<any>): SQLPersistence {
        return new SQLitePersistence(this.platform, this.connectionPool.getConnection());
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new SQLDatabaseQueryFactory(this.connectionPool.getConnection(), this.platform, databaseSession);
    }

    disconnect(force?: boolean): void {
    }
}