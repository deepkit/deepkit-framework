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
    create: t.string,
    $db: t.string,
});

export class CreateCollectionCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<Response> {
        const schema = getClassSchema(this.classSchema);

        const cmd: any = {
            create: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
        };

        // if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait(requestSchema, cmd, Response);
    }

    needsWritableHost(): boolean {
        return false;
    }
}
