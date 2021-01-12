/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { getClassName } from '@deepkit/core';
import { getClassSchema, PrimaryKeyFields } from '@deepkit/type';
import { Database } from './database';
import { GenericQuery } from './query';

export interface ActiveRecordType {
    new(...args: any[]): ActiveRecord;

    getDatabase(): Database<any>;

    registerDatabase(database: Database<any>): void;

    query(): any;
}

export function isActiveRecordType(entity: any): entity is ActiveRecordType {
    return 'function' === entity.getDatabase || 'function' === entity.registerDatabase || 'function' === entity.query;
}

export class ActiveRecord {
    constructor(...args: any[]) { }

    public static getDatabase(): Database<any> {
        const database = getClassSchema(this).data['orm.database'] as Database<any> | undefined;
        if (!database) throw new Error(`No database assigned to ${getClassName(this)}. Use Database.registerEntity(${getClassName(this)}) first.`);
        return database;
    }

    public static registerDatabase(database: Database<any>): void {
        getClassSchema(this).data['orm.database'] = database;
    }

    public async save(): Promise<void> {
        const db = ((this as any).constructor as ActiveRecordType).getDatabase();
        await db.persist(this);
    }

    public async remove(): Promise<void> {
        const db = ((this as any).constructor as ActiveRecordType).getDatabase();
        await db.remove(this);
    }

    public static query<T extends typeof ActiveRecord>(this: T): GenericQuery<InstanceType<T>> {
        return this.getDatabase().query(this);
    }

    public static reference<T extends typeof ActiveRecord>(this: T, primaryKey: any | PrimaryKeyFields<InstanceType<T>>): InstanceType<T> {
        return this.getDatabase().getReference(this, primaryKey) as InstanceType<T>;
    }
}
