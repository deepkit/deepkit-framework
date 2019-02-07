import {
    ClassType,
    getCollectionName,
    getDatabaseName,
    getIdField,
    getClassName,
    getReflectionType,
} from '@marcj/marshal';

import { MongoClient, Collection, Cursor } from 'mongodb';
import {
    classToMongo,
    mongoToClass,
    partialClassToMongo,
    partialMongoToPlain,
    propertyClassToMongo,
} from './mapping';

export class NoIDDefinedError extends Error {}

export type MongoClientFactory = () => Promise<MongoClient>;

/**
 * Handle abstraction of MongoDB.
 *
 * The `filter` argument is always a key-value map, whereas values are class instances. Use partialPlainToClass() first
 * if you want to pass values from JSON/HTTP-Request.
 */
export class Database {
    constructor(
        private mongoClient: MongoClient | MongoClientFactory,
        private defaultDatabaseName = 'app'
    ) {}

    private async getMongoClient(): Promise<MongoClient> {
        if ('function' === typeof this.mongoClient) {
            const f = this.mongoClient as MongoClientFactory;
            return await f();
        }

        return this.mongoClient;
    }

    private async getCollection<T>(
        classType: ClassType<T>
    ): Promise<Collection<T>> {
        return (await this.getMongoClient())
            .db(getDatabaseName(classType) || this.defaultDatabaseName)
            .collection(getCollectionName(classType));
    }

    /**
     * Returns one instance based on given filter, or null when not found.
     */
    public async get<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ): Promise<T | null> {
        const collection = await this.getCollection(classType);

        const item = await collection.findOne(
            partialClassToMongo(classType, filter)
        );

        if (item) {
            return mongoToClass(classType, item);
        }

        return null;
    }

    /**
     * Returns all available documents for given filter as instance classes.
     *
     * Use toClass=false to return the raw documents. Use find().map(v => mongoToPlain(classType, v)) so you can
     * easily return that values back to the HTTP client very fast.
     */
    public async find<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any },
        toClass: boolean = true
    ): Promise<T[]> {
        const collection = await this.getCollection(classType);

        const items = await collection
            .find(filter ? partialClassToMongo(classType, filter) : undefined)
            .toArray();

        const converter = toClass ? mongoToClass : partialMongoToPlain;

        return items.map((v) => {
            return converter(classType, v);
        }) as T[];
    }

    /**
     * Returns a mongodb cursor, which you can further modify and then call toArray() to retrieve the documents.
     *
     * Use toClass=false to return the raw documents.
     */
    public async cursor<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any },
        toClass: boolean = true
    ): Promise<Cursor<T>> {
        const collection = await this.getCollection(classType);

        const cursor = collection.find(
            filter ? partialClassToMongo(classType, filter) : undefined
        );
        const converter = toClass ? mongoToClass : partialMongoToPlain;
        cursor.map((v) => converter(classType, v));

        return cursor;
    }

    /**
     * Removes ONE item from the database that has the given id. You need to use @ID() decorator
     * for at least and max one property at your entity to use this method.
     */
    public async remove<T>(
        classType: ClassType<T>,
        id: string
    ): Promise<boolean> {
        const collection = await this.getCollection(classType);
        const idName = getIdField(classType);
        if (!idName) return false;

        const filter: { [name: string]: any } = {};
        filter[idName] = id;

        const result = await collection.deleteOne(
            partialClassToMongo(classType, filter)
        );

        return result.deletedCount ? result.deletedCount > 0 : false;
    }

    /**
     * Removes ONE item from the database that matches given filter.
     */
    public async deleteOne<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ) {
        const collection = await this.getCollection(classType);
        await collection.deleteOne(partialClassToMongo(classType, filter));
    }

    /**
     * Removes ALL items from the database that matches given filter.
     */
    public async deleteMany<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ) {
        const collection = await this.getCollection(classType);
        await collection.deleteMany(partialClassToMongo(classType, filter));
    }

    /**
     * Adds a new item to the database. Sets _id if defined at your entity.
     */
    public async add<T>(classType: ClassType<T>, item: T): Promise<boolean> {
        const collection = await this.getCollection(classType);

        const id = getIdField(classType);
        (<any>item)['version'] = 1;

        const obj = classToMongo(classType, item);
        obj['version'] = 1;

        const result = await collection.insertOne(obj);

        if (id === '_id' && result.insertedId) {
            const { type } = getReflectionType(classType, id);

            if (
                type === 'objectId' &&
                result.insertedId &&
                result.insertedId.toHexString
            ) {
                (<any>item)['_id'] = result.insertedId.toHexString();
            }
        }

        return true;
    }

    /**
     * Returns the count of items in the database, that fit that given filter.
     */
    public async count<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any }
    ): Promise<number> {
        const collection = await this.getCollection(classType);
        return await collection.countDocuments(
            partialClassToMongo(classType, filter)
        );
    }

    /**
     * Returns true when at least one item in the database is found that fits given filter.
     */
    public async has<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any }
    ): Promise<boolean> {
        return (
            (await this.count(
                classType,
                partialClassToMongo(classType, filter)
            )) > 0
        );
    }

    /**
     * Updates an entity in the database and returns the new version number if successful, or null if not successful.
     *
     * If no filter is given, the ID of `update` is used.
     */
    public async update<T>(
        classType: ClassType<T>,
        update: T,
        filter?: { [field: string]: any }
    ): Promise<number | null> {
        const collection = await this.getCollection(classType);

        const updateStatement: { [name: string]: any } = {
            $inc: { version: +1 },
        };

        updateStatement['$set'] = classToMongo(classType, update);
        delete updateStatement['$set']['version'];

        const filterQuery = filter
            ? partialClassToMongo(classType, filter)
            : this.buildFindCriteria(classType, update);

        const response = await collection.findOneAndUpdate(
            filterQuery,
            updateStatement,
            {
                projection: { version: 1 },
                returnOriginal: false,
            }
        );

        const doc = response.value;

        if (!doc) {
            return null;
        }

        (<any>update)['version'] = (<any>doc)['version'];

        return (<any>update)['version'];
    }

    private buildFindCriteria<T>(
        classType: ClassType<T>,
        data: T
    ): { [name: string]: any } {
        const criteria: { [name: string]: any } = {};
        const id = getIdField(classType);

        if (!id) {
            throw new NoIDDefinedError(
                `Class ${getClassName(classType)} has no @ID() defined.`
            );
        }

        criteria[id] = propertyClassToMongo(classType, id, (<any>data)[id]);

        return criteria;
    }

    /**
     * Patches an entity in the database and returns the new version number if successful, or null if not successful.
     * It's possible to provide nested key-value pairs, where the path should be based on dot symbol separation.
     *
     * Example
     *
     * await patch(SimpleEntity, {
     *     ['children.0.label']: 'Changed label'
     * });
     */
    public async patch<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any },
        patch: Partial<T>
    ): Promise<number | null> {
        const collection = await this.getCollection(classType);

        const patchStatement: { [name: string]: any } = {
            $inc: { version: +1 },
        };

        delete (<any>patch)['id'];
        delete (<any>patch)['_id'];
        delete (<any>patch)['version'];

        patchStatement['$set'] = partialClassToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(
            partialClassToMongo(classType, filter),
            patchStatement,
            {
                projection: { version: 1 },
                returnOriginal: false,
            }
        );

        const doc = response.value;

        if (!doc) {
            return null;
        }

        return (<any>doc)['version'];
    }
}
