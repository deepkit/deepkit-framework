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

interface FindAndModifyResponse extends BaseResponse {
    value: any;
}

interface findAndModifySchema {
    findAndModify: string;
    $db: string;
    query: any;
    update: any;
    new: boolean;
    upsert: boolean;
    fields: Record<string, number>;
    lsid?: { id: UUID };
    txnNumber?: number;
    autocommit?: boolean;
    startTransaction?: boolean;
}

export class FindAndModifyCommand<T extends ReflectionClass<any>> extends Command {
    public upsert = false;
    public fields: string[] = [];
    public returnNew: boolean = false;

    constructor(
        public schema: T,
        public query: any,
        public update: any,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<FindAndModifyResponse> {
        const fields = {};
        for (const name of this.fields) fields[name] = 1;

        const cmd: any = {
            findAndModify: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            update: this.update,
            new: this.returnNew,
            upsert: this.upsert,
            fields: fields,
        };

        if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait<findAndModifySchema, FindAndModifyResponse>(cmd);
    }

    needsWritableHost(): boolean {
        return true;
    }
}
