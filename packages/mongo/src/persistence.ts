/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabasePersistence, DatabasePersistenceChangeSet, DatabaseSession, getClassState, getInstanceState, OrmEntity } from '@deepkit/orm';
import { convertClassQueryToMongo } from './mapping.js';
import { FilterQuery } from './query.model.js';
import { MongoClient } from './client/client.js';
import { InsertCommand } from './client/command/insert.js';
import { UpdateCommand } from './client/command/update.js';
import { DeleteCommand } from './client/command/delete.js';
import { FindAndModifyCommand } from './client/command/findAndModify.js';
import { empty } from '@deepkit/core';
import { FindCommand } from './client/command/find.js';
import { MongoConnection } from './client/connection.js';
import { getPartialSerializeFunction, ReflectionClass } from '@deepkit/type';
import { ObjectId } from '@deepkit/bson';
import { mongoSerializer } from './mongo-serializer.js';

export class MongoPersistence extends DatabasePersistence {
    protected connection?: MongoConnection;

    constructor(protected client: MongoClient, protected ormSequences: ReflectionClass<any>, protected session: DatabaseSession<any>) {
        super();
    }

    release() {
        if (this.connection) this.connection.release();
    }

    async getConnection(): Promise<MongoConnection> {
        if (!this.connection) {
            this.connection = await this.client.getConnection(undefined, this.session.assignedTransaction);
        }
        return this.connection;
    }

    async remove<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const classState = getClassState(classSchema);
        const partialSerialize = getPartialSerializeFunction(classSchema.type, mongoSerializer.serializeRegistry);

        if (classSchema.getPrimaries().length === 1) {
            const pk = classSchema.getPrimary();
            const pkName = pk.name;
            const ids: any[] = [];

            for (const item of items) {
                const pk = getInstanceState(classState, item).getLastKnownPK();
                const converted = partialSerialize(pk);
                ids.push(converted[pkName]);
            }
            await (await this.getConnection()).execute(new DeleteCommand(classSchema, { [pkName]: { $in: ids } }));
        } else {
            const fields: any[] = [];
            for (const item of items) {
                fields.push(partialSerialize(getInstanceState(classState, item).getLastKnownPK()));
            }
            await (await this.getConnection()).execute(new DeleteCommand(classSchema, { $or: fields }));
        }
    }

    async insert<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void> {
        const insert: any[] = [];
        const has_Id = classSchema.hasProperty('_id');

        const connection = await this.getConnection();
        const autoIncrement = classSchema.getAutoIncrement();
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

            //we do not use the same connection for ormSequences if it has a transaction, since
            //sequences need to behave like AUTO_INCREMENT does in SQL databases (they increase no matter if transaction is aborted or not)
            const res = await (this.session.assignedTransaction ? this.client : connection).execute(command);
            autoIncrementValue = res.value['value'] - items.length;
        }

        for (const item of items) {
            if (autoIncrement) item[autoIncrement.name] = ++autoIncrementValue;
            if (has_Id && !item['_id']) {
                item['_id'] = ObjectId.generate();
            }

            //replaces references with the foreign key
            // const converted = scopeSerializer.serialize(item);
            insert.push(item);
        }

        if (this.session.logger.active) this.session.logger.log('insert', classSchema.getClassName(), items.length);

        await connection.execute(new InsertCommand(classSchema, insert));
    }

    async update<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void> {
        const updates: { q: any, u: any, multi: boolean }[] = [];
        const partialSerializer = getPartialSerializeFunction(classSchema.type, mongoSerializer.serializeRegistry)

        let hasAtomic = false;
        const primaryKeyName = classSchema.getPrimary().name;
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
                //important to correctly set references
                u.$set = partialSerializer(changeSet.changes.$set);
            }

            if (changeSet.changes.$inc) u.$inc = changeSet.changes.$inc;
            if (changeSet.changes.$unset) u.$unset = changeSet.changes.$unset;

            updates.push({
                q: convertClassQueryToMongo(classSchema, changeSet.primaryKey as FilterQuery<T>),
                u: u,
                multi: false,
            });
        }

        if (this.session.logger.active) this.session.logger.log('update', classSchema.getClassName(), updates.length);

        const connection = await this.getConnection();

        const res = await connection.execute(new UpdateCommand(classSchema, updates));

        if (res > 0 && hasAtomic) {
            const returnings = await connection.execute(new FindCommand(classSchema, { [primaryKeyName]: { $in: pks } }, projection));
            for (const returning of returnings) {
                const r = assignReturning[returning[primaryKeyName]];

                for (const name of r.names) {
                    r.item[name] = returning[name];
                }
            }
        }
    }
}
