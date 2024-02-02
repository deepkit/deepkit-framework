/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { expect, test, describe } from '@jest/globals';
import { float, float32, int8, integer, PrimaryKey, Reference } from '../src/reflection/type.js';
import { is } from '../src/typeguard.js';
import { serializer, quickSerializer } from '../src/serializer.js';

describe.each([serializer, quickSerializer])('', (testSerializer, name) => {
    test('primitive string', () => {
        expect(is<string>('a', testSerializer)).toEqual(true);
        expect(is<string>(123, testSerializer)).toEqual(false);
        expect(is<string>(true, testSerializer)).toEqual(false);
        expect(is<string>({}, testSerializer)).toEqual(false);
    });

    test('primitive number', () => {
        expect(is<number>('a', testSerializer)).toEqual(false);
        expect(is<number>(123, testSerializer)).toEqual(true);
        expect(is<number>(true, testSerializer)).toEqual(false);
        expect(is<number>({}, testSerializer)).toEqual(false);
    });

    test('primitive number integer', () => {
        expect(is<integer>('a', testSerializer)).toEqual(false);
        expect(is<integer>(123, testSerializer)).toEqual(true);
        expect(is<integer>(123.4, testSerializer)).toEqual(false);
        expect(is<integer>(true, testSerializer)).toEqual(false);
        expect(is<integer>({}, testSerializer)).toEqual(false);
    });

    test('primitive number int8', () => {
        expect(is<int8>('a', testSerializer)).toEqual(false);
        expect(is<int8>(123, testSerializer)).toEqual(true);
        expect(is<int8>(123.4, testSerializer)).toEqual(false);
        expect(is<int8>(true, testSerializer)).toEqual(false);
        expect(is<int8>({}, testSerializer)).toEqual(false);
        expect(is<int8>(127, testSerializer)).toEqual(true);
        expect(is<int8>(128, testSerializer)).toEqual(false);
        expect(is<int8>(-128, testSerializer)).toEqual(true);
        expect(is<int8>(-129, testSerializer)).toEqual(false);
        expect(is<int8>(129, testSerializer)).toEqual(false);
    });

    test('primitive number float', () => {
        expect(is<float>('a', testSerializer)).toEqual(false);
        expect(is<float>(123, testSerializer)).toEqual(true);
        expect(is<float>(123.4, testSerializer)).toEqual(true);
        expect(is<float>(true, testSerializer)).toEqual(false);
        expect(is<float>({}, testSerializer)).toEqual(false);
    });

    test('primitive number float32', () => {
        expect(is<float32>('a', testSerializer)).toEqual(false);
        expect(is<float32>(123, testSerializer)).toEqual(true);
        expect(is<float32>(123.4, testSerializer)).toEqual(true);
        expect(is<float32>(3.40282347e+38, testSerializer)).toEqual(true);
        //JS precision issue:
        expect(is<float32>(3.40282347e+38 + 100000000000000000000000, testSerializer)).toEqual(false);
        expect(is<float32>(-3.40282347e+38, testSerializer)).toEqual(true);
        expect(is<float32>(-3.40282347e+38 - 100000000000000000000000, testSerializer)).toEqual(false);
        expect(is<float32>(true, testSerializer)).toEqual(false);
        expect(is<float32>({}, testSerializer)).toEqual(false);
    });

    test('enum', () => {
        enum MyEnum {
            a, b, c
        }

        expect(is<MyEnum>(0, testSerializer)).toEqual(true);
        expect(is<MyEnum>(1, testSerializer)).toEqual(true);
        expect(is<MyEnum>(2, testSerializer)).toEqual(true);
        expect(is<MyEnum>(3, testSerializer)).toEqual(false);
        expect(is<MyEnum>(undefined, testSerializer)).toEqual(false);
        expect(is<MyEnum>({}, testSerializer)).toEqual(false);
        expect(is<MyEnum>(true, testSerializer)).toEqual(false);
    });

    test('enum const', () => {
        const enum MyEnum {
            a, b, c
        }

        expect(is<MyEnum>(0, testSerializer)).toEqual(true);
        expect(is<MyEnum>(1, testSerializer)).toEqual(true);
        expect(is<MyEnum>(2, testSerializer)).toEqual(true);
        expect(is<MyEnum>(3, testSerializer)).toEqual(false);
        expect(is<MyEnum>(undefined, testSerializer)).toEqual(false);
        expect(is<MyEnum>({}, testSerializer)).toEqual(false);
        expect(is<MyEnum>(true, testSerializer)).toEqual(false);
    });

    test('enum string', () => {
        enum MyEnum {
            a = 'a', b = 'b', c = 'c'
        }

        expect(is<MyEnum>('a', testSerializer)).toEqual(true);
        expect(is<MyEnum>('b', testSerializer)).toEqual(true);
        expect(is<MyEnum>('c', testSerializer)).toEqual(true);
        expect(is<MyEnum>(0, testSerializer)).toEqual(false);
        expect(is<MyEnum>(1, testSerializer)).toEqual(false);
        expect(is<MyEnum>(2, testSerializer)).toEqual(false);
        expect(is<MyEnum>(3, testSerializer)).toEqual(false);
        expect(is<MyEnum>(undefined, testSerializer)).toEqual(false);
        expect(is<MyEnum>({}, testSerializer)).toEqual(false);
        expect(is<MyEnum>(true, testSerializer)).toEqual(false);
    });

    test('array string', () => {
        expect(is<string[]>([], testSerializer)).toEqual(true);
        expect(is<string[]>(['a'], testSerializer)).toEqual(true);
        expect(is<string[]>(['a', 'b'], testSerializer)).toEqual(true);
        expect(is<string[]>([1], testSerializer)).toEqual(false);
        expect(is<string[]>([1, 2], testSerializer)).toEqual(false);
        expect(is<string[]>(['a', 2], testSerializer)).toEqual(false);
    });

    test('tuple', () => {
        expect(is<[string]>(['a'], testSerializer)).toEqual(true);
        expect(is<[string]>([2], testSerializer)).toEqual(false);
        expect(is<[string, string]>(['a', 'b'], testSerializer)).toEqual(true);
        expect(is<[string, string]>(['a'], testSerializer)).toEqual(false);
        expect(is<[string, number]>(['a', 3], testSerializer)).toEqual(true);
        expect(is<[string, number]>(['a', undefined], testSerializer)).toEqual(false);
        expect(is<[string, ...number[]]>(['a', 3], testSerializer)).toEqual(true);
        expect(is<[string, ...number[]]>(['a', 3, 4], testSerializer)).toEqual(true);
        expect(is<[string, ...number[]]>(['a', 3, 4, 5], testSerializer)).toEqual(true);
        expect(is<[string, ...number[]]>([3, 3, 4, 5], testSerializer)).toEqual(false);
    });

    test('set', () => {
        expect(is<Set<string>>(new Set(['a']), testSerializer)).toEqual(true);
        expect(is<Set<string>>(new Set(['a', 'b']), testSerializer)).toEqual(true);
        expect(is<Set<string>>(new Set(['a', 2]), testSerializer)).toEqual(false);
        expect(is<Set<string>>(new Set([2, 3]), testSerializer)).toEqual(false);
        expect(is<Set<string>>([2, 3], testSerializer)).toEqual(false);
    });

    test('map', () => {
        expect(is<Map<string, number>>(new Map([['a', 1]]), testSerializer)).toEqual(true);
        expect(is<Map<string, number>>(new Map([['a', 1], ['b', 2]]), testSerializer)).toEqual(true);
        expect(is<Map<string, number>>(new Map<any, any>([['a', 1], ['b', 'b']]), testSerializer)).toEqual(false);
        expect(is<Map<string, number>>(new Map<any, any>([[2, 1]]), testSerializer)).toEqual(false);
    });

    test('literal', () => {
        expect(is<1>(1, testSerializer)).toEqual(true);
        expect(is<1>(2, testSerializer)).toEqual(false);
        expect(is<'abc'>('abc', testSerializer)).toEqual(true);
        expect(is<'abc'>('ab', testSerializer)).toEqual(false);
        expect(is<false>(false, testSerializer)).toEqual(true);
        expect(is<false>(true, testSerializer)).toEqual(false);
        expect(is<true>(true, testSerializer)).toEqual(true);
        expect(is<true>(false, testSerializer)).toEqual(false);
    });

    test('any', () => {
        expect(is<any>(['a'], testSerializer)).toEqual(true);
        expect(is<any>([1], testSerializer)).toEqual(true);
        expect(is<any>([true], testSerializer)).toEqual(true);
        expect(is<any>([false], testSerializer)).toEqual(true);
        expect(is<any>([undefined], testSerializer)).toEqual(true);
        expect(is<any>([null], testSerializer)).toEqual(true);
        expect(is<any>([{}], testSerializer)).toEqual(true);
        expect(is<any>([], testSerializer)).toEqual(true);

        expect(is<any>('a', testSerializer)).toEqual(true);
        expect(is<any>(1, testSerializer)).toEqual(true);
        expect(is<any>(true, testSerializer)).toEqual(true);
        expect(is<any>(false, testSerializer)).toEqual(true);
        expect(is<any>(undefined, testSerializer)).toEqual(true);
        expect(is<any>(null, testSerializer)).toEqual(true);
        expect(is<any>({}, testSerializer)).toEqual(true);
        expect(is<any>([], testSerializer)).toEqual(true);
    });

    test('array any', () => {
        expect(is<any[]>(['a'], testSerializer)).toEqual(true);
        expect(is<any[]>([1], testSerializer)).toEqual(true);
        expect(is<any[]>([true], testSerializer)).toEqual(true);
        expect(is<any[]>([false], testSerializer)).toEqual(true);
        expect(is<any[]>([undefined], testSerializer)).toEqual(true);
        expect(is<any[]>([null], testSerializer)).toEqual(true);
        expect(is<any[]>([{}], testSerializer)).toEqual(true);
        expect(is<any[]>([], testSerializer)).toEqual(true);
        expect(is<Array<any>>([], testSerializer)).toEqual(true);
        expect(is<Array<any>>(['a'], testSerializer)).toEqual(true);

        expect(is<any[]>(null, testSerializer)).toEqual(false);
        expect(is<any[]>(undefined, testSerializer)).toEqual(false);
        expect(is<any[]>(1, testSerializer)).toEqual(false);
        expect(is<any[]>(true, testSerializer)).toEqual(false);
        expect(is<any[]>({}, testSerializer)).toEqual(false);

        expect(is<any[]>({ length: 1 }, testSerializer)).toEqual(false);
        expect(is<any[]>({ length: 0 }, testSerializer)).toEqual(false);
        expect(is<any[]>({ length: null }, testSerializer)).toEqual(false);
        expect(is<any[]>({ length: undefined }, testSerializer)).toEqual(false);
    });

    test('union', () => {
        expect(is<string | number>(1, testSerializer)).toEqual(true);
        expect(is<string | number>('abc', testSerializer)).toEqual(true);
        expect(is<string | number>(false, testSerializer)).toEqual(false);
    });

    test('deep union', () => {
        expect(is<string | (number | bigint)[]>(1, testSerializer)).toEqual(false);
        expect(is<string | (number | bigint)[]>('1', testSerializer)).toEqual(true);
        expect(is<string | (number | bigint)[]>([1], testSerializer)).toEqual(true);
        expect(is<string | (number | bigint)[]>([1n], testSerializer)).toEqual(true);
        expect(is<string | (number | bigint)[]>(['1'], testSerializer)).toEqual(false);
    });

    test('object literal', () => {
        expect(is<{ a: string }>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<{ a: string }>({ a: 123 }, testSerializer)).toEqual(false);
        expect(is<{ a: string }>({}, testSerializer)).toEqual(false);
        expect(is<{ a?: string }>({}, testSerializer)).toEqual(true);
        expect(is<{ a?: string }>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<{ a?: string }>({ a: 123 }, testSerializer)).toEqual(false);
        expect(is<{ a: string, b: number }>({ a: 'a', b: 12 }, testSerializer)).toEqual(true);
        expect(is<{ a: string, b: number }>({ a: 'a', b: 'asd' }, testSerializer)).toEqual(false);
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

        expect(is<A>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<A>({ a: 123 }, testSerializer)).toEqual(false);
        expect(is<A>({}, testSerializer)).toEqual(false);
        expect(is<A2>({}, testSerializer)).toEqual(true);
        expect(is<A2>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<A2>({ a: 123 }, testSerializer)).toEqual(false);
        expect(is<A3>({ a: 'a', b: 12 }, testSerializer)).toEqual(true);
        expect(is<A3>({ a: 'a', b: 'asd' }, testSerializer)).toEqual(false);
    });

    test('index signature', () => {
        expect(is<{ [name: string]: string }>({}, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string }>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string }>({ a: 123 }, testSerializer)).toEqual(false);

        expect(is<{ [name: number]: string }>({ 1: 'abc' }, testSerializer)).toEqual(true);
        expect(is<{ [name: number]: string }>({ 1: 123 }, testSerializer)).toEqual(false);
        expect(is<{ [name: number]: string }>({ a: 'abc' }, testSerializer)).toEqual(false);
    });

    test('object literal methods', () => {
        expect(is<{ m: () => void }>({ m: (): void => undefined }, testSerializer)).toEqual(true);
        expect(is<{ m: () => void }>({ m: false }, testSerializer)).toEqual(false);
        expect(is<{ m: (name: string) => void }>({ m: () => undefined }, testSerializer)).toEqual(true); //`() => undefined` has no types, so no __type emitted. Means return=any
        expect(is<{ m: (name: string) => void }>({ m: (name: string): void => undefined }, testSerializer)).toEqual(true);
        expect(is<{ m: (name: string) => string }>({ m: (name: string): string => 'asd' }, testSerializer)).toEqual(true);
        expect(is<{ m: (name: string) => string }>({ m: (name: string) => 'asd' }, testSerializer)).toEqual(true);
        expect(is<{ m: (name: string) => string }>({ m: (name: number): string => 'asd' }, testSerializer)).toEqual(false);
        expect(is<{ m: (name: string) => string }>({ m: (name: string): number => 2 }, testSerializer)).toEqual(false);
        expect(is<{ m: (name: string) => any }>({ m: (name: string): number => 2 }, testSerializer)).toEqual(true);
        expect(is<{ m: (name: any) => number }>({ m: (name: string): number => 2 }, testSerializer)).toEqual(true);
    });

    test('multiple index signature', () => {
        expect(is<{ [name: string]: string | number, [name: number]: string }>({}, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string | number, [name: number]: number }>({ a: 'abc' }, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string | number, [name: number]: number }>({ a: 123 }, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string | number, [name: number]: number }>({ 1: 123 }, testSerializer)).toEqual(true);
        expect(is<{ [name: string]: string | number, [name: number]: number }>({ 1: 'abc' }, testSerializer)).toEqual(false);
    });

    test('brands', () => {
        expect(is<number & PrimaryKey>(2, testSerializer)).toEqual(true);
        expect(is<number & PrimaryKey>('2', testSerializer)).toEqual(false);
    });

    test('generic interface', () => {
        interface List<T> {
            items: T[];
        }

        expect(is<List<number>>({ items: [1] }, testSerializer)).toEqual(true);
        expect(is<List<string>>({ items: [1] }, testSerializer)).toEqual(false);
        expect(is<List<string>>({ items: null }, testSerializer)).toEqual(false);
        expect(is<List<string>>({ items: ['abc'] }, testSerializer)).toEqual(true);
    });

    test('generic alias', () => {
        type List<T> = T[];

        expect(is<List<number>>([1], testSerializer)).toEqual(true);
        expect(is<List<string>>([1], testSerializer)).toEqual(false);
        expect(is<List<string>>(null, testSerializer)).toEqual(false);
        expect(is<List<string>>(['abc'], testSerializer)).toEqual(true);
    });

    test('index signature ', () => {
        interface BagOfNumbers {
            [name: string]: number;
        }

        interface BagOfStrings {
            [name: string]: string;
        }

        expect(is<BagOfNumbers>({ a: 1 }, testSerializer)).toEqual(true);
        expect(is<BagOfNumbers>({ a: 1, b: 2 }, testSerializer)).toEqual(true);
        expect(is<BagOfNumbers>({ a: 'b' }, testSerializer)).toEqual(false);
        expect(is<BagOfNumbers>({ a: 'b', b: 'c' }, testSerializer)).toEqual(false);

        expect(is<BagOfStrings>({ a: 1 }, testSerializer)).toEqual(false);
        expect(is<BagOfStrings>({ a: 1, b: 2 }, testSerializer)).toEqual(false);
        expect(is<BagOfStrings>({ a: 'b' }, testSerializer)).toEqual(true);
        expect(is<BagOfStrings>({ a: 'b', b: 'c' }, testSerializer)).toEqual(true);
    });

    test('reference', () => {
        class Image {
            id: number = 0;
        }

        class User {
            image?: Image & Reference;
        }

        expect(is<Image>({}, testSerializer)).toEqual(false);
        expect(is<Image>({ id: 0 }, testSerializer)).toEqual(true);

        expect(is<User>({}, testSerializer)).toEqual(true);
        expect(is<User>({ image: undefined }, testSerializer)).toEqual(true);
        expect(is<User>({ image: { id: 1 } }, testSerializer)).toEqual(true);
        expect(is<User>({ image: { id: false } }, testSerializer)).toEqual(false);
        expect(is<User>({ image: false }, testSerializer)).toEqual(false);
        expect(is<User>({ image: null }, testSerializer)).toEqual(false);
        expect(is<User>({ image: {} }, testSerializer)).toEqual(false);
    });

    test('template literal', () => {
        expect(is<`abc`>('abc')).toBe(true);
        expect(is<`abc`>('abce')).toBe(false);

        expect(is<`ab${string}`>('abc')).toBe(true);
        expect(is<`ab${string}`>('ab3')).toBe(true);

        type a = 'ab3' extends `ab${string}` ? true : false;
        type a2 = 'ab' extends `ab${string}` ? true : false;
        type a3 = 'a' extends `ab${string}` ? true : false;

        expect(is<`ab${string}`>('ab3')).toBe(true);
        expect(is<`ab${string}`>('ab')).toBe(true);
        expect(is<`ab${string}`>('a')).toBe(false);

        type b = 'ab3' extends `ab${number}` ? true : false;
        type b2 = 'ab' extends `ab${number}` ? true : false;
        type b3 = 'a' extends `ab${number}` ? true : false;
        type b4 = 'abc' extends `ab${number}` ? true : false;

        expect(is<`ab${number}`>('ab3')).toBe(true);
        expect(is<`ab${number}`>('ab')).toBe(false);
        expect(is<`ab${number}`>('a')).toBe(false);
        expect(is<`ab${number}`>('abc')).toBe(false);
    });

    test('union template literal', () => {
        expect(is<`abc${number}` | number>('abc2')).toBe(true);
        expect(is<`abc${number}` | number>(23)).toBe(true);
        expect(is<`abc${number}` | number>('abcd')).toBe(false);
        expect(is<`abc${number}` | number>('abc')).toBe(false);
    });

    test('class with literal and default', () => {
        class ConnectionOptions {
            readConcernLevel: 'local' = 'local';
        }

        expect(is<ConnectionOptions>({ readConcernLevel: 'local' })).toBe(true);
        expect(is<ConnectionOptions>({ readConcernLevel: 'local2' })).toBe(false);
    });

    test('union literal', () => {
        class ConnectionOptions {
            readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';
        }

        expect(is<ConnectionOptions>({ readConcernLevel: 'majority' })).toBe(true);
        expect(is<ConnectionOptions>({ readConcernLevel: 'majority2' })).toBe(false);
    });
});
