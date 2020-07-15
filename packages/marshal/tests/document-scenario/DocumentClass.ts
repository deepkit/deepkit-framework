import {PageCollection} from "./PageCollection";
import {ParentReference, f} from "../../src/decorators";
import {PageClass} from "./PageClass";

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
