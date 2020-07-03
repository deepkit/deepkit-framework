import {PageCollection} from "./PageCollection";
import {DocumentClass} from "./DocumentClass";
import {Entity, f, ParentReference} from "../../src/decorators";
import {uuid} from "../../src/utils";

@Entity('PageClass')
export class PageClass {
    @f.uuid()
    id: string = uuid();

    @f.forward(() => PageCollection)
    children: PageCollection = new PageCollection;

    @f.type(ArrayBuffer)
    picture?: ArrayBuffer;

    @f.forward(() => PageClass).optional()
    @ParentReference()
    parent?: PageClass;

    constructor(
        @f.forward(() => DocumentClass)
        @ParentReference()
        public readonly document: DocumentClass,
        @f
        public readonly name: string
    ) {
        this.document = document;
        this.name = name;
    }
}
