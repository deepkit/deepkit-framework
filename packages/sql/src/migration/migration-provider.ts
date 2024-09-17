/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, isEsm } from '@deepkit/core';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import glob from 'fast-glob';
import { basename, join } from 'path';
import { Migration } from './migration.js';

export class MigrationProvider {
    protected databaseMap = new Map<string, Database<any>>();
    protected migrationDir: string = 'migrations/';

    constructor(
        public databases: DatabaseRegistry,
    ) {
    }

    getMigrationDir(): string {
        return this.migrationDir;
    }

    setMigrationDir(dir: string) {
        this.migrationDir = dir;
    }

    async getMigrationsPerDatabase(limitDatabase?: string) {
        const migrationsPerDatabase = new Map<Database<any>, Migration[]>();

        for (const migration of await this.getMigrations(this.migrationDir)) {
            const database = this.databases.getDatabaseByName(migration.databaseName);
            if (!database) continue;
            if (limitDatabase && database.name !== limitDatabase) continue;

            let dbMigrations = migrationsPerDatabase.get(database);
            if (!dbMigrations) {
                dbMigrations = [];
                migrationsPerDatabase.set(database, dbMigrations);
            }

            dbMigrations.push(migration);
        }

        return migrationsPerDatabase;
    }

    // FIXME: esm imports doesn't work
    private async registerTsNode() {
        const esm = isEsm();
        const { register } = await import('ts-node');
        register({
            esm,
            preferTsExts: true,
            experimentalTsImportSpecifiers: true,
            compilerOptions: {
                experimentalDecorators: true,
                module: esm ? 'ESNext' : 'CommonJS',
            },
            transpileOnly: true,
        });
    }

    async addDatabase(path: string): Promise<void> {
        await this.registerTsx();

        const exports = Object.values((await import(join(process.cwd(), path)) || {}));
        if (!exports.length) {
            throw new Error(`No database found in path ${path}`);
        }

        let databaseInstance: Database | undefined;
        let foundDatabaseClass: ClassType<Database> | undefined;

        for (const value of exports) {
            if (value instanceof Database) {
                databaseInstance = value;
                break;
            }
            if (Object.getPrototypeOf(value) instanceof Database) {
                foundDatabaseClass = value as ClassType<Database>;
            }
        }

        if (!databaseInstance) {
            if (foundDatabaseClass) {
                throw new Error(`Found database class ${foundDatabaseClass.name} in path ${path} but it has to be instantiated an exported. export const database = new ${foundDatabaseClass.name}(/* ... */);`);
            }
            throw new Error(`No database found in path ${path}`);
        }

        this.databases.addDatabaseInstance(databaseInstance);
    }

    async getMigrations(migrationDir: string): Promise<Migration[]> {
        let migrations: Migration[] = [];

        const files = await glob('**/*.ts', { cwd: migrationDir });

        await this.registerTsx();

        for (const file of files) {
            const path = join(process.cwd(), migrationDir, file);
            const name = basename(file.replace('.ts', ''));
            const { SchemaMigration } = (await import(path) || {});
            if (SchemaMigration) {
                const jo = new class extends (SchemaMigration as ClassType<Migration>) {
                    constructor() {
                        super();
                        if (!this.name) this.name = name;
                    }
                };
                migrations.push(jo);
            }
        }

        migrations.sort((a, b) => {
            if (a.version > b.version) return +1;
            if (a.version < b.version) return -1;
            return 0;
        });

        return migrations;
    }
}
