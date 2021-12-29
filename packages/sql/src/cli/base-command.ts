import { flag } from '@deepkit/app';

export class BaseCommand {
    @flag.multiple.optional.description('Database typescript files to import and read Database information')
    path: string[] = [];

    @flag.optional.description('Sets the migration directory')
    protected migrationDir: string = '';
}
