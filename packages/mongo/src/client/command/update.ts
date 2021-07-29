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

class UpdateResponse extends t.extendClass(BaseResponse, {
    n: t.number,
}) {
}

const updateSchema = t.schema({
    update: t.string,
    $db: t.string,
    updates: t.array({
        q: t.any,
        // maybe in the future support classSchema. But `u` supports update statements https://docs.mongodb.com/manual/reference/operator/update/#id1
        u: t.any,
        multi: t.boolean,
    }),
    lsid: t.type({id: t.uuid}).optional,
    txnNumber: t.number.optional,
    autocommit: t.boolean.optional,
    startTransaction: t.boolean.optional,
});

export class UpdateCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public updates: { q: any, u: any, multi: boolean }[] = [],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd: any = {
            update: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            updates: this.updates
        };
        if (transaction) transaction.applyTransaction(cmd);

        const res = await this.sendAndWait(updateSchema, cmd, UpdateResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
