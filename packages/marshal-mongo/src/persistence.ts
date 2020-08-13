import {DatabasePersistence, Entity, getInstanceState} from '@super-hornet/marshal-orm';
import {ClassSchema, createClassToXFunction, createPartialXToXFunction} from '@super-hornet/marshal';
import {convertPlainQueryToMongo, partialPlainToMongo} from './mapping';
import {MongoConnection} from './connection';
import {ObjectId} from 'mongodb';
import {FilterQuery} from './query.model';

export class MongoPersistence extends DatabasePersistence {
    constructor(protected connection: MongoConnection) {
        super();
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema);
        const ids: any[] = [];
        for (const item of items) {
            ids.push(partialPlainToMongo(classSchema, getInstanceState(item).getLastKnownPK()));
        }
        await collection.deleteMany({$or: ids});
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const insert: T[] = [];
        const updates: { q: any, u: any }[] = [];
        const has_Id = classSchema.hasProperty('_id');
        const converter = createClassToXFunction(classSchema, 'mongo');
        const converterPartial = createPartialXToXFunction(classSchema, 'class', 'mongo');

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                const lastSnapshot = state.getSnapshot();
                const currentSnapshot = state.doSnapshot(item);
                const changes = state.changeDetector(lastSnapshot, currentSnapshot, item);
                updates.push({
                    q: convertPlainQueryToMongo(classSchema.classType, state.getLastKnownPK() as FilterQuery<T>),
                    u: {$set: converterPartial(changes)}
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

        if (insert.length) await this.connection.insertMany(classSchema, insert);
        if (updates.length) await this.connection.updateMany(classSchema, updates);
    }
}
