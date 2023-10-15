import { flag } from '@deepkit/app';

export class BaseCommand {
    /**
     * @description Sets the migration directory
     */
    @flag
    protected migrationDir: string = '';
}
