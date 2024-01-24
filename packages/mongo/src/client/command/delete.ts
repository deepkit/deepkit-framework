/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ReflectionClass, UUID } from '@deepkit/type';

import { BaseResponse, Command } from './command.js';

interface DeleteResponse extends BaseResponse {
    n: number;
}

interface DeleteSchema {
    delete: string;
    $db: string;
    deletes: { q: any; limit: number }[];
    lsid?: { id: UUID };
    txnNumber?: number;
    autocommit?: boolean;
    startTransaction?: boolean;
}

export class DeleteCommand<T extends ReflectionClass<any>> extends Command {
    constructor(
        public schema: T,
        public filter: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const cmd = {
            delete: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            deletes: [
                {
                    q: this.filter,
                    limit: this.limit,
                },
            ],
        };

        if (transaction) transaction.applyTransaction(cmd);

        const res = await this.sendAndWait<DeleteSchema, DeleteResponse>(cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
