/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { expect, test } from '@jest/globals';
import { float, int8, integer } from '../../../src/reflection/type';
import { is } from '../../../src/typeguard';

test('primitive string', () => {
    expect(is<string>('a')).toEqual(true);
    expect(is<string>(123)).toEqual(false);
    expect(is<string>(true)).toEqual(false);
    expect(is<string>({})).toEqual(false);
});

test('primitive number', () => {
    expect(is<number>('a')).toEqual(false);
    expect(is<number>(123)).toEqual(true);
    expect(is<number>(true)).toEqual(false);
    expect(is<number>({})).toEqual(false);
});

test('primitive number integer', () => {
    expect(is<integer>('a')).toEqual(false);
    expect(is<integer>(123)).toEqual(true);
    expect(is<integer>(123.4)).toEqual(false);
    expect(is<integer>(true)).toEqual(false);
    expect(is<integer>({})).toEqual(false);
});

test('primitive number int8', () => {
    expect(is<int8>('a')).toEqual(false);
    expect(is<int8>(123)).toEqual(true);
    expect(is<int8>(123.4)).toEqual(false);
    expect(is<int8>(true)).toEqual(false);
    expect(is<int8>({})).toEqual(false);
    expect(is<int8>(128)).toEqual(true);
    expect(is<int8>(129)).toEqual(false);
    expect(is<int8>(-127)).toEqual(true);
    expect(is<int8>(-128)).toEqual(false);
    expect(is<int8>(129)).toEqual(false);
});

test('primitive number float', () => {
    expect(is<float>('a')).toEqual(false);
    expect(is<float>(123)).toEqual(true);
    expect(is<float>(123.4)).toEqual(true);
    expect(is<float>(true)).toEqual(false);
    expect(is<float>({})).toEqual(false);
});

test('enum', () => {
    enum MyEnum {
        a, b, c
    }

    expect(is<MyEnum>(0)).toEqual(true);
    expect(is<MyEnum>(1)).toEqual(true);
    expect(is<MyEnum>(2)).toEqual(true);
    expect(is<MyEnum>(3)).toEqual(false);
    expect(is<MyEnum>(undefined)).toEqual(false);
    expect(is<MyEnum>({})).toEqual(false);
    expect(is<MyEnum>(true)).toEqual(false);
});

test('enum const', () => {
    const enum MyEnum {
        a, b, c
    }

    expect(is<MyEnum>(0)).toEqual(true);
    expect(is<MyEnum>(1)).toEqual(true);
    expect(is<MyEnum>(2)).toEqual(true);
    expect(is<MyEnum>(3)).toEqual(false);
    expect(is<MyEnum>(undefined)).toEqual(false);
    expect(is<MyEnum>({})).toEqual(false);
    expect(is<MyEnum>(true)).toEqual(false);
});

test('enum string', () => {
    enum MyEnum {
        a = 'a', b = 'b', c = 'c'
    }

    expect(is<MyEnum>('a')).toEqual(true);
    expect(is<MyEnum>('b')).toEqual(true);
    expect(is<MyEnum>('c')).toEqual(true);
    expect(is<MyEnum>(0)).toEqual(false);
    expect(is<MyEnum>(1)).toEqual(false);
    expect(is<MyEnum>(2)).toEqual(false);
    expect(is<MyEnum>(3)).toEqual(false);
    expect(is<MyEnum>(undefined)).toEqual(false);
    expect(is<MyEnum>({})).toEqual(false);
    expect(is<MyEnum>(true)).toEqual(false);
});

test('array string', () => {
    expect(is<string[]>(['a'])).toEqual(true);
    expect(is<string[]>(['a', 'b'])).toEqual(true);
    expect(is<string[]>([1])).toEqual(false);
    expect(is<string[]>([1, 2])).toEqual(false);
    expect(is<string[]>(['a', 2])).toEqual(false);
});

test('tuple', () => {
    expect(is<[string]>(['a'])).toEqual(true);
    expect(is<[string]>([2])).toEqual(false);
    expect(is<[string, string]>(['a', 'b'])).toEqual(true);
    expect(is<[string, string]>(['a'])).toEqual(false);
    expect(is<[string, number]>(['a', 3])).toEqual(true);
    expect(is<[string, number]>(['a', undefined])).toEqual(false);
    expect(is<[string, ...number[]]>(['a', 3])).toEqual(true);
    expect(is<[string, ...number[]]>(['a', 3, 4])).toEqual(true);
    expect(is<[string, ...number[]]>(['a', 3, 4, 5])).toEqual(true);
    expect(is<[string, ...number[]]>([3, 3, 4, 5])).toEqual(false);
});

test('set', () => {
    expect(is<Set<string>>(new Set(['a']))).toEqual(true);
    expect(is<Set<string>>(new Set(['a', 'b']))).toEqual(true);
    expect(is<Set<string>>(new Set(['a', 2]))).toEqual(false);
    expect(is<Set<string>>(new Set([2, 3]))).toEqual(false);
    expect(is<Set<string>>([2, 3])).toEqual(false);
});

test('map', () => {
    expect(is<Map<string, number>>(new Map([['a', 1]]))).toEqual(true);
    expect(is<Map<string, number>>(new Map([['a', 1], ['b', 2]]))).toEqual(true);
    expect(is<Map<string, number>>(new Map<any, any>([['a', 1], ['b', 'b']]))).toEqual(false);
    expect(is<Map<string, number>>(new Map<any, any>([[2, 1]]))).toEqual(false);
});

test('literal', () => {
    expect(is<1>(1)).toEqual(true);
    expect(is<1>(2)).toEqual(false);
    expect(is<'abc'>('abc')).toEqual(true);
    expect(is<'abc'>('ab')).toEqual(false);
    expect(is<false>(false)).toEqual(true);
    expect(is<false>(true)).toEqual(false);
    expect(is<true>(true)).toEqual(true);
    expect(is<true>(false)).toEqual(false);
});

test('union', () => {
    expect(is<string | number>(1)).toEqual(true);
    expect(is<string | number>('abc')).toEqual(true);
    expect(is<string | number>(false)).toEqual(false);
});

test('object literal', () => {
    expect(is<{ a: string }>({ a: 'abc' })).toEqual(true);
    expect(is<{ a: string }>({ a: 123 })).toEqual(false);
    expect(is<{ a: string }>({})).toEqual(false);
    expect(is<{ a?: string }>({})).toEqual(true);
    expect(is<{ a?: string }>({ a: 'abc' })).toEqual(true);
    expect(is<{ a?: string }>({ a: 123 })).toEqual(false);
    expect(is<{ a: string, b: number }>({ a: 'a', b: 12 })).toEqual(true);
    expect(is<{ a: string, b: number }>({ a: 'a', b: 'asd' })).toEqual(false);
});

test('class', () => {
    class A {
        a!: string;
    }
    class A2 {
        a?: string;
    }
    class A3 {
        a!: string;
        b!: number;
    }
    expect(is<A>({ a: 'abc' })).toEqual(true);
    expect(is<A>({ a: 123 })).toEqual(false);
    expect(is<A>({})).toEqual(false);
    expect(is<A2>({})).toEqual(true);
    expect(is<A2>({ a: 'abc' })).toEqual(true);
    expect(is<A2>({ a: 123 })).toEqual(false);
    expect(is<A3>({ a: 'a', b: 12 })).toEqual(true);
    expect(is<A3>({ a: 'a', b: 'asd' })).toEqual(false);
});

test('index signature', () => {
    expect(is<{ [name: string]: string }>({})).toEqual(true);
    expect(is<{ [name: string]: string }>({ a: 'abc' })).toEqual(true);
    expect(is<{ [name: string]: string }>({ a: 123 })).toEqual(false);

    expect(is<{ [name: number]: string }>({ 1: 'abc' })).toEqual(true);
    expect(is<{ [name: number]: string }>({ 1: 123 })).toEqual(false);
    expect(is<{ [name: number]: string }>({ a: 'abc' })).toEqual(false);
});

test('object literal methods', () => {
    expect(is<{ m: () => void }>({ m: (): void => undefined })).toEqual(true);
    expect(is<{ m: () => void }>({ m: false })).toEqual(false);
    expect(is<{ m: (name: string) => void }>({ m: () => undefined })).toEqual(false);
    expect(is<{ m: (name: string) => void }>({ m: (name: string): void => undefined })).toEqual(true);
    expect(is<{ m: (name: string) => string }>({ m: (name: string): string => 'asd' })).toEqual(true);
    expect(is<{ m: (name: string) => string }>({ m: (name: string) => 'asd' })).toEqual(true);
    expect(is<{ m: (name: string) => string }>({ m: (name: number): string => 'asd' })).toEqual(false);
    expect(is<{ m: (name: string) => string }>({ m: (name: string): number => 2 })).toEqual(false);
    expect(is<{ m: (name: string) => any }>({ m: (name: string): number => 2 })).toEqual(true);
    expect(is<{ m: (name: any) => number }>({ m: (name: string): number => 2 })).toEqual(true);
});

test('multiple index signature', () => {
    expect(is<{ [name: string]: string | number, [name: number]: string }>({})).toEqual(true);
    expect(is<{ [name: string]: string | number, [name: number]: number }>({ a: 'abc' })).toEqual(true);
    expect(is<{ [name: string]: string | number, [name: number]: number }>({ a: 123 })).toEqual(true);
    expect(is<{ [name: string]: string | number, [name: number]: number }>({ 1: 123 })).toEqual(true);
    expect(is<{ [name: string]: string | number, [name: number]: number }>({ 1: 'abc' })).toEqual(false);
});
