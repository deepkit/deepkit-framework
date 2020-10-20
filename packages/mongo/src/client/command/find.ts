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
import {DEEP_SORT} from '../../query.model';

const findSchema = t.schema({
    find: t.string,
    $db: t.string,
    batchSize: t.number,
    limit: t.number.optional,
    filter: t.any,
    projection: t.any,
    sort: t.any,
    skip: t.number.optional,
});

export class FindCommand<T extends ClassSchema | ClassType> extends Command {

    constructor(
        public classSchema: T,
        public filter: {[name: string]: any} = {},
        public projection?: {[name: string]: 1 | 0},
        public sort?: DEEP_SORT<any>,
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<ExtractClassType<T>[]> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            find: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            filter: this.filter,
            projection: this.projection,
            sort: this.sort,
            limit: this.limit,
            skip: this.skip,
            batchSize: 200_000, //todo make configurable
        };

        const jit = schema.jit;
        let specialisedResponse = jit.mdbFind;
        if (!specialisedResponse) {
            specialisedResponse = t.extendSchema(BaseResponse, {
                cursor: {
                    id: t.number,
                    firstBatch: t.array(schema),
                    nextBatch: t.array(schema),
                },
            });
            jit.mdbFind = specialisedResponse;
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(findSchema, cmd, specialisedResponse) as { cursor: { id: BigInt, firstBatch: any[], nextBatch: any[] } };
        //todo: implement fetchMore
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
