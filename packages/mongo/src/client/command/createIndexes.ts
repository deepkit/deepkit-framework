/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command, WriteConcernMessage } from './command.js';
import { ReflectionClass } from '@deepkit/type';
import { MongoError } from '../error.js';
import { CommandOptions } from '../options.js';

export interface CreateIndex {
    key: { [name: string]: 1 },
    name: string,
    unique: boolean,
    sparse: boolean,
    expireAfterSeconds?: number
}

type RequestSchema = {
    createIndexes: string;
    $db: string;
    indexes: CreateIndex[];
} & WriteConcernMessage;

export class CreateIndexesCommand<T extends ReflectionClass<any>> extends Command<BaseResponse> {
    commandOptions: CommandOptions = {};

    constructor(
        public schema: T,
        public indexes: CreateIndex[],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<BaseResponse> {
        const cmd: RequestSchema = {
            createIndexes: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            indexes: this.indexes,
        };

        config.applyWriteConcern(cmd, this.commandOptions);

        // if (transaction) transaction.applyTransaction(cmd);

        try {
            return await this.sendAndWait<RequestSchema>(cmd);
        } catch (error) {
            throw new MongoError(`Could not drop indexes ${JSON.stringify(this.indexes)}: ${error}`);
        }
    }

    needsWritableHost(): boolean {
        return true;
    }
}
