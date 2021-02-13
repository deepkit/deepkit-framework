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
import { Database } from '@deepkit/orm';
import { ClassSchema, getClassSchema } from '@deepkit/type';
import { inject, InjectorContext } from './injector/injector';
import { kernelConfig } from './kernel.config';

/**
 * Class to register a new database and resolve a schema/type to a database.
 */
export class DatabaseRegistry {
    protected databaseNameMap = new Map<string, Database<any>>();
    protected databases: Database<any>[] = [];
    protected databaseMap = new Map<ClassType, Database<any>>();
    protected databaseOptions = new Map<ClassType, { migrateOnStartup?: boolean }>();
    protected initialized = false;

    constructor(
        protected scopedContext: InjectorContext,
        @inject(kernelConfig.token('databases')) protected readonly databaseTypes: ClassType<Database<any>>[] = [],
        @inject(kernelConfig.token('migrateOnStartup')) protected migrateOnStartup: boolean,
    ) {
    }

    public onShutDown() {
        for (const database of this.databaseMap.values()) {
            database.disconnect();
        }
    }

    public addDatabase(database: ClassType, options: { migrateOnStartup?: boolean } = {}) {
        this.databaseTypes.push(database);
        this.databaseOptions.set(database, options);
    }

    public getDatabaseTypes() {
        return this.databaseTypes;
    }

    public isMigrateOnStartup(database: ClassType): boolean {
        const options = this.databaseOptions.get(database);
        if (options && options.migrateOnStartup !== undefined) return options.migrateOnStartup;

        return this.migrateOnStartup;
    }

    public init() {
        if (this.initialized) return;

        for (const databaseType of this.databaseTypes) {
            const database = this.scopedContext.get(databaseType);
            if (this.databaseNameMap.has(database.name)) {
                throw new Error(`Database with name ${database.name} already registered. If you have multiple Database instances, make sure each has its own name.`);
            }

            for (const classSchema of database.entities) {
                classSchema.data['orm.database'] = database;
            }

            this.databaseNameMap.set(database.name, database);
            this.databaseMap.set(databaseType, database);
            this.databases.push(database);
        }

        this.initialized = true;
    }

    getDatabaseForEntity(entity: ClassSchema | ClassType): Database<any> {
        const schema = getClassSchema(entity);
        const database = schema.data['orm.database'];
        if (!database) throw new Error(`Class ${schema.getClassName()} is not assigned to a database`);
        return database;
    }

    getDatabases(): Database<any>[] {
        this.init();
        return this.databases;
    }

    getDatabase(classType: ClassType): Database<any> | undefined {
        this.init();
        return this.databaseMap.get(classType);
    }

    getDatabaseByName(name: string): Database<any> | undefined {
        this.init();
        return this.databaseNameMap.get(name);
    }
}
