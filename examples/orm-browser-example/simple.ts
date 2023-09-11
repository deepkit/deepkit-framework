import { AutoIncrement, entity, PrimaryKey, t } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

@entity.name('group')
export class Group {
    public id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(
        public name: string
    ) {
    }
}

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [Group]);
