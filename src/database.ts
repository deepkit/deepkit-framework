import {ClassType, CustomError, uuid4Binary} from "./utils";
import {
    classToMongo,
    getCollectionName,
    getDatabaseName,
    getEntityName, getIdField,
    getIdFieldValue,
    mongoToClass,
    mongoToPlain, partialObjectToMongo, plainToMongo,
    propertyMongoToPlain, propertyPlainToMongo
} from "./mapper";
import {MongoClient, Collection} from 'mongodb';

export class DatabaseError extends CustomError {
}

export class NotFoundError extends CustomError {
}

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

        const item = await collection.findOne(partialObjectToMongo(classType, filter));

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

        const items = await collection.find(filter ? partialObjectToMongo(classType, filter) : null).toArray();

        return items.map(v => {
            return mongoToClass(classType, v);
        });
    }

    public async remove<T>(classType: ClassType<T>, id: string) {
        const collection = this.getCollection(classType);
        const idName = getIdField(classType);
        const filter = {};
        filter[idName] = id;

        await collection.deleteOne(partialObjectToMongo(classType, filter));
    }

    public async deleteOne<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = this.getCollection(classType);
        await collection.deleteOne(partialObjectToMongo(classType, filter));
    }

    public async deleteMany<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        const collection = this.getCollection(classType);
        await collection.deleteMany(partialObjectToMongo(classType, filter));
    }

    public async add<T>(classType: ClassType<T>, item: T) {
        const collection = this.getCollection(classType);

        item['version'] = 1;

        const id = getIdField(classType);

        const result = await collection.insertOne(classToMongo(classType, item));
        if (id === '_id' && result.insertedId) {
            item['_id'] = result.insertedId.toHexString();
        }
    }

    public async count<T>(classType: ClassType<T>, filter: { [field: string]: any }): Promise<number> {
        const collection = this.getCollection(classType);
        const response = await collection.estimatedDocumentCount(partialObjectToMongo(classType, filter), {});

        return response;
    }

    public async has<T>(classType: ClassType<T>, filter: { [field: string]: any }): Promise<boolean> {
        return (await this.count(classType, filter)) > 0;
    }

    public async update<T>(classType: ClassType<T>, update: T) {
        const collection = this.getCollection(classType);

        const entityName = getEntityName(classType);
        const id = getIdFieldValue(classType, update);

        const updateStatement = {
            $inc: {version: +1},
        };

        updateStatement['$set'] = classToMongo(classType, update);

        const response = await collection.findOneAndUpdate({id: uuid4Binary(id)}, updateStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            throw new NotFoundError(`Entity ${entityName} not found for id ${id}`);
        }

        update['version'] = doc['version'];
    }

    private buildFindCriteria<T>(classType: ClassType<T>, data: T) {
        const criteria = {};
        const id = getIdField(classType);

        criteria[id] = propertyPlainToMongo(classType, id, data[id]);

        return criteria;
    }

    public async patch<T>(classType: ClassType<T>, filter: { [field: string]: any }, patch: Partial<T>): Promise<number> {
        const collection = this.getCollection(classType);
        const entityName = getEntityName(classType);

        const patchStatement = {
            $inc: {version: +1}
        };

        delete patch['id'];
        delete patch['_id'];
        delete patch['version'];

        patchStatement['$set'] = partialObjectToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(partialObjectToMongo(classType, filter), patchStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            throw new NotFoundError(`Entity ${entityName} not found for ${JSON.stringify(filter)}`);
        }

        return doc['version'];
    }
}
