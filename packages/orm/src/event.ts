/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AsyncEmitterEvent, AsyncEventEmitter, ClassType } from '@deepkit/core';
import type { Changes, ClassSchema, ExtractPrimaryKeyType } from '@deepkit/type';
import type { DatabasePersistenceChangeSet } from './database-adapter';
import type { DatabaseSession } from './database-session';
import type { Query } from './query';
import type { DeleteResult, PatchResult } from './type';

export class UnitOfWorkCommitEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>
    ) {
        super();
    }
}

export class UnitOfWorkEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly items: T[]
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is UnitOfWorkEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }

    getPrimaryKeys(): ExtractPrimaryKeyType<T>[] {
        const ids: ExtractPrimaryKeyType<T>[] = [];
        const primaryKeyField = this.classSchema.getPrimaryFieldName();
        for (const item of this.items) {
            ids.push(item[primaryKeyField] as any);
        }
        return ids;
    }
}

export class UnitOfWorkUpdateEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ClassSchema<T>,
        public readonly databaseSession: DatabaseSession<any>,
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

    public readonly onCommitPre: AsyncEventEmitter<UnitOfWorkCommitEvent<any>> = new AsyncEventEmitter(this.parent?.onCommitPre);

    constructor(protected parent?: UnitOfWorkDatabaseEmitter) {
    }

    fork() {
        return new UnitOfWorkDatabaseEmitter(this);
    }
}

export class QueryDatabaseEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public query: Query<T>
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabaseDeleteEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public query: Query<T>,
        public readonly deleteResult: DeleteResult<T>
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabasePatchEvent<T> extends AsyncEmitterEvent {
    public returning: (keyof T & string)[] = [];

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public query: Query<T>,
        public readonly patch: Changes<T>,
        public readonly patchResult: PatchResult<T>
    ) {
        super();
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabasePatchEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabaseEmitter {
    /**
     * For all queries related to fetching data like: find, findOne, count, has.
     */
    public readonly onFetch: AsyncEventEmitter<QueryDatabaseEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePre);

    public readonly onDeletePre: AsyncEventEmitter<QueryDatabaseDeleteEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePre);
    public readonly onDeletePost: AsyncEventEmitter<QueryDatabaseDeleteEvent<any>> = new AsyncEventEmitter(this.parent?.onDeletePost);

    public readonly onPatchPre: AsyncEventEmitter<QueryDatabasePatchEvent<any>> = new AsyncEventEmitter(this.parent?.onPatchPre);
    public readonly onPatchPost: AsyncEventEmitter<QueryDatabasePatchEvent<any>> = new AsyncEventEmitter(this.parent?.onPatchPost);

    constructor(protected parent?: QueryDatabaseEmitter) {
    }

    fork() {
        return new QueryDatabaseEmitter(this);
    }
}
