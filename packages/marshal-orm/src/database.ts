import {ClassType, CustomError} from '@super-hornet/core';
import {DatabaseQueryModel, Entity, GenericQuery, GenericQueryResolver, Sort} from './query';
import {getDatabaseSessionHydrator, isHydrated} from './formatter';
import {ClassSchema, getClassSchema} from '@super-hornet/marshal';
import {DatabaseSession} from './database-session';

export class NotFoundError extends CustomError {
}

export class NoIDDefinedError extends CustomError {
}

/**
 * Hydrates not completely populated item and makes it completely accessible.
 */
export async function hydrateEntity<T>(item: T) {
    if (isHydrated(item)) {
        return await getDatabaseSessionHydrator(item)(item);
    }
    throw new Error(`Given object is not a proxy object and thus can not be hydrated, or is already hydrated.`);
}

export abstract class DatabaseAdapterQueryFactory {
    abstract createQuery<T extends Entity>(classType: ClassType<T>): GenericQuery<T, DatabaseQueryModel<T, Partial<T> | any, Sort<T>>, GenericQueryResolver<T, any, DatabaseQueryModel<T, Partial<T> | any, Sort<T>>>>;
}

export abstract class DatabasePersistence {
    abstract async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;
}

export interface DatabaseConnection {
    isInTransaction(): boolean;
}

/**
 * A generic database adapter you can use if the API of `GenericQuery` is sufficient.
 *
 * You can specify a more concrete adapter like MySqlDatabaseAdapter with special API for MySQL.
 */
export abstract class DatabaseAdapter {
    abstract queryFactory(databaseSession: DatabaseSession<this>): DatabaseAdapterQueryFactory;

    abstract createPersistence(databaseSession: DatabaseSession<this>): DatabasePersistence;

    abstract disconnect(force?: boolean): void;

    abstract createConnection(): DatabaseConnection;

    abstract migrate(classSchemas: Iterable<ClassSchema>): Promise<void>;

    abstract getName(): string;
}

/**
 * Database abstraction. Use createSession() to create a work session with transaction support.
 *
 * Using this class in your code indicates that you can work with common and most basic database semantics.
 * This means that you can use the Marshal database API that works across a variety of database engines
 * like MySQL, PostgreSQL, SQLite, and MongoDB.
 */
export class Database<ADAPTER extends DatabaseAdapter> {
    /**
     * The entity register. This is mainly used for migration utilities.
     */
    public readonly classSchemas = new Set<ClassSchema>();

    protected rootSession = new DatabaseSession<ADAPTER>(this.adapter);

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     *  - Entity instances ARE NOT cached or tracked.
     *
     * Use a DatabaseSession (createSession()) with query() in your workflow to enable
     * instance pooling and transaction support.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    constructor(public readonly adapter: ADAPTER) {
        const queryFactory = this.adapter.queryFactory(this.rootSession);
        this.query = queryFactory.createQuery.bind(queryFactory);
    }

    /**
     * Tells the adapter to disconnect. It reconnects automatically when necessary.
     */
    disconnect(force?: boolean): void {
        this.adapter.disconnect(force);
    }

    /**
     * Creates a new database session. This is the preferred way of working with the database
     * and enjoy all ORM features. Call DatabaseSession.persist(item) to persist changes all at once.
     *
     * All entity instances fetched/stored during this session are cached and tracked.
     */
    public createSession(): DatabaseSession<ADAPTER> {
        return new DatabaseSession(this.adapter);
    }

    /**
     * Executes given callback in a new session/transaction and automatically commits it when executed successfully.
     * Automatically does a rollback when callback throws an error.
     */
    public async session<T>(worker: (session: DatabaseSession<ADAPTER>) => Promise<T>): Promise<T> {
        const session = this.createSession();
        try {
            const res = await worker(session);
            await session.commit();
            return res;
        } catch (error) {
            session.rollback();
            throw error;
        }
    }

    /**
     * Registers a new entity to this database. This is mainly used for db migration utilities.
     */
    registerEntity(entity: ClassType | ClassSchema): void {
        this.classSchemas.add(getClassSchema(entity));
    }

    /**
     * Makes sure the schemas types, indices, uniques, etc are reflected in the database.
     */
    async migrate() {
        await this.adapter.migrate(this.classSchemas);
    }
}
