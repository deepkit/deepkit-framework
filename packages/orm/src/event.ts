import {AsyncEmitterEvent, AsyncEventEmitter} from '@deepkit/core';
import {ClassSchema} from '@deepkit/type';
import {DatabasePersistenceChangeSet} from './database';
import {PrimaryKey} from './identity-map';
import {DatabaseSession} from './database-session';

export class UnitOfWorkEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly items: T[]
    ) {
        super();
    }
}

export class UnitOfWorkUpdateEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly changeSets: DatabasePersistenceChangeSet<T>[]
    ) {
        super();
    }
}

export class UnitOfWorkDatabaseEmitter {
    public readonly onUpdatePre: AsyncEventEmitter<UnitOfWorkUpdateEvent<any>> = new AsyncEventEmitter(this.parent?.onUpdatePre);
    public readonly onUpdatePost: AsyncEventEmitter<UnitOfWorkUpdateEvent<any>> = new AsyncEventEmitter(this.parent?.onUpdatePost);

    public readonly onInsertPre: AsyncEventEmitter<UnitOfWorkEvent<any>> = new AsyncEventEmitter(this.parent?.onInsertPre);
    public readonly onInsertPost: AsyncEventEmitter<UnitOfWorkEvent<any>> = new AsyncEventEmitter(this.parent?.onInsertPost);

    public readonly onDeletePre: AsyncEventEmitter<UnitOfWorkEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePre);
    public readonly onDeletePost: AsyncEventEmitter<UnitOfWorkEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePost);

    constructor(protected parent?: UnitOfWorkDatabaseEmitter) {
    }

    fork() {
        return new UnitOfWorkDatabaseEmitter(this);
    }
}

export class QueryDatabaseDeleteEvent<T> extends AsyncEmitterEvent {
    public deleted?: number;

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly primaryKeys: PrimaryKey<T>[]
    ) {
        super()
    }
}

export class QueryDatabasePatchEvent<T> extends AsyncEmitterEvent {
    public updated?: number;

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly primaryKeys: PrimaryKey<T>[],
        public readonly patch: Partial<T>,
    ) {
        super()
    }
}

export class QueryDatabaseUpdateEvent<T> extends AsyncEmitterEvent {
    public updated?: boolean;

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly primaryKey: PrimaryKey<T>,
        public readonly item: T,
    ) {
        super()
    }
}

export class QueryDatabaseEmitter {
    public readonly onDeletePre: AsyncEventEmitter<QueryDatabaseDeleteEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePre);
    public readonly onDeletePost: AsyncEventEmitter<QueryDatabaseDeleteEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePost);

    public readonly onUpdatePre: AsyncEventEmitter<QueryDatabaseUpdateEvent<any>> = new AsyncEventEmitter(this.parent?.onUpdatePre);
    public readonly onUpdatePost: AsyncEventEmitter<QueryDatabaseUpdateEvent<any>> = new AsyncEventEmitter(this.parent?.onUpdatePost);

    public readonly onPatchPre: AsyncEventEmitter<QueryDatabasePatchEvent<any>> = new AsyncEventEmitter(this.parent?.onPatchPre);
    public readonly onPatchPost: AsyncEventEmitter<QueryDatabasePatchEvent<any>> = new AsyncEventEmitter(this.parent?.onPatchPost);

    constructor(protected parent?: QueryDatabaseEmitter) {
    }

    fork() {
        return new QueryDatabaseEmitter(this);
    }
}
