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
} from '@super-hornet/marshal-orm';
import {ClassType} from '@super-hornet/core';
import {ClassSchema, getClassSchema} from '@super-hornet/marshal';
import {DefaultPlatform} from './platform/default-platform';
import {SQLitePlatform} from './platform/sqlite-platform';
import {SQLiteConnection} from './sqlite-adapter';
import {SqlBuilder} from './sql-builder';
import {SqlFormatter} from './sql-formatter';
import {sqlSerializer} from './sql-serializer';

export type SORT_TYPE = SORT_ORDER | { $meta: 'textScore' };
export type DEEP_SORT<T extends Entity> = { [P in keyof T]?: SORT_TYPE } & { [P: string]: SORT_TYPE };

type FilterQuery<T> = Partial<T>;

export class SQLQueryModel<T extends Entity> extends DatabaseQueryModel<T, FilterQuery<T>, DEEP_SORT<T>> {
}

export abstract class SQLStatement {
    abstract get(params?: any[]): Promise<any>;

    abstract all(params?: any[]): Promise<any[]>;

    abstract close(): void
}

export abstract class SQLConnection {
    abstract platform: DefaultPlatform;

    abstract prepare(sql: string): Promise<SQLStatement>;

    abstract exec(sql: string): Promise<any>;

    abstract getChanges(): Promise<number>;

    async execAndReturnSingle(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        const row = await stmt.get(params);
        stmt.close();
        return row;
    }


    async execAndReturnAll(sql: string, params?: any[]): Promise<any> {
        const stmt = await this.prepare(sql);
        const rows = await stmt.all(params);
        stmt.close();
        return rows;
    }
}

export class SQLQueryResolver<T extends Entity> extends GenericQueryResolver<T, DatabaseAdapter, SQLQueryModel<T>> {
    protected tableId = this.connection.platform.getTableIdentifier.bind(this.connection.platform);
    protected quoteIdentifier = this.connection.platform.quoteIdentifier.bind(this.connection.platform);
    protected quote = this.connection.platform.quoteValue.bind(this.connection.platform);

    constructor(
        protected connection: SQLConnection,
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
        return this.connection.platform.getTableIdentifier(schema);
    }

    async count(model: SQLQueryModel<T>): Promise<number> {
        const sqlBuilder = new SqlBuilder(this.connection.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'SELECT COUNT(*) as count');
        const row = await this.connection.execAndReturnSingle(sql);
        return row.count;
    }

    async deleteMany(model: SQLQueryModel<T>): Promise<number> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        const sqlBuilder = new SqlBuilder(this.connection.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'DELETE');
        await this.connection.exec(sql);
        return await this.connection.getChanges();
    }

    async deleteOne(model: SQLQueryModel<T>): Promise<boolean> {
        if (model.hasJoins()) throw new Error('Delete with joins not supported. Fetch first the ids then delete.');
        model = model.clone();
        model.limit = 1;
        const sqlBuilder = new SqlBuilder(this.connection.platform);
        const sql = sqlBuilder.build(this.classSchema, model, 'DELETE');
        await this.connection.exec(sql);
        return await this.connection.getChanges() === 1;
    }

    async find(model: SQLQueryModel<T>): Promise<T[]> {
        const sqlBuilder = new SqlBuilder(this.connection.platform);
        const sql = sqlBuilder.select(this.classSchema, model);

        const rows = await this.connection.execAndReturnAll(sql);
        const converted = sqlBuilder.convertRows(this.classSchema, model, rows);
        const formatter = this.createFormatter(model.withIdentityMap);
        return converted.map(v => formatter.hydrate(model, v));
    }

    async findOneOrUndefined(model: SQLQueryModel<T>): Promise<T | undefined> {
        const sqlBuilder = new SqlBuilder(this.connection.platform);
        const sql = sqlBuilder.select(this.classSchema, model);
        const row = await this.connection.execAndReturnSingle(sql);

        const converted = sqlBuilder.convertRows(this.classSchema, model, [row]);
        // console.log('findOne converted', converted);
        const formatter = this.createFormatter(model.withIdentityMap);
        return formatter.hydrate(model, converted[0]);
    }

    has(model: SQLQueryModel<T>): Promise<boolean> {
        return Promise.resolve(false);
    }

    patchMany(model: SQLQueryModel<T>, value: { [p: string]: any }): Promise<number> {
        return Promise.resolve(0);
    }

    patchOne(model: SQLQueryModel<T>, value: { [p: string]: any }): Promise<boolean> {
        return Promise.resolve(false);
    }

    updateMany(model: SQLQueryModel<T>, value: {}): Promise<number> {
        return Promise.resolve(0);
    }

    updateOne(model: SQLQueryModel<T>, value: {}): Promise<boolean> {
        return Promise.resolve(false);
    }
}

export class SQLDatabaseQuery<T extends Entity,
    MODEL extends SQLQueryModel<T> = SQLQueryModel<T>,
    RESOLVER extends SQLQueryResolver<T> = SQLQueryResolver<T>> extends GenericQuery<T, MODEL, SQLQueryResolver<T>> {

}

export class SQLDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(protected connection: SQLConnection, protected databaseSession: DatabaseSession<any>) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T>
    ): SQLDatabaseQuery<T> {
        const schema = getClassSchema(classType);
        return new SQLDatabaseQuery(schema, new SQLQueryModel(), new SQLQueryResolver(this.connection, schema, this.databaseSession));
    }
}

export abstract class SQLDatabaseAdapter extends DatabaseAdapter {
    abstract connection: SQLiteConnection;
    abstract platform = new SQLitePlatform();

    abstract queryFactory(databaseSession: DatabaseSession<this>): SQLDatabaseQueryFactory;

    abstract createPersistence(databaseSession: DatabaseSession<this>): SQLPersistence;
}

export class SQLPersistence extends DatabasePersistence {
    constructor(protected platform: DefaultPlatform, protected connection: SQLConnection) {
        super();
    }

    protected prepareAutoIncrement(classSchema: ClassSchema, count: number) {
    }

    protected populateAutoIncrementFields<T>(classSchema: ClassSchema<T>, items: T[]) {
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const scopeSerializer = sqlSerializer.for(classSchema);
        const changeDetector = getJitChangeDetector(classSchema);
        const doSnapshot = getJITConverterForSnapshot(classSchema);
        const quoteValue = this.platform.quoteValue.bind(this.platform);

        const insert: string[] = [];
        const fields = [...classSchema.getClassProperties().keys()];
        const inserted: T[] = [];

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                const lastSnapshot = state.getSnapshot();
                const currentSnapshot = doSnapshot(item);
                const changes = changeDetector(lastSnapshot, currentSnapshot, item);
                if (!changes) continue;

                //scopeSerializer.partialSerialize(changes)
            } else {
                const converted = scopeSerializer.serialize(item);
                //todo we need a faster converter, or should we use prepared statements?
                insert.push(fields.map(v => quoteValue(converted[v])).join(', '));
                inserted.push(item);
            }
        }

        if (insert.length) {
            await this.prepareAutoIncrement(classSchema, insert.length);
            const sql = `INSERT INTO ${this.platform.getTableIdentifier(classSchema)} (${fields.map(v => this.platform.quoteIdentifier(v)).join(', ')}) VALUES (${insert.join('), (')}) `;
            // console.log('insert', sql);
            await this.connection.exec(sql);
            await this.populateAutoIncrementFields(classSchema, inserted);
        }

        //bulk update via https://stackoverflow.com/questions/11563869/update-multiple-rows-with-different-values-in-a-single-sql-query
    }

    remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        return Promise.resolve(undefined);
    }
}