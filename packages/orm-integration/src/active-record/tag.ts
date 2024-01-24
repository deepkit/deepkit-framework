import { ActiveRecord } from '@deepkit/orm';
import { AutoIncrement, PrimaryKey, Unique, entity } from '@deepkit/type';

@entity.name('active-record-tag')
export class Tag extends ActiveRecord {
    public id?: number & PrimaryKey & AutoIncrement;
    created: Date = new Date();
    stars: number = 0;

    constructor(public name: string & Unique) {
        super();
    }
}
