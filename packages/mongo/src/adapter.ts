/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseAdapter, DatabaseAdapterQueryFactory, DatabaseEntityRegistry, DatabaseSession, OrmEntity } from '@deepkit/orm';
import { AbstractClassType, ClassType } from '@deepkit/core';
import { MongoDatabaseQuery } from './query.js';
import { MongoPersistence } from './persistence.js';
import { MongoClient } from './client/client.js';
import { DeleteCommand } from './client/command/delete.js';
import { MongoQueryResolver } from './query.resolver.js';
import { MongoDatabaseTransaction } from './client/connection.js';
import { CreateIndex, CreateIndexesCommand } from './client/command/createIndexes.js';
import { DropIndexesCommand } from './client/command/dropIndexes.js';
import { CreateCollectionCommand } from './client/command/createCollection.js';
import { entity, ReceiveType, ReflectionClass } from '@deepkit/type';

export class MongoDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(
        private client: MongoClient,
        private databaseSession: DatabaseSession<any>,
    ) {
        super();
    }

    createQuery<T extends OrmEntity>(type?: ReceiveType<T> | ClassType<T> | AbstractClassType<T> | ReflectionClass<T>): MongoDatabaseQuery<T> {
        const schema = ReflectionClass.from(type);
        return new MongoDatabaseQuery(schema, this.databaseSession, new MongoQueryResolver(schema, this.databaseSession, this.client));
    }
}

export class MongoDatabaseAdapter extends DatabaseAdapter {
    public readonly client: MongoClient;

    protected ormSequences: ReflectionClass<any>;

    constructor(
        connectionString: string
    ) {
        super();
        this.client = new MongoClient(connectionString);

        @entity.name(this.getAutoIncrementSequencesCollection())
        class OrmSequence {
            name!: string;
            value!: number;
        }

        this.ormSequences = ReflectionClass.from(OrmSequence);
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

    async migrate(entityRegistry: DatabaseEntityRegistry) {
        await this.client.connect(); //manually connect to catch connection errors
        let withOrmSequences = true;
        for (const schema of entityRegistry.forMigration()) {
            await this.migrateClassSchema(schema);
            for (const property of schema.getProperties()) {
                if (property.isAutoIncrement()) withOrmSequences = true;
            }
        }

        if (withOrmSequences) {
            await this.migrateClassSchema(this.ormSequences);
        }
    };

    async migrateClassSchema(schema: ReflectionClass<any>) {
        try {
            await this.client.execute(new CreateCollectionCommand(schema));
        } catch (error) {
            //it's fine to fail
        }

        for (const index of schema.indexes) {
            const fields: { [name: string]: 1 } = {};

            if (index.names.length === 1 && index.names[0] === '_id') continue;

            //todo: namingStrategy
            for (const f of index.names) {
                fields[f] = 1;
            }

            const indexName = index.options.name || index.names.join('_');
            const createIndex: CreateIndex = {
                name: indexName,
                key: fields,
                unique: !!index.options.unique,
                sparse: !!index.options.sparse,
            };
            if (index.options.expireAfterSeconds) {
                createIndex.expireAfterSeconds = Number(index.options.expireAfterSeconds);
            }

            try {
                await this.client.execute(new CreateIndexesCommand(schema, [createIndex]));
            } catch (error) {
                console.log('failed index', indexName, '. Recreate ...');
                //failed (because perhaps of incompatibilities). Dropping and creating a fresh index
                //can resolve that. If the second create also fails, then it throws.
                try {
                    await this.client.execute(new DropIndexesCommand(schema, [indexName]));
                } catch (error) {
                }

                await this.client.execute(new CreateIndexesCommand(schema, [createIndex]));
            }
        }
    }
}
