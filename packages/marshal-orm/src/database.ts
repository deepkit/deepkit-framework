import {ClassType} from '@super-hornet/core';
import {DatabaseQueryModel, Entity, GenericQuery, Sort} from "./query";
import {getHydratedDatabaseSession, isHydrated} from "./formatter";
import {ClassSchema} from "@super-hornet/marshal";
import {DatabaseSession} from "./database-session";

export class NotFoundError extends Error {
}

export class NoIDDefinedError extends Error {
}

export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'mongodb' | string;

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

/**
 * A generic database adapter you can use if the API of `GenericQuery` is sufficient.
 *
 * You can specify a more concrete adapter like MySqlDatabaseAdapter with special API for MySQL.
 */
export abstract class DatabaseAdapter {
    abstract queryFactory(databaseSession: DatabaseSession<any>): DatabaseAdapterQueryFactory;

    abstract disconnect(force?: boolean): void;

    abstract async add<T>(classSchema: ClassSchema<T>, item: T): Promise<void>;

    abstract async update<T>(classSchema: ClassSchema<T>, primaryKey: any, item: T): Promise<void>;

    abstract async patch<T>(classSchema: ClassSchema<T>, primaryKey: any, item: Partial<T>): Promise<void>;

    abstract async remove<T>(classSchema: ClassSchema<T>, primaryKey: any): Promise<void>;

    abstract getType(): DatabaseType;
}

/**
 * Database abstraction. Use createSession() to create a work session with transaction support.
 *
 * Using this class in your code indicates that you can work with common and most basic database semantics.
 * This means that you can use the Marshal database API that works across a variety of database engines
 * like MySQL, PostgreSQL, SQLite, and MongoDB.
 *
 * You should prefer declaring this type so users can overwrite it with their database conne ction
 * they want, e.g. a MysqlDatabase (which extends this class).
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

    getType(): DatabaseType {
        return this.adapter.getType();
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
     * Low level: removes one item from the database that has the given id.
     *  - DOES NOT remove referenced items. You have to call on each reference delete() in order to remove it.
     *  - DOES NOT update back references.
     *  - No repository events are triggered.
     *
     * You should usually work with DatabaseSession (createSession()) instead, except if you know what you are doing.
     */
    public async remove<T>(item: T): Promise<boolean> {
        return this.rootSession.remove(item);
    }

    /**
     * Low level: add one item to the database.
     *  - Populates primary key if necessary.
     *  - DOES NOT add references automatically. You have to call on each new reference add() in order to save it.
     *  - DOES NOT update back references.
     *  - No repository events are triggered.
     *
     * You should usually work with DatabaseSession (createSession()) instead, except if you know what you are doing.
     */
    public async add<T>(item: T) {
        return this.rootSession.add(item);
    }

    /**
     * Low level: updates one item in the database.
     *  - DOES NOT update referenced items. You have to call on each changed reference update() in order to save it.
     *  - DOES NOT update back references.
     *  - No repository events are triggered.
     *
     * You should usually work with DatabaseSession (createSession()) instead, except if you know what you are doing.
     */
    public async update<T>(item: T) {
        return this.rootSession.update(item);
    }
}
