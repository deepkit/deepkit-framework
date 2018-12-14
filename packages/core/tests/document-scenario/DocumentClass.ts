import {PageCollection} from "./PageCollection";
import {ParentReference, Class, Entity, ID, MongoIdType, StringType} from "../../src/decorators";
import {PageClass} from "./PageClass";

export class DocumentClass {
    @ID()
    @MongoIdType()
    _id?: string;

    @StringType()
    name?: string;

    @Class(PageCollection)
    pages: PageCollection = new PageCollection;

    @Class(PageClass)
    page?: PageClass;
}

export class ImpossibleToMetDocumentClass {
    @ID()
    @MongoIdType()
    _id?: string;


    @StringType()
    name?: string;

    @Class(PageCollection)
    pages: PageCollection = new PageCollection;

    constructor(pages: PageCollection) {
    }
}

export class ClassWithUnmetParent {
    @Class(ClassWithUnmetParent)
    @ParentReference()
    parent?: ClassWithUnmetParent;
}