/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseAdapter, DatabaseAdapterQueryFactory, DatabaseSession, Entity } from '@deepkit/orm';
import { ClassSchema, getClassSchema, t } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { MongoDatabaseQuery } from './query';
import { MongoPersistence } from './persistence';
import { MongoClient } from './client/client';
import { DeleteCommand } from './client/command/delete';
import { MongoQueryResolver } from './query.resolver';

export class MongoDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(
        private client: MongoClient,
        private databaseSession: DatabaseSession<any>,
    ) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T> | ClassSchema<T>
    ): MongoDatabaseQuery<T> {
        const schema = getClassSchema(classType);
        return new MongoDatabaseQuery(schema, this.databaseSession, new MongoQueryResolver(schema, this.databaseSession));
    }
}

export class MongoDatabaseAdapter implements DatabaseAdapter {
    public readonly client: MongoClient;

    protected ormSequences = t.schema({
        name: t.string,
        value: t.number,
    }, { name: this.getAutoIncrementSequencesCollection() });

    constructor(
        connectionString: string
    ) {
        this.client = new MongoClient(connectionString);
    }

    getName(): string {
        return 'mongo';
    }

    getSchemaName(): string {
        return '';
    }

    createPersistence(): MongoPersistence {
        return new MongoPersistence(this.client, this.ormSequences);
    }

    isNativeForeignKeyConstraintSupported() {
        return false;
    }

    queryFactory(databaseSession: DatabaseSession<any>): MongoDatabaseQueryFactory {
        return new MongoDatabaseQueryFactory(this.client, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.client.close();
    }

    getAutoIncrementSequencesCollection(): string {
        return 'orm_sequences';
    }

    async resetAutoIncrementSequences() {
        await this.client.execute(new DeleteCommand(this.ormSequences));
    }

    async migrate(classSchemas: Iterable<ClassSchema>) {
        // for (const schema of classSchemas) {
        //     const collection = await this.connection.getCollection(schema);
        //     //collection not existing yet, so create lock
        //     for (const [name, index] of schema.indices.entries()) {
        //         const fields: { [name: string]: 1 } = {};
        //
        //         if (index.fields.length === 1 && index.fields[0] === '_id') continue;
        //
        //         for (const f of index.fields) {
        //             fields[f] = 1;
        //         }
        //
        //         const options: any = {
        //             name: name
        //         };
        //         if (index.options.unique) options.unique = true;
        //         if (index.options.sparse) options.sparse = true;
        //
        //         try {
        //             await collection.createIndex(fields, options);
        //         } catch (error) {
        //             console.log('failed index', name, '. Recreate ...');
        //             //failed, so drop and re-create
        //             await collection.dropIndex(name);
        //             await collection.createIndex(fields, options);
        //         }
        //     }
        // }
    };
}
