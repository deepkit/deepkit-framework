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
import { DEEP_SORT } from '../../query.model.js';
import { InlineRuntimeType, ReflectionClass, ReflectionKind, typeOf, TypeUnion, UUID } from '@deepkit/type';
import { MongoError } from '../error.js';

interface FindSchema {
    find: string;
    $db: string;
    batchSize: number;
    limit: number;
    skip: number;
    filter: any;
    projection?: any;
    sort?: any;
    lsid?: { id: UUID },
    txnNumber?: number,
    startTransaction?: boolean,
    autocommit?: boolean,
}

export class FindCommand<T> extends Command {
    constructor(
        public schema: ReflectionClass<T>,
        public filter: { [name: string]: any } = {},
        public projection?: { [name: string]: 1 | 0 },
        public sort?: DEEP_SORT<any>,
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config, host, transaction): Promise<T[]> {
        const cmd: FindSchema = {
            find: this.schema.collectionName || this.schema.name || 'unknown',
            $db: this.schema.databaseSchemaName || config.defaultDb || 'admin',
            filter: this.filter,
            limit: this.limit,
            skip: this.skip,
            batchSize: 1_000_000, //todo make configurable
        };

        if (transaction) transaction.applyTransaction(cmd);

        if (this.projection) cmd.projection = this.projection;
        if (this.sort) cmd.sort = this.sort;

        const jit = this.schema.getJitContainer();

        let specialisedResponse = this.projection ? jit.mdbFindPartial : jit.mdbFind;
        if (!specialisedResponse) {

            // let itemType = this.projection ? partial(classSchema) : classSchema;

            const singleTableInheritanceMap = this.schema.getAssignedSingleTableInheritanceSubClassesByIdentifier();
            if (singleTableInheritanceMap) {
                const schemas = Array.from(Object.values(singleTableInheritanceMap));
                const type: TypeUnion = { kind: ReflectionKind.union, types: schemas.map(v => v.type) };

                if (this.projection) {
                    interface SpecialisedResponse extends BaseResponse {
                        cursor: {
                            id: number;
                            firstBatch?: Partial<InlineRuntimeType<typeof type>>[];
                            nextBatch?: Partial<InlineRuntimeType<typeof type>>[];
                        };
                    }

                    jit.mdbFindPartial = specialisedResponse = typeOf<SpecialisedResponse>();
                } else {
                    interface SpecialisedResponse extends BaseResponse {
                        cursor: {
                            id: number;
                            firstBatch?: InlineRuntimeType<typeof type>[];
                            nextBatch?: InlineRuntimeType<typeof type>[];
                        };
                    }

                    jit.mdbFind = specialisedResponse = typeOf<SpecialisedResponse>();
                }
            } else {
                const schema = this.schema;
                type resultSchema = InlineRuntimeType<typeof schema>;

                if (this.projection) {
                    interface SpecialisedResponse extends BaseResponse {
                        cursor: {
                            id: number;
                            firstBatch?: Partial<resultSchema>[];
                            nextBatch?: Partial<resultSchema>[];
                        };
                    }

                    jit.mdbFindPartial = specialisedResponse = typeOf<SpecialisedResponse>();
                } else {
                    interface SpecialisedResponse extends BaseResponse {
                        cursor: {
                            id: number;
                            firstBatch?: resultSchema[];
                            nextBatch?: resultSchema[];
                        };
                    }

                    jit.mdbFind = specialisedResponse = typeOf<SpecialisedResponse>();
                }
            }
            toFastProperties(jit);
        }

        interface Response extends BaseResponse {
            cursor: { id: BigInt, firstBatch?: any[], nextBatch?: any[] };
        }

        const res = await this.sendAndWait<FindSchema, Response>(cmd, undefined, specialisedResponse);
        if (!res.cursor.firstBatch) throw new MongoError(`No firstBatch received`);

        //todo: implement fetchMore and decrease batchSize
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
