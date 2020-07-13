import {ClassType, CustomError} from '@super-hornet/core';
import {DatabaseQueryModel, Entity, GenericQuery, Sort} from "./query";
import {getHydratedDatabaseSession, isHydrated} from "./formatter";
import {ClassSchema, getClassSchema, getClassTypeFromInstance} from "@super-hornet/marshal";
import {DatabaseSession} from "./database-session";
import {PrimaryKey} from "./entity-registry";

export class NotFoundError extends CustomError {
}

export class NoIDDefinedError extends CustomError {
}

/**
 * Hydrates not completely populated item and makes it completely accessible.
 */
export async function hydrateEntity<T>(item: T) {
    if (isHydrated(item)) {
        return await getHydratedDatabaseSession(item).hydrateEntity(item);
    }
    throw new Error(`Given object is not a proxy object and thus can not be hydrated, or is already hydrated.`);
}

export abstract class DatabaseAdapterQueryFactory {
    abstract createQuery<T extends Entity>(classType: ClassType<T>): GenericQuery<T, DatabaseQueryModel<T, Partial<T>, Sort<T>>>;
}

export abstract class DatabasePersistence {
    abstract async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract async patch<T extends Entity>(classSchema: ClassSchema<T>, primaryKey: PrimaryKey<T>, item: Partial<T>): Promise<void>;
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
    public readonly entities = new Set<Entity>();

    protected rootSession = new DatabaseSession<ADAPTER>(this.adapter);

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     *  - Entity instances ARE NOT cached or tracked.
     *  - No repository events are triggered.
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
     * Registers a new entity to this database. This is mainly used for db migration utilities.
     */
    registerEntity<T extends Entity>(entity: T): void {
        this.entities.add(entity);
    }

    /**
     * Simple direct persist. The persistence layer (batch) inserts or updates the record
     * depending on the state of the given items.
     */
    public async persist<T extends Entity>(...items: T[]) {
        if (items.length) {
            await this.rootSession.persistence.persist(getClassSchema(getClassTypeFromInstance(items[0])), items);
        }
    }

    /**
     * Simple direct remove. The persistence layer (batch) removes all given items.
     */
    public async remove<T extends Entity>(...items: T[]) {
        if (items.length) {
            await this.rootSession.persistence.remove(getClassSchema(getClassTypeFromInstance(items[0])), items);
        }
    }
}
