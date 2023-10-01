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
    create: string;
    $db: string;
}

export class CreateCollectionCommand<T extends ReflectionClass<any>> extends Command {
    constructor(
        public schema: T,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<BaseResponse> {
        const cmd: any = {
            create: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
        };

        // if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait<RequestSchema>(cmd);
    }

    needsWritableHost(): boolean {
        return false;
    }
}
