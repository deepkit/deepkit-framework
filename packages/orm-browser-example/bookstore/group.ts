import { entity, t } from '@deepkit/type';

@entity.name('group')
export class Group {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;

    constructor(
        @t public name: string
    ) {
    }
}
