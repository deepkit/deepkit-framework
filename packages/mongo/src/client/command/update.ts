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
import { ReflectionClass, UUID } from '@deepkit/type';

interface UpdateResponse extends BaseResponse {
    n: number;
}

interface UpdateSchema {
    update: string;
    $db: string;
    updates: {
        q: any,
        // maybe in the future support classSchema. But `u` supports update statements https://docs.mongodb.com/manual/reference/operator/update/#id1
        u: any,
        multi: boolean,
    }[],
    lsid?: { id: UUID };
    txnNumber?: number,
    autocommit?: boolean,
    startTransaction?: boolean;
}

export class UpdateCommand<T extends ReflectionClass<any>> extends Command<number> {
    constructor(
        public schema: T,
        public updates: { q: any, u: any, multi: boolean }[] = [],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const cmd = {
            update: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            updates: this.updates
        };
        if (transaction) transaction.applyTransaction(cmd);

        const res = await this.sendAndWait<UpdateSchema, UpdateResponse>(cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return true;
    }
}
