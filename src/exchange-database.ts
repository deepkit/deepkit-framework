import {Injectable} from 'injection-js';
import {classToPlain, getIdFieldValue, partialClassToPlain, partialPlainToClass, plainToClass} from '@marcj/marshal';
import {Collection, Cursor} from "typeorm";
import {Exchange} from "./exchange";
import {convertClassQueryToMongo, convertPlainQueryToMongo, Database, partialClassToMongo, partialMongoToPlain, partialPlainToMongo} from "@marcj/marshal-mongo";
import {EntityPatches, FilterQuery, IdInterface} from "@marcj/glut-core";
import {ClassType, eachPair} from '@marcj/estdlib';

export interface ExchangeNotifyPolicy {
    notifyChanges<T>(classType: ClassType<T>): boolean;
}

/**
 * A database that also publishes change feeds to the exchange.
 */
@Injectable()
export class ExchangeDatabase {
    constructor(
        protected exchangeNotifyPolicy: ExchangeNotifyPolicy,
        protected database: Database,
        protected exchange: Exchange,
    ) {
    }

    public async collection<T>(classType: ClassType<T>): Promise<Collection<T>> {
        return await this.database.getCollection(classType);
    }

    private notifyChanges<T>(classType: ClassType<T>): boolean {
        return this.exchangeNotifyPolicy.notifyChanges(classType);
    }

    public async get<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>
    ): Promise<T | undefined> {
        return await this.database.get(classType, filter);
    }

    public async find<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>,
        toClass = true
    ): Promise<T[]> {
        return await this.database.find(classType, filter, toClass) as T[];
    }

    public async has<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>
    ): Promise<boolean> {
        return this.database.has(classType, filter);
    }

    public async remove<T extends IdInterface>(classType: ClassType<T>, id: string) {
        const removed = this.database.remove(classType, id);

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'remove',
                id: id,
                version: 0, //0 means it overwrites always, no matter what previous version was
            });
        }

        return removed;
    }

    public async getIds<T extends IdInterface>(classType: ClassType<T>, filter?: FilterQuery<T>): Promise<string[]> {
        const cursor = await this.cursor(classType, filter, false);
        return (await cursor.project({id: 1}).toArray()).map(v => v.id);
    }

    public async deleteOne<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>) {
        const ids = await this.getIds(classType, filter);

        return this.remove(classType, ids[0]);
    }

    public async deleteMany<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>) {
        const ids = await this.getIds(classType, filter);

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'removeMany',
                ids: ids
            });
        }

        return this.database.deleteMany(classType, {id: {$in: ids}});
    }

    public async add<T extends IdInterface>(
        classType: ClassType<T>,
        item: T,
        options?: {
            advertiseAs?: ClassType<T>,
        }
    ) {
        await this.database.add(classType, item);

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'add',
                id: item.id,
                version: 1,
                item:
                    advertiseAs === classType ?
                        classToPlain(advertiseAs, item) :

                        //make sure only the registered fields are published
                        classToPlain(advertiseAs, plainToClass(advertiseAs, classToPlain(classType, item)))
            });
        }
    }

    public async count<T extends IdInterface>(classType: ClassType<T>, filter?: FilterQuery<T>): Promise<number> {
        return await this.database.count(classType, filter);
    }

    public async cursor<T extends IdInterface>(classType: ClassType<T>, filter?: FilterQuery<T>, toClass = true): Promise<Cursor<T>> {
        return (await this.database.cursor(classType, filter, toClass)) as Cursor<T>;
    }

    public async plainCursor<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>): Promise<Cursor<T>> {
        const collection = await this.collection(classType);

        return collection.find(convertPlainQueryToMongo(classType, filter));
    }

    public async update<T extends IdInterface>(
        classType: ClassType<T>,
        item: T,
        options?: {
            advertiseAs?: ClassType<T>,
        }
    ): Promise<number> {
        const version = await this.database.update(classType, item);

        if (!version) {
            throw new Error('Could not update entity');
        }

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'update',
                id: getIdFieldValue(advertiseAs, item),
                version: version, //this is the new version in the db, which we end up having when `data` is applied.
                item:
                    advertiseAs === classType ?
                        classToPlain(advertiseAs, item) :

                        //make sure only the registered fields are published
                        classToPlain(advertiseAs, plainToClass(advertiseAs, classToPlain(classType, item)))
            });
        }

        return version;
    }

    /**
     * Increases one or multiple fields atomic and returns the new value.
     * This does not send patches to the exchange.
     */
    public async increase<T extends IdInterface, F extends { [field: string]: number }>(
        classType: ClassType<T>,
        filter: FilterQuery<T>,
        fields: F,
        additionalProjection: string[] = []
    ): Promise<{ [k: string]: any }> {
        const collection = await this.collection(classType);
        const projection: { [key: string]: number } = {};
        const statement: { [name: string]: any } = {
            $inc: {}
        };

        for (const [i, v] of eachPair(fields)) {
            statement.$inc[i] = v;
            projection[i] = 1;
        }

        for (const field of additionalProjection) {
            projection[field] = 1;
        }

        const response = await collection.findOneAndUpdate(convertClassQueryToMongo(classType, filter), statement, {
            projection: projection,
            returnOriginal: false
        });

        return partialPlainToClass(classType, partialMongoToPlain(classType, response.value || {}));
    }

    public async patch<T extends IdInterface>(
        classType: ClassType<T>,
        id: string,
        patches: Partial<T> | { [path: string]: any },
        options?: {
            additionalProjection?: string[],
            plain?: boolean,
            advertiseAs?: ClassType<T>,
        }
    ): Promise<{ [field: string]: any }> {
        const collection = await this.collection(classType);

        const patchStatement: { [name: string]: any } = {
            $inc: {version: +1}
        };

        delete (<any>patches)['id'];
        delete (<any>patches)['_id'];
        delete (<any>patches)['version'];

        if (options && options.plain) {
            patchStatement['$set'] = partialPlainToMongo(classType, patches);
        } else {
            patchStatement['$set'] = partialClassToMongo(classType, patches);
        }

        if (Object.keys(patchStatement['$set']).length === 0) {
            throw new Error('No patches given. ' + JSON.stringify(patches));
        }

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        const filter = {id: id};
        const subscribedFields = await this.exchange.getSubscribedEntityFields(advertiseAs);
        const projection: { [key: string]: number } = {
            version: 1,
        };

        for (const field of subscribedFields) {
            projection[field] = 1;
        }

        if (options && options.additionalProjection) {
            for (const field of options.additionalProjection) {
                projection[field] = 1;
            }
        }

        // console.log('Glut patch', filter, patchStatement);
        const response = await collection.findOneAndUpdate(convertClassQueryToMongo(classType, filter), patchStatement, {
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


        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'patch',
                id: id,
                version: newVersion, //this is the new version in the db, which we end up having when `data` is applied.
                item: partialMongoToPlain(advertiseAs, doc),
                patch: jsonPatches,
            });
        }

        return partialPlainToClass(classType, partialMongoToPlain(classType, doc || {}));
    }
}
