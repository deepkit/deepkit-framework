/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { stringify, v4 } from 'uuid';
import { init } from '@paralleldrive/cuid2';

export class NoTypeReceived extends Error {
    constructor() {
        super('No type information received. Is deepkit/type correctly installed?');
    }
}

/**
 * Returns a new UUID v4 as string.
 */
export function uuid(): string {
    return v4();
}

/**
 * Writes a new uuid v4 into an existing buffer, and returns the same buffer.
 */
export function writeUuid(buffer: Uint8Array, offset: number = 0): Uint8Array {
    v4(undefined, buffer, offset);
    return buffer;
}

/**
 * Stringify an exising Uint8Array buffer.
 */
export function stringifyUuid(buffer: Uint8Array, offset: number = 0): string {
    return stringify(buffer, offset);
}

/**
 * Returns a new CUID as string.
 */
export function cuid(
    options?: {
        counter?: () => number
        length?: number
        fingerprint?: string
    }
): string {
    return init(options)();
}

/**
 * Initializes a new CUID generator.
 */
export function initCuid(
    options?: {
        counter?: () => number
        length?: number
        fingerprint?: string
    }
): () => string {
    return init(options);
}

export type Binary = ArrayBuffer | Uint8Array | Int8Array | Uint8ClampedArray | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

export type JSONPartial<T> = T extends Date ? string :
    T extends Array<infer K> ? Array<JSONPartial<K>> :
        // T extends TypedArrays ? string :
        T extends Binary ? string :
            T extends object ? JSONPartialObject<T> :
                T extends string ? number | T :
                    T extends boolean ? number | string | T :
                        T extends bigint ? number | string | T :
                            T extends number ? bigint | string | T :
                                T;

export type JSONPartialObject<T> = { [name in keyof T]?: T[name] | null };

export type JSONSingle<T> = T extends Date ? string | Date :
    T extends Array<infer K> ? Array<JSONSingle<K>> :
        T extends Binary ? string :
            T extends object ? JSONEntity<T> :
                T extends string ? string | number | boolean | undefined :
                    T extends boolean ? T | number | string :
                        T extends number ? T | string : T;
export type JSONEntity<T> = { [name in keyof T]: JSONSingle<T[name]> };

// export type AnyEntitySingle<T> =
//     T extends Array<infer K> ? Array<AnyEntitySingle<K>> :
//     T extends TypedArrays ? any :
//     T extends ArrayBuffer ? any :
//     T extends object ? AnyEntity<T> :
//     T extends string ? any :
//     T extends boolean ? any :
//     T extends number ? any : any;
// export type AnyEntity<T> = { [name in keyof T & string]: AnyEntitySingle<ExtractPrimaryKeyOrReferenceType<T[name]>> };
//
// export type JSONPatch<T> = { [name in keyof T & string]: JSONSingle<T[name]> } | { [name: string]: any };
//
// export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
//
// export type ExtractClassType<T, A = never> = T extends ClassType<infer K> ? K :
//     T extends ClassSchema<infer K> ? K : A;
//
// export type PlainOrFullEntityFromClassTypeOrSchema<T> = { [name: string]: any } | JSONPartial<ExtractClassType<T>> | ExtractClassType<T>;

export function regExpFromString(v: string): RegExp {
    if (v[0] === '/') {
        const end = v.lastIndexOf('/');
        const regexp = v.slice(1, end);
        const modifiers = v.slice(1 + end);
        return new RegExp(regexp, modifiers);
    }
    return new RegExp(v);
}
