import { ActiveRecord } from '@deepkit/orm';
import { AutoIncrement, BackReference, entity, PrimaryKey, Reference } from '@deepkit/type';
import { User } from '../bookstore/user';
import { BookTag } from './book-tag';
import { Tag } from './tag';

@entity.name('active-record-book')
export class Book extends ActiveRecord {
    public id?: number & PrimaryKey & AutoIncrement;

    tags: Tag[] & BackReference<{via: typeof BookTag}> = [];

    constructor(
        public author: User & Reference,
        public title: string,
    ) {
        super();
    }
}
