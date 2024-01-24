/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { inspect } from 'util';

import { BSONDeserializer, deserializeBSONWithoutOptimiser, getBSONDeserializer } from '@deepkit/bson';
import { asyncOperation, getClassName } from '@deepkit/core';
import {
    ReceiveType,
    ReflectionClass,
    SerializationError,
    Type,
    UnpopulatedCheck,
    ValidationError,
    resolveReceiveType,
    stringifyType,
    typeOf,
    typeSettings,
} from '@deepkit/type';

import { mongoBinarySerializer } from '../../mongo-serializer.js';
import { MongoClientConfig } from '../config.js';
import type { MongoDatabaseTransaction } from '../connection.js';
import { MongoError, handleErrorResponse } from '../error.js';
import { Host } from '../host.js';

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

export class CommandMessage<T, R> {
    constructor(
        public readonly schema: ReflectionClass<T>,
        public readonly message: T,
        public readonly responseSchema: ReflectionClass<R>,
        public readonly responseCallback: (response: R) => { result?: any; next?: CommandMessage<any, any> },
    ) {}
}

export interface BaseResponse {
    ok: number;
    errmsg?: string;
    code?: number;
    codeName?: string;
    writeErrors?: Array<{ index: number; code: number; errmsg: string }>;
}

export abstract class Command {
    protected current?: { responseType?: Type; resolve: Function; reject: Function };

    public sender?: <T>(schema: Type, message: T) => void;

    public sendAndWait<T, R = BaseResponse>(
        message: T,
        messageType?: ReceiveType<T>,
        responseType?: ReceiveType<R>,
    ): Promise<R> {
        if (!this.sender) throw new Error(`No sender set in command ${getClassName(this)}`);
        this.sender(resolveReceiveType(messageType), message);

        return asyncOperation((resolve, reject) => {
            this.current = {
                resolve,
                reject,
                responseType: responseType ? resolveReceiveType(responseType) : typeOf<BaseResponse>(),
            };
        });
    }

    abstract execute(config: MongoClientConfig, host: Host, transaction?: MongoDatabaseTransaction): Promise<any>;

    abstract needsWritableHost(): boolean;

    handleResponse(response: Uint8Array): void {
        if (!this.current) throw new Error('Got handleResponse without active command');
        const deserializer: BSONDeserializer<BaseResponse> = this.current.responseType
            ? getBSONDeserializer(mongoBinarySerializer, this.current.responseType)
            : deserializeBSONWithoutOptimiser;

        const oldCheck = typeSettings.unpopulatedCheck;
        try {
            typeSettings.unpopulatedCheck = UnpopulatedCheck.None;
            const message = deserializer(response);
            const error = handleErrorResponse(message);
            if (error) {
                this.current.reject(error);
                return;
            }

            if (!message.ok) {
                this.current.reject(new MongoError(message.errmsg || 'error', message.code));
            } else {
                this.current.resolve(message);
            }
        } catch (error: any) {
            if (error instanceof ValidationError || error instanceof SerializationError) {
                if (this.current.responseType) {
                    const raw = deserializeBSONWithoutOptimiser(response);
                    console.log('mongo raw response', inspect(raw, { depth: null }));
                    if (raw.errmsg && raw.ok === 0) {
                        const error = handleErrorResponse(raw);
                        if (error) {
                            this.current.reject(error);
                            return;
                        }
                    }

                    this.current.reject(
                        new MongoError(
                            `Could not deserialize type ${stringifyType(this.current.responseType)}: ${error}`,
                        ),
                    );
                    return;
                }
            }
            this.current.reject(error);
        } finally {
            typeSettings.unpopulatedCheck = oldCheck;
        }
    }
}

// export class GenericCommand extends Command {
//     constructor(protected classSchema: ReflectionClass<any>, protected cmd: { [name: string]: any }, protected _needsWritableHost: boolean) {
//         super();
//     }
//
//     async execute(config): Promise<number> {
//         const res = await this.sendAndWait(this.classSchema, this.cmd);
//         return res.n;
//     }
//
//     needsWritableHost(): boolean {
//         return this._needsWritableHost;
//     }
// }
