import {v4} from 'uuid';
import {ClassType} from '@super-hornet/core';
import {ClassSchema} from './decorators';

export function uuid(): string {
    return v4();
}

export function isArray(v: any): v is Array<any> {
    if (v && (v as any).length && (v as any).reduce) return true;
    return false;
}

export type JSONPartialSingle<T> = T extends Date ? string :
    T extends Array<infer K> ? Array<JSONPartialSingle<K>> :
        T extends object ? JSONPartial<T> :
            T extends string ? number | T :
                T extends boolean ? number | string | T :
                    T extends number ? T | string : T;

export type JSONPartial<T> = { [name in keyof T & string]?: JSONPartialSingle<T[name]> };

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;

export type ExtractClassType<T, A = never> = T extends ClassType<infer K> ? K :
    T extends ClassSchema<infer K> ? K : A;

export type PlainOrFullEntityFromClassTypeOrSchema<T> = {[name: string]: any} | JSONPartial<ExtractClassType<T>> | ExtractClassType<T>;