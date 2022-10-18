import {PageCollection} from "./PageCollection.js";
import {DocumentClass} from "./DocumentClass.js";
import {Entity, t, ParentReference, uuid} from '@deepkit/type';

@Entity('PageClass')
export class PageClass {
    @t.uuid
    id: string = uuid();

    @t.type(() => PageCollection)
    children: PageCollection = new PageCollection;

    @t.type(ArrayBuffer)
    picture?: ArrayBuffer;

    @t.type(() => PageClass).optional.parentReference
    parent?: PageClass;

    constructor(
        @t.type(() => DocumentClass).parentReference
        public readonly document: DocumentClass,
        @t
        public readonly name: string
    ) {
        this.document = document;
        this.name = name;
    }
}
