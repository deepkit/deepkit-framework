/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabasePersistence, DatabasePersistenceChangeSet, DatabaseSession, Entity, getClassState, getInstanceState } from '@deepkit/orm';
import { ClassSchema } from '@deepkit/type';
import { convertClassQueryToMongo } from './mapping';
import { FilterQuery } from './query.model';
import { MongoClient } from './client/client';
import { InsertCommand } from './client/command/insert';
import { UpdateCommand } from './client/command/update';
import { DeleteCommand } from './client/command/delete';
import { mongoSerializer } from './mongo-serializer';
import { FindAndModifyCommand } from './client/command/find-and-modify';
import { empty } from '@deepkit/core';
import { FindCommand } from './client/command/find';
import { ObjectId } from '@deepkit/bson';

export class MongoPersistence extends DatabasePersistence {

    constructor(protected client: MongoClient, protected ormSequences: ClassSchema, protected session: DatabaseSession<any>) {
        super();
    }

    release() {

    }

    async remove<T extends Entity>(classSchema: ClassSchema<T>, items: T[]): Promise<void> {
        const scopeSerializer = mongoSerializer.for(classSchema);
        const classState = getClassState(classSchema);

        if (classSchema.getPrimaryFields().length === 1) {
            const pk = classSchema.getPrimaryField();
            const pkName = pk.name;
            const ids: any[] = [];

            for (const item of items) {
                const converted = scopeSerializer.partialSerialize(getInstanceState(classState, item).getLastKnownPK());
                ids.push(converted[pkName]);
            }
            await this.client.execute(new DeleteCommand(classSchema, { [pkName]: { $in: ids } }));
        } else {
            const fields: any[] = [];
            for (const item of items) {
                fields.push(scopeSerializer.partialSerialize(getInstanceState(classState, item).getLastKnownPK()));
            }
            await this.client.execute(new DeleteCommand(classSchema, { $or: fields }));
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
                { name: classSchema.getCollectionName(), },
                { $inc: { value: items.length } }
            );
            command.returnNew = true;
            command.fields = ['value'];
            command.upsert = true;
            const res = await this.client.execute(command);
            autoIncrementValue = res.value['value'] - items.length;
        }

        for (const item of items) {
            if (autoIncrement) item[autoIncrement.name] = ++autoIncrementValue;
            if (has_Id && !item['_id']) {
                item['_id'] = ObjectId.generate();
            }

            //replaces references with the foreign key
            const converted = scopeSerializer.serialize(item);
            insert.push(converted);
        }

        if (this.session.logger.active) this.session.logger.log('insert', classSchema.getClassName(), items.length);

        await this.client.execute(new InsertCommand(classSchema, insert));
    }

    async update<T extends Entity>(classSchema: ClassSchema<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const updates: { q: any, u: any, multi: boolean }[] = [];
        const scopeSerializer = mongoSerializer.for(classSchema);

        let hasAtomic = false;
        const primaryKeyName = classSchema.getPrimaryField().name;
        const pks: any[] = [];
        const projection: { [name: string]: 1 } = {};
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
                        assignReturning[id] = { item: changeSet.item, names: [] };
                    }
                    projection[i] = 1;

                    assignReturning[id].names.push(i);
                }
            }

            const u: any = {};
            if (changeSet.changes.$set && !empty(changeSet.changes.$set)) {
                u.$set = scopeSerializer.partialSerialize(changeSet.changes.$set);
            }

            if (changeSet.changes.$inc) u.$inc = changeSet.changes.$inc;
            if (changeSet.changes.$unset) u.$unset = changeSet.changes.$unset;

            updates.push({
                q: convertClassQueryToMongo(classSchema.classType, changeSet.primaryKey as FilterQuery<T>),
                u: u,
                multi: false,
            });
        }

        if (this.session.logger.active) this.session.logger.log('update', classSchema.getClassName(), updates.length);

        const res = await this.client.execute(new UpdateCommand(classSchema, updates));

        if (res > 0 && hasAtomic) {
            const returnings = await this.client.execute(new FindCommand(classSchema, { [primaryKeyName]: { $in: pks } }, projection));
            for (const returning of returnings) {
                const r = assignReturning[returning[primaryKeyName]];

                for (const name of r.names) {
                    r.item[name] = returning[name];
                }
            }
        }
    }
}
