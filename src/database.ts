import {ClassType, CustomError, uuid4Binary} from "./utils";
import {
    classToMongo,
    getCollectionName,
    getDatabaseName,
    getEntityName, getIdField,
    getIdFieldValue,
    mongoToClass,
    mongoToPlain, plainToMongo,
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
        filter: { [field: string]: any },
        asClass = true
    ): Promise<T | null> {
        const collection = this.getCollection(classType);

        const item = await collection.findOne(classToMongo(classType, filter));

        if (item) {
            const transformer = asClass ? mongoToClass : mongoToPlain;
            return transformer(classType, item);
        }

        return null;
    }

    public async find<T>(
        classType: ClassType<T>,
        filter?: { [field: string]: any },
        asClass = true
    ): Promise<T[]> {
        const collection = this.getCollection(classType);

        const items = await collection.find(filter ? classToMongo(classType, filter) : null).toArray();

        const transformer = asClass ? mongoToClass : mongoToPlain;
        return items.map(v => {
            return transformer(classType, v);
        });
    }

    public async remove<T>(classType: ClassType<T>, id: string) {
        const collection = this.getCollection(classType);

        await collection.deleteOne({id: uuid4Binary(id)});
    }

    public async add<T>(classType: ClassType<T>, values: object) {
        const collection = this.getCollection(classType);

        values['version'] = 1;
        await collection.insertOne(plainToMongo(classType, values));

    }

    public async update<T, K extends keyof T>(classType: ClassType<T>, update: T) {
        const collection = this.getCollection(classType);

        const entityName = getEntityName(classType);
        const id = getIdFieldValue(classType, update);

        const updateStatement = {
            $inc: {version: +1},
        };

        updateStatement['$set'] = plainToMongo(classType, update);

        const response = await collection.findOneAndUpdate({id: uuid4Binary(id)}, updateStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            throw new NotFoundError(`Entity ${entityName} not found for id ${id}`);
        }
    }

    private buildFindCriteria<T>(classType: ClassType<T>, data: T) {
        const criteria = {};
        const id = getIdField(classType);

        criteria[id] = propertyPlainToMongo(classType, id, data[id]);

        return criteria;
    }

    public async save<T>(classType: ClassType<T>, data: T): Promise<number> {
        const collection = this.getCollection(classType);

        const update = {$set: plainToMongo(classType, data)};
        update.$set['version'] = 1;

        const response = await collection.findOneAndUpdate(this.buildFindCriteria(classType, data), update, {
            upsert: true,
            projection: {
                version: 1
            },
            returnOriginal: false
        });

        const doc = response.value;

        return doc['version'];
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

        patchStatement['$set'] = classToMongo(classType, patch);

        const response = await collection.findOneAndUpdate(this.buildFindCriteria(classType, filter), patchStatement, {
            projection: {version: 1},
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            throw new NotFoundError(`Entity ${entityName} not found for id ${id}`);
        }

        return doc['version'];
    }
}
