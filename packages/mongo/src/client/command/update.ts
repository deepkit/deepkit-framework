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

class UpdateResponse extends t.extendClass(BaseResponse, {
    n: t.number,
}) {
}

const updateSchema = t.schema({
    update: t.string,
    $db: t.string,
    updates: t.array({
        q: t.any,
        // maybe in the future support classSchema. But `u` supports update statements https://docs.mongodb.com/manual/reference/operator/update/#id1
        u: t.any,
        multi: t.boolean,
    })
});

export class UpdateCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public updates: {q: any, u: any, multi: boolean}[] = [],
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            update: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            updates: this.updates
        };

        const res = await this.sendAndWait(updateSchema, cmd, UpdateResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
