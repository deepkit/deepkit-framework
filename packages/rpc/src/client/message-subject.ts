/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation, CustomError } from '@deepkit/core';
import { ClassSchema, ExtractClassType } from '@deepkit/type';
import { RpcTypes } from '../model';
import type { RpcMessage } from '../protocol';

export class UnexpectedMessageType extends CustomError {
}

export class RpcMessageSubject {
    protected uncatchedNext?: RpcMessage;

    protected onReplyCallback(next: RpcMessage) {
        this.uncatchedNext = next;
    }

    protected catchOnReplyCallback = this.onReplyCallback.bind(this);

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
        if (this.uncatchedNext) {
            callback(this.uncatchedNext);
            this.uncatchedNext = undefined;
        }
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
            this.onReply((next) => {
                this.onReplyCallback = this.catchOnReplyCallback;
                this.release();

                if (next.type === RpcTypes.Ack) {
                    return resolve(undefined);
                }

                if (next.isError()) {
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type Ack, but received ${next.type}`));
            });
        });
    }

    async waitNextMessage<T extends ClassSchema>(): Promise<RpcMessage> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReply((next) => {
                this.onReplyCallback = this.catchOnReplyCallback;
                return resolve(next);
            });
        });
    }

    async waitNext<T extends ClassSchema>(type: number, schema?: T): Promise<undefined extends T ? undefined : ExtractClassType<T>> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReply((next) => {
                this.onReplyCallback = this.catchOnReplyCallback;
                if (next.type === type) {
                    return resolve(schema ? next.parseBody(schema) : undefined);
                }

                if (next.isError()) {
                    this.release();
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type ${type}, but received ${next.type}`));
            });
        });
    }

    async firstThenClose<T extends ClassSchema>(type: number, schema?: T): Promise<undefined extends T ? RpcMessage : ExtractClassType<T>> {
        return asyncOperation<any>((resolve, reject) => {
            this.onReply((next) => {
                this.onReplyCallback = this.catchOnReplyCallback;
                this.release();

                if (next.type === type) {
                    return resolve(schema ? next.parseBody(schema) : next);
                }

                if (next.isError()) {
                    this.release();
                    return reject(next.getError());
                }

                reject(new UnexpectedMessageType(`Expected message type ${type}, but received ${next.type}`));
            });
        });
    }
}
