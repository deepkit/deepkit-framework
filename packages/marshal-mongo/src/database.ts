import {ClassType} from '@super-hornet/core';
import {DatabaseSession} from "./database-session";
import {DatabaseQuery} from "./query";
import {getHydratedDatabaseSession, isHydrated} from "./formatter";
import {Connection} from "./connection";

export class NotFoundError extends Error {
}

export class NoIDDefinedError extends Error {
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

/**
 * Simple abstraction for MongoDB.
 */
export class Database {
    protected rootSession: DatabaseSession = new DatabaseSession(this.connection, true);

    constructor(
        public readonly connection: Connection,
    ) {
    }

    public async close(force?: boolean) {
        await this.connection.close(force);
    }

    /**
     * Creates a new database session. This is the preferred way of working with the database
     * and enjoy all ORM features. Call DatabaseSession.persist(item) to persist changes.
     *
     * All entity instances creating during this session are cached and tracked.
     */
    public createSession(): DatabaseSession {
        return new DatabaseSession(this.connection);
    }

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     *  - Entity instances ARE NOT cached or tracked.
     *  - No repository events are triggered.
     *
     * Use a DatabaseSession (createSession()) with query() in your workflow to enable instance pooling.
     */
    public query<T>(classType: ClassType<T>): DatabaseQuery<T> {
        return this.rootSession.query(classType);
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
