import {cli, flag, Logger} from '@deepkit/framework';
import {DatabaseProvider} from '../provider';

@cli.controller('migration:pending', {
    description: 'Shows pending migration files.'
})
export class MigrationPendingCommand {
    constructor(
        protected logger: Logger,
        protected databaseProvider: DatabaseProvider,
    ) {
    }

    async execute(
        @flag.optional.description('Show SQL commands') verbose: boolean = false,
        @flag.char('db').optional.description('Limit migrations to a specific database.') database?: string,
    ): Promise<void> {
        const migrationsPerDatabase = await this.databaseProvider.getMigrationsPerDatabase(database);

        for (const [database, migrations] of migrationsPerDatabase.entries()) {
            this.logger.log(`Migrations for database <yellow>${database.name}</yellow>`);

            for (const migration of migrations) {
                this.logger.log(`<yellow>${migration.name}</yellow>`, migration.created, migration.up().length, 'UP commands');
                if (verbose) {
                    let i = 1;
                    for (const sql of migration.up()) {
                        this.logger.log('  ' + i++ + '.' + (' '.repeat(8)) + sql);
                    }
                }
            }
        }
    }
}
