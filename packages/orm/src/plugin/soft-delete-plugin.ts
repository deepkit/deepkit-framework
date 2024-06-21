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
import { EventDispatcherUnsubscribe } from '@deepkit/event';
import { DatabaseSession } from '../database-session.js';
import { Database } from '../database.js';
import { DatabaseAdapter } from '../database-adapter.js';
import { OrmEntity } from '../type.js';
import { ReflectionClass } from '@deepkit/type';
import { DatabasePlugin } from './plugin.js';
import { onDeletePre, onFind, onPatchPre } from '../event.js';
import { applySelect, currentState, eq, notEqual, Select, SelectorState, where } from '../select.js';

interface SoftDeleteEntity extends OrmEntity {
    deletedAt?: Date;
    deletedBy?: any;
}

const deletedAtName = 'deletedAt';

export class SoftDeleteSession {
    protected deletedBy = new Map<ReflectionClass<any>, any>();
    protected restoreItems: SoftDeleteEntity[] = [];

    constructor(protected session: DatabaseSession<any>) {
        session.eventDispatcher.listen(DatabaseSession.onDeletePre, event => {
            const deletedBy = this.deletedBy.get(event.classSchema);
            if (!deletedBy) return;
            for (const item of event.items) {
                item.deletedBy = deletedBy;
            }
        });

        session.eventDispatcher.listen(DatabaseSession.onCommitPre, event => {
            for (const item of this.restoreItems) {
                item.deletedAt = undefined;
                item.deletedBy = undefined;
            }

            event.databaseSession.add(...this.restoreItems);
            this.restoreItems.length = 0;
        });
    }

    setDeletedBy<T extends SoftDeleteEntity>(classType: ClassType<T> | ReflectionClass<T>, deletedBy: T['deletedBy']): this {
        this.deletedBy.set(ReflectionClass.from(classType), deletedBy);
        return this;
    }

    restore<T extends SoftDeleteEntity>(item: T): this {
        this.restoreItems.push(item);
        return this;
    }
}

interface SoftDeleteData {
    includeSoftDeleted?: boolean;
    // softDeleteIncludeHardDelete?: boolean;
    deletedBy?: any;
    enableHardDelete?: boolean;
}

function getSoftDeleteData(state: SelectorState): SoftDeleteData {
    return state.data.softDelete ||= {};
}

/**
 * Includes soft=deleted records additional to the normal records.
 */
export function includeSoftDeleted() {
    getSoftDeleteData(currentState()).includeSoftDeleted = true;
}

/**
 * Includes only soft-deleted records. (normal records are excluded)
 */
export function includeOnlySoftDeleted(model: Select<{ deletedAt: Date }>) {
    includeSoftDeleted();
    where(notEqual(model.deletedAt, undefined));
}

export function setDeletedBy(deletedBy: string) {
    getSoftDeleteData(currentState()).deletedBy = deletedBy;
}

//todo: how to handle this?
export function restoreOne() {
}

export function restoreMany() {
}

export function enableHardDelete() {
    getSoftDeleteData(currentState()).enableHardDelete = true;
}

export class SoftDeletePlugin implements DatabasePlugin {
    protected listeners = new Map<ReflectionClass<any>, {
        queryFetch: EventDispatcherUnsubscribe, queryPatch: EventDispatcherUnsubscribe,
        queryDelete: EventDispatcherUnsubscribe, uowDelete: EventDispatcherUnsubscribe
    }>();

    protected database?: Database<DatabaseAdapter>;

    onRegister(database: Database<any>): void {
        this.database = database;
        for (const type of database.entityRegistry.all()) this.enableForSchema(type);
    }

    enable<T extends SoftDeleteEntity>(...classSchemaOrTypes: (ReflectionClass<T> | ClassType<T>)[]) {
        for (const type of classSchemaOrTypes) this.enableForSchema(type);
    }

    disable(...classSchemaOrTypes: (ReflectionClass<any> | ClassType)[]) {
        for (const type of classSchemaOrTypes) this.disableForSchema(type);
    }

    protected disableForSchema(classSchemaOrType: ReflectionClass<any> | ClassType) {
        const schema = ReflectionClass.from(classSchemaOrType);
        const listener = this.listeners.get(schema);
        if (listener) {
            listener.queryFetch();
            listener.queryPatch();
            listener.queryDelete();
            listener.uowDelete();
            this.listeners.delete(schema);
        }
    }

    protected getDatabase(): Database<any> {
        if (!this.database) throw new Error('Plugin not registered yet');
        return this.database;
    }

    protected enableForSchema<T extends SoftDeleteEntity>(classSchemaOrType: ReflectionClass<T> | ClassType<T>) {
        const schema = ReflectionClass.from(classSchemaOrType);
        const hasDeletedBy = schema.hasProperty('deletedBy');

        if (!schema.hasProperty(deletedAtName)) {
            throw new Error(`Entity ${schema.getClassName()} has no ${deletedAtName} property. Please define one as type '${deletedAtName}: t.date.optional'`);
        }

        function queryFilter(event: { classSchema: ReflectionClass<any>, query: any }) {
            //this is for each query method: count, find, findOne(), etc.

            //when includeSoftDeleted is set, we don't want to filter out the deleted records
            if (getSoftDeleteData(event.query).includeSoftDeleted) return;

            if (event.classSchema !== schema) return; //do nothing

            //attach the filter to exclude deleted records
            applySelect(event.query, (q: Select<{ [deletedAtName]: any }>) => {
                where(eq(q[deletedAtName], undefined));
            });
            event.query = event.query.filterField(deletedAtName, undefined);
        }

        const queryFetch = this.getDatabase().listen(onFind, queryFilter);
        const queryPatch = this.getDatabase().listen(onPatchPre, queryFilter);

        const queryDelete = this.getDatabase().listen(onDeletePre, async event => {
            if (event.classSchema !== schema) return; //do nothing

            //when includeSoftDeleted is set, we don't want to filter out the deleted records
            if (getSoftDeleteData(event.query).includeSoftDeleted) return;

            //stop actual query delete query
            event.stop();

            const patch = { [deletedAtName]: new Date } as Partial<T>;
            const deletedBy = getSoftDeleteData(event.query).deletedBy;
            if (hasDeletedBy && deletedBy !== undefined) {
                patch.deletedBy = deletedBy;
            }

            await event.databaseSession.query2(event.query).patchMany(patch);
        });

        const uowDelete = this.getDatabase().listen(DatabaseSession.onDeletePre, async event => {
            if (event.classSchema !== schema) return; //do nothing

            //stop actual query delete query
            event.stop();

            //instead of removing, we move it into the current session (creating a new SessionRound)
            //to let the current commit know we want to rather update it, instead of deleting.
            for (const item of event.items) {
                item[deletedAtName] = new Date;
            }

            //this creates a new SessionRound, and commits automatically once the current is done (in the same transaction).
            event.databaseSession.add(...event.items);
        });

        this.listeners.set(schema, { queryFetch, queryPatch, queryDelete, uowDelete });
    }
}
