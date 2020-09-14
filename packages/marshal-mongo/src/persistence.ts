import {DatabasePersistence, Entity, getInstanceState, getJitChangeDetector, getJITConverterForSnapshot} from '@deepkit/marshal-orm';
import {ClassSchema} from '@deepkit/marshal';
import {convertPlainQueryToMongo} from './mapping';
import {ObjectId} from 'mongodb';
import {FilterQuery} from './query.model';
import {MongoClient} from './client/client';
import {InsertCommand} from './client/command/insert';
import {UpdateCommand} from './client/command/update';
import {DeleteCommand} from './client/command/delete';
import {mongoSerializer} from './mongo-serializer';

export class MongoPersistence extends DatabasePersistence {
    constructor(protected client: MongoClient) {
        super();
    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const scopeSerializer = mongoSerializer.for(classSchema);

        if (classSchema.getPrimaryFields().length === 1) {
            const pk = classSchema.getPrimaryField();
            const pkName = pk.name;
            const ids: any[] = [];

            for (const item of items) {
                const converted = scopeSerializer.partialSerialize(getInstanceState(item).getLastKnownPK());
                ids.push(converted[pkName]);
            }
            await this.client.execute(new DeleteCommand(classSchema, {[pkName]: {$in: ids}}));
        } else {
            const fields: any[] = [];
            for (const item of items) {
                fields.push(scopeSerializer.partialSerialize(getInstanceState(item).getLastKnownPK()));
            }
            await this.client.execute(new DeleteCommand(classSchema, {$or: fields}));
        }
    }

    async persist<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const insert: any[] = [];
        const updates: { q: any, u: any, multi: boolean }[] = [];
        const has_Id = classSchema.hasProperty('_id');
        const scopeSerializer = mongoSerializer.for(classSchema);
        const changeDetector = getJitChangeDetector(classSchema);
        const doSnapshot = getJITConverterForSnapshot(classSchema);

        for (const item of items) {
            const state = getInstanceState(item);
            if (state.isKnownInDatabase()) {
                const lastSnapshot = state.getSnapshot();
                const currentSnapshot = doSnapshot(item);
                const changes = changeDetector(lastSnapshot, currentSnapshot, item);
                if (!changes) continue;
                updates.push({
                    q: convertPlainQueryToMongo(classSchema.classType, state.getLastKnownPK() as FilterQuery<T>),
                    u: {$set: scopeSerializer.partialSerialize(changes)},
                    multi: false,
                });
            } else {
                const converted = scopeSerializer.serialize(item);
                if (has_Id && !item['_id']) {
                    converted['_id'] = new ObjectId();
                    item['_id'] = converted['_id'].toHexString();
                }
                insert.push(converted);
            }
        }

        if (insert.length) await this.client.execute(new InsertCommand(classSchema, insert));
        if (updates.length) await this.client.execute(new UpdateCommand(classSchema, updates));
    }
}
