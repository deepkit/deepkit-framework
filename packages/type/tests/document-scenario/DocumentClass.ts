import {t} from '../../src/decorators';
import {PageClass} from './PageClass';
import {Collection, createCollection} from './PageCollection';

export class DocumentClass {
    static PageCollection = createCollection(PageClass);

    @t.primary.mongoId
    _id?: string;

    @t.optional
    name?: string;

    @t.type(DocumentClass.PageCollection)
    pages: Collection<PageClass> = new DocumentClass.PageCollection;

    @t.type(() => PageClass)
    page?: PageClass;
}

export class ClassWithUnmetParent {
    @t.type(ClassWithUnmetParent).required.parentReference
    parent!: ClassWithUnmetParent;
}
