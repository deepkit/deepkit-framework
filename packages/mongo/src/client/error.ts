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

import { CustomError } from '@deepkit/core';

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
