import {DatabasePersistence, Entity, getInstanceState} from '@super-hornet/marshal-orm';
import {ClassSchema, createClassToXFunction} from '@super-hornet/marshal';
import {convertClassQueryToMongo, partialClassToMongo} from './mapping';
import {MongoConnection} from './connection';
import {ObjectId} from 'mongodb';
import {FilterQuery} from './query.model';

export class MongoPersistence extends DatabasePersistence {
    constructor(protected connection: MongoConnection) {
        super();
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const ids: any[] = [];
        for (const item of items) {
            ids.push(partialClassToMongo(classSchema, getInstanceState(item).getLastKnownPKOrCurrent()));
        }
        await collection.deleteMany({$or: ids});
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const insert: T[] = [];
        const update: { q: any, u: any }[] = [];
        const has_Id = classSchema.hasProperty('_id');
        const converter = createClassToXFunction(classSchema, 'mongo');

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                //     //todo, build change-set and patch only what is necessary
                update.push({
                    q: convertClassQueryToMongo(classSchema.classType, state.getLastKnownPKOrCurrent() as FilterQuery<T>),
                    u: converter(item)
                });
            } else {
                const converted = converter(item);
                if (has_Id && !item['_id']) {
                    converted['_id'] = new ObjectId();
                    item['_id'] = converted['_id'].toHexString();
                }
                insert.push(converted);
            }
        }

        if (insert.length) await this.connection.insertMany(classSchema.classType, insert);
        if (update.length) await this.connection.updateMany(classSchema.classType, update);
    }
}
