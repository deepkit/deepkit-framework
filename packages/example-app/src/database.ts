import { entity, t } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { config } from './config';
import { injectable } from '@deepkit/injector';

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

class DbConfig extends config.slice(['dbPath']) {}

@injectable()
export class SQLiteDatabase extends Database {
    constructor(private config: DbConfig) {
        super(new SQLiteDatabaseAdapter(config.dbPath), [User]);
    }
}
