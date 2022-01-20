/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { toFastProperties } from '@deepkit/core';
import { BaseResponse, Command } from './command';
import { InlineRuntimeType, OuterType, ReflectionClass, typeOf, UUID } from '@deepkit/type';
import { MongoError } from '../error';

interface AggregateMessage {
    aggregate: string;
    $db: string;
    pipeline: any[],
    cursor: {
        batchSize: number,
    },
    lsid?: { id: UUID },
    txnNumber?: number,
    startTransaction?: boolean,
    autocommit?: boolean,
}

export class AggregateCommand<T, R = BaseResponse> extends Command {
    partial: boolean = false;

    constructor(
        public schema: ReflectionClass<T>,
        public pipeline: any[] = [],
        public resultSchema?: ReflectionClass<R>,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<R[]> {
        const cmd = {
            aggregate: this.schema.collectionName || this.schema.name || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            pipeline: this.pipeline,
            cursor: {
                batchSize: 1_000_000, //todo make configurable
            }
        };

        if (transaction) transaction.applyTransaction(cmd);
        const resultSchema = this.resultSchema || this.schema;

        const jit = resultSchema.getJitContainer();
        let specialisedResponse: OuterType | undefined = this.partial ? jit.mdbAggregatePartial : jit.mdbAggregate;

        if (!specialisedResponse) {
            const schema = resultSchema;
            type resultSchema = InlineRuntimeType<typeof schema>;

            if (this.partial) {
                interface SpecialisedResponse extends BaseResponse {
                    cursor: {
                        id: number;
                        firstBatch?: Array<Partial<resultSchema>>;
                        nextBatch?: Array<Partial<resultSchema>>;
                    },
                }

                jit.mdbAggregatePartial = specialisedResponse = typeOf<SpecialisedResponse>();
            } else {
                interface SpecialisedResponse extends BaseResponse {
                    cursor: {
                        id: number;
                        firstBatch?: Array<resultSchema>;
                        nextBatch?: Array<resultSchema>;
                    },
                }

                jit.mdbAggregate = specialisedResponse = typeOf<SpecialisedResponse>();
            }
            toFastProperties(jit);
        }

        interface Response extends BaseResponse {
            cursor: { id: BigInt, firstBatch?: any[], nextBatch?: any[] };
        }

        const res = await this.sendAndWait<AggregateMessage, Response>(cmd, undefined, specialisedResponse);
        if (!res.cursor.firstBatch) throw new MongoError(`No firstBatch received`);

        //todo: implement fetchMore and decrease batchSize
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
