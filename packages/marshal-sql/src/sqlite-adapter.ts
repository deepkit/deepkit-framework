import * as sqlite3 from 'sqlite3';
import {SQLConnection, SQLDatabaseAdapter, SQLDatabaseQueryFactory, SQLPersistence, SQLStatement} from './sql-adapter';
import {DatabaseSession} from '@super-hornet/marshal-orm';
import {SQLitePlatform} from './platform/sqlite-platform';
import {ClassSchema} from '@super-hornet/marshal';
import {asyncOperation} from '@super-hornet/core';

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

    close() {
    }
}

export class SQLiteConnection extends SQLConnection {
    public platform = new SQLitePlatform();

    constructor(protected db: sqlite3.Database) {
        super();
    }

    async prepare(sql: string) {
        // console.log('prepare', sql);
        return new SQLiteStatement(this.db.prepare(sql));
    }

    async exec(sql: string) {
        try {
            this.db.exec(sql);
        } catch (error) {
            console.error('sql', sql);
            throw error;
        }
    }

    async getChanges(): Promise<number> {
        return 0;
        // const row = await this.execAndReturnSingle(`SELECT sqlite3_changes() as changes`);
        // return row.changes;
    }
}

export class SQLitePersistence extends SQLPersistence {
    protected async populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
        //it might be that between this call and the previous INSERT we have additional sql commands on the same
        //connection, which would break this algo. So its better to lock this connection until we are done.
        const stmt = await this.connection.prepare(`SELECT last_insert_rowid() as rowid`);
        const lastInserted = (await stmt.get()).rowid;
        let start = lastInserted - items.length + 1;

        for (const autoIncrement of classSchema.getAutoIncrementFields()) {
            for (const item of items) {
                item[autoIncrement.name] = start++;
            }
        }
    }
}

export class SQLiteDatabaseAdapter implements SQLDatabaseAdapter {
    public readonly db: sqlite3.Database;
    public readonly connection: SQLiteConnection;
    public readonly platform = new SQLitePlatform();

    constructor(protected sqlitePath: string) {
        this.db = new sqlite3.Database(sqlitePath);
        this.db.exec('PRAGMA foreign_keys = ON');

        this.connection = new SQLiteConnection(this.db);
    }

    getName(): string {
        return 'mongo';
    }

    createPersistence(databaseSession: DatabaseSession<any>): SQLPersistence {
        return new SQLitePersistence(this.platform, this.connection);
    }

    queryFactory(databaseSession: DatabaseSession<any>): SQLDatabaseQueryFactory {
        return new SQLDatabaseQueryFactory(this.connection, databaseSession);
    }

    disconnect(force?: boolean): void {
    }

    async migrate(classSchemas: Iterable<ClassSchema>): Promise<void> {

    }
}