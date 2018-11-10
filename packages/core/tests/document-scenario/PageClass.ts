import {PageCollection} from "./PageCollection";
import {DocumentClass} from "./DocumentClass";
import {Class, ClassCircular, AssignParent, StringType, UUIDType} from "../../src/decorators";
import {uuid} from "../../src/utils";

export class PageClass {
    @UUIDType()
    id: string = uuid();

    @StringType()
    name: string | undefined;

    @ClassCircular(() => PageCollection)
    children: PageCollection = new PageCollection;

    @Class(PageClass)
    @AssignParent()
    parent?: PageClass;

    @ClassCircular(() => DocumentClass)
    @AssignParent()
    document?: DocumentClass;
}
