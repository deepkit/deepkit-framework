import {Entity, getEntityState, PrimaryKey, DatabasePersistence} from "@super-hornet/marshal-orm";
import {ClassSchema} from "@super-hornet/marshal";
import {classToMongo, partialClassToMongo} from "./mapping";
import {BulkWriteOperation, FilterQuery} from "mongodb";
import {MongoConnection} from "./connection";

export class MongoPersistence extends DatabasePersistence {
    constructor(protected connection: MongoConnection) {
        super();
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const pks = items.map(v => getEntityState(v).getLastKnownPKOrCurrent());
        await collection.deleteMany({$or: pks.map(v => partialClassToMongo(classSchema.classType, v))});
    }

    //todo: really necessary?
    async patch<T>(classSchema: ClassSchema<T>, primaryKey: PrimaryKey<T>, item: Partial<T>): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const updateStatement: { [name: string]: any } = {};
        updateStatement['$set'] = partialClassToMongo(classSchema.classType, item);
        await collection.updateMany(partialClassToMongo(classSchema.classType, primaryKey), updateStatement);
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);

        const operations: Array<BulkWriteOperation<T>> = [];
        const inserted: T[] = [];

        for (const item of items) {
            const state = getEntityState(item);
            if (state.isNew()) {
                operations.push({
                    insertOne: {
                        document: classToMongo(classSchema.classType, item),
                    }
                });
                inserted.push(item);
            } else {
                //todo, build change-set and patch only what is necessary
                operations.push({
                    updateOne: {
                        filter: state.getLastKnownPKOrCurrent() as FilterQuery<T>,
                        update: {$set: classToMongo(classSchema.classType, item)},
                    }
                });
            }
        }

        const res = await collection.bulkWrite(operations, {
            // j: true,
            // w: 'majority'
        });

        for (let i = 0; i < inserted.length; i++) {
            if (res.insertedIds[i]) {
                (inserted[i] as any)._id = res.insertedIds[i].toHexString();
            }
        }

        for (const item of items) {
            getEntityState(item).markAsPersisted();
        }

        return Promise.resolve(undefined);
    }

}
