import {PageCollection} from "./PageCollection";
import {DocumentClass} from "./DocumentClass";
import {Entity, Field, forwardRef, ParentReference, UUIDField} from "../../src/decorators";
import {uuid} from "../../src/utils";
import {Buffer} from 'buffer';

@Entity('PageClass')
export class PageClass {
    @UUIDField()
    id: string = uuid();

    @Field(forwardRef(() => PageCollection))
    children: PageCollection = new PageCollection;

    @Field(Buffer)
    picture?: Buffer;

    @Field().optional()
    @ParentReference()
    parent?: PageClass;

    constructor(
        @Field(forwardRef(() => DocumentClass))
        @ParentReference()
        public readonly document: DocumentClass,

        @Field()
        public readonly name: string
    ) {
        this.document = document;
        this.name = name;
    }
}
