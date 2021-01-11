import { entity, MultiIndex, t } from '@deepkit/type';
import { ActiveRecord } from '@deepkit/orm';
import { Book } from './book';
import { Tag } from './tag';

@entity.name('book-tag')
@MultiIndex(['book', 'tag'])
export class BookTag extends ActiveRecord {
    @t.primary.autoIncrement public id?: number;

    constructor(
        @t.type(() => Book).reference() public book: Book,
        @t.reference() public tag: Tag,
    ) {
        super()
    }
}
