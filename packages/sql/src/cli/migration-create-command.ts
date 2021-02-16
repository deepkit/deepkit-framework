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
import { format } from 'date-fns';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { cli, Command, flag } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
import { SQLDatabaseAdapter } from '../sql-adapter';
import { DatabaseComparator, DatabaseModel } from '../schema/table';
import { MigrationProvider } from '../migration/migration-provider';
import { BaseCommand } from './base-command';

function serializeSQLLine(sql: string): string {
    return '`' + sql.replace(/`/g, '\\`') + '`';
}

@cli.controller('migration:create', {
    description: 'Generates a new migration file based on a database diff'
})
export class MigrationCreateController extends BaseCommand implements Command {
    constructor(
        protected logger: Logger,
        protected provider: MigrationProvider,
    ) {
        super()
    }

    async execute(
        @flag.optional.description('Limit the migration to a specific database') database?: string,
        @flag.optional.description('Do not drop any table that is not available anymore as entity') noDrop: boolean = false,
        @flag.optional.description('Create an empty migration file') empty: boolean = false,
    ): Promise<void> {
        if (this.path.length) this.provider.databases.readDatabase(this.path);
        if (this.migrationDir) this.provider.setMigrationDir(this.migrationDir);

        if (!this.provider.databases.getDatabases().length) {
            this.logger.error('No databases detected. Use --path path/to/database.ts');
        }

        for (const db of this.provider.databases.getDatabases()) {
            if (database && db.name !== database) continue;
            if (db.name === 'debug') continue;
            if (!(db.adapter instanceof SQLDatabaseAdapter)) continue;

            const databaseModel = new DatabaseModel();
            databaseModel.schemaName = db.adapter.getSchemaName();
            db.adapter.platform.createTables([...db.entities], databaseModel);

            const connection = await db.adapter.connectionPool.getConnection();
            const schemaParser = new db.adapter.platform.schemaParserType(connection, db.adapter.platform);

            const parsedDatabaseModel = new DatabaseModel();
            parsedDatabaseModel.schemaName = db.adapter.getSchemaName();
            await schemaParser.parse(parsedDatabaseModel);

            connection.release();
            db.disconnect();

            // console.log('databaseModel', databaseModel.tables[0]);
            // console.log('parsedDatabaseModel', parsedDatabaseModel.tables[0]);
            let upSql: string[] = [];
            let downSql: string[] = [];

            const databaseDiff = DatabaseComparator.computeDiff(parsedDatabaseModel, databaseModel);
            if (!empty && !databaseDiff) {
                this.logger.error(db.name, 'No database differences found.');
                return;
            }

            if (databaseDiff) {
                upSql = db.adapter.platform.getModifyDatabaseDDL(databaseDiff);
                if (!empty && !upSql.length) {
                    this.logger.error(db.name, 'No generates sql found.');
                    continue;
                }
            }

            let migrationName = '';
            const date = new Date;

            for (let i = 1; i < 100; i++) {
                migrationName = format(date, 'yyyyMMdd-HHmm');
                if (i > 1) migrationName += '_' + i;

                if (!existsSync(join(this.provider.getMigrationDir(), migrationName + '.ts'))) {
                    break;
                }
            }
            const migrationFile = join(this.provider.getMigrationDir(), migrationName + '.ts');

            if (databaseDiff) {
                const reverseDatabaseDiff = DatabaseComparator.computeDiff(databaseModel, parsedDatabaseModel);
                downSql = reverseDatabaseDiff ? db.adapter.platform.getModifyDatabaseDDL(reverseDatabaseDiff) : [];
            }

            const code = `
import {Migration} from '@deepkit/sql';

/**
 * Schema migration created automatically. You should commit this into your Git repository.
 *
 * You can rename and modify this file as you like, but make sure that 'databaseName' and 'created' are not modified.
*/
export class SchemaMigration implements Migration {
    /**
     * The migration name/title. Defaults to the file name, but can be overwritten here and to give a nice explanation what has been done.
     */
    name = \`\`;

    /**
     * Database name used for this migration. Should usually not be changed.
     * If you change your database names later, you can adjust those here as well to make sure
     * migration files are correctly assigned to the right database connection.
     *
     * Used adapter: ${JSON.stringify(db.adapter.getName())}
     */
    databaseName = ${JSON.stringify(db.name)};

    /**
     * This version should not be changed since it is used to detect if this migration
     * has been already executed against the database.
     *
     * This version was created at ${date.toISOString()}.
     */
    version = ${Math.floor(date.getTime() / 1000)};

    /**
     * SQL queries executed one by one, to apply a migration.
     */
    up() {
        return [
${upSql.map(serializeSQLLine).map(indent(12)).join(',\n')}
        ];
    }

    /**
     * SQL queries executed one by one, to revert a migration.
     */
    down() {
        return [
${downSql.map(serializeSQLLine).map(indent(12)).join(',\n')}
        ];
    }
}
`;

            mkdirSync(dirname(migrationFile), { recursive: true });
            writeFileSync(migrationFile, code.trim());
            this.logger.log(`Migration file for database <green>${db.name}</green> written to <yellow>${migrationFile}</yellow>`);
        }
    }
}
