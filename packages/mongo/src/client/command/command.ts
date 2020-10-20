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

import {ClassSchema, ExtractClassType, getClassSchema, t} from '@deepkit/type';
import {asyncOperation, ClassType} from '@deepkit/core';
import {getBSONDecoder} from '@deepkit/bson';
import {MongoError} from '../error';
import {MongoClientConfig} from '../client';
import {Host} from '../host';
import {deserialize} from 'bson';


export interface CommandMessageResponseCallbackResult<T> {
    /**
     * When the command is finished, set the `result`
     */
    result?: T;

    /**
     * When the command is not finished and another message should be sent, set the new CommandMessage
     * as `next`.
     */
    next?: CommandMessage<any, any>
}

export class CommandMessage<T, R extends ClassSchema | ClassType> {
    constructor(
        public readonly schema: ClassSchema<T>,
        public readonly message: T,
        public readonly responseSchema: R,
        public readonly responseCallback: (response: ExtractClassType<R>) => { result?: any, next?: CommandMessage<any, any> },
    ) {
    }
}

export const BaseResponse = t.schema({
    ok: t.number,
    errmsg: t.string.optional,
    code: t.number.optional,
    codeName: t.string.optional,
});

export abstract class Command {
    protected current?: { response?: ClassSchema | ClassType, resolve: Function, reject: Function };

    public sender?: (schema: ClassSchema | ClassType | undefined, message: Buffer) => void;

    public sendAndWait<T extends ClassSchema | ClassType, R extends ClassSchema | ClassType>(
        schema: T | undefined, message: ExtractClassType<T>, response?: R
    ): Promise<ExtractClassType<R>> {
        if (!this.sender) throw new Error(`No sender set in command ${getClassSchema(this)}`);
        this.sender(schema, message);

        return asyncOperation((resolve, reject) => {
            this.current = {resolve, reject, response};
        });
    }

    abstract execute(config: MongoClientConfig, host: Host): Promise<any>;

    abstract needsWritableHost(): boolean;

    handleResponse(response: Buffer) {
        if (!this.current) throw new Error('Got handleResponse without active command');
        const message = this.current.response ? getBSONDecoder(this.current.response)(response) : deserialize(response);
        if (!message.ok) {
            console.error(message);
            this.current.reject(new MongoError(message.errmsg, message.code));
        } else {
            this.current.resolve(message);
        }
    }
}
