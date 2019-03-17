import {PageCollection} from "./PageCollection";
import {DocumentClass} from "./DocumentClass";
import {Entity, Field, forwardRef, ParentReference, UUIDField} from "../../src/decorators";
import {uuid} from "../../src/utils";
import {Optional} from "../../src/validation";
import {Buffer} from 'buffer';

@Entity('PageClass')
export class PageClass {
    @UUIDField()
    id: string = uuid();

    @Field()
    name?: string;

    @Field(forwardRef(() => PageCollection))
    children: PageCollection = new PageCollection;

    @Field(Buffer)
    picture?: Buffer;

    @Field(PageClass)
    @ParentReference()
    @Optional()
    parent?: PageClass;

    @Field(forwardRef(() => DocumentClass))
    @ParentReference()
    document: DocumentClass;

    constructor(document: DocumentClass, name: string) {
        this.document = document;
        this.name = name;
    }
}
