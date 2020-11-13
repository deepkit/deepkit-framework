/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Database} from '@deepkit/orm';
import {ClassType} from '@deepkit/core';
import * as glob from 'fast-glob';
import {basename, join} from 'path';
import {Migration} from './migration';
import {Databases} from './databases';
import {inject} from '../injector/injector';

export class MigrationProvider {
    protected databaseMap = new Map<string, Database<any>>();

    constructor(
        @inject().root() protected databases: Databases,
        @inject().config('migrationDir') protected migrationDir: string,
    ) {
    }

    async getMigrationsPerDatabase(limitDatabase?: string) {
        const migrationsPerDatabase = new Map<Database<any>, Migration[]>();

        for (const migration of await this.getMigrations(this.migrationDir)) {
            const database = this.databases.getDatabase(migration.databaseName);
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

        const files = await glob('**/*.ts', {cwd: migrationDir});

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
