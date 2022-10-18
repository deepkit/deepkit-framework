/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ControllerSymbol } from '@deepkit/rpc';
import { ChangesInterface, deserializeType, entity, ReflectionClass } from '@deepkit/type';
import { FakerTypes } from './faker.js';

export type DatabaseCommit = {
    [dbName: string]: {
        addedIds: { [entityName: string]: number[] },
        added: { [entityName: string]: any[] },
        removed: { [entityName: string]: { [pkName: string]: any }[] },
        changed: {
            [entityName: string]: {
                pk: { [pkName: string]: any },
                changes: ChangesInterface<any>
            }[]
        }
    }
}

@entity.name('orm-browser/database')
export class DatabaseInfo {
    constructor(
        public name: string,
        public adapter: string,
        public serializedTypes: any[] = []
    ) {
    }

    protected classSchemas?: ReflectionClass<any>[];

    getClassSchemas(): ReflectionClass<any>[] {
        if (!this.classSchemas) {
            this.classSchemas = this.serializedTypes.map(v => ReflectionClass.from(deserializeType(v)));
        }

        return this.classSchemas;
    }

    getEntity(name: string): ReflectionClass<any> {
        for (const schema of this.getClassSchemas()) {
            if (schema.getName() === name) return schema;
        }
        throw new Error(`No type for ${name} found`);
    }
}

@entity.name('orm-broser/migration/entity')
export class MigrationEntityInfo {
    constructor(public name: string) {
    }
}

@entity.name('orm-broser/migration')
export class MigrationInfo {
    entites: { [name: string]: MigrationEntityInfo } = {};
}

export type SeedResult = { function: string, example: any }[];

export type EntityPropertySeedReference = 'random' | 'random-seed' | 'create';

@entity.name('orm-browser/seed/property')
export class EntityPropertySeed {
    fake: boolean = false;
    reference: EntityPropertySeedReference = 'create';
    value?: any;
    array?: EntityPropertyArraySeed;
    map?: EntityPropertyMapSeed;
    faker: string = '';
    properties: { [name: string]: EntityPropertySeed } = {};

    constructor(public name: string = '') {
    }

    getArray(): EntityPropertyArraySeed {
        if (!this.array) this.array = new EntityPropertyArraySeed();
        return this.array;
    }

    getMap(): EntityPropertyMapSeed {
        if (!this.map) this.map = new EntityPropertyMapSeed();
        return this.map;
    }
}

@entity.name('orm-browser/seed/property/array')
export class EntityPropertyArraySeed {
    min: number = 1;
    max: number = 5;
    seed: EntityPropertySeed = new EntityPropertySeed;
}

@entity.name('orm-browser/seed/property/map')
export class EntityPropertyMapSeed {
    key: { fake: boolean, faker: string } = { fake: true, faker: 'random.word' };
    min: number = 1;
    max: number = 5;
    seed: EntityPropertySeed = new EntityPropertySeed();
}

@entity.name('orm-browser/seed/entity')
export class EntitySeed {
    truncate: boolean = true;
    active: boolean = false;
    amount: number = 1000;

    properties: { [name: string]: EntityPropertySeed } = {};
}

@entity.name('orm-browser/seed/database')
export class SeedDatabase {
    entities: { [name: string]: EntitySeed } = {};
}

export type QueryResult = { error?: string, log: string[], executionTime: number, result: any };

export const BrowserControllerInterface = ControllerSymbol<BrowserControllerInterface>('orm-browser/controller', [DatabaseInfo]);

export interface BrowserControllerInterface {
    getDatabases(): DatabaseInfo[];

    resetAllTables(name: string): Promise<void>;

    seed(dbName: string, seed: SeedDatabase): Promise<void>;

    migrate(name: string): Promise<void>;

    getMigrations(name: string): Promise<{ [name: string]: { sql: string[], diff: string } }>;

    getFakerTypes(): Promise<FakerTypes>;

    getDatabase(name: string): DatabaseInfo;

    query(dbName: string, entityName: string, query: string): Promise<QueryResult>;

    getItems(dbName: string, entityName: string, filter: { [name: string]: any }, sort: { [name: string]: any }, limit: number, skip: number): Promise<{ items: any[], executionTime: number }>;

    getCount(dbName: string, entityName: string, filter: { [name: string]: any }): Promise<number>;

    create(dbName: string, entityName: string): Promise<any>;

    commit(commit: DatabaseCommit): Promise<any>;
}
