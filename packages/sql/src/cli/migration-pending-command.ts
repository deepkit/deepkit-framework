/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { cli, flag } from '@deepkit/app';
import { empty } from '@deepkit/core';
import { Logger } from '@deepkit/logger';
import { MigrationProvider } from '../migration/migration-provider';
import { SqlMigrationHandler } from '../sql-adapter';
import { BaseCommand } from './base-command';

@cli.controller('migration:pending', {
    description: 'Shows pending migration files.'
})
export class MigrationPendingCommand extends BaseCommand {
    constructor(
        protected logger: Logger,
        protected provider: MigrationProvider,
    ) {
        super()
    }

    async execute(
        @flag.optional.description('Show SQL commands') verbose: boolean = false,
        @flag.char('db').optional.description('Limit migrations to a specific database.') database?: string,
    ): Promise<void> {
        if (this.path.length) this.provider.databases.readDatabase(this.path);
        if (this.migrationDir) this.provider.setMigrationDir(this.migrationDir);

        const migrationsPerDatabase = await this.provider.getMigrationsPerDatabase(database);

        if (empty(migrationsPerDatabase)) this.logger.log(`No migrations in ${this.provider.getMigrationDir()} found.`);

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
