/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { DeepkitError } from '@deepkit/core';

import { BaseResponse } from './command/command.js';

/**
 * Throws the correct ORM errors when responses returns an error
 */
export function handleErrorResponse(response: BaseResponse): MongoDatabaseError | undefined {
    const message =
        response.errmsg ||
        (response.writeErrors && response.writeErrors.length ? response.writeErrors[0].errmsg : undefined);
    if (!message || 'string' !== typeof message) return;

    if (message) {
        return Object.assign(new MongoDatabaseError(message), { mongoCode: response.code || 0 });
    }
    return;
}

export class MongoError extends DeepkitError {
    public mongoCode: number = 0;

    constructor(code: string, message: string, options?: { cause?: Error }) {
        super(code, message, options);
    }

    override toString() {
        if (this.mongoCode) return `[${this.mongoCode}] ${this.message}`;
        return this.message;
    }
}

/**
 * When a tcp/connection issue happened.
 */
export class MongoConnectionError extends MongoError {
    constructor(message: string, options?: { cause?: Error }) {
        super('DK-MG010', message, options);
    }
}

/**
 * When the Mongo server returns an error with code,
 * generally from database.raw or database.query.
 */
export class MongoDatabaseError extends MongoError {
    constructor(message: string, options?: { cause?: Error }) {
        super('DK-MG020', message, options);
    }
}

//https://github.com/mongodb/specifications/blob/master/source/retryable-writes/retryable-writes.rst#determining-retryable-errors
const retryableWrites: number[] = [11600, 11602, 10107, 13435, 13436, 189, 91, 7, 6, 89, 9001, 262];

export function isErrorRetryableWrite(error: any): boolean {
    if (error instanceof MongoError && error.mongoCode) {
        return retryableWrites.includes(error.mongoCode);
    }

    return false;
}

// https://github.com/mongodb/specifications/blob/master/source/retryable-reads/retryable-reads.rst#retryable-error
const retryableReads: number[] = [11600, 11602, 10107, 13435, 13436, 189, 91, 7, 6, 89, 9001];
export function isErrorRetryableRead(error: any): boolean {
    if (error instanceof MongoError && error.mongoCode) {
        return retryableReads.includes(error.mongoCode);
    }

    return false;
}
