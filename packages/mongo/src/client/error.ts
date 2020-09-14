import {CustomError} from '@deepkit/core';

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