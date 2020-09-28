import {AsyncEmitterEvent, AsyncEventEmitter, ClassType} from '@deepkit/core';
import {ClassSchema, PrimaryKeyFields} from '@deepkit/type';
import {DatabasePersistenceChangeSet} from './database';
import {DatabaseSession} from './database-session';
import {Changes} from './changes';
import {DeleteResult, PatchResult} from './type';

export class UnitOfWorkEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly items: T[]
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is UnitOfWorkEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class UnitOfWorkUpdateEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly changeSets: DatabasePersistenceChangeSet<T>[]
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is UnitOfWorkUpdateEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
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
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly deleteResult: DeleteResult<T>
    ) {
        super()
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabasePatchEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly patch: Changes<T>,
        public readonly patchResult: PatchResult<T>
    ) {
        super()
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabasePatchEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabaseUpdateEvent<T> extends AsyncEmitterEvent {
    public updated?: boolean;

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public readonly primaryKey: PrimaryKeyFields<T>,
        public readonly item: T,
    ) {
        super()
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabaseUpdateEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
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
