import {Database} from '@deepkit/orm/dist';
import {ClassType} from '@deepkit/core';
import {inject, Injector} from '@deepkit/framework';
import * as glob from 'fast-glob';
import {basename, join} from 'path';
import {Migration} from './migration';

export class DatabaseProvider {
    protected databaseMap = new Map<string, Database<any>>();

    constructor(
        @inject().root() protected injector: Injector,
        @inject().config('migrationDir') protected migrationDir: string,
        @inject('orm.databases') public databaseTypes: ClassType<Database<any>>[]
    ) {
        for (const databaseType of databaseTypes) {
            const database = this.injector.get(databaseType);
            if (this.databaseMap.has(database.name)) {
                throw new Error(`Database with name ${database.name} already registered`);
            }
            this.databaseMap.set(database.name, database);
        }
    }

    getDatabases() {
        return this.databaseMap.values();
    }

    getDatabase(name: string): Database<any> | undefined {
        return this.databaseMap.get(name);
    }

    async getMigrationsPerDatabase(limitDatabase?: string) {
        const migrationsPerDatabase = new Map<Database<any>, Migration[]>();

        for (const migration of await this.getMigrations(this.migrationDir)) {
            const database = this.getDatabase(migration.databaseName);
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
            if (a.created > b.created) return +1;
            if (a.created < b.created) return -1;
            return 0;
        });

        return migrations;
    }

}
