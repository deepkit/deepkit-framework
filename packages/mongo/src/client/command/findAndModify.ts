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

class FindAndModifyResponse extends t.extendClass(BaseResponse, {
    value: t.any,
}) {
}

const findAndModifySchema = t.schema({
    findAndModify: t.string,
    $db: t.string,
    query: t.any,
    update: t.any,
    new: t.boolean,
    upsert: t.boolean,
    fields: t.map(t.number),
    lsid: t.type({ id: t.uuid }).optional,
    txnNumber: t.number.optional,
    autocommit: t.boolean.optional,
    startTransaction: t.boolean.optional,
});

export class FindAndModifyCommand<T extends ClassSchema | ClassType> extends Command {
    public upsert = false;
    public fields: string[] = [];
    public returnNew: boolean = false;

    constructor(
        public classSchema: T,
        public query: any,
        public update: any,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<FindAndModifyResponse> {
        const schema = getClassSchema(this.classSchema);

        const fields = {};
        for (const name of this.fields) fields[name] = 1;

        const cmd: any = {
            findAndModify: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            update: this.update,
            new: this.returnNew,
            upsert: this.upsert,
            fields: fields,
        };

        if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait(findAndModifySchema, cmd, FindAndModifyResponse);
    }

    needsWritableHost(): boolean {
        return false;
    }
}
