/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassTypeFromInstance } from '@deepkit/core';
import { ClassSchema, getClassSchema } from '@deepkit/type';
import { InjectorContext } from '@deepkit/injector';
import { Database } from './database';
import { isAbsolute, join } from 'path';

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
        protected readonly databaseTypes: ClassType<Database<any>>[] = [],
        protected migrateOnStartup: boolean = false,
    ) {
        if (!scopedContext) throw new Error('no scopedContext');
    }

    setMigrateOnStartup(v: boolean) {
        this.migrateOnStartup = v;
    }

    /**
     * Reads database from a path. Imports the given paths
     * and looks for instantiated Database classes. All instantiated Database classes will be returned.
     *
     * This is an alternative way to find Database and entities compared to
     * a config file driven way.
     */
    readDatabase(paths: string[]) {
        Database.registry = [];

        //we dont want to allow bundles to bundle ts-node
        const n = 'ts' + '-node';
        const r = require;
        r(n).register({
            compilerOptions: {
                experimentalDecorators: true
            }
        });

        for (const path of paths) {
            require(isAbsolute(path) ? path : join(process.cwd(), path));
        }

        for (const db of Database.registry) {
            this.databases.push(db);
            const classType = getClassTypeFromInstance(db);
            this.databaseNameMap.set(db.name, db);
            this.databaseMap.set(classType, db);
            this.databaseTypes.push(classType);
        }
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
            if (this.databaseMap.has(databaseType)) continue;

            const database = this.scopedContext.get(databaseType);

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
