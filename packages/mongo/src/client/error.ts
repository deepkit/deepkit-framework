/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CustomError } from '@deepkit/core';
import { BaseResponse } from './command/command';
import { DatabaseError, UniqueConstraintFailure } from '@deepkit/orm';


/**
 * Throws the correct ORM errors when responses returns an error
 */
export function handleErrorResponse(response: InstanceType<typeof BaseResponse.classType>): DatabaseError | undefined {
    const message = response.errmsg || (response.writeErrors && response.writeErrors.length ? response.writeErrors[0].errmsg : undefined);
    if (!message || 'string' !== typeof message) return;

    if (message.includes('duplicate key error')) {
        return new UniqueConstraintFailure();
    }

    if (message) {
        return new DatabaseError(message);
    }

    return;
}

export class MongoError extends CustomError {
    constructor(message: string, public readonly code?: number) {
        super(message);
    }

    toString() {
        if (this.code) return `[${this.code}] ${this.message}`;
        return this.message;
    }
}

//https://github.com/mongodb/specifications/blob/master/source/retryable-writes/retryable-writes.rst#determining-retryable-errors
const retryableWrites: number[] = [
    11600,
    11602,
    10107,
    13435,
    13436,
    189,
    91,
    7,
    6,
    89,
    9001,
    262
];

export function isErrorRetryableWrite(error: any): boolean {
    if (error instanceof MongoError && error.code) {
        return retryableWrites.includes(error.code);
    }

    return false;
}

// https://github.com/mongodb/specifications/blob/master/source/retryable-reads/retryable-reads.rst#retryable-error
const retryableReads: number[] = [
    11600,
    11602,
    10107,
    13435,
    13436,
    189,
    91,
    7,
    6,
    89,
    9001
]
    ;
export function isErrorRetryableRead(error: any): boolean {
    if (error instanceof MongoError && error.code) {
        return retryableReads.includes(error.code);
    }

    return false;
}

/**
 * When a tcp/connection issue happened.
 */
export class MongoConnectionError extends MongoError {

}

/**
 * When the error came from the server `errmsg`.
 */
export class MongoCommandError extends MongoError {

}

export class MongoFindConnectionTimeOut extends MongoError {

}
