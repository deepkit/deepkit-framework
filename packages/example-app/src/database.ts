import { entity, t } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

@entity.name('user')
export class User {
    @t.primary.autoIncrement id: number = 0;
    @t created: Date = new Date;
    @t image?: Uint8Array;

    constructor(
        @t.minLength(3).index({unique: true}) public username: string
    ) {
    }
}

export class SQLiteDatabase extends Database {
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}
