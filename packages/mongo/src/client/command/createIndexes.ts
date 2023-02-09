/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command } from './command';
import { ReflectionClass } from '@deepkit/type';
import { MongoError } from '../error';

export interface CreateIndex {
    key: { [name: string]: 1 },
    name: string,
    unique: boolean,
    sparse: boolean,
    expireAfterSeconds?: number
}

interface RequestSchema {
    createIndexes: string;
    $db: string;
    indexes: CreateIndex[];
}

export class CreateIndexesCommand<T extends ReflectionClass<any>> extends Command {
    constructor(
        public schema: T,
        public indexes: CreateIndex[],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<BaseResponse> {
        const cmd: any = {
            createIndexes: this.schema.collectionName || this.schema.name || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            indexes: this.indexes,
        };

        // if (transaction) transaction.applyTransaction(cmd);

        try {
            return await this.sendAndWait<RequestSchema>(cmd);
        } catch (error) {
            throw new MongoError(`Could not drop indexes ${JSON.stringify(this.indexes)}: ${error}`);
        }
    }

    needsWritableHost(): boolean {
        return false;
    }
}
