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
import { MongoClientConfig } from '../config.js';
import { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

type CommitTransaction = TransactionalMessage & WriteConcernMessage & {
    $db: string;
};

export class CommitTransactionCommand extends Command<BaseResponse> {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<BaseResponse> {
        const cmd: CommitTransaction = {
            commitTransaction: 1,
            $db: 'admin'
        };

        if (transaction) transaction.applyTransaction(cmd);
        config.applyWriteConcern(cmd, this.options);

        return await this.sendAndWait<CommitTransaction>(cmd);
    }
}
