import {PageCollection} from "./PageCollection";
import {DocumentClass} from "./DocumentClass";
import {Class, ClassCircular, ParentReference, StringType, UUIDType} from "../../src/decorators";
import {uuid} from "../../src/utils";
import {Optional} from "../../src/validation";

export class PageClass {
    @UUIDType()
    id: string = uuid();

    @StringType()
    name: string | undefined;

    @ClassCircular(() => PageCollection)
    children: PageCollection = new PageCollection;

    @Class(PageClass)
    @ParentReference()
    @Optional()
    parent?: PageClass;

    @ClassCircular(() => DocumentClass)
    @ParentReference()
    document: DocumentClass;

    constructor(document: DocumentClass, name: string) {
        this.document = document;
        this.name = name;
    }
}
