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

import { BaseResponse, Command } from './command';
import { ClassSchema, getClassSchema, t } from '@deepkit/type';
import { ClassType } from '@deepkit/core';

class FindAndModifyResponse extends t.extendClass(BaseResponse, {
    value: t.any,
}) {
}

const findAndModifySchema = t.schema({
    findAndModify: t.string,
    $db: t.string,
    query: t.any,
    update: t.any,
    new: t.boolean,
    upsert: t.boolean,
    fields: t.map(t.number),
});

export class FindAndModifyCommand<T extends ClassSchema | ClassType> extends Command {
    public upsert = false;
    public fields: string[] = [];
    public returnNew: boolean = false;

    constructor(
        public classSchema: T,
        public query: any,
        public update: any,
    ) {
        super();
    }

    async execute(config): Promise<FindAndModifyResponse> {
        const schema = getClassSchema(this.classSchema);

        const fields = {};
        for (const name of this.fields) fields[name] = 1;

        const cmd = {
            findAndModify: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            update: this.update,
            new: this.returnNew,
            upsert: this.upsert,
            fields: fields,
        };

        return await this.sendAndWait(findAndModifySchema, cmd, FindAndModifyResponse);
    }

    needsWritableHost(): boolean {
        return false;
    }
}
