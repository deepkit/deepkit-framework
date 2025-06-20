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

interface FindAndModifyResponse extends BaseResponse {
    value: any;
}

type FindAndModifySchema = {
    findAndModify: string;
    $db: string;
    query: any;
    update: any;
    new: boolean;
    upsert: boolean;
    fields: Record<string, number>;
    collation?: CollationMessage;
    hint?: HintMessage;
} & WriteConcernMessage & TransactionalMessage;

export class FindAndModifyCommand<T extends ReflectionClass<any>> extends Command<FindAndModifyResponse> {
    upsert = false;
    fields: string[] = [];
    returnNew: boolean = false;

    constructor(
        public schema: T,
        public query: any,
        public update: any,
    ) {
        super();
    }

    getCommand(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction) {
        const fields = {};
        for (const name of this.fields) fields[name] = 1;

        const cmd: FindAndModifySchema = {
            findAndModify: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            update: this.update,
            new: this.returnNew,
            upsert: this.upsert,
            fields: fields,
        };

        if (transaction) transaction.applyTransaction(cmd);
        if (!transaction) config.applyWriteConcern(cmd, this.options);
        if (undefined !== this.options.hint) cmd.hint = this.options.hint;
        if (undefined !== this.options.collation) cmd.collation = this.options.collation;

        return cmd;
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<FindAndModifyResponse> {
        const cmd = this.getCommand(config, host, transaction);
        return await this.sendAndWait<FindAndModifySchema, FindAndModifyResponse>(cmd);
    }

    needsWritableHost(): boolean {
        return true;
    }
}
