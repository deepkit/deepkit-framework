import { flag } from '@deepkit/app';
import { t } from '@deepkit/type';

export class BaseCommand {
    @flag.multiple.optional.description('Database typescript files to import and read Database information')
    @t.array(t.string)
    path: string[] = [];

    @flag.optional.description('Sets the migration directory')
    protected migrationDir: string = '';
}
