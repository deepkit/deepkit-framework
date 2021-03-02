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
import { ChangesInterface, ClassSchema, deserializeSchemas, entity, SerializedSchema, serializedSchemaDefinition, t } from '@deepkit/type';
import { FakerTypes } from './faker';
import { Forward } from '@deepkit/core';

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
        @t.name('name') public name: string,
        @t.name('adapter') public adapter: string,
        @t.array(serializedSchemaDefinition).name('serializedSchemas') public serializedSchemas: SerializedSchema[] = []
    ) {
    }

    protected classSchemas?: ClassSchema[];

    getClassSchemas(): ClassSchema[] {
        if (!this.classSchemas) {
            this.classSchemas = deserializeSchemas(this.serializedSchemas, '@orm-browser/' + this.name + '/');
        }

        return this.classSchemas;
    }

    getEntity(name: string): ClassSchema {
        for (const schema of this.getClassSchemas()) {
            if (schema.name === name) return schema;
        }
        throw new Error(`No schema for ${name} found`);
    }
}

@entity.name('orm-broser/migration/entity')
export class MigrationEntityInfo {
    constructor(
        @t.name('name') public name: string,
    ) {
    }
}

@entity.name('orm-broser/migration')
export class MigrationInfo {
    @t.map(MigrationEntityInfo) entites: { [name: string]: MigrationEntityInfo } = {};
}

export type SeedResult = { function: string, example: any }[];


export type EntityPropertySeedReference = 'random' | 'random-seed' | 'create';

@entity.name('orm-browser/seed/property')
export class EntityPropertySeed {
    @t fake: boolean = false;
    @t.string reference: EntityPropertySeedReference = 'create';
    @t.any value?: any;
    @t.type(() => EntityPropertyArraySeed).optional array?: Forward<EntityPropertyArraySeed>;
    @t.type(() => EntityPropertyMapSeed).optional map?: Forward<EntityPropertyMapSeed>;
    @t.any faker: string = '';
    @t.map(EntityPropertySeed) properties: { [name: string]: EntityPropertySeed } = {};

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
    @t min: number = 1;
    @t max: number = 5;
    @t.type(EntityPropertySeed) seed: EntityPropertySeed = new EntityPropertySeed;
}

@entity.name('orm-browser/seed/property/map')
export class EntityPropertyMapSeed {
    @t.any key: { fake: boolean, faker: string } = { fake: true, faker: 'random.word' };
    @t min: number = 1;
    @t max: number = 5;
    @t.type(EntityPropertySeed) seed: EntityPropertySeed = new EntityPropertySeed();
}

@entity.name('orm-browser/seed/entity')
export class EntitySeed {
    @t truncate: boolean = true;
    @t active: boolean = false;
    @t amount: number = 1000;

    @t.map(EntityPropertySeed)
    properties: { [name: string]: EntityPropertySeed } = {};
}

@entity.name('orm-browser/seed/database')
export class SeedDatabase {
    @t.map(EntitySeed)
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
