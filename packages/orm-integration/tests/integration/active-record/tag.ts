import {entity, t} from '@deepkit/type';
import {ActiveRecord} from '@deepkit/orm';

@entity.name('tag')
export class Tag extends ActiveRecord {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;
    @t stars: number = 0;

    constructor(
        @t.index({unique: true}) public name: string,
    ) {
        super();
    }
}
