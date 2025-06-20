/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, CollationMessage, Command, HintMessage, ReadPreferenceMessage, TransactionalMessage } from './command.js';
import { ReflectionClass } from '@deepkit/type';
import type { MongoClientConfig } from '../config.js';
import type { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

interface CountResponse extends BaseResponse {
    n: number;
}

type CountSchema = {
    count: string;
    $db: string;
    limit?: number;
    query: any;
    skip?: number;
    collation?: CollationMessage;
    hint?: HintMessage;
} & TransactionalMessage & ReadPreferenceMessage;

export class CountCommand<T extends ReflectionClass<any>> extends Command<number> {
    constructor(
        public schema: T,
        public query: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    getCommand(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction) {
        const cmd: CountSchema = {
            count: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            limit: this.limit,
            skip: this.skip,
        };

        if (transaction) transaction.applyTransaction(cmd);
        config.applyReadPreference(host, cmd, this.options, transaction);
        if (undefined !== this.options.hint) cmd.hint = this.options.hint;
        if (undefined !== this.options.collation) cmd.collation = this.options.collation;
        return cmd;
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<number> {
        const cmd = this.getCommand(config, host, transaction);
        const res = await this.sendAndWait<CountSchema, CountResponse>(cmd);
        return res.n;
    }
}
