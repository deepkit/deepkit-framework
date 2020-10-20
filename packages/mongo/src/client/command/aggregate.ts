/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {BaseResponse, Command} from './command';
import {ClassSchema, ExtractClassType, getClassSchema, t} from '@deepkit/type';
import {ClassType, toFastProperties} from '@deepkit/core';

const aggregateSchema = t.schema({
    aggregate: t.string,
    $db: t.string,
    pipeline: t.array(t.any),
    cursor: {
        batchSize: t.number,
    }
});

export class AggregateCommand<T extends ClassSchema | ClassType, R extends ClassSchema> extends Command {
    constructor(
        public classSchema: T,
        public pipeline: any[] = [],
        public resultSchema?: R,
    ) {
        super();
    }

    async execute(config): Promise<ExtractClassType<R extends undefined ? T : R>[]> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            aggregate: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            pipeline: this.pipeline,
            cursor: {
                batchSize: 20000,
            }
        };

        const resultSchema = this.resultSchema || schema;

        const jit = resultSchema.jit;
        let specialisedResponse = jit.mdbAggregate;
        if (!specialisedResponse) {
            specialisedResponse = t.extendSchema(BaseResponse, {
                cursor: {
                    id: t.number,
                    firstBatch: t.array(resultSchema),
                    nextBatch: t.array(resultSchema),
                },
            });
            jit.mdbAggregate = specialisedResponse;
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(aggregateSchema, cmd, specialisedResponse) as { cursor: { id: BigInt, firstBatch: any[], nextBatch: any[] } };

        //todo: implement fetchMore
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
