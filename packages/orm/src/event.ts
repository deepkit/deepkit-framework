/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { BaseEvent, EventToken } from '@deepkit/event';
import type { Changes } from '@deepkit/type';
import { PrimaryKeyType, ReflectionClass } from '@deepkit/type';
import type { DatabasePersistenceChangeSet } from './database-adapter.js';
import type { DatabaseSession } from './database-session.js';
import type { DeleteResult, PatchResult } from './type.js';
import { OrmEntity } from './type.js';
import { SelectorState } from './select.js';

export class ItemNotFound extends Error {
}

export class DatabaseEvent extends BaseEvent {
    stopped = false;

    stop() {
        this.stopped = true;
    }

    isStopped() {
        return this.stopped;
    }
}

export class UnitOfWorkCommitEvent<T> extends DatabaseEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
    ) {
        super();
    }
}

export class UnitOfWorkEvent<T> extends DatabaseEvent {
    constructor(
        public readonly classSchema: ReflectionClass<T>,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly items: T[],
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

export class UnitOfWorkUpdateEvent<T extends object> extends DatabaseEvent {
    constructor(
        public readonly classSchema: ReflectionClass<T>,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly changeSets: DatabasePersistenceChangeSet<T>[],
    ) {
        super();
    }

    isSchemaOf<T extends object>(classType: ClassType<T>): this is UnitOfWorkUpdateEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export class QueryDatabaseEvent<T extends OrmEntity> extends DatabaseEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ReflectionClass<T>,
        public readonly query: SelectorState,
    ) {
        super();
    }

    isSchemaOf<T extends OrmEntity>(classType: ClassType<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export class DatabaseErrorEvent extends DatabaseEvent {
    constructor(
        public readonly error: Error,
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema?: ReflectionClass<any>,
        public readonly query?: SelectorState,
    ) {
        super();
    }
}

/**
 * Error event emitted when unit of work commit failed inserting new items.
 */
export class DatabaseErrorInsertEvent extends DatabaseErrorEvent {
    inserts: OrmEntity[] = [];
}

/**
 * Error event emitted when unit of work commit failed updating existing items.
 */
export class DatabaseErrorUpdateEvent extends DatabaseErrorEvent {
    changeSets: DatabasePersistenceChangeSet<OrmEntity>[] = [];
}

/**
 * This event is emitted when an error occurs in async database operation, like query, commit, connect, etc.
 * In event.databaseSession.adapter you can access the adapter that caused the error.
 * In event.error you can access the caught error.
 * In event.classSchema and event.query you might find additional context, but not necessarily.
 */
export const onDatabaseError = new EventToken<DatabaseErrorEvent>('database.error');

export class QueryDatabaseDeleteEvent<T extends OrmEntity> extends DatabaseEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ReflectionClass<T>,
        public readonly query: SelectorState,
        public readonly deleteResult: DeleteResult<T>,
    ) {
        super();
    }

    isSchemaOf<T extends OrmEntity>(classType: ClassType<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export class QueryDatabasePatchEvent<T extends object> extends DatabaseEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ReflectionClass<T>,
        public readonly query: SelectorState,
        public readonly patch: Changes<T>,
        public readonly patchResult: PatchResult<T>,
    ) {
        super();
    }

    isSchemaOf<T extends object>(classType: ClassType<T>): this is QueryDatabasePatchEvent<T> {
        return this.classSchema.isSchemaOf(classType);
    }
}

export const onFind: EventToken<QueryDatabaseEvent<any>> = new EventToken('orm.select.find');

export const onDeletePre: EventToken<QueryDatabaseDeleteEvent<any>> = new EventToken('orm.select.delete.pre');
export const onDeletePost: EventToken<QueryDatabaseDeleteEvent<any>> = new EventToken('orm.select.delete.post');

export const onPatchPre: EventToken<QueryDatabasePatchEvent<any>> = new EventToken('orm.select.patch.pre');
export const onPatchPost: EventToken<QueryDatabasePatchEvent<any>> = new EventToken('orm.select.patch.post');
