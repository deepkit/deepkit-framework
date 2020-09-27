import {ClassType} from '@deepkit/core';
import {GenericQuery} from './query';
import {getDatabaseSessionHydrator, isHydrated} from './formatter';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {DatabaseSession} from './database-session';
import {isActiveRecordType} from './active-record';
import {QueryDatabaseEmitter, UnitOfWorkDatabaseEmitter} from './event';
import {ItemChanges} from './changes';
import {PrimaryKeyFields} from './identity-map';
import {Entity} from './type';

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
    abstract createQuery<T extends Entity>(classType: ClassType<T> | ClassSchema<T>): GenericQuery<T>;
}

export interface DatabasePersistenceChangeSet<T> {
    changes: ItemChanges<T>;
    item: T;
    primaryKey: PrimaryKeyFields<T>;
}

export abstract class DatabasePersistence {
    abstract async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract async insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void>;

    /**
     * When DatabasePersistence instance is not used anymore, this function will be called.
     * Good place to release a connection for example.
     */
    abstract release(): void;
}

/**
 * A generic database adapter you can use if the API of `GenericQuery` is sufficient.
 *
 * You can specify a more specialized adapter like MysqlDatabaseAdapter/MongoDatabaseAdapter with special API for MySQL/Mongo.
 */
export abstract class DatabaseAdapter {
    abstract queryFactory(databaseSession: DatabaseSession<this>): DatabaseAdapterQueryFactory;

    abstract createPersistence(): DatabasePersistence;

    abstract disconnect(force?: boolean): void;

    abstract migrate(classSchemas: ClassSchema[]): Promise<void>;

    abstract getName(): string;

    abstract getSchemaName(): string;
}
/**
 * Database abstraction. Use createSession() to create a work session with transaction support.
 *
 * Using this class in your code indicates that you can work with common and most basic database semantics.
 * This means that you can use the deepkit/type database API that works across a variety of database engines
 * like MySQL, PostgreSQL, SQLite, and MongoDB.
 */
export class Database<ADAPTER extends DatabaseAdapter = DatabaseAdapter> {
    public name: string = 'default';

    /**
     * The entity register. This is mainly used for migration utilities.
     */
    public readonly classSchemas = new Set<ClassSchema>();

    public readonly queryEvents = new QueryDatabaseEmitter();

    public readonly unitOfWorkEvents = new UnitOfWorkDatabaseEmitter();

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     *  - Entity instances ARE NOT cached or tracked.
     *
     * Use a DatabaseSession (createSession()) with query() in your workflow to enable
     * identity map.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    constructor(
        public readonly adapter: ADAPTER,
        schemas: (ClassType | ClassSchema)[] = []
    ) {
        this.query = (classType: ClassType | ClassSchema) => {
            const session = this.createSession();
            return session.query(classType);
        };
        this.registerEntity(...schemas);
    }

    static createClass<T extends DatabaseAdapter>(name: string, adapter: T, schemas: (ClassType | ClassSchema)[] = []): ClassType<Database<T>> {
        return class extends Database<T> {
            constructor(oAdapter = adapter, oSchemas = schemas) {
                super(oAdapter, oSchemas);
                this.name = name;
            }
        };
    }

    /**
     * Tells the adapter to disconnect. It reconnects automatically when necessary.
     */
    disconnect(force?: boolean): void {
        this.adapter.disconnect(force);
    }

    /**
     * Creates a new database session. This is the preferred way of working with the database
     * and to enjoy all ORM features. Call DatabaseSession.commit to persist changes all at once.
     *
     * All entity instances fetched/stored during this session are cached and tracked.
     */
    public createSession(): DatabaseSession<ADAPTER> {
        return new DatabaseSession(this.adapter, this.unitOfWorkEvents, this.queryEvents);
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
     * Registers a new entity to this database.
     * This is mainly used for db migration utilities and active record.
     * If you want to use active record, you have to assign your entities first the a database
     * using this method.
     */
    registerEntity(...entities: (ClassType | ClassSchema)[]): void {
        for (const entity of entities) {
            const schema = getClassSchema(entity);

            this.classSchemas.add(schema);

            schema.data['orm.database'] = this;
            if (isActiveRecordType(entity)) entity.registerDatabase(this);
        }
    }

    /**
     * Makes sure the schemas types, indices, uniques, etc are reflected in the database.
     */
    async migrate() {
        await this.adapter.migrate([...this.classSchemas.values()]);
    }

    /**
     * Simple direct persist. The persistence layer (batch) inserts or updates the record
     * depending on the state of the given items. This is different to createSession()+add() in a way
     * that `add` adds the given items to the queue (which is then committed using commit())
     * and database.persist() just simply inserts/updates the given items immediately,
     * completely bypassing the advantages of the unit of work.
     *
     * You should prefer the add/remove and commit() workflow to fully utilizing database performance.
     */
    public async persist<T extends Entity>(...items: T[]) {
        const session = this.createSession();
        session.add(...items);
        await session.commit();
    }

    /**
     * Simple direct remove. The persistence layer (batch) removes all given items.
     * This is different to createSession()+add() in a way that `remove` adds the given items to the queue
     * (which is then committed using commit()) and immediate.remove() just simply removes the given items immediately,
     * completely bypassing the advantages of the unit of work.
     *
     * You should prefer the add/remove and commit() workflow to fully utilizing database performance.
     */
    public async remove<T extends Entity>(...items: T[]) {
        const session = this.createSession();
        session.remove(...items);
        await session.commit();
    }
}
