/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import type { DatabaseAdapter, DatabasePersistence, DatabasePersistenceChangeSet } from './database-adapter';
import { DatabaseValidationError, Entity } from './type';
import { ClassType, CustomError, getClassTypeFromInstance } from '@deepkit/core';
import { getPrimaryKeyExtractor, isReference, markAsHydrated, PrimaryKeyFields, ReflectionClass, typeSettings, UnpopulatedCheck, validate } from '@deepkit/type';
import { GroupArraySort } from '@deepkit/topsort';
import { getClassState, getInstanceState, getNormalizedPrimaryKey, IdentityMap } from './identity-map';
import { getClassSchemaInstancePairs } from './utils';
import { HydratorFn } from './formatter';
import { getReference } from './reference';
import { QueryDatabaseEmitter, UnitOfWorkCommitEvent, UnitOfWorkDatabaseEmitter, UnitOfWorkEvent, UnitOfWorkUpdateEvent } from './event';
import { DatabaseLogger } from './logger';
import { Stopwatch } from '@deepkit/stopwatch';

let SESSION_IDS = 0;

export class DatabaseSessionRound<ADAPTER extends DatabaseAdapter> {
    protected addQueue = new Set<Entity>();
    protected removeQueue = new Set<Entity>();

    protected inCommit: boolean = false;
    protected committed: boolean = false;

    constructor(
        protected session: DatabaseSession<any>,
        protected emitter: UnitOfWorkDatabaseEmitter,
        public logger: DatabaseLogger,
        protected identityMap?: IdentityMap,
    ) {

    }

    public isInCommit() {
        return this.inCommit;
    }

    public isCommitted() {
        return this.committed;
    }

    public add(...items: Entity[]): void {
        if (this.isInCommit()) throw new Error('Already in commit. Can not change queues.');

        for (const item of items) {
            if (this.removeQueue.has(item)) continue;
            if (this.addQueue.has(item)) continue;

            this.addQueue.add(item);

            for (const dep of this.getReferenceDependencies(item)) {
                this.add(dep);
            }
        }
    }

    protected getReferenceDependencies<T extends Entity>(item: T): Entity[] {
        const result: Entity[] = [];
        const classSchema = ReflectionClass.from(getClassTypeFromInstance(item));

        const old = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheck.None;
        try {
            for (const reference of classSchema.getReferences()) {
                if (reference.isBackReference()) continue;

                //todo, check if join was populated. will throw otherwise
                const v = item[reference.getNameAsString() as keyof T] as any;
                if (v == undefined) continue;

                // if (reference.isArray) {
                //     if (isArray(v)) {
                //         for (const i of v) {
                //             if (isReference(v)) continue;
                //             if (i instanceof reference.getResolvedClassType()) result.push(i);
                //         }
                //     }
                // } else {
                if (!isReference(v)) result.push(v);
                // }
            }
        } finally {
            typeSettings.unpopulatedCheck = old;
        }

        return result;
    }

    public remove(...items: Entity[]) {
        if (this.isInCommit()) throw new Error('Already in commit. Can not change queues.');

        for (const item of items) {
            this.removeQueue.add(item);
            this.addQueue.delete(item);
        }
    }

    public async commit(persistence: DatabasePersistence) {
        if (!this.removeQueue.size && !this.addQueue.size) return;

        this.inCommit = true;

        try {
            await this.doDelete(persistence);
            await this.doPersist(persistence);
            this.committed = true;
        } finally {
            this.inCommit = false;
        }
    }

    protected async doDelete(persistence: DatabasePersistence) {
        for (const [classSchema, items] of getClassSchemaInstancePairs(this.removeQueue.values())) {
            if (this.emitter.onDeletePre.hasSubscriptions()) {
                const event = new UnitOfWorkEvent(classSchema, this.session, items);
                await this.emitter.onDeletePre.emit(event);
                if (event.stopped) return;
            }

            await persistence.remove(classSchema, items);
            if (this.identityMap) this.identityMap.deleteMany(classSchema, items);

            if (this.emitter.onDeletePost.hasSubscriptions()) {
                const event = new UnitOfWorkEvent(classSchema, this.session, items);
                await this.emitter.onDeletePost.emit(event);
            }
        }
    }

    protected async doPersist(persistence: DatabasePersistence) {
        const sorter = new GroupArraySort<Entity, ReflectionClass<any>>();
        sorter.sameTypeExtraGrouping = true;
        sorter.throwOnNonExistingDependency = false;
        const unpopulatedCheck = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheck.None;

        try {
            for (const item of this.addQueue.values()) {
                const classSchema = ReflectionClass.from(getClassTypeFromInstance(item));
                sorter.add(item, classSchema, this.getReferenceDependencies(item));
            }

            sorter.sort();
            const groups = sorter.getGroups();

            for (const group of groups) {
                const inserts: Entity[] = [];
                const changeSets: DatabasePersistenceChangeSet<Entity>[] = [];
                const classState = getClassState(group.type);

                for (const item of group.items) {
                    const state = getInstanceState(classState, item);
                    const errors = validate(item, classState.classSchema.type);
                    if (errors.length) {
                        throw new DatabaseValidationError(classState.classSchema, errors);
                    }

                    if (state.isKnownInDatabase()) {
                        const lastSnapshot = state.getSnapshot();
                        const currentSnapshot = classState.snapshot(item);
                        const changeSet = classState.changeDetector(lastSnapshot, currentSnapshot, item);
                        if (!changeSet) {
                            continue;
                        }
                        changeSets.push({
                            changes: changeSet,
                            item: item,
                            primaryKey: state.getLastKnownPK(),
                        });
                    } else {
                        inserts.push(item);
                    }
                }

                if (inserts.length) {
                    let doInsert = true;
                    if (this.emitter.onInsertPre.hasSubscriptions()) {
                        const event = new UnitOfWorkEvent(group.type, this.session, inserts);
                        await this.emitter.onInsertPre.emit(event);
                        if (event.stopped) doInsert = false;
                    }
                    if (doInsert) {
                        await persistence.insert(group.type, inserts);
                        if (this.emitter.onInsertPost.hasSubscriptions()) {
                            await this.emitter.onInsertPost.emit(new UnitOfWorkEvent(group.type, this.session, inserts));
                        }
                    }
                }

                if (changeSets.length) {
                    let doUpdate = true;
                    if (this.emitter.onUpdatePre.hasSubscriptions()) {
                        const event = new UnitOfWorkUpdateEvent(group.type, this.session, changeSets);
                        await this.emitter.onUpdatePre.emit(event);
                        if (event.stopped) doUpdate = false;
                    }

                    if (doUpdate) {
                        await persistence.update(group.type, changeSets);

                        if (this.emitter.onUpdatePost.hasSubscriptions()) {
                            await this.emitter.onUpdatePost.emit(new UnitOfWorkUpdateEvent(group.type, this.session, changeSets));
                        }
                    }
                }

                if (this.identityMap) {
                    this.identityMap.storeMany(group.type, group.items);
                } else {
                    for (const item of group.items) {
                        const state = getInstanceState(classState, item);
                        state.markAsPersisted();
                    }
                }
            }
        } finally {
            typeSettings.unpopulatedCheck = unpopulatedCheck;
        }
    }
}

export class SessionClosedException extends CustomError {
}

export interface DatabaseSessionHookConstructor<C> {
    new<T extends DatabaseSession<any>>(session: T): C;
}

export interface DatabaseSessionHook<T extends DatabaseSession<any>> {
}

export abstract class DatabaseTransaction {
    static transactionCounter: number = 0;

    public ended: boolean = false;

    abstract begin(): Promise<void>;

    abstract commit(): Promise<void>;

    abstract rollback(): Promise<void>;

    constructor(public id: number = DatabaseTransaction.transactionCounter++) {
    }
}

export class DatabaseSession<ADAPTER extends DatabaseAdapter> {
    public readonly id = SESSION_IDS++;
    public withIdentityMap = true;

    /**
     * When this session belongs to a transaction, then this is set.
     * All connection handlers should make sure that when a query/persistence object
     * requests a connection, it should always be the same for a given transaction.
     * (that's how transaction work). The connection between a transaction
     * and connection should be unlinked when the transaction commits/rollbacks.
     */
    public assignedTransaction?: ReturnType<this['adapter']['createTransaction']>;

    public readonly identityMap = new IdentityMap();

    /**
     * Creates a new DatabaseQuery instance which can be used to query and manipulate data.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    public readonly raw!: ReturnType<this['adapter']['rawFactory']>['create'];

    protected rounds: DatabaseSessionRound<ADAPTER>[] = [];

    protected inCommit: boolean = false;

    protected currentPersistence?: DatabasePersistence = undefined;

    constructor(
        public readonly adapter: ADAPTER,
        public readonly unitOfWorkEmitter: UnitOfWorkDatabaseEmitter = new UnitOfWorkDatabaseEmitter,
        public readonly queryEmitter: QueryDatabaseEmitter = new QueryDatabaseEmitter(),
        public logger: DatabaseLogger = new DatabaseLogger,
        public stopwatch?: Stopwatch,
    ) {
        const queryFactory = this.adapter.queryFactory(this);
        this.query = queryFactory.createQuery.bind(queryFactory);

        const factory = this.adapter.rawFactory(this);
        this.raw = factory.create.bind(factory);
    }

    /**
     * Marks this session as transactional. On the next query or flush/commit() a transaction on the database adapter is started.
     * Use flush(), commit(), and rollback() to control the transaction behavior. All created query objects from this session
     * are running in this transaction as well.
     *
     * The transaction is released when commit()/rollback is executed. When the transaction is released then
     * this session is not marked as transactional anymore. You have to use useTransaction() again if you want to
     * have a new transaction on this session.
     */
    useTransaction(): ReturnType<this['adapter']['createTransaction']> {
        if (!this.assignedTransaction) {
            this.assignedTransaction = this.adapter.createTransaction(this) as ReturnType<this['adapter']['createTransaction']>;
        }
        return this.assignedTransaction;
    }

    /**
     * Whether a transaction is assigned to this session.
     */
    hasTransaction(): boolean {
        return !!this.assignedTransaction;
    }

    /**
     * Commits all open changes (pending inserts, updates, deletions) in optimized batches.
     *
     * If a transaction is assigned, this will automatically call a transaction commit and the transaction released.
     * Use flush() if you don't want to end the transaction and keep making changes to the current transaction.
     */
    public async commit() {
        await this.flush();
        if (!this.assignedTransaction) return;
        await this.assignedTransaction.commit();
        this.assignedTransaction = undefined;
    }

    /**
     * If a transaction is assigned, a transaction rollback is executed and the transaction released.
     *
     * This does not rollback changes made to objects in memory.
     */
    async rollback(): Promise<void> {
        if (!this.assignedTransaction) return;
        await this.assignedTransaction.rollback();
        this.assignedTransaction = undefined;
    }

    /**
     * If a transaction is assigned, a transaction commit is executed.
     *
     * This does not commit changes made to your objects in memory. Use commit() for that instead (which executes commitTransaction() as well).
     */
    async commitTransaction(): Promise<void> {
        if (!this.assignedTransaction) return;
        await this.assignedTransaction.commit();
        this.assignedTransaction = undefined;
    }

    /**
     * Executes an async callback inside of a new transaction. If the callback succeeds (not throwing), the
     * session is automatically committed (and thus its transaction committed and all changes flushed).
     * If the callback throws, the session executes rollback() automatically, and the error is rethrown.
     *
     * ```typescript
     * await session.transaction(async (session) => {
     *     await session.query(...);
     *     session.add(...);
     *
     *     //...
     * });
     * ```
     */
    async transaction<T>(callback: (session: this) => Promise<T>): Promise<T> {
        this.useTransaction();

        try {
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    from<T>(hook: DatabaseSessionHookConstructor<T>): T {
        return new hook(this);
    }

    /**
     * Creates or returns an existing reference.
     *
     * If no instance is known in the identity map, it creates a proxy reference (where only primary keys are populated).
     * You can work with this entity instance to assign new references, but reading for not-hydrated values is not possible.
     * Writing not-hydrated is possible and lead to a change in the change-detection. Completely hydrate the object using
     * the `hydrateEntity` function.
     *
     * ```
     * const user = session.getReference(User, 1);
     * ```
     */
    public getReference<T>(classType: ClassType<T> | ReflectionClass<T>, primaryKey: any | PrimaryKeyFields<T>): T {
        const schema = ReflectionClass.from(classType);
        const pk = getNormalizedPrimaryKey(schema, primaryKey);
        return getReference(schema, pk, this.identityMap);
    }

    protected getCurrentRound(): DatabaseSessionRound<ADAPTER> {
        if (!this.rounds.length) this.enterNewRound();

        return this.rounds[this.rounds.length - 1];
    }

    protected enterNewRound() {
        this.rounds.push(new DatabaseSessionRound(this, this.unitOfWorkEmitter, this.logger, this.withIdentityMap ? this.identityMap : undefined));
    }

    /**
     * Adds a single or multiple items to the to add/update queue. Use session.commit() to persist all queued items to the database.
     *
     * This works like Git: you add files, and later commit all in one batch.
     */
    public add(...items: Entity[]): void {
        if (this.getCurrentRound().isInCommit()) {
            this.enterNewRound();
        }

        this.getCurrentRound().add(...items);
    }

    /**
     * Adds a item to the remove queue. Use session.commit() to remove queued items from the database all at once.
     */
    public remove(...items: Entity[]) {
        if (this.getCurrentRound().isInCommit()) {
            this.enterNewRound();
        }

        this.getCurrentRound().remove(...items);
    }

    /**
     * Resets all scheduled changes (add() and remove() calls).
     *
     * This does not reset changes made to your objects in memory.
     */
    public reset() {
        this.inCommit = false;
        this.rounds = [];
        if (this.currentPersistence) {
            this.currentPersistence.release();
            this.currentPersistence = undefined;
        }
    }

    public getHydrator(): HydratorFn {
        return this.hydrateEntity.bind(this);
    }

    public async hydrateEntity<T extends object>(item: T) {
        const classType = getClassTypeFromInstance(item);
        const classSchema = ReflectionClass.from(classType);
        const pk = getPrimaryKeyExtractor(classSchema)(item);

        const itemDB = await this.query(classType).filter(pk).findOne();

        for (const property of classSchema.getProperties()) {
            if (property.isPrimaryKey()) continue;
            if (property.isReference() || property.isBackReference()) continue;

            //we set only not overwritten values
            if (!item.hasOwnProperty(property.symbol)) {
                Object.defineProperty(item, property.symbol, {
                    enumerable: false,
                    configurable: true,
                    value: itemDB[property.getNameAsString() as keyof T]
                });
            }
        }

        markAsHydrated(item);
    }

    /**
     * Commits all open changes (pending inserts, updates, deletions) in optimized batches.
     *
     * The transaction (if there is any) is still alive. You can call flush() multiple times in an active transaction.
     * commit() does the same as flush() but also automatically commits and closes the transaction.
     */
    public async flush() {
        if (!this.currentPersistence) {
            this.currentPersistence = this.adapter.createPersistence(this);
        }

        if (!this.rounds.length) {
            //we create a new round
            this.enterNewRound();
        }

        //make sure all stuff in the identity-map is known
        const round = this.getCurrentRound();
        if (this.withIdentityMap) {
            for (const map of this.identityMap.registry.values()) {
                for (const item of map.values()) {
                    round.add(item.ref);
                }
            }
        }

        if (this.unitOfWorkEmitter.onCommitPre.hasSubscriptions()) {
            const event = new UnitOfWorkCommitEvent(this);
            await this.unitOfWorkEmitter.onCommitPre.emit(event);
            if (event.stopped) return;
        }

        //we need to iterate via for i, because hooks might add additional rounds dynamically
        for (let i = 0; i < this.rounds.length; i++) {
            const round = this.rounds[i];
            if (round.isCommitted() || round.isInCommit()) continue;

            try {
                await round.commit(this.currentPersistence);
            } catch (error) {
                this.rounds = [];
                this.currentPersistence.release();
                this.currentPersistence = undefined;
                throw error;
            }
        }

        this.currentPersistence.release();
        this.currentPersistence = undefined;
        this.rounds = [];
    }
}
