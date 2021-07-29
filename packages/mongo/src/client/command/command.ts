/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, ExtractClassType, getClassSchema, t } from '@deepkit/type';
import { asyncOperation, ClassType } from '@deepkit/core';
import { deserialize, getBSONDecoder } from '@deepkit/bson';
import { MongoError } from '../error';
import { MongoClientConfig } from '../config';
import { Host } from '../host';
import { MongoDatabaseTransaction } from '../connection';


export interface CommandMessageResponseCallbackResult<T> {
    /**
     * When the command is finished, set the `result`
     */
    result?: T;

    /**
     * When the command is not finished and another message should be sent, set the new CommandMessage
     * as `next`.
     */
    next?: CommandMessage<any, any>;
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

    public sender?: (schema: ClassSchema | ClassType, message: Buffer) => void;

    public sendAndWait<T extends ClassSchema | ClassType, R extends ClassSchema | ClassType>(
        schema: T, message: ExtractClassType<T>, response?: R
    ): Promise<ExtractClassType<R>> {
        if (!this.sender) throw new Error(`No sender set in command ${getClassSchema(this)}`);
        this.sender(schema, message);

        return asyncOperation((resolve, reject) => {
            this.current = { resolve, reject, response };
        });
    }

    abstract execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<any>;

    abstract needsWritableHost(): boolean;

    handleResponse(response: Uint8Array) {
        if (!this.current) throw new Error('Got handleResponse without active command');
        const message = this.current.response ? getBSONDecoder(this.current.response)(response) : deserialize(response);
        if (!message.ok) {
            // console.log('Mongo error', message);
            this.current.reject(new MongoError(message.errmsg, message.code));
        } else {
            this.current.resolve(message);
        }
    }
}

export class GenericCommand extends Command {
    constructor(protected classSchema: ClassSchema, protected cmd: { [name: string]: any }, protected _needsWritableHost: boolean) {
        super();
    }

    async execute(config): Promise<number> {
        const res = await this.sendAndWait(this.classSchema, this.cmd);
        return res.n;
    }

    needsWritableHost(): boolean {
        return this._needsWritableHost;
    }
}
