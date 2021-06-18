/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { FlattenIfArray } from './utils';
import { Buffer } from 'buffer';

export type PrimaryKey<T> = T & { __isPrimaryKey?: T };

export type Reference<T> = T & { __isReference?: T };

export type BackReference<T> = T & { __isBackReference?: T } & { __isReference?: T };

export type ExtractLooselyPrimaryKeys<T, R = Required<T>> = { [K in keyof R]: R[K] extends string | number ? K : never }[keyof R];
export type ExtractPrimaryKeys<T, R = Required<T>> = { [K in keyof R]: R[K] extends { __isPrimaryKey?: infer PKT } ? K : never }[keyof R];
export type ExtractPrimaryKeyType<T> = ExtractPrimaryKeys<T> extends never ? any : ExtractPrimaryKeys<T>;

type _references<T> = { [K in keyof T]: T[K] extends { __isReference?: any } ? K : never }[keyof T];

type isProbablyReference<T> = FlattenIfArray<T> extends number | string | Date | boolean ? false : true;

type _referencesFromClasses<T> = { [P in keyof T]: isProbablyReference<T[P]> extends true ? P : never }[keyof T];

type _referencesOrAllClassTypes<T> = _references<T> extends never ? _referencesFromClasses<T> : _references<T>;

export type ExtractReferences<T> = _referencesOrAllClassTypes<Required<T>>;

export type ExtractPrimaryKeyOrReferenceType<T> = T extends PrimaryKey<infer PT> ? PT : T extends Reference<infer RT> ? RT : T;

export type PrimaryKeyFields<T> = ExtractPrimaryKeyType<T> extends any ? Record<ExtractLooselyPrimaryKeys<T>, T> : Record<ExtractPrimaryKeys<T>, T>;

export type Types =
    'objectId'
    | 'uuid'
    | 'literal'
    | 'class'
    | 'map'
    | 'partial'
    | 'patch'
    | 'array'
    | 'union'
    | 'date'
    | 'enum'
    | 'any'
    | 'string'
    | 'number'
    | 'bigint'
    | 'boolean'
    | 'Int8Array'
    | 'Uint8Array'
    | 'Uint8ClampedArray'
    | 'Int16Array'
    | 'Uint16Array'
    | 'Int32Array'
    | 'Uint32Array'
    | 'Float32Array'
    | 'Float64Array'
    | 'arrayBuffer';

/**
 * Type for @t.partial().
 */
export type PartialField<T> = {
    [P in keyof T & string]?: T[P]
} & {
    //it's currently not possible to further define it
    //https://github.com/Microsoft/TypeScript/issues/12754
    [path: string]: any
}

/**
 * Type for @t.patch().
 * Differs to standard Partial<> in a way that it supports sub class fields using dot based paths (like mongoDB)
 */
export type PatchField<T> = {
    [P in keyof T & string]?: T[P]
} & {
    //it's currently not possible to further define it
    //https://github.com/Microsoft/TypeScript/issues/12754
    //todo: Since 4.1 its possible using template literals
    [path: string]: any
}

export type PartialEntity<T> = { [name in keyof T & string]?: T[name] };

export const typedArrayMap = new Map<any, Types>();
typedArrayMap.set(String, 'string');
typedArrayMap.set(Number, 'number');
typedArrayMap.set(Date, 'date');
typedArrayMap.set(Boolean, 'boolean');
typedArrayMap.set(Int8Array, 'Int8Array');
typedArrayMap.set(Buffer, 'Uint8Array');
typedArrayMap.set(Uint8Array, 'Uint8Array');
typedArrayMap.set(Uint8ClampedArray, 'Uint8ClampedArray');
typedArrayMap.set(Int16Array, 'Int16Array');
typedArrayMap.set(Uint16Array, 'Uint16Array');
typedArrayMap.set(Int32Array, 'Int32Array');
typedArrayMap.set(Uint32Array, 'Uint32Array');
typedArrayMap.set(Float32Array, 'Float32Array');
typedArrayMap.set(Float64Array, 'Float64Array');
typedArrayMap.set(ArrayBuffer, 'arrayBuffer');

export type TypedArrays = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Uint8ClampedArray | Float32Array | Float64Array;

export const typedArrayNamesMap = new Map<Types, any>();
typedArrayNamesMap.set('Int8Array', Int8Array);
typedArrayNamesMap.set('Uint8Array', Uint8Array);
typedArrayNamesMap.set('Uint8ClampedArray', Uint8ClampedArray);
typedArrayNamesMap.set('Int16Array', Int16Array);
typedArrayNamesMap.set('Uint16Array', Uint16Array);
typedArrayNamesMap.set('Int32Array', Int32Array);
typedArrayNamesMap.set('Uint32Array', Uint32Array);
typedArrayNamesMap.set('Float32Array', Float32Array);
typedArrayNamesMap.set('Float64Array', Float64Array);

export const binaryTypes: Types[] = [...typedArrayNamesMap.keys(), 'arrayBuffer'];
