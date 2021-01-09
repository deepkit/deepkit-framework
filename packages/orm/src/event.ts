/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {AsyncEmitterEvent, AsyncEventEmitter, ClassType} from '@deepkit/core';
import {ClassSchema, ExtractPrimaryKeyType, PrimaryKey} from '@deepkit/type';
import {DatabasePersistenceChangeSet} from './database';
import {DatabaseSession} from './database-session';
import {Changes} from './changes';
import {DeleteResult, PatchResult} from './type';
import { GenericQuery } from './query';

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
        public query: GenericQuery<T>
    ) {
        super()
    }

    isSchemaOf<T>(classTypeOrSchema: ClassType<T> | ClassSchema<T>): this is QueryDatabaseDeleteEvent<T> {
        return this.classSchema.isSchemaOf(classTypeOrSchema);
    }
}

export class QueryDatabaseDeleteEvent<T> extends AsyncEmitterEvent {
    constructor(
        public readonly databaseSession: DatabaseSession<any>,
        public readonly classSchema: ClassSchema<T>,
        public query: GenericQuery<T>,
        public readonly deleteResult: DeleteResult<T>
    ) {
        super()
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
        public query: GenericQuery<T>,
        public readonly patch: Changes<T>,
        public readonly patchResult: PatchResult<T>
    ) {
        super()
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
