/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ConnectionRequest, MongoConnection, MongoConnectionPool, MongoDatabaseTransaction, MongoStats } from './connection.js';
import { isErrorRetryableRead, isErrorRetryableWrite, MongoError } from './error.js';
import { sleep } from '@deepkit/core';
import { Command } from './command/command.js';
import { DropDatabaseCommand } from './command/dropDatabase.js';
import { MongoClientConfig } from './config.js';
import { ReflectionClass } from '@deepkit/type';
import { mongoBinarySerializer } from '../mongo-serializer.js';
import { BSONBinarySerializer } from '@deepkit/bson';

export class MongoClient {
    protected inCloseProcedure: boolean = false;

    public readonly config: MongoClientConfig;
    public connectionPool: MongoConnectionPool;
    public stats: MongoStats = new MongoStats;

    protected serializer: BSONBinarySerializer = mongoBinarySerializer;

    constructor(
        connectionString: string
    ) {
        this.config = new MongoClientConfig(connectionString);
        this.connectionPool = new MongoConnectionPool(this.config, this.serializer, this.stats);
    }

    public resolveCollectionName(schema: ReflectionClass<any>): string {
        return this.config.resolveCollectionName(schema);
    }

    public async connect() {
        await this.connectionPool.connect();
    }

    public close() {
        this.inCloseProcedure = true;
        this.connectionPool.close();
    }

    async dropDatabase(dbName: string): Promise<void> {
        await this.execute(new DropDatabaseCommand(dbName));
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    async getConnection(request: Partial<ConnectionRequest> = {}, transaction?: MongoDatabaseTransaction): Promise<MongoConnection> {
        if (transaction && transaction.connection) return transaction.connection;
        const connection = await this.connectionPool.getConnection(request);
        if (transaction) {
            transaction.connection = connection;
            connection.transaction = transaction;
            try {
                await transaction.begin();
            } catch (error) {
                transaction.ended = true;
                connection.release();
                throw new Error('Could not start transaction: ' + error);
            }
        }
        return connection;
    }

    public async execute<T extends Command<unknown>>(command: T): Promise<ReturnType<T['execute']>> {
        const maxRetries = 10;
        const request = { readonly: !command.needsWritableHost() };

        for (let i = 1; i <= maxRetries; i++) {
            const connection = await this.connectionPool.getConnection(request);

            try {
                return await connection.execute(command);
            } catch (error) {
                if (command.needsWritableHost()) {
                    if (!isErrorRetryableWrite(error)) throw error;
                } else {
                    if (!isErrorRetryableRead(error)) throw error;
                }

                if (i == maxRetries) {
                    throw error;
                }
                await sleep(0.25);
            } finally {
                connection.release();
            }
        }

        throw new MongoError(`Could not execute command since no connection found: ${command}`);
    }
}
