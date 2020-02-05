import {Injectable} from 'injection-js';
import {classToPlain, partialClassToPlain, partialPlainToClass, plainToClass, getClassTypeFromInstance} from '@marcj/marshal';
import {Exchange} from "./exchange";
import {convertClassQueryToMongo, Database, mongoToPlain, partialClassToMongo, partialMongoToPlain, partialPlainToMongo} from "@marcj/marshal-mongo";
import {EntityPatches, FilterQuery, IdInterface} from "@marcj/glut-core";
import {ClassType, eachPair, eachKey} from '@marcj/estdlib';
import {Observable, Subscription} from 'rxjs';
import {findQuerySatisfied} from './utils';
import {Collection, Cursor} from 'mongodb';

export interface ExchangeNotifyPolicy {
    notifyChanges<T>(classType: ClassType<T>): boolean;
}

/**
 * A exchangeDatabase that also publishes change feeds to the exchange.
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
        return await this.database.connection.getCollection(classType);
    }

    protected notifyChanges<T>(classType: ClassType<T>): boolean {
        return this.exchangeNotifyPolicy.notifyChanges(classType);
    }

    public query() {
        //todo implement that
        // and remove `remove`, `deleteMany`, `ids`, `deleteOne`
        // add hook to know when to sent sync data to the exchange
    }

    public async remove<T extends IdInterface>(classType: ClassType<T>, id: string) {
        await this.database.query(classType).filter({id: id}).deleteOne();

        if (this.notifyChanges(classType)) {
            this.exchange.publishEntity(classType, {
                type: 'remove',
                id: id,
                version: 0, //0 means it overwrites always, no matter what previous version was
            });
        }
    }

    public async getIds<T extends IdInterface>(classType: ClassType<T>, filter?: FilterQuery<T>): Promise<string[]> {
        return (await this.database.query(classType).select(['id']).filter(filter).find()).map(v => v.id);
    }

    public async deleteOne<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>) {
        const ids = await this.getIds(classType, filter);

        if (ids.length > 0) {
            return this.remove(classType, ids[0]);
        }
    }

    public async deleteMany<T extends IdInterface>(classType: ClassType<T>, filter: FilterQuery<T>): Promise<void> {
        const ids = await this.getIds(classType, filter);

        if (ids.length > 0) {
            await this.database.query(classType).filter({id: {$in: ids}}).deleteMany();

            if (this.notifyChanges(classType)) {
                this.exchange.publishEntity(classType, {
                    type: 'removeMany',
                    ids: ids
                });
            }
        }
    }

    public async add<T extends IdInterface>(
        item: T,
        options?: {
            advertiseAs?: ClassType<T>,
        }
    ): Promise<void> {
        item.version = 0;
        await this.database.add(item);
        const classType = getClassTypeFromInstance(item);

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'add',
                id: item.id,
                version: 0,
                item:
                    advertiseAs === classType ?
                        classToPlain(advertiseAs, item) :

                        //make sure only the registered fields are published
                        classToPlain(advertiseAs, plainToClass(advertiseAs, classToPlain(classType, item)))
            });
        }
    }

    /**
     * Returns a new Observable that resolves the id as soon as an item in the database of given filter criteria is found.
     */
    public onCreation<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>,
        initialCheck: boolean = true,
        stopOnFind: boolean = true,
    ): Observable<string> {
        return new Observable((observer) => {
            let sub: Subscription | undefined;

            (async () => {
                sub = await this.exchange.subscribeEntity(classType, (message) => {
                    if (message.type === 'add' && findQuerySatisfied(message.item, filter)) {
                        observer.next(message.id);
                        if (stopOnFind && sub) sub.unsubscribe();
                    }
                });

                if (initialCheck) {
                    const items = await (await this.rawPlainCursor(classType, filter, ['id'])).toArray();
                    if (items.length) {
                        observer.next(items[0].id);
                        if (stopOnFind) sub.unsubscribe();
                    }
                }
            })();

            return {
                unsubscribe() {
                    if (sub) sub.unsubscribe();
                }
            };
        });
    }

    /**
     * Returns a find cursor of MongoDB with map to mongoToPlain, or partialMongoToPlain if fields are given.
     *
     * `filter` needs to be a FilterQuery of class parameters. convertClassQueryToMongo() is applied accordingly.
     */
    public async rawPlainCursor<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>,
        fields: (keyof T | string)[] = []
    ): Promise<Cursor<T>> {
        const hasProjection = fields.length > 0;
        const projection: any = {};

        if (hasProjection) {
            for (const field of fields) {
                projection[field] = 1;
            }
        }

        const cursor = (await this.database.connection.getCollection(classType))
            .find(filter ? convertClassQueryToMongo(classType, filter) : undefined)
            .map((v: any) => hasProjection ? partialMongoToPlain(classType, v) : mongoToPlain(classType, v));

        if (hasProjection) {
            cursor.project(projection);
        }

        return cursor;
    }

    public async update<T extends IdInterface>(
        item: T,
        options?: {
            advertiseAs?: ClassType<T>,
        }
    ): Promise<number> {
        //at some point we need to implement https://github.com/automerge/automerge
        item.version = await this.exchange.version();
        await this.database.update(item);
        const classType = getClassTypeFromInstance(item);

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'update',
                id: item.id,
                version: item.version, //this is the new version in the db, which we end up having when `data` is applied.
                item:
                    advertiseAs === classType ?
                        classToPlain(advertiseAs, item) :

                        //make sure only the registered fields are published
                        classToPlain(advertiseAs, plainToClass(advertiseAs, classToPlain(classType, item)))
            });
        }

        return item.version;
    }


    /**
     * Increases one or multiple fields atomic and returns the new value. Only changes on item in the collection.
     */
    public async increase<T extends IdInterface, F extends { [field: string]: number }>(
        classType: ClassType<T>,
        filter: FilterQuery<T>,
        fields: F,
        additionalProjection: string[] = [],
        options?: {
            advertiseAs?: ClassType<T>,
        }
    ): Promise<{ [k: string]: any }> {
        const collection = await this.collection(classType);
        const projection: { [key: string]: number } = {};
        const statement: { [name: string]: any } = {
            $inc: {},
            $set: {},
        };

        for (const [i, v] of eachPair(fields)) {
            statement.$inc[i] = v;
            projection[i] = 1;
        }

        for (const field of additionalProjection) {
            projection[field] = 1;
        }

        const version = await this.exchange.version();
        statement.$set['version'] = version;
        projection['id'] = 1;

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;
        const subscribedFields = await this.exchange.getSubscribedEntityFields(advertiseAs);

        for (const field of subscribedFields) {
            projection[field] = 1;
        }

        const response = await collection.findOneAndUpdate(convertClassQueryToMongo(classType, filter), statement, {
            projection: projection,
            returnOriginal: false
        });

        const doc = response.value;

        if (!doc) {
            return {};
        }

        delete (doc as any)._id;

        if (this.notifyChanges(advertiseAs)) {
            const plain = partialMongoToPlain(classType, response.value || {});

            const jsonPatches: any = {};
            for (const i of eachKey(fields)) {
                jsonPatches[i] = plain[i];
            }

            this.exchange.publishEntity(advertiseAs, {
                type: 'patch',
                id: plain.id,
                version: version, //this is the new version in the db, which we end up having when `patch` is applied.
                item: partialMongoToPlain(advertiseAs, doc),
                patch: jsonPatches,
            });
        }

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
        //at some point we need to implement https://github.com/automerge/automerge
        const collection = await this.collection(classType);

        const version = await this.exchange.version();
        const patchStatement: { [name: string]: any } = {};

        delete (<any>patches)['id'];
        delete (<any>patches)['_id'];
        delete (<any>patches)['version'];

        if (options && options.plain) {
            patchStatement['$set'] = partialPlainToMongo(classType, patches);
        } else {
            patchStatement['$set'] = partialClassToMongo(classType, patches);
        }

        patchStatement['$set']['version'] = version;

        if (Object.keys(patchStatement['$set']).length === 0) {
            throw new Error('No patches given. ' + JSON.stringify(patches));
        }

        const advertiseAs = options && options.advertiseAs ? options.advertiseAs : classType;

        const filter = {id: id};
        const subscribedFields = await this.exchange.getSubscribedEntityFields(advertiseAs);
        const projection: { [key: string]: number } = {};

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

        delete (doc as any)._id;

        const jsonPatches: EntityPatches = partialClassToPlain(classType, patches);

        if (this.notifyChanges(advertiseAs)) {
            this.exchange.publishEntity(advertiseAs, {
                type: 'patch',
                id: id,
                version: version, //this is the new version in the db, which we end up having when `patch` is applied.
                item: partialMongoToPlain(advertiseAs, doc),
                patch: jsonPatches,
            });
        }

        return partialPlainToClass(classType, partialMongoToPlain(classType, doc || {}));
    }
}
