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

interface CountResponse extends BaseResponse {
    n: number;
}

interface CountSchema {
    count: string;
    $db: string;
    limit?: number;
    query: any;
    skip?: number;
    lsid?: { id: UUID };
    txnNumber?: number;
    startTransaction?: boolean;
    autocommit?: boolean;
}

export class CountCommand<T extends ReflectionClass<any>> extends Command {
    constructor(
        public schema: T,
        public query: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const cmd: any = {
            count: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            limit: this.limit,
            skip: this.skip,
        };

        if (transaction) transaction.applyTransaction(cmd);

        const res = await this.sendAndWait<CountSchema, CountResponse>(cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
