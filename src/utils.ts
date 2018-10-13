import {v4} from 'uuid';
import * as mongoUuid from 'mongo-uuid';
import {Binary} from 'mongodb';

export class CustomError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

export function uuid4Stringify(u: Binary | string): string {
    return 'string' === typeof u ? u : mongoUuid.stringify(u);
}

export function uuid(): string {
    return v4();
}

export interface ClassType<T> {
    new(...args): T;
}

export function typeOf(obj) {
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

export function isFunction(obj): obj is Function {
    return 'function' === typeOf(obj);
}

export function isObject(obj): obj is object {
    return 'object' === typeOf(obj);
}

export function isArray(obj): obj is any[] {
    return 'array' === typeOf(obj);
}

export function isNull(obj): obj is null {
    return 'null' === typeOf(obj);
}

export function isUndefined(obj): obj is undefined {
    return 'undefined' === typeOf(obj);
}

export function isSet(obj): boolean {
    return !isNull(obj) && !isUndefined(obj);
}

export function isNumber(obj): obj is number {
    return 'number' === typeOf(obj);
}

export function isString(obj): obj is string {
    return 'string' === typeOf(obj);
}


/**
 *
 * for (const [i, v] of eachPair(['a', 'b']) {
 *    console.log(i, v); //0 a, 1 b
 * }
 *
 * for (const [i, v] of eachPair({'foo': 'bar}) {
 *    console.log(i, v); //foo bar
 * }
 */
export function eachPair<T>(object: ArrayLike<T>): IterableIterator<[number, T]>;
export function eachPair<T>(object: { [s: string]: T }): IterableIterator<[string, T]>;
export function *eachPair<T>(object: { [s: string]: T } |  ArrayLike<T>): IterableIterator<[string, T] | [number, T]> {
    if (Array.isArray(object)) {
        for (const i in object) {
            yield [parseInt(i), object[i]];
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield [i, object[i]];
            }
        }
    }
}
