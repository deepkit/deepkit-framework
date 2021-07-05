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
import { ClassType, CustomError, isArray } from '@deepkit/core';
import {
    ClassSchema,
    getClassSchema,
    getClassTypeFromInstance,
    getGlobalStore,
    getPrimaryKeyExtractor,
    GlobalStore,
    isReference,
    markAsHydrated,
    PrimaryKeyFields,
    UnpopulatedCheck,
    validate
} from '@deepkit/type';
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
    protected global: GlobalStore = getGlobalStore();

    constructor(
        protected session: DatabaseSession<any>,
        protected identityMap: IdentityMap,
        protected emitter: UnitOfWorkDatabaseEmitter,
        public logger: DatabaseLogger,
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
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const old = this.global.unpopulatedCheck;
        this.global.unpopulatedCheck = UnpopulatedCheck.None;
        try {
            for (const reference of classSchema.references.values()) {
                if (reference.backReference) continue;

                //todo, check if join was populated. will throw otherwise
                const v = item[reference.name as keyof T] as any;
                if (v === undefined) continue;

                if (reference.isArray) {
                    if (isArray(v)) {
                        for (const i of v) {
                            if (isReference(v)) continue;
                            if (i instanceof reference.getResolvedClassType()) result.push(i);
                        }
                    }
                } else {
                    if (v instanceof reference.getResolvedClassType() && !isReference(v)) result.push(v);
                }
            }
        } finally {
            this.global.unpopulatedCheck = old;
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
            this.identityMap.deleteMany(classSchema, items);

            if (this.emitter.onDeletePost.hasSubscriptions()) {
                const event = new UnitOfWorkEvent(classSchema, this.session, items);
                await this.emitter.onDeletePost.emit(event);
            }
        }
    }

    protected async doPersist(persistence: DatabasePersistence) {
        const sorter = new GroupArraySort<Entity, ClassSchema>();
        sorter.sameTypeExtraGrouping = true;
        sorter.throwOnNonExistingDependency = false;
        const unpopulatedCheck = getGlobalStore().unpopulatedCheck;
        getGlobalStore().unpopulatedCheck = UnpopulatedCheck.None;

        try {
            // const start = performance.now();
            for (const item of this.addQueue.values()) {
                const classSchema = getClassSchema(getClassTypeFromInstance(item));
                sorter.add(item, classSchema, this.getReferenceDependencies(item));
            }

            sorter.sort();
            const groups = sorter.getGroups();
            // console.log('dependency resolution of', items.length, 'items took', performance.now() - start, 'ms');

            for (const group of groups) {
                const inserts: Entity[] = [];
                const changeSets: DatabasePersistenceChangeSet<Entity>[] = [];
                const classState = getClassState(group.type);

                for (const item of group.items) {
                    const state = getInstanceState(classState, item);
                    const errors = validate(classState.classSchema, item);
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

                this.identityMap.storeMany(group.type, group.items);
            }
        } finally {
            getGlobalStore().unpopulatedCheck = unpopulatedCheck;
        }
    }
}

export class SessionClosedException extends CustomError {
}

export interface DatabaseSessionHookConstructor<C> {
    new<T extends DatabaseSession<DatabaseAdapter>>(session: T): C;
}

export interface DatabaseSessionHook<T extends DatabaseSession<DatabaseAdapter>> {
}

export class DatabaseTransaction {
    constructor(public id: number) {
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
    public transaction?: DatabaseTransaction;

    public readonly identityMap = new IdentityMap();

    /**
     * Creates a new DatabaseQuery instance which can be used to query and manipulate data.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    public readonly raw!: ReturnType<this['adapter']['rawFactory']>['create'];

    protected rounds: DatabaseSessionRound<ADAPTER>[] = [];

    protected commitDepth: number = 0;

    protected inCommit: boolean = false;

    protected currentPersistence?: DatabasePersistence = undefined;

    constructor(
        public readonly adapter: ADAPTER,
        public readonly unitOfWorkEmitter: UnitOfWorkDatabaseEmitter = new UnitOfWorkDatabaseEmitter,
        public readonly queryEmitter: QueryDatabaseEmitter = new QueryDatabaseEmitter(),
        public logger: DatabaseLogger = new DatabaseLogger,
        public stopwatch: Stopwatch = new Stopwatch(),
    ) {
        const queryFactory = this.adapter.queryFactory(this);
        this.query = queryFactory.createQuery.bind(queryFactory);

        const factory = this.adapter.rawFactory(this);
        this.raw = factory.create.bind(factory);
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
    public getReference<T>(classType: ClassType<T> | ClassSchema<T>, primaryKey: any | PrimaryKeyFields<T>): T {
        const schema = getClassSchema(classType);
        const pk = getNormalizedPrimaryKey(schema, primaryKey);
        return getReference(schema, pk, this.identityMap);
    }

    protected getCurrentRound(): DatabaseSessionRound<ADAPTER> {
        if (!this.rounds.length) this.enterNewRound();

        return this.rounds[this.rounds.length - 1];
    }

    protected enterNewRound() {
        this.rounds.push(new DatabaseSessionRound(this, this.identityMap, this.unitOfWorkEmitter, this.logger));
    }

    /**
     * Adds a single or multiple to the to add/update queue. Use session.commit() to persist all queued items to the database.
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

    public reset() {
        this.commitDepth = 0;
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
        const classSchema = getClassSchema(classType);
        const pk = getPrimaryKeyExtractor(classSchema)(item);

        const itemDB = await this.query(classType).filter(pk).findOne();

        for (const property of classSchema.getProperties()) {
            if (property.isId) continue;
            if (property.isReference || property.backReference) continue;

            //we set only not overwritten values
            if (!item.hasOwnProperty(property.symbol)) {
                Object.defineProperty(item, property.symbol, {
                    enumerable: false,
                    configurable: true,
                    value: itemDB[property.name as keyof T]
                });
            }
        }

        markAsHydrated(item);
    }

    public async commit<T>() {
        if (!this.currentPersistence) {
            this.currentPersistence = this.adapter.createPersistence(this);
        }

        if (!this.rounds.length) {
            //we create a new round
            this.enterNewRound();
        }

        //make sure all stuff in the identity-map is known
        const round = this.getCurrentRound();
        for (const map of this.identityMap.registry.values()) {
            for (const item of map.values()) {
                round.add(item.ref);
            }
        }

        this.commitDepth++;

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
                this.commitDepth = 0;
                this.currentPersistence.release();
                this.currentPersistence = undefined;
                throw error;
            }
        }

        if (this.commitDepth - 1 === 0) {
            this.currentPersistence.release();
            this.currentPersistence = undefined;
            this.rounds = [];
        }

        this.commitDepth--;
    }
}
