import {Entity, GenericQuery} from "@super-hornet/marshal-orm";
import {ClassSchema} from "@super-hornet/marshal";
import {MongoQueryModel} from "./query.model";
import {MongoQueryResolver} from "./resolver";

export class MongoDatabaseQuery<T extends Entity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>,
    RESOLVER extends MongoQueryResolver<T> = MongoQueryResolver<T>> extends GenericQuery<T, MODEL> {

    constructor(classSchema: ClassSchema<T>, model: MODEL, protected resolver: RESOLVER) {
        super(classSchema, model);
    }

    public async find(): Promise<T[]> {
        return await this.resolver.find(this.model);
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        return await this.resolver.findOneOrUndefined(this.model);
    }

    public async deleteMany(): Promise<number> {
        return await this.resolver.deleteMany(this.model);
    }

    public async patchMany(value: {}): Promise<number> {
        return Promise.resolve(0);
    }

    public async updateMany(value: {}): Promise<number> {
        return Promise.resolve(0);
    }

    count(): Promise<number> {
        return Promise.resolve(0);
    }
}
