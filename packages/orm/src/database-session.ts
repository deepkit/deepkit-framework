import {DatabaseAdapter, DatabasePersistence} from './database';
import {Entity} from './query';
import {ClassType, CustomError} from '@deepkit/core';
import {ClassSchema, getClassSchema, getClassTypeFromInstance, getGlobalStore, GlobalStore, isArray} from '@deepkit/type';
import {GroupArraySort} from '@deepkit/topsort';
import {getNormalizedPrimaryKey, IdentityMap, PrimaryKey} from './identity-map';
import {getClassSchemaInstancePairs} from './utils';
import {HydratorFn, markAsHydrated} from './formatter';
import {getPrimaryKeyExtractor} from './converter';
import {getReference} from './reference';

let SESSION_IDS = 0;

export class DatabaseSessionRound<ADAPTER extends DatabaseAdapter> {
    protected addQueue = new Set<Entity>();
    protected removeQueue = new Set<Entity>();

    protected inCommit: boolean = false;
    protected committed: boolean = false;
    protected global: GlobalStore = getGlobalStore();

    constructor(
        protected identityMap: IdentityMap,
        public readonly persistence: DatabasePersistence,
    ) {

    }

    public isInCommit() {
        return this.inCommit;
    }

    public isCommitted() {
        return this.committed;
    }

    public add<T extends Entity>(item: T | T[], deep: boolean = true): void {
        if (this.isInCommit()) throw new Error('Already in commit. Can not change queues.');

        if (isArray(item)) {
            item.map(v => this.add(v));
            return;
        }

        if (this.removeQueue.has(item)) return;
        if (this.addQueue.has(item)) return;

        this.addQueue.add(item);

        if (deep) {
            for (const dep of this.getReferenceDependencies(item)) {
                this.add(dep, deep);
            }
        }
    }

    protected getReferenceDependencies<T extends Entity>(item: T): Entity[] {
        const result: Entity[] = [];
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        const old = this.global.unpopulatedCheckActive;
        this.global.unpopulatedCheckActive = false;
        for (const reference of classSchema.references.values()) {
            //todo, check if join was populated. will throw otherwise
            const v = item[reference.name as keyof T] as any;
            if (!v) continue;
            if (reference.isArray) {
                result.push(...v);
            } else {
                result.push(v);
            }
        }
        this.global.unpopulatedCheckActive = old;

        return result;
    }

    public remove<T extends Entity>(item: T) {
        if (this.isInCommit()) throw new Error('Already in commit. Can not change queues.');

        //todo: check if already deleted
        //todo: check if new Entity() has persisted (use WeakMap for that)

        this.removeQueue.add(item);
        this.addQueue.delete(item);
    }

    public async commit() {
        if (!this.removeQueue.size && !this.addQueue.size) return;

        this.inCommit = true;

        try {
            await this.doDelete();
            await this.doPersist();
            this.committed = true;
        } finally {
            this.inCommit = false;
        }
    }

    protected async doDelete() {
        for (const [classSchema, items] of getClassSchemaInstancePairs(this.removeQueue.values())) {
            await this.persistence.remove(classSchema, items);
            this.identityMap.deleteMany(classSchema, items);
        }
    }

    protected async doPersist() {
        const sorter = new GroupArraySort<Entity, ClassSchema<any>>();
        sorter.sameTypeExtraGrouping = true;

        // const start = performance.now();
        for (const item of this.addQueue.values()) {
            const classSchema = getClassSchema(getClassTypeFromInstance(item));
            sorter.add(item, classSchema, this.getReferenceDependencies(item));
        }

        sorter.sort();
        const groups = sorter.getGroups();
        // console.log('dependency resolution of', items.length, 'items took', performance.now() - start, 'ms');

        for (const group of groups) {
            await this.persistence.persist(group.type, group.items);
            this.identityMap.storeMany(group.type, group.items);
        }
    }
}

export class SessionClosedException extends CustomError {
}

export class DatabaseSessionImmediate {
    constructor(
        protected identityMap: IdentityMap,
        protected persistence: DatabasePersistence
    ) {
    }

    /**
     * Simple direct persist. The persistence layer (batch) inserts or updates the record
     * depending on the state of the given items. This is different to add() in a way
     * that `add` adds the given items to the queue (which is then committed using commit())
     * and immediate.persist just simply inserts/updates the given items immediately, completely bypassing
     * the unit of work.
     *
     * You should prefer the add/remove & commit() workflow to fully utilizing database performance.
     */
    public async persist<T extends Entity>(...items: T[]) {
        for (const [classSchema, groupItems] of getClassSchemaInstancePairs(items)) {
            await this.persistence.persist(classSchema, groupItems);
            for (const item of groupItems) {
                this.identityMap.store(classSchema, item);
            }
        }
    }

    /**
     * Simple direct remove. The persistence layer (batch) removes all given items.
     * This is different to remove() in a way that `remove`` adds the given items to the queue
     * (which is then committed using commit()) and immediate.remove just simply removes the given items immediately,
     * completely bypassing the unit of work.
     *
     * You should prefer the add/remove & commit() workflow to fully utilizing database performance.
     */
    public async remove<T extends Entity>(...items: T[]) {
        for (const [classSchema, groupItems] of getClassSchemaInstancePairs(items)) {
            await this.persistence.remove(classSchema, groupItems);
            this.identityMap.deleteMany(classSchema, groupItems);
        }
    }
}

export class DatabaseSession<ADAPTER extends DatabaseAdapter> {
    public readonly id = SESSION_IDS++;
    public withIdentityMap = true;

    public readonly identityMap = new IdentityMap();

    /**
     * Creates a new DatabaseQuery instance which can be used to query and manipulate data.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    protected rounds: DatabaseSessionRound<ADAPTER>[] = [];

    protected commitDepth: number = 0;

    protected inCommit: boolean = false;

    protected persistence = this.adapter.createPersistence(this);

    /**
     * Immediate operations without unit of work. Its faster for few operations, and slower for many operations.
     */
    public readonly immediate = new DatabaseSessionImmediate(this.identityMap, this.persistence);

    constructor(
        public readonly adapter: ADAPTER
    ) {
        const queryFactory = this.adapter.queryFactory(this);
        this.query = queryFactory.createQuery.bind(queryFactory);
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
     * const user = database.getReference(User, 1);
     * ```
     */
    public getReference<T>(classType: ClassType<T> | ClassSchema<T>, primaryKey: any | PrimaryKey<T>): T {
        const schema = getClassSchema(classType);
        const pk = getNormalizedPrimaryKey(schema, primaryKey);
        return getReference(schema, pk, this.identityMap);
    }

    protected getCurrentRound(): DatabaseSessionRound<ADAPTER> {
        if (!this.rounds.length) this.enterNewRound();

        return this.rounds[this.rounds.length - 1];
    }

    protected enterNewRound() {
        this.rounds.push(new DatabaseSessionRound(this.identityMap, this.persistence));
    }

    public add<T>(item: T | T[], deep: boolean = true): void {
        if (this.getCurrentRound().isInCommit()) {
            this.enterNewRound();
        }

        this.getCurrentRound().add(item, deep);
    }

    public remove<T>(item: T) {
        if (this.getCurrentRound().isInCommit()) {
            this.enterNewRound();
        }

        this.getCurrentRound().remove(item);
    }

    public reset() {
        this.commitDepth = 0;
        this.inCommit = false;
        this.rounds = [];
    }

    public rollback() {
        //todo: implement
    }

    public getHydrator(): HydratorFn {
        return this.hydrateEntity.bind(this);
    }

    public async hydrateEntity<T extends object>(item: T) {
        const classType = getClassTypeFromInstance(item);
        const classSchema = getClassSchema(classType);
        const pk = getPrimaryKeyExtractor(classSchema)(item);

        const itemDB = await this.query(classType).filter(pk).findOne();

        for (const property of classSchema.getClassProperties().values()) {
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

        //we need to iterate via for i, because hooks might add additional rounds dynamically
        for (let i = 0; i < this.rounds.length; i++) {
            const round = this.rounds[i];

            if (round.isCommitted() || round.isInCommit()) continue;

            try {
                await round.commit();
            } catch (error) {
                this.rounds = [];
                this.commitDepth = 0;
                throw error;
            }
        }

        if (this.commitDepth - 1 === 0) {
            this.rounds = [];
        }

        this.commitDepth--;
    }
}
