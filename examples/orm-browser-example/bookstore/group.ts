import { AutoIncrement, entity, PrimaryKey, t } from '@deepkit/type';

@entity.name('group')
export class Group {
    public id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}
