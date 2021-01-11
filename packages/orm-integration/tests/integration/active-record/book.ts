import { ActiveRecord } from '@deepkit/orm';
import { entity, t } from '@deepkit/type';
import { User } from '../user';
import { BookTag } from './book-tag';
import { Tag } from './tag';

@entity.name('book')
export class Book extends ActiveRecord {
    @t.primary.autoIncrement public id?: number;

    @t.array(() => Tag).backReference({ via: () => BookTag })
    tags: Tag[] = [];

    constructor(
        @t.reference() public author: User,
        @t public title: string,
    ) {
        super();
    }
}