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
import {ClassSchema, getClassSchema, t} from '@deepkit/type';
import {ClassType} from '@deepkit/core';

class CountResponse extends t.extendClass(BaseResponse, {
    n: t.number,
}) {
}

const countSchema = t.schema({
    count: t.string,
    $db: t.string,
    limit: t.number.optional,
    query: t.any,
    skip: t.number.optional,
});

export class CountCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public query: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            count: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            limit: this.limit,
            skip: this.skip,
        };

        const res = await this.sendAndWait(countSchema, cmd, CountResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
