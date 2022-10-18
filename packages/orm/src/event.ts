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
import { BaseEvent } from '@deepkit/event';
import type { Changes } from '@deepkit/type';
import { PrimaryKeyType, ReflectionClass } from '@deepkit/type';
import type { DatabasePersistenceChangeSet } from './database-adapter.js';
import type { DatabaseSession } from './database-session.js';
import type { Query } from './query.js';
import type { DeleteResult, PatchResult } from './type.js';

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
        public readonly databaseSession: DatabaseSession<any>
    ) {
        super();
    }
}

export class UnitOfWorkEvent<T> extends DatabaseEvent {
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

export class UnitOfWorkUpdateEvent<T extends object> extends DatabaseEvent {
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

export class QueryDatabaseEvent<T> extends DatabaseEvent {
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

export class QueryDatabaseDeleteEvent<T> extends DatabaseEvent {
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

export class QueryDatabasePatchEvent<T extends object> extends DatabaseEvent {
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
