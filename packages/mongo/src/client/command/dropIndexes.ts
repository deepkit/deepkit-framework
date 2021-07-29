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
    dropIndexes: t.string,
    $db: t.string,
    index: t.array(t.string),
});

export class DropIndexesCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public names: string[]
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<Response> {
        const schema = getClassSchema(this.classSchema);

        const cmd: any = {
            dropIndexes: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            index: this.names
        };

        // if (transaction) transaction.applyTransaction(cmd);

        try {
            return await this.sendAndWait(requestSchema, cmd, Response);
        } catch (error) {
            throw new Error(`Could not drop indexes ${JSON.stringify(this.names)}: ${error}`);
        }
    }

    needsWritableHost(): boolean {
        return false;
    }
}
