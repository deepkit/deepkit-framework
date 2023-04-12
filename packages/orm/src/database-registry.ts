/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassName, getClassTypeFromInstance } from '@deepkit/core';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { Database } from './database.js';
import { isAbsolute, join } from 'path';
import { ReflectionClass } from '@deepkit/type';

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
        protected injectorContext: InjectorContext,
        protected readonly databaseTypes: { module: InjectorModule<any>, classType: ClassType<Database<any>> }[] = [],
        protected migrateOnStartup: boolean = false,
    ) {
        if (!injectorContext) throw new Error('no scopedContext');
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
            if (this.databaseNameMap.has(db.name)) {
                throw new Error(
                    `Database class ${getClassName(db)} has a name '${db.name}' that is already registered. ` +
                    `Choose a different name via class ${getClassName(db)} {\n  name = 'anotherName';\n    }`
                );
            }
            this.databaseNameMap.set(db.name, db);
            this.databaseMap.set(classType, db);
            this.databaseTypes.push({ classType, module: new InjectorModule() });
        }
    }

    public onShutDown() {
        for (const database of this.databaseMap.values()) {
            database.disconnect();
        }
    }

    public addDatabase(database: ClassType, options: { migrateOnStartup?: boolean } = {}, module: InjectorModule<any>) {

        if (!this.databaseTypes.find(v => v.classType === database)) {
            this.databaseTypes.push({ classType: database, module });
        }
        let o = this.databaseOptions.get(database);
        if (o) {
            Object.assign(o, options);
        } else {
            this.databaseOptions.set(database, options);
        }
    }

    public removeDatabase(database: ClassType) {
        const index = this.databaseTypes.findIndex(v => v.classType === database);
        if (index !== -1) this.databaseTypes.splice(index, 1);
        this.databaseOptions.delete(database);
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
            if (this.databaseMap.has(databaseType.classType)) continue;

            const database = this.injectorContext.get(databaseType.classType);

            for (const classSchema of database.entityRegistry.entities) {
                classSchema.data['orm.database'] = database;
            }

            if (this.databaseNameMap.has(database.name)) {
                throw new Error(
                    `Database class ${getClassName(database)} has a name '${database.name}' that is already registered. ` +
                    `Choose a different name via class ${getClassName(database)} {\n  name = 'anotherName';\n}`
                );
            }

            this.databaseNameMap.set(database.name, database);
            this.databaseMap.set(databaseType.classType, database);
            this.databases.push(database);
        }

        this.initialized = true;
    }

    getDatabaseForEntity(entity: ReflectionClass<any> | ClassType): Database<any> {
        const schema = ReflectionClass.from(entity);
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
