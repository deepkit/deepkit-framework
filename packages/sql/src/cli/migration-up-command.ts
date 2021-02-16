/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { indent } from '@deepkit/core';
import { cli, flag } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
import { MigrationProvider } from '../migration/migration-provider';
import { SQLDatabaseAdapter, SqlMigrationHandler } from '../sql-adapter';
import { BaseCommand } from './base-command';

@cli.controller('migration:up', {
    description: 'Executes pending migration files. Use migration:pending to see which are pending.'
})
export class MigrationUpCommand extends BaseCommand {
    constructor(
        protected logger: Logger,
        protected provider: MigrationProvider,
    ) {
        super();
    }

    async execute(
        @flag.optional.description('Limit migrations to a specific database.') database?: string,
        @flag.optional.description('Sets the migration version without executing actual SQL commands') fake: boolean = false,
    ): Promise<void> {
        if (this.path.length) this.provider.databases.readDatabase(this.path);
        if (this.migrationDir) this.provider.setMigrationDir(this.migrationDir);

        const migrationsPerDatabase = await this.provider.getMigrationsPerDatabase(database);

        for (const [database, migrations] of migrationsPerDatabase.entries()) {
            this.logger.log(`Execute migrations for <yellow>${database.name}</yellow>`);

            if (database.adapter instanceof SQLDatabaseAdapter) {
                const migrationHandler = new SqlMigrationHandler(database);

                try {
                    const latestVersion = await migrationHandler.getLatestMigrationVersion();
                    const migrationToApply = migrations.filter(v => v.version > latestVersion);
                    const migration = migrationToApply.shift();
                    if (!migration) {
                        this.logger.log('<green>All migrations executed</green>');
                        return;
                    }

                    const connection = await database.adapter.connectionPool.getConnection();
                    try {
                        this.logger.log(`    Migration up <yellow>${migration.name}</yellow>`);
                        if (fake) {
                            this.logger.log(`       Faking migration.`);
                        } else {
                            let i = 1;
                            for (const sql of migration.up()) {
                                this.logger.log(`<yellow>    ${i++}. ${indent(4)(sql)}</yellow>`);
                                await connection.run(sql);
                            }
                        }
                        await migrationHandler.setLatestMigrationVersion(migration.version);
                        this.logger.log(`<green>Successfully migrated up to version ${migration.version}</green>`);

                        if (migrationToApply.length) {
                            this.logger.log(`<yellow>${migrationToApply.length} migration/s left. Run migration:up again to execute the next migration.</yellow>`);
                        } else {
                            this.logger.log('<green>All migrations executed</green>');
                        }
                    } finally {
                        connection.release();
                    }
                } finally {
                    database.disconnect();
                }
            }
        }
    }
}
