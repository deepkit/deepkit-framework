import {Injectable} from 'injection-js';
import {
    classToPlain,
    ClassType,
    getCollectionName,
    getIdFieldValue,
    partialClassToPlain,
} from '@marcj/marshal';
import {Collection, Cursor} from "mongodb";
import {Exchange} from "./exchange";
import {
    convertPlainQueryToMongo,
    partialClassToMongo,
    partialMongoToPlain,
    partialPlainToMongo,
    Database
} from "@marcj/marshal-mongo";
import {MongoLock, Mongo} from "./mongo";
import {eachPair} from "@kamille/core";
import {EntityPatches} from "@kamille/core";
import {Application} from "./application";

/**
 * A database that also publishes change feeds to the exchange.
 */
@Injectable()
export class ExchangeDatabase {
    constructor(
        protected application: Application,
        protected mongo: Mongo,
        protected database: Database,
        protected exchange: Exchange,
    ) {
    }
    public async collection<T>(classType: ClassType<T>): Promise<Collection> {
        return await this.mongo.collection(getCollectionName(classType));
    }

    public async get<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ): Promise<T | null> {
        return await this.database.get(classType, filter);
    }

    public async find<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any },
        toClass = false
    ): Promise<T[]> {
        return await this.database.find(classType, filter, toClass) as T[];
    }

    public async has<T>(
        classType: ClassType<T>,
        filter: { [field: string]: any }
    ): Promise<boolean> {
        return this.database.has(classType, filter);
    }

    public async remove<T>(classType: ClassType<T>, id: string) {
        const removed = this.database.remove(classType, id);

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'remove',
                id: id,
                version: 0,
            });
        }

        return removed;
    }

    public async deleteOne<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        return this.database.deleteOne(classType, filter);
        //todo, add exchange.Publish
    }

    public async deleteMany<T>(classType: ClassType<T>, filter: { [field: string]: any }) {
        return this.database.deleteMany(classType, filter);
        //todo, add exchange.Publish
    }

    public async add<T>(classType: ClassType<T>, item: T) {
        await this.database.add(classType, item);

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'add',
                id: getIdFieldValue(classType, item),
                version: 1,
                item: classToPlain(classType, item)
            });
        }
    }

    public async count<T>(classType: ClassType<T>, filter?: { [field: string]: any }): Promise<number> {
        return await this.database.count(classType, filter);
    }

    public async cursor<T>(classType: ClassType<T>, filter?: { [field: string]: any }, toClass = false): Promise<Cursor<T>> {
        return (await this.database.cursor(classType, filter, toClass)) as Cursor<T>;
    }

    public async plainCursor<T>(classType: ClassType<T>, filter: { [field: string]: any }): Promise<Cursor<T>> {
        const collection = await this.mongo.collection(getCollectionName(classType));

        return collection.find(convertPlainQueryToMongo(classType, filter));
    }

    public async update<T>(classType: ClassType<T>, item: T): Promise<number> {
        const version = await this.database.update(classType, item);

        if (!version) {
            throw new Error('Could not update entity');
        }

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'update',
                id: getIdFieldValue(classType, item),
                version: version, //this is the new version in the db, which we end up having when `data` is applied.
                item: classToPlain(classType, item),
            });
        }

        return version;
    }

    public async lock<T>(classType: ClassType<T>, id?: string): Promise<MongoLock> {
        const name = 'collection-lock/' + getCollectionName(classType) + (id ? '/' + id : '');

        return this.mongo.acquireLock(name);
    }

    private notifyChanges<T>(classType: ClassType<T>): boolean {
        return this.application.notifyChanges(classType);
    }

    /**
     * Increases one or multiple fields atomic and returns the new value.
     * This does not send patches to the exchange.
     */
    public async increase<T, F extends {[field: string]: number}>(
        classType: ClassType<T>,
        id: string,
        fields: F
    ): Promise<F> {
        const collection = await this.mongo.collection(getCollectionName(classType));
        const projection: {[key: string]: number} = {};
        const filter = {id: id};
        const statement: { [name: string]: any } = {
            $inc: {}
        };

        for (const [i, v] of eachPair(fields)) {
            statement.$inc[i] = v;
            projection[i] = 1;
        }

        const response = await collection.findOneAndUpdate(partialClassToMongo(classType, filter), statement, {
            projection: projection,
            returnOriginal: false
        });

        return response.value;
    }

    public async patchPlain<T>(
        classType: ClassType<T>,
        id: string,
        patches: {[path: string]: any},
        additionalProjection: string[] = []
    ): Promise<{[field: string]: any}> {
        return this.patch(
            classType,
            id,
            patches,
            additionalProjection,
            true
        );
    }

    public async patch<T>(
        classType: ClassType<T>,
        id: string,
        patches: Partial<T> | {[path: string]: any},
        additionalProjection: string[] = [],
        plain = false
    ): Promise<{[field: string]: any}> {
        const collection = await this.mongo.collection(getCollectionName(classType));

        const patchStatement: { [name: string]: any } = {
            $inc: {version: +1}
        };

        delete (<any>patches)['id'];
        delete (<any>patches)['_id'];
        delete (<any>patches)['version'];

        if (plain) {
            patchStatement['$set'] = partialPlainToMongo(classType, patches);
        } else {
            patchStatement['$set'] = partialClassToMongo(classType, patches);
        }

        if (Object.keys(patchStatement['$set']).length === 0) {
            throw new Error('No patches given. ' + JSON.stringify(patches));
        }

        const filter = {id: id};
        const subscribedFields = await this.exchange.getSubscribedEntityFields(classType);
        const projection: {[key: string]: number} = {
            version: 1,
        };

        for (const field of subscribedFields) {
            projection[field] = 1;
        }

        for (const field of additionalProjection) {
            projection[field] = 1;
        }

        const response = await collection.findOneAndUpdate(partialClassToMongo(classType, filter), patchStatement, {
            projection: projection,
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            console.error('patchStatement', patchStatement, filter, projection);
            console.error('response', response);
            throw new Error('Could not patch entity');
        }

        delete doc._id;

        const newVersion = (<any>doc)['version'];

        const jsonPatches: EntityPatches = partialClassToPlain(classType, patches);

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'patch',
                id: id,
                version: newVersion, //this is the new version in the db, which we end up having when `data` is applied.
                item: partialMongoToPlain(classType, doc),
                patch: jsonPatches,
            });
        }

        return (<any>doc);
    }
}
