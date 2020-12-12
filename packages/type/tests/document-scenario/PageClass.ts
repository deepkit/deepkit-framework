import {createCollection, Collection} from './PageCollection';
import {Entity, t} from '../../src/decorators';
import {uuid} from '../../src/utils';

@Entity('PageClass')
export class PageClass {
    static PageCollection = createCollection(PageClass);

    @t.uuid
    id: string = uuid();

    @t.type(PageClass.PageCollection)
    children: Collection<PageClass> = new PageClass.PageCollection;

    @t.type(ArrayBuffer)
    picture?: ArrayBuffer;

    @t.type(() => PageClass).optional.parentReference
    parent?: PageClass;

    constructor(
        @t public readonly name: string
    ) {
        this.name = name;
    }
}
