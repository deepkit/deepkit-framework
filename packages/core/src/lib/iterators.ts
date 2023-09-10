/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * Iterator for each key of an array or object.
 *
 * @example
 * ```
 * for (const i of eachKey(['a', 'b']) {
 *    console.log(i); //0, 1
 * }
 * ```
 *
 * @public
 * @category iterator
 */
export function eachKey<T>(object: ArrayLike<T>): IterableIterator<number>;
/** @public */
export function eachKey<T extends { [key: string]: any }, K extends keyof T>(object: T): IterableIterator<string>;
/** @public */
export function* eachKey<T extends { [key: string]: any }, K extends keyof T>(object: T | ArrayLike<T>): IterableIterator<string | number> {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            yield i;
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield i as string;
            }
        }
    }
}

/**
 * Iterator for each value of an array or object.
 *
 * @example
 * ```
 * for (const v of each(['a', 'b']) {
 *    console.log(v); //a, b
 * }
 * ```
 *
 * @public
 * @category iterator
 */
export function* each<T>(object: { [s: string]: T } | ArrayLike<T>): IterableIterator<T> {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            yield object[i];
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield (object as { [s: string]: T })[i];
            }
        }
    }
}

/**
 * Iterator for key value pair of an array or object.
 *
 * @example
 * ```
 * for (const [i, v] of eachPair(['a', 'b']) {
 *    console.log(i, v); //0 a, 1 b
 * }
 *
 * for (const [i, v] of eachPair({'foo': 'bar}) {
 *    console.log(i, v); //foo bar
 * }
 * ```
 *
 * @public
 * @category iterator
 */
export function eachPair<T>(object: ArrayLike<T>): IterableIterator<[number, T]>;
/** @public */
export function eachPair<T>(object: { [s: string]: T }): IterableIterator<[string, T]>;
/** @public */
export function* eachPair<T>(object: { [s: string]: T } | ArrayLike<T>): IterableIterator<[string, T] | [number, T]> {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            yield [i, object[i]];
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield [i, (object as { [s: string]: T })[i]];
            }
        }
    }
}
