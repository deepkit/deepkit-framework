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
import type { MongoClientConfig } from '../config.js';
import type { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

interface RequestSchema {
    create: string;
    $db: string;
}

export class CreateCollectionCommand<T extends ReflectionClass<any>> extends Command<BaseResponse> {
    constructor(
        public schema: T,
    ) {
        super();
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<BaseResponse> {
        const cmd: any = {
            create: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
        };

        // if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait<RequestSchema>(cmd);
    }

    needsWritableHost(): boolean {
        return true;
    }
}
