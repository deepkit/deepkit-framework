/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ConnectionRequest, MongoConnection, MongoConnectionPool } from './connection';
import { ClassSchema } from '@deepkit/type';
import { isErrorRetryableRead, isErrorRetryableWrite, MongoError } from './error';
import { ClassType, sleep } from '@deepkit/core';
import { Command } from './command/command';
import { DropDatabaseCommand } from './command/drop-database';
import { MongoClientConfig } from './config';

export class MongoClient {
    protected inCloseProcedure: boolean = false;

    public readonly config: MongoClientConfig;

    protected connectionPool: MongoConnectionPool;

    constructor(
        connectionString: string
    ) {
        this.config = new MongoClientConfig(connectionString);
        this.connectionPool = new MongoConnectionPool(this.config);
    }

    public resolveCollectionName(schema: ClassSchema | ClassType): string {
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
    getConnection(request: ConnectionRequest = {}): Promise<MongoConnection> {
        return this.connectionPool.getConnection(request);
    }

    public async execute<T extends Command>(command: T): Promise<ReturnType<T['execute']>> {
        const maxRetries = 10;
        const request = { writable: command.needsWritableHost() };
        await this.connectionPool.ensureHostsConnected(true);

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
