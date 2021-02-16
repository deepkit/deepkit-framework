import { Database } from '@deepkit/orm';
import { entity, t } from '@deepkit/type';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter';

@entity.name('entity')
class Entity {
    @t.primary.autoIncrement id: number = 0;
    @t title: string = '';
}

export const testDatabase = new Database(new SQLiteDatabaseAdapter, [Entity]);
