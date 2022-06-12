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
import type { Changes } from '@deepkit/type';
import { PrimaryKeyType, ReflectionClass } from '@deepkit/type';
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
        public readonly classSchema: ReflectionClass<T>,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly items: T[]
    ) {
        super();
    }

    isSchemaOf<T>(classType: ClassType<T>): this is UnitOfWorkEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }

    getPrimaryKeys(): PrimaryKeyType<T>[] {
        const ids: PrimaryKeyType<T>[] = [];
        const primaryKeyField = this.classSchema.getPrimary();
        for (const item of this.items) {
            ids.push(item[primaryKeyField.getNameAsString() as keyof T] as any);
        }
        return ids;
    }
}

export class UnitOfWorkUpdateEvent<T extends object> extends AsyncEmitterEvent {
    constructor(
        public readonly classSchema: ReflectionClass<T>,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly changeSets: DatabasePersistenceChangeSet<T>[]
    ) {
        super();
    }

    isSchemaOf<T extends object>(classType: ClassType<T>): this is UnitOfWorkUpdateEvent<T> {
        return this.classSchema.isSchemaOf(classType);
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
        public readonly classSchema: ReflectionClass<T>,
        public query: Query<T>
    ) {
        super();
    }

    isSchemaOf<T>(classType: ClassType<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export class QueryDatabaseDeleteEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ReflectionClass<T>,
        public query: Query<T>,
        public readonly deleteResult: DeleteResult<T>
    ) {
        super();
    }

    isSchemaOf<T>(classType: ClassType<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export class QueryDatabasePatchEvent<T extends object> extends AsyncEmitterEvent {
    public returning: (keyof T & string)[] = [];

    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ReflectionClass<T>,
        public query: Query<T>,
        public readonly patch: Changes<T>,
        public readonly patchResult: PatchResult<T>
    ) {
        super();
    }

    isSchemaOf<T extends object>(classType: ClassType<T>): this is QueryDatabasePatchEvent<T> {
        return this.classSchema.isSchemaOf(classType);
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
