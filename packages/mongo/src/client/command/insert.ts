/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command, TransactionalMessage, WriteConcernMessage } from './command.js';
import { toFastProperties } from '@deepkit/core';
import { InlineRuntimeType, ReflectionClass, typeOf } from '@deepkit/type';
import type { MongoClientConfig } from '../config.js';
import type { Host } from '../host.js';
import type { MongoDatabaseTransaction } from '../connection.js';

interface InsertResponse extends BaseResponse {
    n: number;
}

type InsertSchema = {
    insert: string;
    $db: string;
    documents: any[];
} & WriteConcernMessage & TransactionalMessage;

export class InsertCommand<T> extends Command<number> {
    constructor(
        protected schema: ReflectionClass<T>,
        protected documents: T[],
    ) {
        super();
    }

    async execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<number> {
        const cmd: InsertSchema = {
            insert: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            documents: this.documents,
        };

        if (transaction) transaction.applyTransaction(cmd);
        if (!transaction) config.applyWriteConcern(cmd, this.options);

        const jit = this.schema.getJitContainer();
        let specialisedSchema = jit.mdbInsert;
        if (!specialisedSchema) {
            const schema = this.schema;

            interface SpecialisedSchema extends InsertSchema {
                documents: InlineRuntimeType<typeof schema>[];
            }

            jit.mdbInsert = specialisedSchema = typeOf<SpecialisedSchema>();
            toFastProperties(jit);
        }

        const res = await this.sendAndWait<InsertSchema, InsertResponse>(cmd, specialisedSchema);
        return res.n;
    }

    needsWritableHost(): boolean {
        return true;
    }
}
