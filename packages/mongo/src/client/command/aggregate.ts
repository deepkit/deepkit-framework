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
import { BaseResponse, Command, ReadPreferenceMessage, TransactionalMessage, WriteConcernMessage } from './command.js';
import { getTypeJitContainer, InlineRuntimeType, isType, ReflectionClass, Type, typeOf } from '@deepkit/type';
import { MongoError } from '../error.js';
import { GetMoreMessage } from './getMore.js';
import { MongoClientConfig } from '../config.js';
import { CommandOptions } from '../options.js';

type AggregateMessage = {
    aggregate: string;
    $db: string;
    pipeline: any[],
    cursor: {
        batchSize: number,
    },
} & TransactionalMessage & WriteConcernMessage & ReadPreferenceMessage;

export class AggregateCommand<T, R = BaseResponse> extends Command<R[]> {
    partial: boolean = false;
    commandOptions: CommandOptions = {};

    constructor(
        public schema: ReflectionClass<T>,
        public pipeline: any[] = [],
        public resultSchema?: ReflectionClass<R> | Type,
    ) {
        super();
    }

    async execute(config: MongoClientConfig, host, transaction): Promise<R[]> {
        const cmd: AggregateMessage = {
            aggregate: this.schema.getCollectionName() || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            pipeline: this.pipeline,
            cursor: {
                batchSize: config.options.batchSize,
            },
        };

        if (transaction) transaction.applyTransaction(cmd);
        config.applyReadPreference(host, cmd, this.commandOptions, transaction);
        if (!transaction) config.applyWriteConcern(cmd, this.commandOptions);

        let resultSchema = this.resultSchema || this.schema;
        if (resultSchema && !isType(resultSchema)) resultSchema = resultSchema.type;

        const jit = getTypeJitContainer(resultSchema);
        let specialisedResponse: Type | undefined = this.partial ? jit.mdbAggregatePartial : jit.mdbAggregate;

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
            cursor: { id: bigint, firstBatch?: any[], nextBatch?: any[] };
        }

        const res = await this.sendAndWait<AggregateMessage, Response>(cmd, undefined, specialisedResponse);
        if (!res.cursor.firstBatch) throw new MongoError(`No firstBatch received`);

        const result: R[] = res.cursor.firstBatch;

        let cursorId = res.cursor.id;
        while (cursorId) {
            const nextCommand: GetMoreMessage = {
                getMore: cursorId,
                $db: cmd.$db,
                collection: cmd.aggregate,
                batchSize: cmd.cursor.batchSize,
            };
            if (transaction) transaction.applyTransaction(nextCommand);
            config.applyReadPreference(host, nextCommand, this.commandOptions, transaction);
            const next = await this.sendAndWait<GetMoreMessage, Response>(nextCommand, undefined, specialisedResponse);

            if (next.cursor.nextBatch) {
                result.push(...next.cursor.nextBatch);
            }
            cursorId = next.cursor.id;
        }

        return result;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
