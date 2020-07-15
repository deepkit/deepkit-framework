import {Entity, GenericQuery} from "@super-hornet/marshal-orm";
import {MongoQueryModel} from "./query.model";
import {MongoQueryResolver} from "./query.resolver";

export class MongoDatabaseQuery<T extends Entity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>,
    RESOLVER extends MongoQueryResolver<T> = MongoQueryResolver<T>> extends GenericQuery<T, MODEL, MongoQueryResolver<T>> {

    clone(): this {
        const cloned = super.clone() as this;
        cloned.resolver = this.resolver;
        return cloned;
    }

    public async find(): Promise<T[]> {
        return await this.resolver.find(this.model);
    }

    public async findOneOrUndefined(): Promise<T | undefined> {
        return await this.resolver.findOneOrUndefined(this.model);
    }

    public async deleteOne(): Promise<boolean> {
        return await this.resolver.deleteOne(this.model);
    }

    public async deleteMany(): Promise<number> {
        return await this.resolver.deleteMany(this.model);
    }

    public async patchOne(value: {[path: string]: any}): Promise<boolean> {
        return await this.resolver.patchOne(this.model, value);
    }

    public async patchMany(value: {[path: string]: any}): Promise<number> {
        return await this.resolver.patchMany(this.model, value);
    }

    public async updateOne(value: {[path: string]: any}): Promise<boolean> {
        return await this.resolver.updateOne(this.model, value);
    }

    public async updateMany(value: {[path: string]: any}): Promise<number> {
        return await this.resolver.updateMany(this.model, value);
    }

    public async count(): Promise<number> {
        return await this.resolver.count(this.model);
    }
}
