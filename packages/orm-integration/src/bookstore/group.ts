import { AutoIncrement, entity, PrimaryKey } from '@deepkit/type';

@entity.name('group')
export class Group {
    public id?: number & PrimaryKey & AutoIncrement;
    created: Date = new Date;

    constructor(
        public name: string
    ) {
    }
}
