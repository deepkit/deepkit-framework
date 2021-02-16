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
import { Database, DatabaseRegistry } from '@deepkit/orm';
import glob from 'fast-glob';
import { basename, join } from 'path';
import { injectable } from '@deepkit/injector';
import { Migration } from './migration';

@injectable()
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

    async getMigrations(migrationDir: string): Promise<Migration[]> {
        let migrations: Migration[] = [];

        const files = await glob('**/*.ts', { cwd: migrationDir });
        require('ts-node').register({
            compilerOptions: {
                experimentalDecorators: true
            }
        });

        for (const file of files) {
            const path = join(process.cwd(), migrationDir, file);
            const name = basename(file.replace('.ts', ''));
            const migration = require(path);
            if (migration && migration.SchemaMigration) {
                const jo = new class extends (migration.SchemaMigration as ClassType<Migration>) {
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
