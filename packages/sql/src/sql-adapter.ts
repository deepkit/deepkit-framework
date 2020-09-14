import {
    DatabaseAdapter,
    DatabaseAdapterQueryFactory,
    DatabasePersistence,
    DatabaseQueryModel,
    DatabaseSession,
    Entity,
    GenericQuery,
    GenericQueryResolver,
    getInstanceState,
    getJitChangeDetector,
    getJITConverterForSnapshot,
    SORT_ORDER
} from '@deepkit/orm';
import {ClassType} from '@deepkit/core';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {DefaultPlatform} from './platform/default-platform';
import {SqlBuilder} from './sql-builder';
import {SqlFormatter} from './sql-formatter';
import {sqlSerializer} from './serializer/sql-serializer';
import {Database} from './schema/table';

export type SORT_TYPE = SORT_ORDER | { $meta: 'textScore' };
export type DEEP_SORT<T extends Entity> = { [P in keyof T]?: SORT_TYPE } & { [P: string]: SORT_TYPE };

type FilterQuery<T> = Partial<T>;

export class SQLQueryModel<T extends Entity> extends DatabaseQueryModel<T, FilterQuery<T>, DEEP_SORT<T>> {
}

export abstract class SQLStatement {
    abstract get(params?: any[]): Promise<any>;

    abstract all(params?: any[]): Promise<any[]>;

    abstract release(): void
}

export abstract class SQLConnection {
    buys: boolean = false;

    constructor(protected connectionPool: SQLConnectionPool) {
    }

    release() {
        this.connectionPool.release(this);
    }

    abstract prepare(sql: string): Promise<SQLStatement>;

    abstract exec(sql: string): Promise<any>;

    abstract getChanges(): Promise<number>;

    async execAndReturnSingle(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        const row = await stmt.get(params);
        stmt.release();
        return row;
    }

    async execAndReturnAll(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        const rows = await stmt.all(params);
        stmt.release();
        return rows;
    }
}

export abstract class SQLConnectionPool {
    abstract getConnection(): SQLConnection;

    release(connection: SQLConnection) {
        connection.buys = false;
    }
}

export class SQLQueryResolver<T extends Entity> extends GenericQueryResolver<T, DatabaseAdapter, SQLQueryModel<T>> {
    protected tableId = this.platform.getTableIdentifier.bind(this.platform);
    protected quoteIdentifier = this.platform.quoteIdentifier.bind(this.platform);
    protected quote = this.platform.quoteValue.bind(this.platform);

    constructor(
        protected connection: SQLConnection,
        protected platform: DefaultPlatform,
        classSchema: ClassSchema<T>,
        databaseSession: DatabaseSession<DatabaseAdapter>
    ) {
        super(classSchema, databaseSession);
    }

    protected createFormatter(withIdentityMap: boolean = false) {
        return new SqlFormatter(
            this.classSchema,
            sqlSerializer,
            this.databaseSession.getHydrator(),
            withIdentityMap ? this.databaseSession.identityMap : undefined
        );
    }

    protected getTableIdentifier(schema: ClassSchema) {
        return this.platform.getTableIdentifier(schema);
    }

    async count(model: SQLQueryModel<T>): Promise<number> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'SELECT COUNT(*) as count');
        const row = await this.connection.execAndReturnSingle(sql);
        //postgres has bigint as return type of COUNT, so we need to convert always
        return Number(row.count);
    }

    async deleteMany(model: SQLQueryModel<T>): Promise<number> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'DELETE');
        await this.connection.exec(sql);
        return await this.connection.getChanges();
    }

    async deleteOne(model: SQLQueryModel<T>): Promise<boolean> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        model = model.clone();
        model.limit = 1;
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'DELETE');
        await this.connection.exec(sql);
        return await this.connection.getChanges() === 1;
    }

    async find(model: SQLQueryModel<T>): Promise<T[]> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.select(this.classSchema, model);

        const rows = await this.connection.execAndReturnAll(sql);
        const converted = sqlBuilder.convertRows(this.classSchema, model, rows);
        const formatter = this.createFormatter(model.withIdentityMap);
        return converted.map(v => formatter.hydrate(model, v));
    }

    async findOneOrUndefined(model: SQLQueryModel<T>): Promise<T | undefined> {
        const sqlBuilder = new SqlBuilder(this.platform);
        const sql = sqlBuilder.select(this.classSchema, model);
        const row = await this.connection.execAndReturnSingle(sql);
        if (!row) return;

        const converted = sqlBuilder.convertRows(this.classSchema, model, [row]);
        const formatter = this.createFormatter(model.withIdentityMap);
        return formatter.hydrate(model, converted[0]);
    }

    async has(model: SQLQueryModel<T>): Promise<boolean> {
        return await this.count(model) > 0;
    }

    patchMany(model: SQLQueryModel<T>, value: { [p: string]: any }): Promise<number> {
        return Promise.resolve(0);
    }

    patchOne(model: SQLQueryModel<T>, value: { [p: string]: any }): Promise<boolean> {
        return Promise.resolve(false);
    }

    updateOne(model: SQLQueryModel<T>, value: T): Promise<boolean> {
        return Promise.resolve(false);
    }
}

export class SQLDatabaseQuery<T extends Entity,
    MODEL extends SQLQueryModel<T> = SQLQueryModel<T>,
    RESOLVER extends SQLQueryResolver<T> = SQLQueryResolver<T>> extends GenericQuery<T, MODEL, SQLQueryResolver<T>> {

}

export class SQLDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(protected connection: SQLConnection, protected platform: DefaultPlatform, protected databaseSession: DatabaseSession<any>) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T> | ClassSchema<T>
    ): SQLDatabaseQuery<T> {
        const schema = getClassSchema(classType);
        return new SQLDatabaseQuery(schema, new SQLQueryModel(), new SQLQueryResolver(this.connection, this.platform, schema, this.databaseSession));
    }
}

export abstract class SQLDatabaseAdapter extends DatabaseAdapter {
    protected abstract platform: DefaultPlatform = new DefaultPlatform;
    protected abstract connectionPool: SQLConnectionPool;

    abstract queryFactory(databaseSession: DatabaseSession<this>): SQLDatabaseQueryFactory;

    abstract createPersistence(databaseSession: DatabaseSession<this>): SQLPersistence;

    abstract getSchemaName(): string;

    async migrate(classSchemas: ClassSchema[]): Promise<void> {
        const connection = await this.connectionPool.getConnection();
        try {
            const database = new Database();
            database.schemaName = this.getSchemaName();
            this.platform.createTables(classSchemas, database);
            const DDLs = this.platform.getAddTablesDDL(database);
            // console.log('DDLs', DDLs);
            for (const sql of DDLs) {
                await connection.exec(sql);
            }
        } finally {
            connection.release();
        }
    }
}

export class SQLPersistence extends DatabasePersistence {
    constructor(
        protected platform: DefaultPlatform,
        protected connection: SQLConnection,
    ) {
        super();
    }

    protected prepareAutoIncrement(classSchema: ClassSchema, count: number) {
    }

    protected populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const scopeSerializer = this.platform.serializer.for(classSchema);
        const changeDetector = getJitChangeDetector(classSchema);
        const doSnapshot = getJITConverterForSnapshot(classSchema);

        const inserted: T[] = [];
        const sqls: string[] = [];

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                const lastSnapshot = state.getSnapshot();
                const currentSnapshot = doSnapshot(item);
                const changes = changeDetector(lastSnapshot, currentSnapshot, item);
                if (!changes) continue;

                const set: string[] = [];
                const where: string[] = [];

                const pk = scopeSerializer.partialSerialize(state.getLastKnownPK());
                for (const i in pk) {
                    where.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(pk[i])}`);
                }
                const value = scopeSerializer.partialSerialize(changes);
                for (const i in value) {
                    set.push(`${this.platform.quoteIdentifier(i)} = ${this.platform.quoteValue(value[i])}`);
                }

                sqls.push(`UPDATE ${this.platform.getTableIdentifier(classSchema)} SET ${set.join(', ')} WHERE ${where.join(' AND ')}`);
            } else {
                inserted.push(item);
            }
        }

        if (inserted.length) {
            await this.prepareAutoIncrement(classSchema, inserted.length);
            await this.doInsert(classSchema, inserted);
            await this.populateAutoIncrementFields(classSchema, inserted);
        }

        if (sqls.length) {
            //try bulk update via https://stackoverflow.com/questions/11563869/update-multiple-rows-with-different-values-in-a-single-sql-query
            await this.connection.exec(sqls.join(';\n'));
        }
    }

    protected async doInsert<T>(classSchema: ClassSchema<T>, items: T[]) {
        const quoteValue = this.platform.quoteValue.bind(this.platform);
        const scopeSerializer = this.platform.serializer.for(classSchema);
        const fields = this.platform.getEntityFields(classSchema).filter(v => !v.isAutoIncrement).map(v => v.name);
        const insert: string[] = [];

        for (const item of items) {
            const converted = scopeSerializer.serialize(item);
            //todo we need a faster converter, or should we use prepared statements?
            insert.push(fields.map(v => quoteValue(converted[v])).join(', '));
        }

        const sql = this.getInsertSQL(classSchema, fields.map(v => this.platform.quoteIdentifier(v)), insert);
        await this.connection.exec(sql);
    }

    protected getInsertSQL(classSchema: ClassSchema, fields: string[], values: string[]): string {
        return `INSERT INTO ${this.platform.getTableIdentifier(classSchema)} (${fields.join(', ')}) VALUES (${values.join('), (')})`;
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const pks: any[] = [];
        const pk = classSchema.getPrimaryField();
        for (const item of items) {
            pks.push(item[pk.name]);
        }

        const inValues = pks.map(v => this.platform.quoteValue(v)).join(', ');
        await this.connection.exec(`DELETE FROM ${this.platform.getTableIdentifier(classSchema)} WHERE ${this.platform.quoteIdentifier(pk.name)} IN (${inValues})`);
    }
}