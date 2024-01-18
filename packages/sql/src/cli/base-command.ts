import { Flag } from '@deepkit/app';

export class BaseCommand {
    /**
     * @description Sets the migration directory.
     */
    protected migrationDir: string & Flag = '';
}
