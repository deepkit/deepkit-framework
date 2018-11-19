import {
    ClassType,
    classToMongo,
    getCollectionName,
    getDatabaseName,
    getIdField,
    mongoToClass,
    propertyClassToMongo,
    getRegisteredProperties,
    toObject,
    getClassName,
    getReflectionType
} from '@marcj/marshal';

import {MongoClient, Collection, Cursor} from 'mongodb';
import * as clone from "clone";

export function partialFilterObjectToMongo<T>(classType: ClassType<T>, target: any = {}): { [name: string]: any } {
    const cloned = clone(target, false);

    for (const propertyName of getRegisteredProperties(classType)) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        if (target[propertyName] instanceof RegExp) {
            continue;
        }

        cloned[propertyName] = propertyClassToMongo(classType, propertyName, target[propertyName]);
    }

    return toObject(cloned);
}


export class NoIDDefinedError extends Error {}

export type MongoClientFactory = () => Promise<MongoClient>;

export class Database {
    constructor(private mongoClient: MongoClient | MongoClientFactory, private defaultDatabaseName = 'app') {
    }

    private async getMongoClient(): Promise<MongoClient> {
        if ('function' === typeof this.mongoClient) {
            const f = (this.mongoClient as MongoClientFactory);
            return await f();
        }

        return this.mongoClient;
    }

    private async getCollection<T>(classType: ClassType<T>): Promise<Collection<T>> {
        return (await this.getMongoClient())
            .db(getDatabaseName(classType) || this.defaultDatabaseName)
            .collection(getCollectionName(classType));
    }

    public async get<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ): Promise<T | null> {
        const collection = await this.getCollection(classType);

        const item = await collection.findOne(partialFilterObjectToMongo(classType, filter));

        if (item) {
            return mongoToClass(classType, item);
        }

        return null;
    }

    public async find<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any }
    ): Promise<T[]> {
        const collection = await this.getCollection(classType);

        const items = await collection.find(filter ? partialFilterObjectToMongo(classType, filter) : undefined).toArray();

        return items.map(v => {
            return mongoToClass(classType, v);
        });
    }

    public async cursor<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any }
    ): Promise<Cursor<T>> {
        const collection = await this.getCollection(classType);

        const cursor = collection.find(filter ? partialFilterObjectToMongo(classType, filter) : undefined);
        cursor.map(v => mongoToClass(classType, v));

        return cursor;
    }

    public async remove<T>(classType: ClassType<T>, id: string): Promise<boolean> {
        const collection = await this.getCollection(classType);
        const idName = getIdField(classType);
        if (!idName) return false;

        const filter: {[name: string]: any} = {};
        filter[idName] = id;

        const result = await collection.deleteOne(partialFilterObjectToMongo(classType, filter));

        return result.deletedCount ? result.deletedCount > 0 : false;
    }

    public async deleteOne<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = await this.getCollection(classType);
        await collection.deleteOne(partialFilterObjectToMongo(classType, filter));
    }

    public async deleteMany<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = await this.getCollection(classType);
        await collection.deleteMany(partialFilterObjectToMongo(classType, filter));
    }

    public async add<T>(classType: ClassType<T>, item: T): Promise<boolean> {
        const collection = await this.getCollection(classType);

        const id = getIdField(classType);
        (<any>item)['version'] = 1;

        const obj = classToMongo(classType, item);
        obj['version'] = 1;

        const result = await collection.insertOne(obj);

        if (id === '_id' && result.insertedId) {
            const {type} = getReflectionType(classType, id);

            if (type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
                (<any>item)['_id'] = result.insertedId.toHexString();
            }
        }

        return true;
    }

    public async count<T>(classType: ClassType<T>, filter?: { [field: string]: any }): Promise<number> {
        const collection = await this.getCollection(classType);
        return await collection.countDocuments(partialFilterObjectToMongo(classType, filter));
    }

    public async has<T>(classType: ClassType<T>, filter?: { [field: string]: any }): Promise<boolean> {
        return (await this.count(classType, partialFilterObjectToMongo(classType, filter))) > 0;
    }

    /**
     * Updates an entity in the database and returns the new version number if successful, or null if not successful.
     *
     * If no filter is given, the ID of `update` is used.
     */
    public async update<T>(classType: ClassType<T>, update: T, filter?: { [field: string]: any }): Promise<number | null> {
        const collection = await this.getCollection(classType);

        const updateStatement: {[name :string]: any} = {
            $inc: {version: +1},
        };

        updateStatement['$set'] = classToMongo(classType, update);
        delete updateStatement['$set']['version'];

        const filterQuery = filter ? partialFilterObjectToMongo(classType, filter) : this.buildFindCriteria(classType, update);

        const response = await collection.findOneAndUpdate(filterQuery, updateStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return null;
        }

        (<any>update)['version'] = (<any>doc)['version'];

        return (<any>update)['version'];
    }

    private buildFindCriteria<T>(classType: ClassType<T>, data: T): {[name: string]: any} {
        const criteria: {[name: string]: any} = {};
        const id = getIdField(classType);

        if (!id) {
            throw new NoIDDefinedError(`Class ${getClassName(classType)} has no @ID defined.`);
        }

        criteria[id] = propertyClassToMongo(classType, id, (<any>data)[id]);

        return criteria;
    }

    /**
     * Patches an entity in the database and returns the new version number if successful, or null if not successful.
     */
    public async patch<T>(classType: ClassType<T>, filter: { [field: string]: any }, patch: Partial<T>): Promise<number | null> {
        const collection = await this.getCollection(classType);

        const patchStatement: {[name: string]: any} = {
            $inc: {version: +1}
        };

        delete (<any>patch)['id'];
        delete (<any>patch)['_id'];
        delete (<any>patch)['version'];

        patchStatement['$set'] = partialFilterObjectToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(partialFilterObjectToMongo(classType, filter), patchStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return null;
        }

        return (<any>doc)['version'];
    }
}
