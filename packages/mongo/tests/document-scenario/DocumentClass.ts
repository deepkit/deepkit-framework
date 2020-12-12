import {PageCollection} from './PageCollection';
import {PageClass} from './PageClass';
import {t, ParentReference} from '@deepkit/type';
import {Forward} from '@deepkit/core';

export class DocumentClass {
    @t.primary.mongoId
    _id?: string;

    @t.optional
    name?: string;

    @t.type(PageCollection)
    pages: PageCollection = new PageCollection;

    @t.type(() => PageClass)
    page?: Forward<PageClass>;
}

export class ClassWithUnmetParent {
    @t.type(ClassWithUnmetParent).parentReference
    parent?: ClassWithUnmetParent;
}
