import {cli, flag, Logger} from '@deepkit/framework';
import {DatabaseProvider} from '../provider';
import {SQLDatabaseAdapter, SqlMigrationHandler} from '@deepkit/sql';
import {indent} from '@deepkit/core';


@cli.controller('migration:up', {
    description: 'Executes pending migration files. Use migration:pending to see which are pending.'
})
export class MigrationUpCommand {
    constructor(
        protected logger: Logger,
        protected databaseProvider: DatabaseProvider,
    ) {
    }

    async execute(
        @flag.optional.description('Limit migrations to a specific database.') database?: string,
    ): Promise<void> {
        const migrationsPerDatabase = await this.databaseProvider.getMigrationsPerDatabase(database);

        for (const [database, migrations] of migrationsPerDatabase.entries()) {
            this.logger.log(`Execute migrations for <yellow>${database.name}</yellow>`);

            if (database.adapter instanceof SQLDatabaseAdapter) {
                const migrationHandler = new SqlMigrationHandler(database);

                try {
                    const latestVersion = await migrationHandler.getLatestMigrationVersion();
                    const migrationsToApply = migrations.filter(v => Math.floor(v.created.getTime() / 1000) > latestVersion);

                    const connection = database.adapter.connectionPool.getConnection();
                    for (const migration of migrationsToApply) {
                        this.logger.log(`    Migration <yellow>${migration.name}</yellow>`);
                        let i = 0;
                        for (const sql of migration.up()) {
                            this.logger.log(`<yellow>    ${i++}. ${indent(4)(sql)}</yellow>`);
                            await connection.exec(sql);
                        }
                        await migrationHandler.setLatestMigrationVersion(Math.floor(migration.created.getTime() / 1000));
                    }
                } finally {
                    database.disconnect();
                }
            }
        }
    }
}
