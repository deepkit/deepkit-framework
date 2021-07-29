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
import { ClassSchema, getClassSchema, t } from '@deepkit/type';
import { ClassType } from '@deepkit/core';

class CountResponse extends t.extendClass(BaseResponse, {
    n: t.number,
}) {
}

const countSchema = t.schema({
    count: t.string,
    $db: t.string,
    limit: t.number.optional,
    query: t.any,
    skip: t.number.optional,
    lsid: t.type({id: t.uuid}).optional,
    txnNumber: t.number.optional,
    startTransaction: t.boolean.optional,
    autocommit: t.boolean.optional,
});

export class CountCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public query: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd: any = {
            count: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            limit: this.limit,
            skip: this.skip,
        };

        if (transaction) transaction.applyTransaction(cmd);

        const res = await this.sendAndWait(countSchema, cmd, CountResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
