import {PageCollection} from "./PageCollection";
import {ParentReference, IDField, MongoIdField, Field} from "../../src/decorators";
import {PageClass} from "./PageClass";

export class DocumentClass {
    @IDField()
    @MongoIdField()
    _id?: string;

    @Field()
    name?: string;

    @Field(PageCollection)
    pages: PageCollection = new PageCollection;

    @Field(PageClass)
    page?: PageClass;
}

export class ImpossibleToMetDocumentClass {
    @IDField()
    @MongoIdField()
    _id?: string;


    @Field()
    name?: string;

    @Field(PageCollection)
    pages: PageCollection = new PageCollection;

    constructor(pages: PageCollection) {
    }
}

export class ClassWithUnmetParent {
    @Field(ClassWithUnmetParent)
    @ParentReference()
    parent?: ClassWithUnmetParent;
}
