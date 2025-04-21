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
import { CommandOptions } from '../options.js';

type RequestSchema = {
    dropIndexes: string;
    $db: string;
    index: string[];
} & WriteConcernMessage;

export class DropIndexesCommand<T extends ReflectionClass<any>> extends Command<BaseResponse> {
    commandOptions: CommandOptions = {};

    constructor(
        public schema: T,
        public names: string[],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<BaseResponse> {
        const cmd: RequestSchema = {
            dropIndexes: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            index: this.names,
        };

        // if (transaction) transaction.applyTransaction(cmd);
        config.applyWriteConcern(cmd, this.commandOptions);

        try {
            return await this.sendAndWait<RequestSchema>(cmd);
        } catch (error) {
            throw new Error(`Could not drop indexes ${JSON.stringify(this.names)}: ${error}`);
        }
    }

    needsWritableHost(): boolean {
        return false;
    }
}
