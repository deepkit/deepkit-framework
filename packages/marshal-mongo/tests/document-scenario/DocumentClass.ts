import {PageCollection} from "./PageCollection";
import {PageClass} from "./PageClass";
import {f, ParentReference} from "@super-hornet/marshal";

export class DocumentClass {
    @f.primary().mongoId()
    _id?: string;

    @f.optional()
    name?: string;

    @f.type(PageCollection)
    pages: PageCollection = new PageCollection;

    @f.type(PageClass)
    page?: PageClass;
}

export class ImpossibleToMetDocumentClass {
    @f.primary().mongoId()
    _id?: string;


    @f
    name?: string;

    @f.type(PageCollection)
    pages: PageCollection = new PageCollection;

    constructor(pages: PageCollection) {
    }
}

export class ClassWithUnmetParent {
    @f.type(ClassWithUnmetParent)
    @ParentReference()
    parent?: ClassWithUnmetParent;
}
