import { Forward } from '@deepkit/core';
import { ParentReference, t } from '@deepkit/type';

import { PageClass } from './PageClass.js';
import { PageCollection } from './PageCollection.js';

export class DocumentClass {
    @t.primary.mongoId
    _id?: string;

    @t.optional
    name?: string;

    @t.type(PageCollection)
    pages: PageCollection = new PageCollection();

    @t.type(() => PageClass)
    page?: Forward<PageClass>;
}

export class ClassWithUnmetParent {
    @t.type(ClassWithUnmetParent).parentReference
    parent?: ClassWithUnmetParent;
}
