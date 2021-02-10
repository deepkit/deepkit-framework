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
        @t public name: string,
        @t public adapter: string,
        @t.array(serializedSchemaDefinition) public serializedSchemas: SerializedSchema[] = []
    ) { }

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
        @t public name: string,
    ) { }
}

@entity.name('orm-broser/migration')
export class MigrationInfo {
    @t.map(MigrationEntityInfo) entites: { [name: string]: MigrationEntityInfo } = {};
}

export const BrowserControllerInterface = ControllerSymbol<BrowserControllerInterface>('orm-browser/controller', [DatabaseInfo]);
export interface BrowserControllerInterface {
    getDatabases(): DatabaseInfo[];
    resetAllTables(name: string): Promise<void>;
    migrate(name: string): Promise<void>;
    getMigrations(name: string): Promise<{ [name: string]: {sql: string[], diff: string} }>;
    getDatabase(name: string): DatabaseInfo;
    // getMigration(name: string): MigrationInfo;
    getItems(dbName: string, entityName: string, filter: { [name: string]: any }, sort: { [name: string]: any }, limit: number, skip: number): Promise<any[]>;
    getCount(dbName: string, entityName: string, filter: { [name: string]: any }): Promise<number>;
    create(dbName: string, entityName: string): Promise<any>;
    commit(commit: DatabaseCommit): Promise<any>;
}
