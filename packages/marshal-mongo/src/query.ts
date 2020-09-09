import {Entity, GenericQuery} from "@super-hornet/marshal-orm";
import {MongoQueryModel} from "./query.model";
import {MongoQueryResolver} from "./query.resolver";

export class MongoDatabaseQuery<T extends Entity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>,
    RESOLVER extends MongoQueryResolver<T> = MongoQueryResolver<T>> extends GenericQuery<T, MODEL, MongoQueryResolver<T>> {

}
