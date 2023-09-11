import { AutoIncrement, entity, PrimaryKey, Unique } from '@deepkit/type';
import { ActiveRecord } from '@deepkit/orm';

@entity.name('active-record-tag')
export class Tag extends ActiveRecord {
    public id?: number & PrimaryKey & AutoIncrement;
    created: Date = new Date;
    stars: number = 0;

    constructor(
        public name: string & Unique,
    ) {
        super();
    }
}
