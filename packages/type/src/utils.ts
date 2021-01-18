/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { v4, stringify } from 'uuid';
import { ClassType } from '@deepkit/core';
import { ClassSchema } from './model';
import { ExtractPrimaryKeyOrReferenceType, TypedArrays } from './types';

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

export function isArray(obj: any): obj is Array<any> {
    return !!(obj && 'number' === typeof obj.length && 'function' === typeof obj.reduce);
}

export type JSONPartialSingle<T> = T extends Date ? string :
    T extends Array<infer K> ? Array<JSONPartialSingle<K>> :
    T extends TypedArrays ? string :
    T extends ArrayBuffer ? string :
    T extends object ? JSONPartial<T> :
    T extends string ? number | T :
    T extends boolean ? number | string | T :
    T extends number ? T | string : T;

export type JSONPartial<T> = { [name in keyof T & string]?: JSONPartialSingle<ExtractPrimaryKeyOrReferenceType<T[name]>> };

export type JSONSingle<T> = T extends Date ? string | Date :
    T extends Array<infer K> ? Array<JSONSingle<K>> :
    T extends TypedArrays ? string :
    T extends ArrayBuffer ? string :
    T extends object ? JSONEntity<T> :
    T extends string ? T :
    T extends boolean ? T :
    T extends number ? T : T;
export type JSONEntity<T> = { [name in keyof T & string]: JSONSingle<ExtractPrimaryKeyOrReferenceType<T[name]>> };

export type AnyEntitySingle<T> =
    T extends Array<infer K> ? Array<AnyEntitySingle<K>> :
    T extends TypedArrays ? any :
    T extends ArrayBuffer ? any :
    T extends object ? AnyEntity<T> :
    T extends string ? any :
    T extends boolean ? any :
    T extends number ? any : any;
export type AnyEntity<T> = { [name in keyof T & string]: AnyEntitySingle<ExtractPrimaryKeyOrReferenceType<T[name]>> };

export type JSONPatch<T> = { [name in keyof T & string]: JSONSingle<T[name]> } | { [name: string]: any };

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;

export type ExtractClassType<T, A = never> = T extends ClassType<infer K> ? K :
    T extends ClassSchema<infer K> ? K : A;

export type PlainOrFullEntityFromClassTypeOrSchema<T> = { [name: string]: any } | JSONPartial<ExtractClassType<T>> | ExtractClassType<T>;
