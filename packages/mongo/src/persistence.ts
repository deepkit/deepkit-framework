/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {DatabasePersistence, DatabasePersistenceChangeSet, Entity, getInstanceState} from '@deepkit/orm';
import {ClassSchema} from '@deepkit/type';
import {convertClassQueryToMongo} from './mapping';
import {ObjectId} from 'mongodb';
import {FilterQuery} from './query.model';
import {MongoClient} from './client/client';
import {InsertCommand} from './client/command/insert';
import {UpdateCommand} from './client/command/update';
import {DeleteCommand} from './client/command/delete';
import {mongoSerializer} from './mongo-serializer';
import {FindAndModifyCommand} from './client/command/find-and-modify';
import {empty} from '@deepkit/core';
import {FindCommand} from './client/command/find';


export class MongoPersistence extends DatabasePersistence {

    constructor(protected client: MongoClient, protected ormSequences: ClassSchema) {
        super();
    }

    release() {

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

    async insert<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const insert: any[] = [];
        const has_Id = classSchema.hasProperty('_id');
        const scopeSerializer = mongoSerializer.for(classSchema);

        const autoIncrement = classSchema.getAutoIncrementField();
        let autoIncrementValue = 0;
        if (autoIncrement) {
            const command = new FindAndModifyCommand(
                this.ormSequences,
                {name: classSchema.getCollectionName(),},
                {$inc: {value: items.length}}
            );
            command.returnNew = true;
            command.fields = ['value'];
            command.upsert = true;
            const res = await this.client.execute(command);
            autoIncrementValue = res.value['value'] - items.length;
        }

        for (const item of items) {
            if (autoIncrement) item[autoIncrement.name] = ++autoIncrementValue;
            const converted = scopeSerializer.serialize(item);

            if (has_Id && !item['_id']) {
                converted['_id'] = new ObjectId();
                item['_id'] = converted['_id'].toHexString();
            }
            insert.push(converted);
        }
        await this.client.execute(new InsertCommand(classSchema, insert));
    }

    async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const updates: { q: any, u: any, multi: boolean }[] = [];
        const scopeSerializer = mongoSerializer.for(classSchema);

        let hasAtomic = false;
        const primaryKeyName = classSchema.getPrimaryField().name;
        const pks: any[] = [];
        const projection: {[name: string]: 1} = {};
        projection[primaryKeyName] = 1;
        const assignReturning: { [name: string]: { item: any, names: string[] } } = {};

        for (const changeSet of changeSets) {
            if (!hasAtomic && !empty(changeSet.changes.$inc)) hasAtomic = true;
            pks.push(changeSet.primaryKey[primaryKeyName]);

            const id = changeSet.primaryKey[primaryKeyName];

            if (!empty(changeSet.changes.$inc)) {
                for (const i in changeSet.changes.$inc) {
                    if (!changeSet.changes.$inc.hasOwnProperty(i)) continue;

                    if (!assignReturning[id]) {
                        assignReturning[id] = {item: changeSet.item, names: []};
                    }
                    projection[i] = 1;

                    assignReturning[id].names.push(i);
                }
            }

            updates.push({
                q: convertClassQueryToMongo(classSchema.classType, changeSet.primaryKey as FilterQuery<T>),
                u: {
                    $set: !empty(changeSet.changes.$set) ? scopeSerializer.partialSerialize(changeSet.changes.$set!) : undefined,
                    $inc: changeSet.changes.$inc,
                    $unset: changeSet.changes.$unset,
                },
                multi: false,
            });
        }

        const res = await this.client.execute(new UpdateCommand(classSchema, updates));

        if (res > 0 && hasAtomic) {
            const returnings = await this.client.execute(new FindCommand(classSchema, {[primaryKeyName]: {$in: pks}}, projection));
            for (const returning of returnings) {
                const r = assignReturning[returning[primaryKeyName]];

                for (const name of r.names) {
                    r.item[name] = returning[name];
                }
            }
        }
    }
}
