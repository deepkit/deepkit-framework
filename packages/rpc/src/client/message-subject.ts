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

import { asyncOperation, CustomError } from '@deepkit/core';
import { ClassSchema, ExtractClassType } from '@deepkit/type';
import { RpcTypes } from '../model';
import { RpcMessage } from '../protocol';

export class UnexpectedMessageType extends CustomError {
}

export class RpcMessageSubject {
    protected onReplyCallback(next: RpcMessage) {

    }

    constructor(
        private continuation: <T>(type: number, schema?: ClassSchema<T>, body?: T,) => void,

        /**
         * Releases this subject. It is necessary that eventually every created subject is released,
         * otherwise dramatic performance decrease and memory leak will happen.
         */
        public release: () => void,
    ) {
    }

    public next(next: RpcMessage) {
        this.onReplyCallback(next);
    }

    public onReply(callback: (next: RpcMessage) => void): this {
        this.onReplyCallback = callback;
        return this;
    }

    /**
     * Sends a message to the server in the context of this created subject.
     * If the connection meanwhile has been reconnected, and completed MessageSubject.
     */
    public send<T>(
        type: number,
        schema?: ClassSchema<T>,
        body?: T,
    ): this {
        this.continuation(type, schema, body);
        return this;
    }

    async ackThenClose(): Promise<undefined> {
        return asyncOperation<undefined>((resolve, reject) => {
            this.onReplyCallback = (next) => {
                this.release();

                if (next.type === RpcTypes.Ack) {
                    return resolve(undefined);
                }

                if (next.isError()) {
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type Ack, but received ${next.type}`));
            };
        });
    }

    async waitNextMessage<T extends ClassSchema>(): Promise<RpcMessage> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReplyCallback = (next) => {
                return resolve(next);
            };
        });
    }

    async waitNext<T extends ClassSchema>(type: number, schema?: T): Promise<undefined extends T ? undefined : ExtractClassType<T>> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReplyCallback = (next) => {
                if (next.type === type) {
                    return resolve(schema ? next.parseBody(schema) : undefined);
                }

                if (next.isError()) {
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type ${type}, but received ${next.type}`));
            };
        });
    }

    async firstThenClose<T extends ClassSchema>(type: number, schema?: T): Promise<undefined extends T ? undefined : ExtractClassType<T>> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReplyCallback = (next) => {
                this.release();

                if (next.type === type) {
                    return resolve(schema ? next.parseBody(schema) : undefined);
                }

                if (next.isError()) {
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type ${type}, but received ${next.type}`));
            };
        });
    }
}
