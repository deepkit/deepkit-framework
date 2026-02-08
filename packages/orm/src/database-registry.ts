/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ClassType, getClassName } from '@deepkit/core';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { ReflectionClass } from '@deepkit/type';

import { Database } from './database.js';

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
        protected readonly databaseTypes: { module: InjectorModule<any>; classType: ClassType<Database<any>> }[] = [],
        protected migrateOnStartup: boolean = false,
    ) {
        if (!injectorContext) throw new Error('no scopedContext');
    }

    setMigrateOnStartup(v: boolean) {
        this.migrateOnStartup = v;
    }

    public onShutDown() {
        this.init();
        for (const database of this.databases) {
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

    public addDatabaseInstance(database: Database) {
        this.databaseNameMap.set(database.name, database);
        this.databases.push(database);
    }

    public init() {
        if (this.initialized) return;

        for (const databaseType of this.databaseTypes) {
            if (this.databaseMap.has(databaseType.classType)) continue;

            const database = this.injectorContext.get(databaseType.classType, databaseType.module);

            for (const classSchema of database.entityRegistry.all()) {
                classSchema.data['orm.database'] = database;
            }

            if (this.databaseNameMap.has(database.name)) {
                throw new Error(
                    `Database class ${getClassName(database)} has a name '${database.name}' that is already registered. ` +
                        `Choose a different name via class ${getClassName(database)} {\n  name = 'anotherName';\n}`,
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
