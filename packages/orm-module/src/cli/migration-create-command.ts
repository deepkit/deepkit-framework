import {cli, Command, flag, inject, Injector, Logger} from '@deepkit/framework';
import {DatabaseProvider} from '../provider';
import {DatabaseComparator, DatabaseModel, SQLDatabaseAdapter} from '@deepkit/sql';
import {dirname, join} from 'path';
import { format } from 'date-fns';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {indent} from '@deepkit/core';


function serializeSQLLine(sql: string): string {
    return '`' + sql.replace(/`/g, '\`') + '`';
}

@cli.controller('migration:create', {
    description: 'Generates a new migration file based on a database diff'
})
export class MigrationCreateController implements Command {
    constructor(
        protected logger: Logger,
        protected databaseProvider: DatabaseProvider,
        @inject().config('migrationDir') protected migrationDir: string,
    ) {
    }

    async execute(
        @flag.optional.description('Limit the migration to a specific database.') database?: string,
        @flag.optional.description('Do not drop any table that is not available anymore as entity.') noDrop?: boolean,
    ): Promise<void> {
        for (const db of this.databaseProvider.getDatabases()) {
            if (database && db.name !== database) continue;

            if (db.adapter instanceof SQLDatabaseAdapter) {
                const databaseModel = new DatabaseModel();
                databaseModel.schemaName = db.adapter.getSchemaName();
                db.adapter.platform.createTables([...db.classSchemas], databaseModel);

                const connection = await db.adapter.connectionPool.getConnection();
                const schemaParser = new db.adapter.platform.schemaParserType(connection, db.adapter.platform);

                const parsedDatabaseModel = new DatabaseModel();
                parsedDatabaseModel.schemaName = db.adapter.getSchemaName();
                await schemaParser.parse(parsedDatabaseModel);

                connection.release();
                db.disconnect();

                // console.log('databaseModel', databaseModel.tables[0]);
                // console.log('parsedDatabaseModel', parsedDatabaseModel.tables[0]);
                const databaseDiff = DatabaseComparator.computeDiff(parsedDatabaseModel, databaseModel);
                if (!databaseDiff) {
                    this.logger.error(db.name, 'No database differences found.');
                    return;
                }

                const sql = db.adapter.platform.getModifyDatabaseDDL(databaseDiff);
                if (!sql.length) {
                    this.logger.error(db.name, 'No generates sql found.');
                    continue;
                }

                let migrationName = '';

                const date = new Date;

                for (let i = 1; i < 100; i++) {
                    migrationName = format(date, 'yyyyMMdd-HHmm');
                    if (i > 1) migrationName += '_' + i;

                    if (!existsSync(join(this.migrationDir, migrationName + '.ts'))) {
                        break;
                    }
                }
                const migrationFile = join(this.migrationDir, migrationName + '.ts');

                const reverseDatabaseDiff = DatabaseComparator.computeDiff(databaseModel, parsedDatabaseModel);
                const reverseSql =  reverseDatabaseDiff ? db.adapter.platform.getModifyDatabaseDDL(reverseDatabaseDiff) : [];

                const code = `
import {Migration} from '@deepkit/orm-module';

/**
 * Schema migration created automatically. You should commit this into your Git repository.
 * 
 * You can rename and modify this file as you like, but make sure that 'databaseName' and 'created' are not modified.
*/
export class SchemaMigration implements Migration {
    /**
     * Database name used for this migration. Should usually not be changed. 
     * If you change your database names later, you can adjust those here as well to make sure
     * migration files are correctly assigned to the right database connection.
     */
    databaseName = ${JSON.stringify(db.name)};
    
    adapterName = ${JSON.stringify(db.adapter.getName())};
    
    /**
     * This date should not be changed since it is used to detect if this migration 
     * has been already executed against the database.
     */
    created = new Date('${date.toJSON()}');
    
    up() {
        return [
${sql.map(serializeSQLLine).map(indent(12)).join(',\n')}
        ];
    }

    down() {
        return [
${reverseSql.map(serializeSQLLine).map(indent(12)).join(',\n')}
        ];
    }
}
`;

                mkdirSync(dirname(migrationFile), {recursive: true});
                writeFileSync(migrationFile, code.trim());
                this.logger.log(`Migration file for database <green>${db.name}</green> written to <yellow>${migrationFile}</yellow>`);
            }
        }
    }
}
