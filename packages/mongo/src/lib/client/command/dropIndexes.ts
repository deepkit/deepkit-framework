/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command } from './command.js';
import { ReflectionClass } from '@deepkit/type';

interface RequestSchema {
    dropIndexes: string;
    $db: string;
    index: string[];
}

export class DropIndexesCommand<T extends ReflectionClass<any>> extends Command {
    constructor(
        public schema: T,
        public names: string[]
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<BaseResponse> {
        const cmd: any = {
            dropIndexes: this.schema.collectionName || this.schema.name || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            index: this.names
        };

        // if (transaction) transaction.applyTransaction(cmd);

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
