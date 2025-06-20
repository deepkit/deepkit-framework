/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command, TransactionalMessage, WriteConcernMessage } from './command.js';
import { ReflectionClass } from '@deepkit/type';
import type { MongoClientConfig } from '../config.js';
import type { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

interface UpdateResponse extends BaseResponse {
    n: number;
}

type UpdateSchema = {
    update: string;
    $db: string;
    updates: {
        q: any,
        // maybe in the future support classSchema. But `u` supports update statements https://docs.mongodb.com/manual/reference/operator/update/#id1
        u: any,
        multi: boolean,
    }[],
} & TransactionalMessage & WriteConcernMessage;

export class UpdateCommand<T extends ReflectionClass<any>> extends Command<number> {
    constructor(
        public schema: T,
        public updates: { q: any, u: any, multi: boolean }[] = [],
    ) {
        super();
    }

    getCommand(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction) {
        const cmd: UpdateSchema = {
            update: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            updates: this.updates,
        };

        if (transaction) transaction.applyTransaction(cmd);
        if (!transaction) config.applyWriteConcern(cmd, this.options);

        return cmd;
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<number> {
        const cmd = this.getCommand(config, host, transaction);
        const res = await this.sendAndWait<UpdateSchema, UpdateResponse>(cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return true;
    }
}
