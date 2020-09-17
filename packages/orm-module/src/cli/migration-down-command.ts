import {cli, flag, Logger} from '@deepkit/framework';
import {DatabaseProvider} from '../provider';
import {SQLDatabaseAdapter, SqlMigrationHandler} from '@deepkit/sql';
import {indent} from '@deepkit/core';


@cli.controller('migration:down', {
    description: 'Executes down migration, reverting old migration files.'
})
export class MigrationDownCommand {
    constructor(
        protected logger: Logger,
        protected databaseProvider: DatabaseProvider,
    ) {
    }

    async execute(
        @flag.optional.description('Limit migrations to a specific database') database?: string,
        @flag.optional.description('Sets the migration version without executing actual SQL commands') fake: boolean = false,
    ): Promise<void> {
        const migrationsPerDatabase = await this.databaseProvider.getMigrationsPerDatabase(database);

        for (const [database, migrations] of migrationsPerDatabase.entries()) {
            this.logger.log(`Execute migrations for <yellow>${database.name}</yellow>`);

            if (database.adapter instanceof SQLDatabaseAdapter) {
                const migrationHandler = new SqlMigrationHandler(database);

                try {
                    const latestVersion = await migrationHandler.getLatestMigrationVersion();
                    const migration = migrations.find(v => v.version === latestVersion);
                    if (!migration) {
                        this.logger.log('<red>No migration found to execute');
                        return;
                    }

                    const connection = database.adapter.connectionPool.getConnection();
                    this.logger.log(`    Migration down <yellow>${migration.name}</yellow>`);
                    if (fake) {
                        this.logger.log(`       Faking migration.`);
                    } else {
                        let i = 1;
                        for (const sql of migration.down()) {
                            this.logger.log(`<yellow>    ${i++}. ${indent(4)(sql)}</yellow>`);
                            await connection.exec(sql);
                        }
                    }
                    await migrationHandler.removeMigrationVersion(migration.version);
                    this.logger.log(`<green>Successfully migrated down to version ${migration.version}</green>`);
                } finally {
                    database.disconnect();
                }
            }
        }
    }
}
