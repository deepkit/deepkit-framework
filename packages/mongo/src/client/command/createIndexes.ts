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

class Response extends t.extendClass(BaseResponse, {}) {
}

const requestSchema = t.schema({
    createIndexes: t.string,
    $db: t.string,
    indexes: t.array({
        key: t.map(t.number),
        name: t.string,
        unique: t.boolean,
        sparse: t.boolean,
    }),
});

export interface CreateIndex {
    key: { [name: string]: 1 },
    name: string,
    unique: boolean,
    sparse: boolean
}

export class CreateIndexesCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public indexes: { key: { [name: string]: 1 }, name: string, unique: boolean, sparse: boolean }[],
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<Response> {
        const schema = getClassSchema(this.classSchema);

        const cmd: any = {
            createIndexes: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            indexes: this.indexes,
        };

        // if (transaction) transaction.applyTransaction(cmd);

        try {
            return await this.sendAndWait(requestSchema, cmd, Response);
        } catch (error) {
            throw new Error(`Could not drop indexes ${JSON.stringify(this.indexes)}: ${error}`);
        }
    }

    needsWritableHost(): boolean {
        return false;
    }
}
