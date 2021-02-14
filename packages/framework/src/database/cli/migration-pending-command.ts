/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { SqlMigrationHandler } from '@deepkit/sql';
import { cli, flag } from '../../command';
import { Logger } from '@deepkit/logger';
import { MigrationProvider } from '../migration-provider';

@cli.controller('migration:pending', {
    description: 'Shows pending migration files.'
})
export class MigrationPendingCommand {
    constructor(
        protected logger: Logger,
        protected databaseProvider: MigrationProvider,
    ) {
    }

    async execute(
        @flag.optional.description('Show SQL commands') verbose: boolean = false,
        @flag.char('db').optional.description('Limit migrations to a specific database.') database?: string,
    ): Promise<void> {
        const migrationsPerDatabase = await this.databaseProvider.getMigrationsPerDatabase(database);

        for (const [database, migrations] of migrationsPerDatabase.entries()) {
            const migrationHandler = new SqlMigrationHandler(database);
            const latestVersion = await migrationHandler.getLatestMigrationVersion();
            const migrationsToApply = migrations.filter(v => v.version > latestVersion);
            if (migrationsToApply.length) {
                this.logger.log(`Database <green>${database.name}</green>: Pending migrations`);
                let i = 1;
                for (const migration of migrationsToApply) {
                    this.logger.log(` <yellow>${i++}. ${migration.name}</yellow> version=${migration.version} <yellow>${migration.up().length} UP</yellow> statements`);
                    if (verbose) {
                        let i = 1;
                        for (const sql of migration.up()) {
                            this.logger.log('   ' + i++ + '.' + (' '.repeat(8)) + sql);
                        }
                    }
                }
            } else {
                this.logger.log(`Database <red>${database.name}</red>: No pending migrations`);
            }
        }
    }
}
