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
import { ClassSchema, entity, getGlobalStore, propertyDefinition, PropertySchema, PropertySchemaSerialized, t, SerializedSchema, serializedSchemaDefinition, deserializeSchemas } from '@deepkit/type';

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
    migrate(name: string): Promise<void>;
    getDatabase(name: string): DatabaseInfo;
    // getMigration(name: string): MigrationInfo;
    getItems(dbName: string, entityName: string): Promise<any[]>;
    create(dbName: string, entityName: string): Promise<any>;
    add(dbName: string, entityName: string, items: any[]): Promise<any>;
}
