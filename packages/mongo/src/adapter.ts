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
import { MongoDatabaseTransaction } from './client/connection';
import { CreateIndex, CreateIndexesCommand } from './client/command/createIndexes';
import { DropIndexesCommand } from './client/command/dropIndexes';
import { CreateCollectionCommand } from './client/command/createCollection';

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
        return new MongoDatabaseQuery(schema, this.databaseSession, new MongoQueryResolver(schema, this.databaseSession, this.client));
    }
}

export class MongoDatabaseAdapter extends DatabaseAdapter {
    public readonly client: MongoClient;

    protected ormSequences = t.schema({
        name: t.string,
        value: t.number,
    }, { name: this.getAutoIncrementSequencesCollection() });

    constructor(
        connectionString: string
    ) {
        super();
        this.client = new MongoClient(connectionString);
    }

    getName(): string {
        return 'mongo';
    }

    getSchemaName(): string {
        return '';
    }

    createPersistence(session: DatabaseSession<this>): MongoPersistence {
        return new MongoPersistence(this.client, this.ormSequences, session);
    }

    createTransaction(session: DatabaseSession<this>): MongoDatabaseTransaction {
        return new MongoDatabaseTransaction;
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
        let withOrmSequences = false;
        for (const schema of classSchemas) {
            await this.migrateClassSchema(schema);
            for (const property of schema.getProperties()) {
                if (property.isAutoIncrement) withOrmSequences = true;
            }
        }

        if (withOrmSequences) {
            await this.migrateClassSchema(this.ormSequences);
        }
    };

    async migrateClassSchema(schema: ClassSchema) {
        try {
            await this.client.execute(new CreateCollectionCommand(schema));
        } catch (error) {
            //its fine to fail
        }

        for (const [name, index] of schema.indices.entries()) {
            const fields: { [name: string]: 1 } = {};

            if (index.fields.length === 1 && index.fields[0] === '_id') continue;

            for (const f of index.fields) {
                fields[f] = 1;
            }

            const createIndex: CreateIndex = {
                name: name || index.fields.join('_'),
                key: fields,
                unique: !!index.options.unique,
                sparse: !!index.options.sparse,
            };

            try {
                await this.client.execute(new CreateIndexesCommand(schema, [createIndex]));
            } catch (error) {
                console.log('failed index', name, '. Recreate ...');
                //failed (because perhaps of incompatibilities). Dropping and creating a fresh index
                //can resolve that. If the second create also fails, then it throws.
                try {
                    await this.client.execute(new DropIndexesCommand(schema, [name]));
                } catch (error) {}

                await this.client.execute(new CreateIndexesCommand(schema, [createIndex]));
            }
        }
    }
}
