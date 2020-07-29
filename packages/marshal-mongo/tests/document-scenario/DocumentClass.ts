import {PageCollection} from "./PageCollection";
import {PageClass} from "./PageClass";
import {t, ParentReference} from "@super-hornet/marshal";

export class DocumentClass {
    @t.primary.mongoId
    _id?: string;

    @t.optional
    name?: string;

    @t.type(PageCollection)
    pages: PageCollection = new PageCollection;

    @t.type(PageClass)
    page?: PageClass;
}

export class ImpossibleToMetDocumentClass {
    @t.primary.mongoId
    _id?: string;


    @t
    name?: string;

    @t.type(PageCollection)
    pages: PageCollection = new PageCollection;

    constructor(pages: PageCollection) {
    }
}

export class ClassWithUnmetParent {
    @t.type(ClassWithUnmetParent).parentReference
    parent?: ClassWithUnmetParent;
}
