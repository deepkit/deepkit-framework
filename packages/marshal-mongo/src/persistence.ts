import {DatabasePersistence, Entity, getInstanceState} from "@super-hornet/marshal-orm";
import {ClassSchema} from "@super-hornet/marshal";
import {classToMongo, convertClassQueryToMongo, partialClassToMongo} from "./mapping";
import {BulkWriteOperation, FilterQuery} from "mongodb";
import {MongoConnection} from "./connection";

export class MongoPersistence extends DatabasePersistence {
    constructor(protected connection: MongoConnection) {
        super();
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const pks = items.map(v => getInstanceState(v).getLastKnownPKOrCurrent());
        await collection.deleteMany({$or: pks.map(v => partialClassToMongo(classSchema.classType, v))});
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);

        const operations: Array<BulkWriteOperation<T>> = [];
        const inserted: T[] = [];

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                //todo, build change-set and patch only what is necessary
                operations.push({
                    replaceOne: {
                        filter: convertClassQueryToMongo(classSchema.classType, state.getLastKnownPKOrCurrent() as FilterQuery<T>),
                        replacement: classToMongo(classSchema.classType, item),
                    }
                });
            } else {
                operations.push({
                    insertOne: {
                        document: classToMongo(classSchema.classType, item),
                    }
                });
                inserted.push(item);
            }
        }

        const res = await collection.bulkWrite(operations, {
            // j: true,
            // w: 'majority'
        });

        if (classSchema.hasProperty('_id')) {
            for (let i = 0; i < inserted.length; i++) {
                if (res.insertedIds[i]) {
                    (inserted[i] as any)._id = res.insertedIds[i].toHexString();
                }
            }
        }
    }
}
