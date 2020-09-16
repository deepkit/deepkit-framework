import {cli, Command, flag, inject, Injector} from '@deepkit/framework';
import {DatabaseProvider} from '../provider';
import {DatabaseComparator, DatabaseModel, SQLDatabaseAdapter} from '@deepkit/sql';
import {dirname, join} from 'path';
import { format } from 'date-fns';
import {existsSync, mkdirSync, writeFileSync} from 'fs';

function indent(indentation: number) {
    return (str: string) => {
        return ' '.repeat(indentation) + str.replace(/\n/g, '\n' + (' '.repeat(indentation + 4)));
    };
}

function serializeSQLLine(sql: string): string {
    return '`' + sql.replace(/`/g, '\`') + '`';
}

@cli.controller('migration:create', {
    description: 'Generates a new migration file based on a database diff'
})
export class MigrationCreateController implements Command {
    constructor(
        protected databaseProvider: DatabaseProvider,
        @inject().root() protected injector: Injector,
        @inject().config('migrationDir') protected migrationDir: string,
    ) {
    }

    async execute(
        @flag.optional.description('Limit the migration to a specific database.') database?: string,
        @flag.optional.description('Do not drop any table that is not available anymore as entity.') noDrop?: boolean,
    ): Promise<void> {
        for (const dbType of this.databaseProvider.databases) {
            const db = this.injector.get(dbType);
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

                const databaseDiff = DatabaseComparator.computeDiff(parsedDatabaseModel, databaseModel);
                if (!databaseDiff) {
                    console.log(db.name, 'No database differences found.');
                    return;
                }

                const sql = db.adapter.platform.getModifyDatabaseDDL(databaseDiff);
                if (!sql.length) {
                    console.log(db.name, 'No generates sql found.');
                    continue;
                }

                let migrationName = '';

                for (let i = 1; i < 100; i++) {
                    migrationName = format(new Date, 'yyyyMMdd-HHmm');
                    if (i > 1) migrationName += '_' + i;

                    if (!existsSync(join(this.migrationDir, migrationName + '.ts'))) {
                        break;
                    }
                }
                const migrationFile = join(this.migrationDir, migrationName + '.ts');

                const reverseDatabaseDiff = DatabaseComparator.computeDiff(databaseModel, parsedDatabaseModel);
                const reverseSql =  reverseDatabaseDiff ? db.adapter.platform.getModifyDatabaseDDL(reverseDatabaseDiff) : [];

                const code = `
//Schema migration created at ${new Date()}
export class Migration {
    databaseName = ${JSON.stringify(db.name)};
    adapterName = ${JSON.stringify(db.adapter.getName())};
    
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
                console.log(db.name, 'Migration file written to', migrationFile);
            }
        }
    }
}
