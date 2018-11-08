import {ClassType} from "./utils";
import {
    classToMongo,
    getCollectionName,
    getDatabaseName,
    getIdField,
    mongoToClass,
    partialFilterObjectToMongo,
    propertyClassToMongo
} from "./mapper";
import {MongoClient, Collection} from 'mongodb';

export class Database {
    constructor(private mongoClient: MongoClient, private defaultDatabaseName = 'app') {
    }

    private getCollection<T>(classType: ClassType<T>): Collection<T> {
        return this.mongoClient
            .db(getDatabaseName(classType) || this.defaultDatabaseName)
            .collection(getCollectionName(classType));
    }

    public async get<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ): Promise<T | null> {
        const collection = this.getCollection(classType);

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
        const collection = this.getCollection(classType);

        const items = await collection.find(filter ? partialFilterObjectToMongo(classType, filter) : null).toArray();

        return items.map(v => {
            return mongoToClass(classType, v);
        });
    }

    public async remove<T>(classType: ClassType<T>, id: string) {
        const collection = this.getCollection(classType);
        const idName = getIdField(classType);
        const filter = {};
        filter[idName] = id;

        await collection.deleteOne(partialFilterObjectToMongo(classType, filter));
    }

    public async deleteOne<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = this.getCollection(classType);
        await collection.deleteOne(partialFilterObjectToMongo(classType, filter));
    }

    public async deleteMany<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = this.getCollection(classType);
        await collection.deleteMany(partialFilterObjectToMongo(classType, filter));
    }

    public async add<T>(classType: ClassType<T>, item: T) {
        const collection = this.getCollection(classType);

        const id = getIdField(classType);
        item['version'] = 1;

        const obj = classToMongo(classType, item);
        obj['version'] = 1;

        const result = await collection.insertOne(obj);

        if (id === '_id' && result.insertedId) {
            item['_id'] = result.insertedId.toHexString();
        }
    }

    public async count<T>(classType: ClassType<T>, filter?: { [field: string]: any }): Promise<number> {
        const collection = this.getCollection(classType);
        return await collection.countDocuments(partialFilterObjectToMongo(classType, filter));
    }

    public async has<T>(classType: ClassType<T>, filter?: { [field: string]: any }): Promise<boolean> {
        return (await this.count(classType, filter)) > 0;
    }

    /**
     * Updates an entity in the database and returns the new version number if successful, or null if not successful.
     */
    public async update<T>(classType: ClassType<T>, update: T): Promise<number | null> {
        const collection = this.getCollection(classType);

        const updateStatement = {
            $inc: {version: +1},
        };

        updateStatement['$set'] = classToMongo(classType, update);
        delete updateStatement['$set']['version'];

        const response = await collection.findOneAndUpdate(this.buildFindCriteria(classType, update), updateStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return null;
        }

        update['version'] = doc['version'];
    }

    private buildFindCriteria<T>(classType: ClassType<T>, data: T) {
        const criteria = {};
        const id = getIdField(classType);

        criteria[id] = propertyClassToMongo(classType, id, data[id]);

        return criteria;
    }

    /**
     * Patches an entity in the database and returns the new version number if successful, or null if not successful.
     */
    public async patch<T>(classType: ClassType<T>, filter: { [field: string]: any }, patch: Partial<T>): Promise<number | null> {
        const collection = this.getCollection(classType);

        const patchStatement = {
            $inc: {version: +1}
        };

        delete patch['id'];
        delete patch['_id'];
        delete patch['version'];

        patchStatement['$set'] = partialFilterObjectToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(partialFilterObjectToMongo(classType, filter), patchStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return null;
        }

        return doc['version'];
    }
}
