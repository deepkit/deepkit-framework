/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command } from './command.js';
import { toFastProperties } from '@deepkit/core';
import { InlineRuntimeType, ReflectionClass, typeOf, UUID } from '@deepkit/type';

interface InsertResponse extends BaseResponse {
    n: number;
}

interface InsertSchema {
    insert: string;
    $db: string;
    lsid?: { id: UUID };
    txnNumber?: number;
    autocommit?: boolean;
    startTransaction?: boolean;
}

export class InsertCommand<T> extends Command {
    constructor(
        protected schema: ReflectionClass<T>,
        protected documents: T[]
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<number> {
        const cmd: any = {
            insert: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            documents: this.documents,
        };

        if (transaction) transaction.applyTransaction(cmd);

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

        const res =  await this.sendAndWait<InsertSchema, InsertResponse>(cmd, specialisedSchema);
        return res.n;
    }

    needsWritableHost(): boolean {
        return true;
    }
}
