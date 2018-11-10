import {PageCollection} from "./PageCollection";
import {Class, Entity, ID, MongoIdType, StringType} from "../../src/decorators";
import {PageClass} from "./PageClass";


@Entity('DocumentClass')
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