import {DatabaseAdapter, DatabasePersistence} from "./database";
import {Entity} from "./query";
import {CustomError} from "@super-hornet/core";
import {ClassSchema, getClassSchema, getClassTypeFromInstance} from "@super-hornet/marshal";
import {GroupArraySort} from "@super-hornet/topsort";
import {EntityRegistry, getEntityState, PrimaryKey} from "./entity-registry";

let SESSION_IDS = 0;

export class DatabaseSessionRound<ADAPTER extends DatabaseAdapter> {
    protected addQueue = new Set<Entity>();
    protected removeQueue = new Set<Entity>();

    protected inCommit: boolean = false;
    protected committed: boolean = false;

    constructor(
        public readonly persistence: DatabasePersistence,
    ) {

    }

    public isInCommit() {
        return this.inCommit;
    }

    public isCommitted() {
        return this.committed;
    }

    public add<T extends Entity>(item: T, deep: boolean = true) {
        if (this.isInCommit()) throw new Error('Already in commit. Can not change queues.');

        if (this.addQueue.has(item)) return;

        this.addQueue.add(item);
        this.removeQueue.delete(item);

        if (deep) {
            for (const dep of this.getReferenceDependencies(item)) {
                this.add(dep, deep);
            }
        }
    }

    protected getReferenceDependencies<T extends Entity>(item: T): Entity[] {
        const result: Entity[] = [];
        const classSchema = getClassSchema(getClassTypeFromInstance(item));

        for (const reference of classSchema.references.values()) {
            //todo, check if join was populated. will throw otherwise
            const v = item[reference.name as keyof T] as any;
            if (!v) continue;
            if (reference.isArray) {
                result.push(...v);
                for (const item of v) this.add(item);
            } else {
                result.push(v);
            }
        }

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
        const map = new Map<ClassSchema<any>, PrimaryKey<any>[]>();
        for (const item of this.removeQueue.values()) {
            const classSchema = getClassSchema(getClassTypeFromInstance(item));
            let items = map.get(classSchema);
            if (!items) {
                items = [];
                map.set(classSchema, items);
            }
            items.push(item);
        }

        for (const [classSchema, items] of map.entries()) {
            await this.persistence.remove(classSchema, items);
            for (const item of items) {
                getEntityState(item).markAsDeleted();
            }
        }
    }

    protected async doPersist() {
        const sorter = new GroupArraySort<Entity, ClassSchema<any>>();
        sorter.sameTypeExtraGrouping = true;

        for (const item of this.addQueue.values()) {
            const classSchema = getClassSchema(getClassTypeFromInstance(item));
            sorter.add(item, classSchema, this.getReferenceDependencies(item));
        }

        sorter.sort();
        const groups = sorter.getGroups();

        for (const group of groups) {
            await this.persistence.persist(group.type, group.items);
        }
    }
}

export class SessionClosedException extends CustomError {
}

export class DatabaseSession<ADAPTER extends DatabaseAdapter> {
    public readonly id = SESSION_IDS++;
    public withEntityTracking = true;

    public readonly entityRegistry = new EntityRegistry();

    /**
     * Creates a new DatabaseQuery instance which can be used to query and manipulate data.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    protected rounds: DatabaseSessionRound<ADAPTER>[] = [];

    protected closed: boolean = false;

    protected commitDepth: number = 0;

    protected inCommit: boolean = false;

    public persistence = this.adapter.createPersistence(this);

    constructor(
        public readonly adapter: ADAPTER
    ) {
        const queryFactory = this.adapter.queryFactory(this);
        this.query = queryFactory.createQuery.bind(queryFactory);
    }

    protected getCurrentRound(): DatabaseSessionRound<ADAPTER> {
        if (!this.rounds.length) this.enterNewRound();

        return this.rounds[this.rounds.length - 1];
    }

    protected enterNewRound() {
        this.rounds.push(new DatabaseSessionRound(this.persistence));
    }

    public add<T>(item: T, deep: boolean = true) {
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

    public async commit<T>() {
        if (!this.rounds.length) return;

        if (this.closed) {
            throw new SessionClosedException(`Session is closed due to an exception. Repair its failure and call reset()/repaired() to open it again.`);
        }

        this.commitDepth++;

        //we need to iterate via for i, because hooks might add additional rounds dynamically
        for (let i = 0; i < this.rounds.length; i++) {
            const round = this.rounds[i];

            if (round.isCommitted() || round.isInCommit()) continue;

            try {
                await round.commit();
            } catch (error) {
                this.closed = true;
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
