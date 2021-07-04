/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Entity } from './type';
import { AbstractClassType } from '@deepkit/core';
import { ClassSchema, ItemChanges, PrimaryKeyFields } from '@deepkit/type';
import { Query } from './query';
import { DatabaseSession } from './database-session';

export abstract class DatabaseAdapterQueryFactory {
    abstract createQuery<T extends Entity>(classType: AbstractClassType<T> | ClassSchema<T>): Query<T>;
}

export interface DatabasePersistenceChangeSet<T> {
    changes: ItemChanges<T>;
    item: T;
    primaryKey: PrimaryKeyFields<T>;
}

export abstract class DatabasePersistence {
    abstract remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void>;

    abstract update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void>;

    /**
     * When DatabasePersistence instance is not used anymore, this function will be called.
     * Good place to release a connection for example.
     */
    abstract release(): void;
}

export class RawFactory<A extends Array<any>> {
    create(...args: A): any {
        throw new Error(`Current database adapter does not support raw mode.`);
    }
}

/**
 * A generic database adapter you can use if the API of `Query` is sufficient.
 *
 * You can specify a more specialized adapter like MysqlDatabaseAdapter/MongoDatabaseAdapter with special API for MySQL/Mongo.
 */
export abstract class DatabaseAdapter {
    abstract queryFactory(session: DatabaseSession<this>): DatabaseAdapterQueryFactory;

    rawFactory(session: DatabaseSession<this>): RawFactory<any> {
        return new RawFactory();
    };

    abstract createPersistence(session: DatabaseSession<this>): DatabasePersistence;

    abstract disconnect(force?: boolean): void;

    abstract migrate(classSchemas: ClassSchema[]): Promise<void>;

    abstract getName(): string;

    abstract getSchemaName(): string;

    abstract isNativeForeignKeyConstraintSupported(): boolean;
}
