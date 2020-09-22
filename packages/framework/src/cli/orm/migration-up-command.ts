import {SQLDatabaseAdapter, SqlMigrationHandler} from '@deepkit/sql';
import {indent} from '@deepkit/core';
import {cli, flag} from '../../command';
import {Logger} from '../../logger';
import {MigrationProvider} from '../../migration-provider';


@cli.controller('migration:up', {
    description: 'Executes pending migration files. Use migration:pending to see which are pending.'
})
export class MigrationUpCommand {
    constructor(
        protected logger: Logger,
        protected databaseProvider: MigrationProvider,
    ) {
    }

    async execute(
        @flag.optional.description('Limit migrations to a specific database.') database?: string,
        @flag.optional.description('Sets the migration version without executing actual SQL commands') fake: boolean = false,
    ): Promise<void> {
        const migrationsPerDatabase = await this.databaseProvider.getMigrationsPerDatabase(database);

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

                    const connection = database.adapter.connectionPool.getConnection();
                    try {
                        this.logger.log(`    Migration up <yellow>${migration.name}</yellow>`);
                        if (fake) {
                            this.logger.log(`       Faking migration.`);
                        } else {
                            let i = 1;
                            for (const sql of migration.up()) {
                                this.logger.log(`<yellow>    ${i++}. ${indent(4)(sql)}</yellow>`);
                                await connection.exec(sql);
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
