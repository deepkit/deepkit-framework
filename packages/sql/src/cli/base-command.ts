import { flag } from '@deepkit/app';

export class BaseCommand {
    /**
     * @description Database typescript files to import and read Database information
     */
    @flag.multiple
    path: string[] = [];

    /**
     * @description Sets the migration directory
     */
    @flag
    protected migrationDir: string = '';
}
