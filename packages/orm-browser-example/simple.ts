import { entity, t } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

@entity.name('group')
export class Group {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;

    constructor(
        @t public name: string
    ) {
    }
}

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [Group]);
