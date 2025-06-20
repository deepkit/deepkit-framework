/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, CollationMessage, Command, HintMessage, TransactionalMessage, WriteConcernMessage } from './command.js';
import { ReflectionClass } from '@deepkit/type';
import type { MongoClientConfig } from '../config.js';
import type { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

interface DeleteResponse extends BaseResponse {
    n: number;
}

type DeleteSchema = {
    delete: string;
    $db: string;
    deletes: {
        q: any;
        limit: number;
        collation?: CollationMessage;
        hint?: HintMessage;
    }[];
} & TransactionalMessage & WriteConcernMessage;

export class DeleteCommand<T extends ReflectionClass<any>> extends Command<number> {
    constructor(
        public schema: T,
        public filter: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<number> {
        const cmd: DeleteSchema = {
            delete: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            deletes: [
                {
                    q: this.filter,
                    limit: this.limit,
                },
            ],
        };
        if (undefined !== this.options.hint) cmd.deletes[0].hint = this.options.hint;
        if (undefined !== this.options.collation) cmd.deletes[0].collation = this.options.collation;

        if (transaction) transaction.applyTransaction(cmd);
        if (!transaction) config.applyWriteConcern(cmd, this.options);

        const res = await this.sendAndWait<DeleteSchema, DeleteResponse>(cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
