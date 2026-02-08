/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { describe, test } from 'node:test';

import { TypeAnnotation, getClassName } from '@deepkit/core';
import { expect } from '@deepkit/run/expect';

import { NamingStrategy, Serializer, createSerializeFunction, getSerializeFunction, serializer, underscoreNamingStrategy } from '../index.js';
import { entity, t } from '../src/decorator.js';
import { isReferenceInstance } from '../src/reference.js';
import { parametersToTuple } from '../src/reflection/extends.js';
import { ReflectionClass, reflect, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, Type, TypeProperty, TypePropertySignature, assertType, isCustomTypeClass, isTypeClassOf, stringifyResolvedType } from '../src/reflection/type.js';
import { cast, deserialize, patch, serialize } from '../src/serializer-facade.js';
import { Alphanumeric, AutoIncrement, BackReference, BinaryBigInt, Embedded, Excluded, Group, MapName, MaxLength, MinLength, PrimaryKey, Reference, SignedBinaryBigInt, int8, integer, typeAnnotation } from '../src/type-annotations.js';
import { is } from '../src/typeguard.js';
import { ValidationError, validate } from '../src/validator.js';
import { StatEnginePowerUnit, StatWeightUnit } from './types.js';

test('deserializer', () => {
    class User {
        username!: string;
        created!: Date;
    }

    const fn = createSerializeFunction(reflect(User), serializer.deserializeRegistry);
    const o = fn({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(o).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z'),
    });
});

test('cast interface', () => {
    interface User {
        username: string;
        created: Date;
    }

    const user = cast<User>({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(user).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z'),
    });
});

test('cast class', () => {
    class User {
        created: Date = new Date();

        constructor(public username: string) {}
    }

    const user = cast<User>({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(user).toBeInstanceOf(User);
    expect(user).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z'),
    });
});

test('groups', () => {
    class Settings {
        weight: string & Group<'privateSettings'> = '12g';
        color: string = 'red';
    }

    class User {
        id: number = 0;
        password: string & Group<'b'> = '';
        settings: Settings = new Settings();

        constructor(public username: string & Group<'a'>) {}
    }

    const user = new User('peter');
    expect(serialize<User>(user)).toEqual({ id: 0, username: 'peter', password: '', settings: { weight: '12g', color: 'red' } });
    expect(serialize<User>(user, { groups: ['a'] })).toEqual({ username: 'peter' });
    expect(serialize<User>(user, { groups: ['b'] })).toEqual({ password: '' });
    expect(serialize<User>(user, { groups: ['a', 'b'] })).toEqual({ username: 'peter', password: '' });
    expect(serialize<User>(user, { groupsExclude: ['b'] })).toEqual({ id: 0, username: 'peter', settings: { weight: '12g', color: 'red' } });
    expect(serialize<User>(user, { groupsExclude: ['privateSettings'] })).toEqual({ id: 0, username: 'peter', password: '', settings: { color: 'red' } });
});

test('default value', () => {
    class User {
        logins: number = 0;
    }

    {
        const user = cast<User>({});
        expect(user).toBeInstanceOf(User);
        expect(user).toEqual({
            logins: 0,
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2,
        });
    }
});

test('optional value', () => {
    class User {
        logins?: number;
    }

    {
        const user = cast<User>({});
        expect(user).toEqual({
            logins: undefined,
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2,
        });
    }
});

test('optional default value', () => {
    class User {
        logins?: number = 2;
    }

    {
        const user = cast<User>({});
        expect(user).toEqual({
            logins: 2,
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2,
        });
    }

    {
        const user = cast<User>({ logins: null });
        expect(user).toEqual({
            logins: undefined,
        });
    }

    {
        const user = cast<User>({ logins: undefined });
        expect(user).toEqual({
            logins: undefined,
        });
    }
});

test('optional literal', () => {
    interface LoginInput {
        mechanism?: 'cookie';
    }

    {
        const input = cast<LoginInput>({});
        expect(input).toEqual({
            mechanism: undefined,
        });
    }

    {
        const input = cast<LoginInput>({ mechanism: 'cookie' });
        expect(input).toEqual({
            mechanism: 'cookie',
        });
    }
});

test('cast primitives', () => {
    expect(cast<string>('123')).toBe('123');
    expect(cast<string>(123)).toBe('123');
    expect(cast<number>(123)).toBe(123);
    expect(cast<number>('123')).toBe(123);

    expect(cast<Date>('2021-10-19T00:22:58.257Z')).toEqual(new Date('2021-10-19T00:22:58.257Z'));
    expect(serialize<Date>(new Date('2021-10-19T00:22:58.257Z'))).toEqual('2021-10-19T00:22:58.257Z');
});

test('cast integer', () => {
    expect(cast<integer>(123.456)).toBe(123);
    expect(cast<int8>(1000)).toBe(127);
});

test('tuple 2', () => {
    const value = cast<[string, number]>([12, '13']);
    expect(value).toEqual(['12', 13]);
});

test('tuple rest', () => {
    {
        const value = cast<[...string[], number]>([12, '13']);
        expect(value).toEqual(['12', 13]);
    }
    {
        const value = cast<[...string[], number]>([12, 13, '14']);
        expect(value).toEqual(['12', '13', 14]);
    }
    {
        const value = cast<[boolean, ...string[], number]>([1, 12, '13']);
        expect(value).toEqual([true, '12', 13]);
    }
    {
        const value = cast<[boolean, ...string[], number]>([1, 12, 13, '14']);
        expect(value).toEqual([true, '12', '13', 14]);
    }
    {
        const value = serialize<[boolean, ...string[], number]>([true, '12', 13]);
        expect(value).toEqual([true, '12', 13]);
    }
});

test('set', () => {
    {
        const value = cast<Set<string>>(['a', 'a', 'b']);
        expect(value).toEqual(new Set(['a', 'b']));
    }
    {
        const value = cast<Set<string>>(['a', 2, 'b']);
        expect(value).toEqual(new Set(['a', '2', 'b']));
    }
    {
        const value = serialize<Set<string>>(new Set(['a', 'b']));
        expect(value).toEqual(['a', 'b']);
    }
});

test('map', () => {
    {
        const value = cast<Map<string, number>>([
            ['a', 1],
            ['a', 2],
            ['b', 3],
        ]);
        expect(value).toEqual(
            new Map([
                ['a', 2],
                ['b', 3],
            ]),
        );
    }
    {
        const value = cast<Map<string, number>>([
            ['a', 1],
            [2, '2'],
            ['b', 3],
        ]);
        expect(value).toEqual(
            new Map([
                ['a', 1],
                ['2', 2],
                ['b', 3],
            ]),
        );
    }
    {
        const value = serialize<Map<string, number>>(
            new Map([
                ['a', 2],
                ['b', 3],
            ]),
        );
        expect(value).toEqual([
            ['a', 2],
            ['b', 3],
        ]);
    }
});

test('number', () => {
    expect(cast<number>(1)).toBe(1);
    expect(cast<number>(-1)).toBe(-1);
    expect(cast<number>(true)).toBe(1);
    expect(cast<number>(false)).toBe(0);
    expect(cast<number>('1')).toBe(1);
    expect(cast<number>('-1')).toBe(-1);
});

test('null undefined and string', () => {
    expect(() => cast<string>(undefined)).toThrow('Validation error');
    expect(() => cast<string>(null)).toThrow('Validation error');
    expect(cast<string>('')).toBe('');
});

test('union string number', () => {
    expect(cast<string | number>('a')).toEqual('a');
    expect(cast<string | number>(2)).toEqual(2);

    expect(cast<string | integer>(2)).toEqual(2);
    expect(cast<string | integer>('3', { loosely: false })).toEqual('3');
    expect(cast<string | integer>('3')).toEqual(3);

    expect(cast<string | integer>(2.2)).toEqual(2);
    expect(cast<string | integer>('2.2', { loosely: false })).toEqual('2.2');
    expect(cast<string | integer>('2.2')).toEqual(2);

    expect(cast<string | integer>(false)).toEqual('false');
    expect(cast<string | integer>(true)).toEqual('true');
});

test('union boolean number', () => {
    expect(cast<boolean | number>(2)).toEqual(2);
    expect(cast<boolean | number>(1)).toEqual(1);
    expect(cast<boolean | number>(0)).toEqual(0);
    expect(cast<boolean | number>(false)).toEqual(false);
    expect(cast<boolean | number>(true)).toEqual(true);
});

test('disabled loosely throws for primitives', () => {
    expect(cast<string>(23)).toEqual('23');
    expect(cast<string>(23)).toEqual('23');
    expect(() => cast<string>(23, { loosely: false })).toThrow('Validation error');

    expect(cast<number>('23')).toEqual(23);
    expect(cast<number>('23')).toEqual(23);
    expect(() => cast<number>('23', { loosely: false })).toThrow('Validation error');

    expect(cast<boolean>(1)).toEqual(true);
    expect(cast<boolean>(1)).toEqual(true);
    expect(() => cast<boolean>(1, { loosely: false })).toThrow('Validation error');
});

test('union loose string number', () => {
    expect(cast<string | number>('a')).toEqual('a');
    expect(cast<string | number>(2)).toEqual(2);
    expect(cast<string | number>(-2)).toEqual(-2);

    expect(cast<string | integer>(2)).toEqual(2);
    expect(cast<string | integer>('3')).toEqual(3);

    expect(cast<string | integer>(2.2)).toEqual(2);
    expect(cast<string | integer>(-2.2)).toEqual(-2);
    expect(cast<string | integer>('2.2')).toEqual(2);
    expect(cast<string | integer>(false)).toEqual('false');
    expect(cast<string | integer>(true)).toEqual('true');
});

test('union loose string boolean', () => {
    expect(cast<string | boolean>('a')).toEqual('a');
    expect(cast<string | boolean>(1)).toEqual(true);
    expect(cast<string | boolean>(0)).toEqual(false);
    expect(cast<string | boolean>(-1)).toEqual('-1');
    expect(cast<string | boolean>(2)).toEqual('2');
    expect(cast<string | boolean>('true')).toEqual(true);
    expect(cast<string | boolean>('true2')).toEqual('true2');
});

test('union loose number boolean', () => {
    expect(() => cast<number | boolean>('a')).toThrow('Cannot convert string "a" to number | boolean');
    expect(() => deserialize<number | boolean>('a')).toThrow('Cannot convert string "a" to number | boolean');
    expect(cast<string | boolean>(1)).toEqual(true);
    expect(cast<number | boolean>(1)).toEqual(1);
    expect(cast<string | boolean>('1')).toEqual(true);
    expect(cast<number | boolean>('1')).toEqual(1);
    expect(cast<number | boolean>('1')).toEqual(1);
    expect(cast<string | boolean>(0)).toEqual(false);
    expect(cast<number | boolean>(0)).toEqual(0);
    expect(cast<number | boolean>(-1)).toEqual(-1);
    expect(cast<number | boolean>(2)).toEqual(2);
    expect(cast<number | boolean>('2')).toEqual(2);
    expect(cast<number | boolean>('true')).toEqual(true);
    expect(() => cast<number | boolean>('true', { loosely: false })).toThrow('Cannot convert string "true" to number | boolean');
    expect(() => cast<number | boolean>('true2', { loosely: false })).toThrow('Cannot convert string "true2" to number | boolean');
    expect(() => deserialize<number | boolean>('true2')).toThrow('Cannot convert string "true2" to number | boolean');
});

test('union string date', () => {
    expect(cast<string | Date>('a')).toEqual('a');
    expect(cast<string | Date>('2021-11-24T16:21:13.425Z')).toBeInstanceOf(Date);
    expect(cast<string | Date>(1637781902866)).toBeInstanceOf(Date);
    expect(cast<string | Date>('1637781902866')).toBe('1637781902866');
    expect(cast<(string | Date)[]>(['2021-11-24T16:21:13.425Z'])[0]).toBeInstanceOf(Date);
});

test('union string bigint', () => {
    expect(cast<string | bigint>('a')).toEqual('a');
    expect(cast<string | bigint>(2n)).toEqual(2n);
    expect(cast<string | bigint>(2)).toEqual(2n);
    expect(cast<string | bigint>('2', { loosely: false })).toEqual('2');
    expect(cast<string | bigint>('2')).toEqual(2n);
    expect(cast<string | bigint>('2a')).toEqual('2a');
});

test('union loose string bigint', () => {
    expect(cast<string | bigint>('a')).toEqual('a');
    expect(cast<string | bigint>(2n)).toEqual(2n);
    expect(cast<string | bigint>(2)).toEqual(2n);
    expect(cast<string | bigint>('2')).toEqual(2n);
    expect(cast<string | bigint>('2a')).toEqual('2a');
});

test('BinaryBigInt', () => {
    expect(serialize<bigint>(24n)).toBe('24');
    expect(serialize<BinaryBigInt>(24n)).toBe('24');
    expect(serialize<BinaryBigInt>(-4n)).toBe('0');

    expect(deserialize<BinaryBigInt>(24n)).toBe(24n);
    expect(deserialize<BinaryBigInt>('24')).toBe(24n);
    expect(deserialize<BinaryBigInt>(-4n)).toBe(0n);
    expect(deserialize<BinaryBigInt>('-4')).toBe(0n);

    expect(serialize<SignedBinaryBigInt>(24n)).toBe('24');
    expect(serialize<SignedBinaryBigInt>(-4n)).toBe('-4');
    expect(deserialize<SignedBinaryBigInt>(24n)).toBe(24n);
    expect(deserialize<SignedBinaryBigInt>('24')).toBe(24n);
    expect(deserialize<SignedBinaryBigInt>(-4n)).toBe(-4n);
    expect(deserialize<SignedBinaryBigInt>('-4')).toBe(-4n);
});

test('literal', () => {
    expect(cast<'a'>('a')).toEqual('a');
    expect(serialize<'a'>('a')).toEqual('a');
    expect(cast<'a'>('b')).toEqual('a');
    expect(cast<'a'>(123)).toEqual('a');
    expect(cast<1>(123)).toEqual(1);
    expect(cast<1>('123')).toEqual(1);
    expect(cast<true>('123')).toEqual(true);
    expect(cast<1n>('123')).toEqual(1n);
    expect(cast<1n>('123')).toEqual(1n);

    expect(serialize<1n>(1n)).toEqual(1n);
});

test('cast runs validators', () => {
    type Username = string & MinLength<3> & MaxLength<23> & Alphanumeric;
    expect(() => cast<Username>('ab')).toThrow('Validation error for type');
    expect(() => cast<Username>('$ab')).toThrow('Validation error for type');
    expect(cast<Username>('Peter')).toBe('Peter');
});

test('union literal', () => {
    expect(cast<'a' | number>('a')).toEqual('a');
    expect(cast<'a' | number>(23)).toEqual(23);
    expect(serialize<'a' | number>('a')).toEqual('a');
    expect(serialize<'a' | number>(23)).toEqual(23);

    expect(cast<3 | number>(23)).toEqual(23);
    expect(cast<3 | number>(3)).toEqual(3);
    expect(serialize<3 | number>(23)).toEqual(23);
    expect(serialize<3 | number>(3)).toEqual(3);

    expect(cast<3 | boolean>(3)).toEqual(3);
    expect(cast<true | boolean>(true)).toEqual(true);
    expect(cast<true | boolean>(false)).toEqual(false);
    expect(cast<false | boolean>(true)).toEqual(true);
    expect(cast<false | boolean>(false)).toEqual(false);
});

test('union primitive and class', () => {
    class User {
        id!: number;
    }

    expect(cast<number | User>(2)).toEqual(2);
    expect(cast<number | User>('2')).toEqual(2);
    expect(cast<number | User>({ id: 23 })).toEqual({ id: 23 });
    expect(cast<number | User>({ id: 23 })).toBeInstanceOf(User);
    expect(() => cast<number | User>('2asd')).toThrow('Cannot convert string "2asd" to number | User');

    expect(serialize<number | User>(2)).toEqual(2);
    expect(serialize<number | User>({ id: 23 })).toEqual({ id: 23 });
    expect(serialize<number | User>({ id: 23 })).toBeInstanceOf(Object);
});

test('union multiple classes', () => {
    class User {
        id!: number;
        username!: string;
    }

    class Picture {
        id!: number;
        path!: string;
    }

    expect(cast<Picture | User>({ id: 23, username: 'peter' })).toEqual({ id: 23, username: 'peter' });
    expect(cast<Picture | User>({ id: 23, username: 'peter' })).toBeInstanceOf(User);

    expect(cast<Picture | User>({ id: 23, path: 'src/path' })).toEqual({ id: 23, path: 'src/path' });
    expect(cast<Picture | User>({ id: 23, path: 'src/path' })).toBeInstanceOf(Picture);

    expect(cast<number | User>(23)).toEqual(23);
    expect(cast<number | User>({ id: 23, username: 'peter' })).toBeInstanceOf(User);

    expect(serialize<Picture | User>({ id: 23, username: 'peter' })).toEqual({ id: 23, username: 'peter' });
    expect(serialize<Picture | User>({ id: 23, username: 'peter' })).toBeInstanceOf(Object);

    expect(serialize<Picture | User>({ id: 23, path: 'src/path' })).toEqual({ id: 23, path: 'src/path' });
    expect(serialize<Picture | User>({ id: 23, path: 'src/path' })).toBeInstanceOf(Object);

    expect(serialize<number | User>(23)).toEqual(23);
    expect(serialize<number | User>({ id: 23, username: 'peter' })).toBeInstanceOf(Object);
    expect(serialize<number | User>({ id: 23, username: 'peter' })).toEqual({ id: 23, username: 'peter' });
});

test('brands', () => {
    expect(cast<number & PrimaryKey>(2)).toEqual(2);
    expect(cast<number & PrimaryKey>('2')).toEqual(2);

    expect(serialize<number & PrimaryKey>(2)).toEqual(2);
});

test('throw', () => {
    expect(() => cast<number>('123abc')).toThrow('Cannot convert string "123abc" to number');
    expect(() => cast<{ a: string }>(false)).toThrow('Cannot convert boolean false to {a: string}');
    expect(() => cast<{ a: number }>({ a: 'abc' })).toThrow('Cannot convert string "abc" to number');
    expect(() => cast<{ a: { b: number } }>({ a: 'abc' })).toThrow('Cannot convert string "abc" to {b: number}');
    expect(() => cast<{ a: { b: number } }>({ a: { b: 'abc' } })).toThrow('Cannot convert string "abc" to number');
});

test('index signature ', () => {
    interface BagOfNumbers {
        [name: string]: number;
    }

    interface BagOfStrings {
        [name: string]: string;
    }

    expect(cast<BagOfNumbers>({ a: 1 })).toEqual({ a: 1 });
    expect(cast<BagOfNumbers>({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(() => cast<BagOfNumbers>({ a: 'b' })).toThrow(ValidationError as any);
    expect(() => cast<BagOfNumbers>({ a: 'b' })).toThrow('Cannot convert string "b" to number');
    expect(cast<BagOfNumbers>({ a: '1' })).toEqual({ a: 1 });
    expect(() => cast<BagOfNumbers>({ a: 'b', b: 'c' })).toThrow(ValidationError as any);
    expect(() => cast<BagOfNumbers>({ a: 'b', b: 'c' })).toThrow('Cannot convert string "b" to number');

    // Verify error code for ValidationError
    try {
        cast<BagOfNumbers>({ a: 'b' });
    } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.code).toBe('DK-T300'); // ValidationError error code
    }

    expect(cast<BagOfStrings>({ a: 1 })).toEqual({ a: '1' });
    expect(cast<BagOfStrings>({ a: 1, b: 2 })).toEqual({ a: '1', b: '2' });
    expect(cast<BagOfStrings>({ a: 'b' })).toEqual({ a: 'b' });
    expect(cast<BagOfStrings>({ a: 'b', b: 'c' })).toEqual({ a: 'b', b: 'c' });

    expect(serialize<BagOfNumbers>({ a: 1 })).toEqual({ a: 1 });
    expect(serialize<BagOfStrings>({ a: '1' })).toEqual({ a: '1' });
});

test('exclude', () => {
    class User {
        username!: string;

        password?: string & Excluded<'*'>;
    }

    const reflection = ReflectionClass.from(User);
    expect(reflection.getProperty('password')?.getExcluded()).toEqual(['*']);

    expect(cast<User>({ username: 'peter', password: 'nope' })).toEqual({ username: 'peter', password: undefined });
    expect(serialize<User>({ username: 'peter', password: 'nope' })).toEqual({ username: 'peter', password: undefined });
});

test('regexp direct', () => {
    expect(cast<RegExp>(/abc/).toString()).toEqual('/abc/');
    expect(cast<RegExp>('/abc/').toString()).toEqual('/abc/');
    expect(cast<RegExp>('abc').toString()).toEqual('/abc/');
    expect(serialize<RegExp>(/abc/).toString()).toEqual('/abc/');
});

test('regexp union', () => {
    expect(cast<string | { $regex: RegExp }>({ $regex: /abc/ })).toEqual({ $regex: /abc/ });
    expect(cast<Record<string, string | { $regex: RegExp }>>({ a: { $regex: /abc/ } })).toEqual({ a: { $regex: /abc/ } });
});

test('index signature with template literal', () => {
    type a1 = { [index: `a${number}`]: number };
    expect(cast<a1>({ a123: '123' })).toEqual({ a123: 123 });
    expect(cast<a1>({ a123: '123', b: 123 })).toEqual({ a123: 123, b: undefined });
    expect(cast<a1>({ a123: '123', a124: 123 })).toEqual({ a123: 123, a124: 123 });
});

test('class circular reference', () => {
    class User {
        constructor(public username: string) {}

        manager?: User;
    }

    const res = cast<User>({ username: 'Horst', manager: { username: 'Peter' } });
    expect(res).toEqual({ username: 'Horst', manager: { username: 'Peter' } });
    expect(res).toBeInstanceOf(User);
    expect(res.manager).toBeInstanceOf(User);
});

test('class with reference', () => {
    class User {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {}
    }

    interface Team {
        lead: User & Reference;
    }

    {
        const res = cast<Team>({ lead: { id: 1, username: 'Peter' } });
        expect(res).toEqual({ lead: { id: 1, username: 'Peter' } });
        expect(res.lead).toBeInstanceOf(User);
        expect(isReferenceInstance(res.lead)).toBe(false);
    }

    {
        const res = cast<Team>({ lead: { id: 1 } });
        expect(res).toEqual({ lead: { id: 1 } });
        expect(res.lead).toBeInstanceOf(User);
        expect(isReferenceInstance(res.lead)).toBe(true);
    }

    {
        const res = cast<Team>({ lead: { username: 'Peter' } });
        expect(res).toEqual({ lead: { id: 0, username: 'Peter' } });
        expect(res.lead).toBeInstanceOf(User);
    }

    {
        const res = cast<Team>({ lead: 23 });
        expect(res).toEqual({ lead: { id: 23 } });
        expect(res.lead).toBeInstanceOf(User);
        expect(getClassName(res.lead)).toBe('UserReference');
    }
});

test('class with back reference', () => {
    class User {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {}
    }

    interface Team {
        leads: User[] & BackReference;
    }

    const res = cast<Team>({ leads: [{ username: 'Peter' }] });
    expect(res).toEqual({ leads: [{ id: 0, username: 'Peter' }] });
    expect(res.leads[0]).toBeInstanceOf(User);
});

test('embedded single', () => {
    class Price {
        constructor(public amount: integer) {}
    }

    class Product {
        constructor(
            public title: string,
            public price: Embedded<Price>,
        ) {}
    }

    expect(serialize<Embedded<Price>>(new Price(34))).toEqual(34);
    expect(serialize<Embedded<Price>[]>([new Price(34)])).toEqual([34]);
    expect(serialize<Embedded<Price, { prefix: '' }>[]>([new Price(34)])).toEqual([34]);
    expect(serialize<Embedded<Price, { prefix: 'price_' }>[]>([new Price(34)])).toEqual([34]);
    expect(serialize<{ a: Embedded<Price> }>({ a: new Price(34) })).toEqual({ a: 34 });
    expect(serialize<{ a: Embedded<Price, { prefix: '' }> }>({ a: new Price(34) })).toEqual({ amount: 34 });
    expect(serialize<{ a: Embedded<Price, { prefix: 'price_' }> }>({ a: new Price(34) })).toEqual({ price_amount: 34 });
    expect(serialize<Product>(new Product('Brick', new Price(34)))).toEqual({ title: 'Brick', price: 34 });

    expect(deserialize<Embedded<Price>>(34)).toEqual(new Price(34));
    expect(deserialize<Embedded<Price>[]>([34])).toEqual([new Price(34)]);
    expect(deserialize<(Embedded<Price> | string)[]>([34])).toEqual([new Price(34)]);
    expect(deserialize<(Embedded<Price> | string)[]>(['abc'])).toEqual(['abc']);
    expect(deserialize<Embedded<Price, { prefix: '' }>[]>([34])).toEqual([new Price(34)]);
    expect(deserialize<Embedded<Price, { prefix: 'price_' }>[]>([34])).toEqual([new Price(34)]);
    expect(deserialize<{ a: Embedded<Price> }>({ a: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: '' }> }>({ amount: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: 'price_' }> }>({ price_amount: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<Product>({ title: 'Brick', price: 34 })).toEqual(new Product('Brick', new Price(34)));

    // check if union works correctly
    expect(serialize<{ v: Embedded<Price> | string }>({ v: new Price(34) })).toEqual({ v: 34 });
    expect(serialize<{ v: Embedded<Price> | string }>({ v: '123' })).toEqual({ v: '123' });
    expect(serialize<(Embedded<Price> | string)[]>([new Price(34)])).toEqual([34]);
    expect(serialize<(Embedded<Price> | string)[]>(['abc'])).toEqual(['abc']);
    expect(serialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: new Price(34) })).toEqual({ amount: 34 });
    expect(serialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: '34' })).toEqual({ v: '34' });
    expect(serialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: new Price(34) })).toEqual({ price_amount: 34 });
    expect(serialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: '34' })).toEqual({ v: '34' });

    expect(deserialize<{ v: Embedded<Price> | string }>({ v: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price> | string }>({ v: '123' })).toEqual({ v: '123' });
    expect(deserialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: '34' })).toEqual({ v: '34' });
    expect(deserialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ price_amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: '34' })).toEqual({ v: '34' });
});

test('embedded single optional', () => {
    class Price {
        constructor(public amount: integer) {}
    }

    expect(deserialize<{ v?: Embedded<Price> }>({ v: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v?: Embedded<Price> }>({})).toEqual({});
    expect(deserialize<{ v?: Embedded<Price, { prefix: '' }> }>({ amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v?: Embedded<Price, { prefix: '' }> }>({})).toEqual({});
    expect(deserialize<{ v?: Embedded<Price, { prefix: 'price_' }> }>({ price_amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v?: Embedded<Price, { prefix: 'price_' }> }>({})).toEqual({});

    class Product1 {
        constructor(
            public title: string,
            public price: Embedded<Price> = new Price(15),
        ) {}
    }

    class Product2 {
        constructor(
            public title: string,
            public price?: Embedded<Price>,
        ) {}
    }

    class Product3 {
        public price: Embedded<Price> | undefined = new Price(15);
    }

    class Product4 {
        public price: Embedded<Price> | null = new Price(15);
    }

    expect(deserialize<{ a?: Embedded<Price> }>({})).toEqual({});
    expect(deserialize<{ a?: Embedded<Price> }>({ a: undefined })).toEqual({});
    expect(deserialize<{ a?: Embedded<Price, { prefix: '' }> }>({})).toEqual({});
    expect(deserialize<{ a?: Embedded<Price, { prefix: '' }> }>({ amount: undefined })).toEqual({});
    expect(deserialize<{ a?: Embedded<Price, { prefix: 'price_' }> }>({})).toEqual({});
    expect(deserialize<{ a?: Embedded<Price, { prefix: 'price_' }> }>({ price_amount: undefined })).toEqual({});
    expect(deserialize<Product1>({ title: 'Brick' })).toEqual(new Product1('Brick'));
    expect(deserialize<Product2>({ title: 'Brick' })).toEqual(new Product2('Brick'));
    expect(deserialize<Product3>({})).toEqual({ price: new Price(15) });
    expect(deserialize<Product3>({ price: null })).toEqual({ price: undefined });
    expect(deserialize<Product4>({ price: undefined })).toEqual({ price: null });
    expect(deserialize<Product4>({})).toEqual({ price: null });
    expect(deserialize<Product4>({ price: null })).toEqual({ price: null });
});

test('embedded multi parameter', () => {
    class Price {
        constructor(
            public amount: integer,
            public currency: string = 'EUR',
        ) {}
    }

    class Product {
        constructor(
            public title: string,
            public price: Embedded<Price>,
        ) {}
    }

    expect(serialize<Embedded<Price>>(new Price(34))).toEqual({ amount: 34, currency: 'EUR' });
    expect(serialize<Embedded<Price>[]>([new Price(34)])).toEqual([{ amount: 34, currency: 'EUR' }]);
    expect(serialize<Embedded<Price, { prefix: '' }>[]>([new Price(34)])).toEqual([{ amount: 34, currency: 'EUR' }]);
    expect(serialize<Embedded<Price, { prefix: 'price_' }>[]>([new Price(34)])).toEqual([{ price_amount: 34, price_currency: 'EUR' }]);
    expect(serialize<{ a: Embedded<Price> }>({ a: new Price(34) })).toEqual({ a_amount: 34, a_currency: 'EUR' });
    expect(serialize<{ a: Embedded<Price, { prefix: '' }> }>({ a: new Price(34) })).toEqual({ amount: 34, currency: 'EUR' });
    expect(serialize<{ a: Embedded<Price, { prefix: 'price_' }> }>({ a: new Price(34) })).toEqual({ price_amount: 34, price_currency: 'EUR' });
    expect(serialize<Product>(new Product('Brick', new Price(34)))).toEqual({ title: 'Brick', price_amount: 34, price_currency: 'EUR' });

    expect(deserialize<Embedded<Price>>({ amount: 34 })).toEqual(new Price(34));
    expect(deserialize<Embedded<Price>>({ amount: 34, currency: '$' })).toEqual(new Price(34, '$'));
    expect(deserialize<Embedded<Price>[]>([{ amount: 34 }])).toEqual([new Price(34)]);
    expect(deserialize<Embedded<Price>[]>([{ amount: 34, currency: '$' }])).toEqual([new Price(34, '$')]);
    expect(deserialize<Embedded<Price, { prefix: '' }>[]>([{ amount: 34 }])).toEqual([new Price(34)]);
    expect(deserialize<Embedded<Price, { prefix: 'price_' }>[]>([{ price_amount: 34 }])).toEqual([new Price(34)]);
    expect(deserialize<{ a: Embedded<Price> }>({ a_amount: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: '' }> }>({ amount: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: '' }> }>({ amount: 34, currency: '$' })).toEqual({ a: new Price(34, '$') });
    expect(deserialize<{ a: Embedded<Price, { prefix: '' }> }>({ amount: 34, currency: undefined })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: 'price_' }> }>({ price_amount: 34 })).toEqual({ a: new Price(34) });
    expect(deserialize<{ a: Embedded<Price, { prefix: 'price_' }> }>({ price_amount: 34, price_currency: '$' })).toEqual({ a: new Price(34, '$') });
    expect(deserialize<Product>({ title: 'Brick', price_amount: 34 })).toEqual(new Product('Brick', new Price(34)));

    //check if union works correctly
    expect(serialize<{ v: Embedded<Price> | string }>({ v: new Price(34) })).toEqual({ v_amount: 34, v_currency: 'EUR' });
    expect(serialize<{ v: Embedded<Price> | string }>({ v: new Price(34, '$') })).toEqual({ v_amount: 34, v_currency: '$' });
    expect(serialize<{ v: Embedded<Price> | string }>({ v: '123' })).toEqual({ v: '123' });
    expect(serialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: new Price(34) })).toEqual({ amount: 34, currency: 'EUR' });
    expect(serialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: '34' })).toEqual({ v: '34' });
    expect(serialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: new Price(34) })).toEqual({ price_amount: 34, price_currency: 'EUR' });
    expect(serialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: '34' })).toEqual({ v: '34' });

    expect(deserialize<{ v: Embedded<Price> | string }>({ v_amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price> | string }>({ v_amount: 34, v_currency: '$' })).toEqual({ v: new Price(34, '$') });
    expect(deserialize<{ v: Embedded<Price> | string }>({ v: '123' })).toEqual({ v: '123' });
    expect(deserialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price, { prefix: '' }> | string }>({ v: '34' })).toEqual({ v: '34' });
    expect(deserialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ price_amount: 34 })).toEqual({ v: new Price(34) });
    expect(deserialize<{ v: Embedded<Price, { prefix: 'price_' }> | string }>({ v: '34' })).toEqual({ v: '34' });
});

test('class inheritance', () => {
    abstract class Person {
        id: number & PrimaryKey & AutoIncrement = 0;
        firstName?: string;
        lastName?: string;
        abstract type: string;
    }

    class Employee extends Person {
        email?: string;
        type: 'employee' = 'employee';
    }

    class Freelancer extends Person {
        @t budget: number = 10_000;
        type: 'freelancer' = 'freelancer';
    }

    const employee = ReflectionClass.from(Employee);
    expect(employee.getProperty('firstName').getKind()).toBe(ReflectionKind.string);
    const scopeSerializer = getSerializeFunction(employee.type, serializer.serializeRegistry);

    expect(scopeSerializer({ type: 'employee', firstName: 'Peter', email: 'test@example.com' })).toEqual({ type: 'employee', firstName: 'Peter', email: 'test@example.com' });
});

test('class with union literal', () => {
    class ConnectionOptions {
        readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';
    }

    expect(cast<ConnectionOptions>({ readConcernLevel: 'majority' })).toEqual({ readConcernLevel: 'majority' });
    expect(cast<ConnectionOptions>({ readConcernLevel: 'linearizable' })).toEqual({ readConcernLevel: 'linearizable' });
    // Invalid values should throw validation error (fix for #478)
    expect(() => cast<ConnectionOptions>({ readConcernLevel: 'unknown' })).toThrow("Cannot convert string \"unknown\" to 'local' | 'majority' | 'linearizable' | 'available'");
});

test('named tuple in error message', () => {
    expect(cast<[age: number]>([23])).toEqual([23]);
    expect(() => cast<{ v: [age: number] }>({ v: ['123abc'] })).toThrow('v.age(type): Cannot convert string "123abc" to number');
});

test('issue-478: small literal unions should validate values', () => {
    // Small string unions (< 5 members) should validate values
    // Error format is 'Cannot convert type "value" to ...' for strings, 'Cannot convert type value to ...' for others
    expect(serialize<'a' | 'b' | 'c' | 'd'>('a')).toBe('a');
    expect(serialize<'a' | 'b' | 'c' | 'd'>('d')).toBe('d');
    expect(() => serialize<'a' | 'b' | 'c' | 'd'>('invalid' as any)).toThrow("Cannot convert string \"invalid\" to 'a' | 'b' | 'c' | 'd'");
    expect(() => deserialize<'a' | 'b' | 'c' | 'd'>('invalid')).toThrow("Cannot convert string \"invalid\" to 'a' | 'b' | 'c' | 'd'");

    // Small numeric unions should validate values
    expect(serialize<1 | 2 | 3>(1)).toBe(1);
    expect(serialize<1 | 2 | 3>(3)).toBe(3);
    expect(() => serialize<1 | 2 | 3>(99 as any)).toThrow('Cannot convert number 99 to 1 | 2 | 3');
    expect(() => deserialize<1 | 2 | 3>(99)).toThrow('Cannot convert number 99 to 1 | 2 | 3');

    // Loose deserialization should still coerce strings to numbers for numeric unions
    expect(deserialize<1 | 2 | 3>('1', { loosely: true })).toBe(1);
    expect(deserialize<1 | 2 | 3>('3', { loosely: true })).toBe(3);
    // Error shows original input type since no match was found (string didn't match any number literal)
    expect(() => deserialize<1 | 2 | 3>('99', { loosely: true })).toThrow('Cannot convert string "99" to 1 | 2 | 3');

    // Validate works for both small and large unions
    expect(validate<'a' | 'b' | 'c' | 'd'>('a')).toEqual([]);
    expect(validate<'a' | 'b' | 'c' | 'd'>('invalid')).toHaveLength(1);
    expect(validate<'a' | 'b' | 'c' | 'd'>('invalid')[0].message).toContain('Cannot convert');
});

test('intersected mapped type key', () => {
    type SORT_ORDER = 'asc' | 'desc' | any;
    type Sort<T, ORDER extends SORT_ORDER = SORT_ORDER> = { [P in keyof T & string]?: ORDER };

    interface A {
        username: string;
        id: number;
    }

    type sortA = Sort<A>;

    expect(cast<sortA>({ username: 'asc' })).toEqual({ username: 'asc' });
    expect(cast<sortA>({ id: 'desc', username: 'asc' })).toEqual({ id: 'desc', username: 'asc' });

    type sortAny = Sort<any>;
    expect(cast<sortAny>({ username: 'asc' })).toEqual({ username: 'asc' });
    expect(cast<sortAny>({ id: 'desc', username: 'asc' })).toEqual({ id: 'desc', username: 'asc' });
});

test('wild property names', () => {
    interface A {
        ['asd-344']: string;
        ['#$%^^x']: number;
    }

    expect(deserialize<A>({ 'asd-344': 'abc', '#$%^^x': 3 })).toEqual({ 'asd-344': 'abc', '#$%^^x': 3 });
});

test('embedded with lots of properties', () => {
    interface LotsOfIt {
        a?: string;
        lot?: string;
        of?: string;
        additional?: string;
        properties?: string;
    }

    class A {
        constructor(public options: Embedded<LotsOfIt, { prefix: '' }> = {}) {}
    }

    const back1 = deserialize<A>({ a: 'abc', lot: 'string' });
    expect(back1.options).toEqual({ a: 'abc', lot: 'string' });

    class A2 {
        public options: Embedded<LotsOfIt, { prefix: '' }> = {};
    }

    const back2 = deserialize<A2>({ a: 'abc', lot: 'string' });
    expect(back2.options).toEqual({ a: 'abc', lot: 'string' });
});

test('embedded in super class', () => {
    class Thread {
        public parentThreadId?: string;
        public senderOrder?: number;

        constructor(public id: string & MapName<'~thread'>) {}
    }

    class ComposedMessage {
        thread?: Embedded<Thread, { prefix: '' }>;
    }

    class Message extends ComposedMessage {
        public readonly type: string = Message.type;
        public static readonly type = 'my-id';

        public routingKeys?: string[];
        public endpoint?: string;
    }

    const back1 = deserialize<Message>({ '~thread': 'foo' });
    expect(back1).toEqual({ type: Message.type, thread: { id: 'foo' } });

    const plain = serialize<Message>(back1);
    expect(plain).toEqual({ type: Message.type, parentThreadId: null, senderOrder: null, '~thread': 'foo' });
});

test('disabled constructor', () => {
    let called = false;

    @entity.disableConstructor()
    class User {
        id: number = 0;
        title: string = 'id:' + this.id;

        constructor(public type: string) {
            called = true;
        }
    }

    expect(ReflectionClass.from(User).disableConstructor).toBe(true);

    const user = deserialize<User>({ type: 'nix' });
    expect(called).toBe(false);
    expect(user).toBeInstanceOf(User);
    expect(user).toEqual({ id: 0, title: 'id:' + 0, type: 'nix' });
});

test('readonly constructor properties', () => {
    class Pilot {
        constructor(
            readonly name: string,
            readonly age: number,
        ) {}
    }

    expect(cast<Pilot>({ name: 'Peter', age: 32 })).toEqual({ name: 'Peter', age: 32 });
    expect(cast<Pilot>({ name: 'Peter', age: '32' })).toEqual({ name: 'Peter', age: 32 });
});

test('naming strategy prefix', () => {
    class MyNamingStrategy extends NamingStrategy {
        constructor() {
            super('my');
        }

        override getPropertyName(type: TypeProperty | TypePropertySignature, forSerializer: string): string | undefined {
            return '_' + super.getPropertyName(type, forSerializer);
        }
    }

    interface Post {
        id: number;
        likesCount: number;
    }

    interface User {
        readonly id: number;
        readonly posts: readonly Post[];
    }

    {
        const res = serialize<User>(
            {
                id: 2,
                posts: [
                    { id: 3, likesCount: 1 },
                    { id: 4, likesCount: 2 },
                ],
            },
            undefined,
            undefined,
            new MyNamingStrategy(),
        );
        expect(res).toEqual({
            _id: 2,
            _posts: [
                { _id: 3, _likesCount: 1 },
                { _id: 4, _likesCount: 2 },
            ],
        });
    }

    {
        const res = deserialize<User>(
            {
                _id: 2,
                _posts: [
                    { _id: 3, _likesCount: 1 },
                    { _id: 4, _likesCount: 2 },
                ],
            },
            undefined,
            undefined,
            new MyNamingStrategy(),
        );
        expect(res).toEqual({
            id: 2,
            posts: [
                { id: 3, likesCount: 1 },
                { id: 4, likesCount: 2 },
            ],
        });
    }
});

test('naming strategy camel case', () => {
    const camelCaseToSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    class CamelCaseToSnakeCaseNamingStrategy extends NamingStrategy {
        constructor() {
            super('snake-case-to-camel-case');
        }

        override getPropertyName(type: TypeProperty | TypePropertySignature, forSerializer: string): string | undefined {
            const propertyName = super.getPropertyName(type, forSerializer);
            return propertyName ? camelCaseToSnakeCase(propertyName) : undefined;
        }
    }

    interface Post {
        id: number;
        likesCount: number;
    }

    interface User {
        id: number;
        posts: Post[];
    }

    {
        const res = serialize<User>(
            {
                id: 2,
                posts: [
                    { id: 3, likesCount: 1 },
                    { id: 4, likesCount: 2 },
                ],
            },
            undefined,
            undefined,
            new CamelCaseToSnakeCaseNamingStrategy(),
        );
        expect(res).toEqual({
            id: 2,
            posts: [
                { id: 3, likes_count: 1 },
                { id: 4, likes_count: 2 },
            ],
        });
    }

    {
        const res = deserialize<User>(
            {
                id: 2,
                posts: [
                    { id: 3, likes_count: 1 },
                    { id: 4, likes_count: 2 },
                ],
            },
            undefined,
            undefined,
            new CamelCaseToSnakeCaseNamingStrategy(),
        );
        expect(res).toEqual({
            id: 2,
            posts: [
                { id: 3, likesCount: 1 },
                { id: 4, likesCount: 2 },
            ],
        });
    }
});

test('enum mixed case', () => {
    enum Units {
        MILLIGRAM = 'm',
        GRAM = 'g',
        KILOGRAM = 'k',
    }

    expect(cast<Units>('milligram')).toBe('m');
    expect(cast<Units>('milligram')).toBe(Units.MILLIGRAM);

    expect(cast<Units>('MilliGRAM')).toBe(Units.MILLIGRAM);

    expect(cast<Units>('gram')).toBe('g');
    expect(cast<Units>('gram')).toBe(Units.GRAM);

    expect(cast<number | Units>('GRAM')).toBe(Units.GRAM);
    expect(cast<number | Units>(23)).toBe(23);
    expect(cast<number | Units>('Gram')).toBe(Units.GRAM);
});

// Skipped: Requires update to new jit.fn() API - state.addCode() no longer exists
test.skip('onLoad call', () => {
    class Target {
        id: number = 0;
        loaded = false;

        onLoad(): void {
            this.loaded = true;
        }
    }

    const serializer = new (class extends Serializer {
        override registerSerializers() {
            super.registerSerializers();
            this.deserializeRegistry.addDecorator(
                (type: Type) => type.kind === ReflectionKind.class && type.classType === Target,
                (type, state) => {
                    state.addCode(`${state.setter}.onLoad();`);
                },
            );
        }
    })();

    const target = cast<Target>({ id: 1 }, undefined, serializer);
    expect(target.loaded).toBe(true);
});

// Skipped: Requires update to new jit.fn() API - state.touch() no longer exists
test.skip('onLoad call2', () => {
    class Target {
        id: number = 0;
        loaded = false;

        onLoad(): void {
            this.loaded = true;
        }
    }

    const serializer = new (class extends Serializer {
        override registerSerializers() {
            super.registerSerializers();
            this.deserializeRegistry.addDecorator(isTypeClassOf(Target), (type, state) => {
                state.touch((target: Target) => target.onLoad());
            });
        }
    })();

    const target = cast<Target>({ id: 1 }, undefined, serializer);
    expect(target.loaded).toBe(true);
});

// Skipped: Requires update to new jit.fn() API - state.touch() no longer exists
test.skip('onLoad call3', () => {
    class Target {
        id: number = 0;
        loaded = false;

        onLoad(): void {
            this.loaded = true;
        }
    }

    const serializer = new (class extends Serializer {
        override registerSerializers() {
            super.registerSerializers();
            this.deserializeRegistry.addDecorator(isCustomTypeClass, (type, state) => {
                state.touch(value => {
                    if ('onLoad' in value) value.onLoad();
                });
            });
        }
    })();

    const target = cast<Target>({ id: 1 }, undefined, serializer);
    expect(target.loaded).toBe(true);
});

test('enum union', () => {
    enum StatEnginePowerUnit {
        Hp = 'hp',
    }

    enum StatWeightUnit {
        Lbs = 'lbs',
        Kg = 'kg',
    }

    type StatMeasurementUnit = StatEnginePowerUnit | StatWeightUnit;
    const type = typeOf<StatMeasurementUnit>();
    assertType(type, ReflectionKind.union);
    expect(type.types.length).toBe(2);

    expect(deserialize<StatMeasurementUnit>(StatWeightUnit.Kg)).toBe(StatWeightUnit.Kg);
    expect(deserialize<StatMeasurementUnit>(StatWeightUnit.Lbs)).toBe(StatWeightUnit.Lbs);
    expect(deserialize<StatMeasurementUnit>(StatEnginePowerUnit.Hp)).toBe(StatEnginePowerUnit.Hp);
});

test('union literals in union', () => {
    type StatWeightUnit = 'lbs' | 'kg';
    type StatEnginePowerUnit = 'hp';

    type StatMeasurementUnit = StatEnginePowerUnit | StatWeightUnit;
    const type = typeOf<StatMeasurementUnit>();
    assertType(type, ReflectionKind.union);
    expect(type.types.length).toBe(3);

    expect(deserialize<StatMeasurementUnit>('kg')).toBe('kg');
    expect(deserialize<StatMeasurementUnit>('lbs')).toBe('lbs');
    expect(deserialize<StatMeasurementUnit>('hp')).toBe('hp');
});

test('union literals in union imported', () => {
    type StatMeasurementUnit = StatEnginePowerUnit | StatWeightUnit;
    const type = typeOf<StatMeasurementUnit>();
    assertType(type, ReflectionKind.union);
    expect(type.types.length).toBe(3);

    expect(deserialize<StatMeasurementUnit>('kg')).toBe('kg');
    expect(deserialize<StatMeasurementUnit>('lbs')).toBe('lbs');
    expect(deserialize<StatMeasurementUnit>('hp')).toBe('hp');
});

test('function rest parameters', () => {
    type t = (start: number, ...rest: string[]) => void;
    const fn = typeOf<t>();
    assertType(fn, ReflectionKind.function);
    {
        const type = typeOf<Parameters<never>>([fn]); //same as Parameters<t>
        expect(deserialize([2, '33', 44], undefined, undefined, undefined, type)).toEqual([2, '33', '44']);
    }
    {
        const type = parametersToTuple(fn.parameters);
        expect(deserialize([2, '33', 44], undefined, undefined, undefined, type)).toEqual([2, '33', '44']);
    }
});

test('discriminated union with string date in type guard', () => {
    expect(is<number | string>(12)).toBe(true);
    expect(is<number | string>('abc')).toBe(true);
    expect(is<number | string>(false)).toBe(false);
    expect(is<number | (string | bigint)[]>([false])).toBe(false);

    {
        type ModelB = { kind: 'b'; date: Date };
        const b1 = cast<ModelB>({ kind: 'b', date: '2020-08-05T00:00:00.000Z' });
        expect(b1).toEqual({ kind: 'b', date: new Date('2020-08-05T00:00:00.000Z') });
    }

    {
        type ModelA = { id: number; title: string };
        type ModelB = { id: number; date: Date };
        type Union = ModelA | ModelB;

        const b2 = cast<Union>({ id: 1, date: '2020-08-05T00:00:00.000Z' });
        expect(b2).toEqual({ id: 1, date: new Date('2020-08-05T00:00:00.000Z') });
    }

    {
        type ModelA = { kind: 'a'; title: string };
        type ModelB = { kind: 'b'; date: Date };
        type Union = ModelA | ModelB;

        const b2 = cast<Union>({ kind: 'b', date: '2020-08-05T00:00:00.000Z' });
        expect(b2).toEqual({ kind: 'b', date: new Date('2020-08-05T00:00:00.000Z') });
    }

    {
        type ModelA = { kind: 'a'; title: string };
        type ModelB = { kind: 'b'; date: number | Date };
        type Union = ModelA | ModelB;
        const b2 = cast<Union>({ kind: 'b', date: '2020-08-05T00:00:00.000Z' });
        expect(b2).toEqual({ kind: 'b', date: new Date('2020-08-05T00:00:00.000Z') });
    }
});

test('date format', () => {
    const date = cast<number | Date>('2020-07-02T12:00:00Z');
    expect(date).toEqual(new Date('2020-07-02T12:00:00Z'));
});

test('patch', () => {
    class Address {
        street!: string & MinLength<3>;
        streetNo!: string;
        additional: { [name: string]: string } = {};
    }

    class Order {
        id!: number;
        shippingAddress!: Address;
    }

    {
        const data = patch<Order>({ id: 5, 'shippingAddress.street': 123 }, undefined, undefined, underscoreNamingStrategy);
        expect(data).toEqual({ id: 5, 'shipping_address.street': '123' });
    }

    //no validation for the moment until object reference->primary key validation is implemented for the ORM
    // {
    //     expect(() => patch<Order>({ 'shippingAddress.street': 12 }, undefined, undefined, underscoreNamingStrategy)).toThrow('Min length is 3');
    // }

    {
        //index signature are not touched by naming strategy
        const data = patch<Order>({ id: 5, 'shippingAddress.additional.randomName': 12 }, undefined, undefined, underscoreNamingStrategy);
        expect(data).toEqual({ id: 5, 'shipping_address.additional.randomName': '12' });
    }
});

// Skipped: Requires update to new jit.fn() API - state.addSetter/accessor no longer exist
// WARNING: This test corrupts global serializer when it fails, causing cascading failures
test.skip('extend with custom type', () => {
    type StringifyTransport = TypeAnnotation<'stringifyTransport'>;

    function isStringifyTransportType(type: Type): boolean {
        return !!typeAnnotation.getType(type, 'stringifyTransport');
    }

    serializer.serializeRegistry.addPostHook((type, state) => {
        if (!isStringifyTransportType(type)) return;
        state.addSetter(`JSON.stringify(${state.accessor})`);
    });
    serializer.deserializeRegistry.addPreHook((type, state) => {
        if (!isStringifyTransportType(type)) return;
        state.addSetter(`JSON.parse(${state.accessor})`);
    });

    class MyType {
        test!: string;
    }

    class Entity {
        obj: MyType & StringifyTransport = { test: 'abc' };
    }

    const e = new Entity();
    const s = serialize<Entity>(e, undefined, serializer);
    expect(s.obj).toBe('{"test":"abc"}');
    const d = deserialize<Entity>(s, undefined, serializer);
    expect(d.obj).toEqual({ test: 'abc' });
});

test('issue-415: serialize literal types in union', () => {
    enum MyEnum {
        VALUE_0 = 0,
        VALUE_180 = 180,
    }

    class Data {
        rotate: MyEnum.VALUE_180 | MyEnum.VALUE_0 = MyEnum.VALUE_0;
    }

    expect(deserialize<Data>({ rotate: 0 }, { loosely: true }).rotate).toBe(0);
    expect(deserialize<Data>({ rotate: '0' }, { loosely: true }).rotate).toBe(0);
    expect(deserialize<Data>({ rotate: 180 }, { loosely: true }).rotate).toBe(180);
    expect(deserialize<Data>({ rotate: '180' }, { loosely: true }).rotate).toBe(180);
    // Invalid values should throw validation error (fix for #478)
    expect(() => deserialize<Data>({ rotate: 123456 }, { loosely: true })).toThrow('Cannot convert number 123456 to 180 | 0');
});

test('union with optional property', () => {
    type A = { type: 'a'; value?: string } | null;

    {
        const a = deserialize<A>({ type: 'a' });
        expect(a).toEqual({ type: 'a' });
    }
    {
        const a = deserialize<A>({ type: 'a', value: 'b' });
        expect(a).toEqual({ type: 'a', value: 'b' });
    }
    {
        const a = deserialize<A>(null);
        expect(a).toEqual(null);
    }
    {
        const a = deserialize<A>({ type: 'a', value: null });
        expect(a).toEqual({ type: 'a', value: undefined });
    }
});

test('parcel search input deserialization', async () => {
    class GeoLocation {
        locality?: string;
        postalCode?: string;

        hasCoords() {
            return true;
        }
    }

    interface AdTitleAndBasicAttributes {
        title: string;
        attributes: {
            plotSurface?: number;
            buildingSurface: number;
            ges?: string;
            energyRate?: string;
        };
        location: GeoLocation;
    }

    class ParcelSearchParams {
        ad: AdTitleAndBasicAttributes | null = null;
    }

    const data: any = {
        ad: {
            title: 'Maison 4 pièces 92 m²',
            attributes: {
                buildingSurface: 92,
                energyRate: 'D',
                ges: 'E',
            },
            location: {
                locality: 'Paris',
                postalCode: '75000',
            },
        },
    } as any;

    const location = cast<GeoLocation>(data.ad.location);
    expect(location).toBeInstanceOf(GeoLocation);
    expect(location.locality).toBe('Paris');

    const search = cast<ParcelSearchParams>(data);
    expect(search.ad).not.toBeUndefined();
    expect(search.ad!.location).toBeInstanceOf(GeoLocation);
    expect(search?.ad?.attributes?.buildingSurface).toBe(92);
    expect(search?.ad?.location.hasCoords()).toBeTruthy();
});

test('skip parameter name resolving', () => {
    class Guest {
        constructor(public id: number) {}
    }

    class Vehicle {
        constructor(public Guest: Guest) {}
    }

    expect(cast<Vehicle>({ Guest: { id: '1' } })).toEqual(new Vehicle(new Guest(1)));
});

test('union with almost same member, additional properties', () => {
    type T = { a: string } | { a: string; b: number };
    const t1 = cast<T>({ a: '3' });
    expect(t1).toEqual({ a: '3' });
    const t2 = cast<T>({ a: '3', b: '4' });
    expect(t2).toEqual({ a: '3', b: 4 });
});

test('union with almost same member, optional properties', () => {
    type T = { a: string; c?: number } | { a: string; b?: number };
    const t1 = cast<T>({ a: '3' });
    expect(t1).toEqual({ a: '3' });
    const t2 = cast<T>({ a: '3', b: 4 });
    expect(t2).toEqual({ a: '3', b: 4 });
});

test('union with less specific last', () => {
    type T = { a: string; c?: number } | { a: string };
    const t1 = cast<T>({ a: '3' });
    expect(t1).toEqual({ a: '3' });
    const t2 = cast<T>({ a: '3', c: 4 });
    expect(t2).toEqual({ a: '3', c: 4 });
});

test('union same member, optional', () => {
    type T = { a: number; b?: number } | { a: number; b: string };
    const t1 = serialize<T>({ a: 3 });
    expect(t1).toEqual({ a: 3 });
    const t2 = serialize<T>({ a: 3, b: '4' });
    expect(t2).toEqual({ a: 3, b: '4' });
    const t3 = serialize<T>({ a: 3, b: 4 });
    expect(t3).toEqual({ a: 3, b: 4 });
});

test('large literal union optimization', () => {
    // Test that literal unions work correctly with serialization, deserialization, and validation
    // The optimization for literal unions (>=5 members) uses Set.has() instead of if-else
    // but the behavior should be identical for both small and optimized unions

    // Test with a union of number literals
    type SmallLiteralUnion = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

    // Serialization - valid values pass through
    expect(serialize<SmallLiteralUnion>(0)).toBe(0);
    expect(serialize<SmallLiteralUnion>(5)).toBe(5);
    expect(serialize<SmallLiteralUnion>(9)).toBe(9);

    // Deserialization - valid values pass through
    expect(deserialize<SmallLiteralUnion>(0)).toBe(0);
    expect(deserialize<SmallLiteralUnion>(5)).toBe(5);
    expect(deserialize<SmallLiteralUnion>(9)).toBe(9);

    // Validation with is() - checks if value is valid
    expect(is<SmallLiteralUnion>(0)).toBe(true);
    expect(is<SmallLiteralUnion>(5)).toBe(true);
    expect(is<SmallLiteralUnion>(9)).toBe(true);
    expect(is<SmallLiteralUnion>(10)).toBe(false);
    expect(is<SmallLiteralUnion>(-1)).toBe(false);

    // cast() throws on invalid values with descriptive error message
    expect(() => cast<SmallLiteralUnion>(10)).toThrow(/Cannot convert/);
    expect(() => cast<SmallLiteralUnion>(-1)).toThrow(/Cannot convert/);

    // Test with string literals
    type StringLiteralUnion = 'a' | 'b' | 'c' | 'd' | 'e';
    expect(serialize<StringLiteralUnion>('a')).toBe('a');
    expect(deserialize<StringLiteralUnion>('e')).toBe('e');
    expect(is<StringLiteralUnion>('a')).toBe(true);
    expect(is<StringLiteralUnion>('z')).toBe(false);
    expect(() => cast<StringLiteralUnion>('z' as any)).toThrow(/Cannot convert/);

    // Test with mixed number and string literals (4 members, below threshold, uses standard if-else)
    type MixedLiteralUnion = 1 | 2 | 'a' | 'b';
    expect(serialize<MixedLiteralUnion>(1)).toBe(1);
    expect(serialize<MixedLiteralUnion>('a')).toBe('a');
    expect(deserialize<MixedLiteralUnion>(2)).toBe(2);
    expect(deserialize<MixedLiteralUnion>('b')).toBe('b');
    expect(is<MixedLiteralUnion>(1)).toBe(true);
    expect(is<MixedLiteralUnion>('a')).toBe(true);
    expect(is<MixedLiteralUnion>(3)).toBe(false);
    expect(is<MixedLiteralUnion>('c')).toBe(false);
    // Below threshold uses standard path, now with consistent "Cannot convert" error
    expect(() => cast<MixedLiteralUnion>(3 as any)).toThrow(/Cannot convert/);
});

test('large template literal union does not cause stack overflow (#478)', () => {
    // Regression test for https://github.com/deepkit/deepkit-framework/issues/478
    // A template literal union with 24 × 60 × 60 = 86,400 members should not cause
    // "Maximum call stack size exceeded" error during deserialization or validation.

    type Hour24 = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23';

    type Minute =
        | '00'
        | '01'
        | '02'
        | '03'
        | '04'
        | '05'
        | '06'
        | '07'
        | '08'
        | '09'
        | '10'
        | '11'
        | '12'
        | '13'
        | '14'
        | '15'
        | '16'
        | '17'
        | '18'
        | '19'
        | '20'
        | '21'
        | '22'
        | '23'
        | '24'
        | '25'
        | '26'
        | '27'
        | '28'
        | '29'
        | '30'
        | '31'
        | '32'
        | '33'
        | '34'
        | '35'
        | '36'
        | '37'
        | '38'
        | '39'
        | '40'
        | '41'
        | '42'
        | '43'
        | '44'
        | '45'
        | '46'
        | '47'
        | '48'
        | '49'
        | '50'
        | '51'
        | '52'
        | '53'
        | '54'
        | '55'
        | '56'
        | '57'
        | '58'
        | '59';

    type Second = Minute; // Same values as Minute

    type ClockHour24 = `${Hour24}:${Minute}:${Second}`;

    // Test 1: deserialize should not throw (no stack overflow)
    const result = deserialize<ClockHour24>('01:01:59');
    expect(result).toBe('01:01:59');

    // Test 2: is() should return true for valid clock time
    expect(is<ClockHour24>('01:01:59')).toBe(true);

    // Test 3: is() should return false for invalid format
    expect(is<ClockHour24>('invalid')).toBe(false);

    // Test 4: is() should return false for invalid hour (25 is not valid)
    expect(is<ClockHour24>('25:01:59')).toBe(false);
});

test('literal union error consistency', () => {
    // Test that both small (<5 members) and large (>=5 members) literal unions
    // have consistent error behavior for invalid values.
    // Related to issue #478 UX improvements.

    type SmallUnion = 'a' | 'b' | 'c' | 'd'; // 4 members - uses if-else chain
    type LargeUnion = 'a' | 'b' | 'c' | 'd' | 'e'; // 5 members - uses Set.has() optimization

    // 1. Valid values should work for both serialize and deserialize
    expect(serialize<SmallUnion>('a')).toBe('a');
    expect(serialize<SmallUnion>('d')).toBe('d');
    expect(serialize<LargeUnion>('a')).toBe('a');
    expect(serialize<LargeUnion>('e')).toBe('e');

    expect(deserialize<SmallUnion>('a')).toBe('a');
    expect(deserialize<SmallUnion>('d')).toBe('d');
    expect(deserialize<LargeUnion>('a')).toBe('a');
    expect(deserialize<LargeUnion>('e')).toBe('e');

    // 2. is() should return false for invalid values in both
    expect(is<SmallUnion>('invalid')).toBe(false);
    expect(is<LargeUnion>('invalid')).toBe(false);
    expect(is<SmallUnion>('z')).toBe(false);
    expect(is<LargeUnion>('z')).toBe(false);

    // 3. validate() should return errors for invalid values with consistent structure
    const smallErrors = validate<SmallUnion>('invalid');
    const largeErrors = validate<LargeUnion>('invalid');

    // Both should have exactly one error
    expect(smallErrors.length).toBe(1);
    expect(largeErrors.length).toBe(1);

    // Both should have the same error code ('type')
    expect(smallErrors[0].code).toBe('type');
    expect(largeErrors[0].code).toBe('type');

    // Both should have empty path (root level)
    expect(smallErrors[0].path).toBe('');
    expect(largeErrors[0].path).toBe('');

    // Both should include the invalid value
    expect(smallErrors[0].value).toBe('invalid');
    expect(largeErrors[0].value).toBe('invalid');

    // 4. cast() should throw for invalid values in both
    expect(() => cast<SmallUnion>('invalid' as any)).toThrow();
    expect(() => cast<LargeUnion>('invalid' as any)).toThrow();

    // Error messages should contain "Cannot convert"
    expect(() => cast<SmallUnion>('invalid' as any)).toThrow(/Cannot convert/);
    expect(() => cast<LargeUnion>('invalid' as any)).toThrow(/Cannot convert/);
});

test('literal union error consistency - numeric literals', () => {
    // Test numeric literal unions for consistency
    type SmallNumericUnion = 1 | 2 | 3 | 4; // 4 members
    type LargeNumericUnion = 1 | 2 | 3 | 4 | 5; // 5 members

    // Valid values work
    expect(serialize<SmallNumericUnion>(1)).toBe(1);
    expect(serialize<LargeNumericUnion>(5)).toBe(5);
    expect(deserialize<SmallNumericUnion>(4)).toBe(4);
    expect(deserialize<LargeNumericUnion>(5)).toBe(5);

    // is() returns false for invalid
    expect(is<SmallNumericUnion>(99)).toBe(false);
    expect(is<LargeNumericUnion>(99)).toBe(false);

    // validate() returns consistent errors
    const smallErrors = validate<SmallNumericUnion>(99);
    const largeErrors = validate<LargeNumericUnion>(99);

    expect(smallErrors.length).toBe(1);
    expect(largeErrors.length).toBe(1);
    expect(smallErrors[0].code).toBe('type');
    expect(largeErrors[0].code).toBe('type');
    expect(smallErrors[0].value).toBe(99);
    expect(largeErrors[0].value).toBe(99);

    // cast() throws for invalid
    expect(() => cast<SmallNumericUnion>(99 as any)).toThrow(/Cannot convert/);
    expect(() => cast<LargeNumericUnion>(99 as any)).toThrow(/Cannot convert/);
});

test('literal union error consistency - mixed type literals', () => {
    // Test mixed literal unions (string and number literals)
    type SmallMixedUnion = 'a' | 'b' | 1 | 2; // 4 members
    type LargeMixedUnion = 'a' | 'b' | 'c' | 1 | 2; // 5 members

    // Valid values of different types work
    expect(serialize<SmallMixedUnion>('a')).toBe('a');
    expect(serialize<SmallMixedUnion>(1)).toBe(1);
    expect(serialize<LargeMixedUnion>('c')).toBe('c');
    expect(serialize<LargeMixedUnion>(2)).toBe(2);

    expect(deserialize<SmallMixedUnion>('b')).toBe('b');
    expect(deserialize<SmallMixedUnion>(2)).toBe(2);
    expect(deserialize<LargeMixedUnion>('a')).toBe('a');
    expect(deserialize<LargeMixedUnion>(1)).toBe(1);

    // is() returns false for invalid values of both types
    expect(is<SmallMixedUnion>('invalid')).toBe(false);
    expect(is<SmallMixedUnion>(99)).toBe(false);
    expect(is<LargeMixedUnion>('invalid')).toBe(false);
    expect(is<LargeMixedUnion>(99)).toBe(false);

    // validate() returns consistent errors
    const smallStringErrors = validate<SmallMixedUnion>('invalid');
    const largeStringErrors = validate<LargeMixedUnion>('invalid');
    const smallNumErrors = validate<SmallMixedUnion>(99);
    const largeNumErrors = validate<LargeMixedUnion>(99);

    expect(smallStringErrors.length).toBe(1);
    expect(largeStringErrors.length).toBe(1);
    expect(smallNumErrors.length).toBe(1);
    expect(largeNumErrors.length).toBe(1);

    expect(smallStringErrors[0].code).toBe('type');
    expect(largeStringErrors[0].code).toBe('type');
    expect(smallNumErrors[0].code).toBe('type');
    expect(largeNumErrors[0].code).toBe('type');
});

test('literal union error consistency - boundary threshold', () => {
    // Test unions at exactly the threshold boundary (4 vs 5 members)
    type Union4 = 'w' | 'x' | 'y' | 'z'; // 4 members - just below threshold
    type Union5 = 'v' | 'w' | 'x' | 'y' | 'z'; // 5 members - exactly at threshold
    type Union6 = 'u' | 'v' | 'w' | 'x' | 'y' | 'z'; // 6 members - just above threshold

    // All valid values work
    expect(serialize<Union4>('w')).toBe('w');
    expect(serialize<Union5>('v')).toBe('v');
    expect(serialize<Union6>('u')).toBe('u');

    // All invalid values properly rejected
    expect(is<Union4>('invalid')).toBe(false);
    expect(is<Union5>('invalid')).toBe(false);
    expect(is<Union6>('invalid')).toBe(false);

    // Validation errors have consistent structure
    const errors4 = validate<Union4>('invalid');
    const errors5 = validate<Union5>('invalid');
    const errors6 = validate<Union6>('invalid');

    expect(errors4[0].code).toBe('type');
    expect(errors5[0].code).toBe('type');
    expect(errors6[0].code).toBe('type');

    expect(errors4[0].value).toBe('invalid');
    expect(errors5[0].value).toBe('invalid');
    expect(errors6[0].value).toBe('invalid');

    // cast() throws with consistent error pattern
    expect(() => cast<Union4>('invalid' as any)).toThrow(/Cannot convert/);
    expect(() => cast<Union5>('invalid' as any)).toThrow(/Cannot convert/);
    expect(() => cast<Union6>('invalid' as any)).toThrow(/Cannot convert/);
});

describe('literal union - type varieties', () => {
    test('pure boolean literals (true | false)', () => {
        type BoolLiteral = true | false;

        // Valid values work
        expect(serialize<BoolLiteral>(true)).toBe(true);
        expect(serialize<BoolLiteral>(false)).toBe(false);
        expect(deserialize<BoolLiteral>(true)).toBe(true);
        expect(deserialize<BoolLiteral>(false)).toBe(false);

        // is() returns correct boolean
        expect(is<BoolLiteral>(true)).toBe(true);
        expect(is<BoolLiteral>(false)).toBe(true);
        expect(is<BoolLiteral>('true')).toBe(false);
        expect(is<BoolLiteral>(1)).toBe(false);
        expect(is<BoolLiteral>(0)).toBe(false);
        expect(is<BoolLiteral>(null)).toBe(false);
        expect(is<BoolLiteral>(undefined)).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<BoolLiteral>(true)).toEqual([]);
        expect(validate<BoolLiteral>(false)).toEqual([]);
        const stringErrors = validate<BoolLiteral>('true');
        expect(stringErrors.length).toBe(1);
        expect(stringErrors[0].code).toBe('type');
        const numErrors = validate<BoolLiteral>(1);
        expect(numErrors.length).toBe(1);
        expect(numErrors[0].code).toBe('type');
    });

    test('bigint literals', () => {
        type BigIntLiteral = 1n | 2n | 3n;

        // Valid values work
        expect(serialize<BigIntLiteral>(1n)).toBe(1n);
        expect(serialize<BigIntLiteral>(2n)).toBe(2n);
        expect(serialize<BigIntLiteral>(3n)).toBe(3n);
        expect(deserialize<BigIntLiteral>(1n)).toBe(1n);
        expect(deserialize<BigIntLiteral>(2n)).toBe(2n);
        expect(deserialize<BigIntLiteral>(3n)).toBe(3n);

        // is() returns correct boolean
        expect(is<BigIntLiteral>(1n)).toBe(true);
        expect(is<BigIntLiteral>(2n)).toBe(true);
        expect(is<BigIntLiteral>(3n)).toBe(true);
        expect(is<BigIntLiteral>(4n)).toBe(false);
        expect(is<BigIntLiteral>(0n)).toBe(false);
        expect(is<BigIntLiteral>(1)).toBe(false); // number, not bigint
        expect(is<BigIntLiteral>('1')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<BigIntLiteral>(1n)).toEqual([]);
        expect(validate<BigIntLiteral>(2n)).toEqual([]);
        const invalidBigIntErrors = validate<BigIntLiteral>(4n);
        expect(invalidBigIntErrors.length).toBe(1);
        expect(invalidBigIntErrors[0].code).toBe('type');
        const numErrors = validate<BigIntLiteral>(1);
        expect(numErrors.length).toBe(1);
        expect(numErrors[0].code).toBe('type');
    });

    test('single-member literal type', () => {
        type SingleLiteral = 'only';

        // Valid value works
        expect(serialize<SingleLiteral>('only')).toBe('only');
        expect(deserialize<SingleLiteral>('only')).toBe('only');

        // For single literal types, serialize/deserialize treat it as a constant
        // The value is always set to the literal value regardless of input
        // This is by design - a single literal is a "constant type"
        expect(serialize<SingleLiteral>('anything' as any)).toBe('only');
        expect(deserialize<SingleLiteral>('anything' as any)).toBe('only');

        // is() returns correct boolean - validates the actual value
        expect(is<SingleLiteral>('only')).toBe(true);
        expect(is<SingleLiteral>('other')).toBe(false);
        expect(is<SingleLiteral>('')).toBe(false);
        expect(is<SingleLiteral>(null)).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<SingleLiteral>('only')).toEqual([]);
        const errors = validate<SingleLiteral>('other');
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('other');

        // cast() for single literals uses the constant behavior (no throw)
        // This is different from unions which perform validation
        expect(cast<SingleLiteral>('other' as any)).toBe('only');
    });

    test('mixed string + boolean', () => {
        type StringBoolMixed = 'yes' | 'no' | true | false;

        // Valid values work
        expect(serialize<StringBoolMixed>('yes')).toBe('yes');
        expect(serialize<StringBoolMixed>('no')).toBe('no');
        expect(serialize<StringBoolMixed>(true)).toBe(true);
        expect(serialize<StringBoolMixed>(false)).toBe(false);
        expect(deserialize<StringBoolMixed>('yes')).toBe('yes');
        expect(deserialize<StringBoolMixed>(true)).toBe(true);

        // is() returns correct boolean
        expect(is<StringBoolMixed>('yes')).toBe(true);
        expect(is<StringBoolMixed>('no')).toBe(true);
        expect(is<StringBoolMixed>(true)).toBe(true);
        expect(is<StringBoolMixed>(false)).toBe(true);
        expect(is<StringBoolMixed>('true')).toBe(false); // string 'true' not in union
        expect(is<StringBoolMixed>('false')).toBe(false);
        expect(is<StringBoolMixed>(1)).toBe(false);
        expect(is<StringBoolMixed>('maybe')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<StringBoolMixed>('yes')).toEqual([]);
        expect(validate<StringBoolMixed>(true)).toEqual([]);
        const errors = validate<StringBoolMixed>('maybe');
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('type');
    });

    test('mixed number + boolean', () => {
        type NumBoolMixed = 0 | 1 | true | false;

        // Valid values work
        expect(serialize<NumBoolMixed>(0)).toBe(0);
        expect(serialize<NumBoolMixed>(1)).toBe(1);
        expect(serialize<NumBoolMixed>(true)).toBe(true);
        expect(serialize<NumBoolMixed>(false)).toBe(false);
        expect(deserialize<NumBoolMixed>(0)).toBe(0);
        expect(deserialize<NumBoolMixed>(true)).toBe(true);

        // is() returns correct boolean
        expect(is<NumBoolMixed>(0)).toBe(true);
        expect(is<NumBoolMixed>(1)).toBe(true);
        expect(is<NumBoolMixed>(true)).toBe(true);
        expect(is<NumBoolMixed>(false)).toBe(true);
        expect(is<NumBoolMixed>(2)).toBe(false);
        expect(is<NumBoolMixed>('0')).toBe(false);
        expect(is<NumBoolMixed>('true')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<NumBoolMixed>(0)).toEqual([]);
        expect(validate<NumBoolMixed>(true)).toEqual([]);
        const errors = validate<NumBoolMixed>(2);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('type');
    });

    test('mixed string + number + boolean', () => {
        type FullMixed = 'a' | 'b' | 1 | 2 | true | false;

        // Valid values work
        expect(serialize<FullMixed>('a')).toBe('a');
        expect(serialize<FullMixed>(1)).toBe(1);
        expect(serialize<FullMixed>(true)).toBe(true);
        expect(deserialize<FullMixed>('b')).toBe('b');
        expect(deserialize<FullMixed>(2)).toBe(2);
        expect(deserialize<FullMixed>(false)).toBe(false);

        // is() returns correct boolean
        expect(is<FullMixed>('a')).toBe(true);
        expect(is<FullMixed>('b')).toBe(true);
        expect(is<FullMixed>(1)).toBe(true);
        expect(is<FullMixed>(2)).toBe(true);
        expect(is<FullMixed>(true)).toBe(true);
        expect(is<FullMixed>(false)).toBe(true);
        expect(is<FullMixed>('c')).toBe(false);
        expect(is<FullMixed>(3)).toBe(false);
        expect(is<FullMixed>(null)).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<FullMixed>('a')).toEqual([]);
        expect(validate<FullMixed>(1)).toEqual([]);
        expect(validate<FullMixed>(true)).toEqual([]);
        const stringErrors = validate<FullMixed>('c');
        expect(stringErrors.length).toBe(1);
        expect(stringErrors[0].code).toBe('type');
        const numErrors = validate<FullMixed>(3);
        expect(numErrors.length).toBe(1);
        expect(numErrors[0].code).toBe('type');
    });
});

describe('literal union - edge cases', () => {
    test('empty string in union', () => {
        type EmptyStringUnion = '' | 'a' | 'b';

        // Valid values work, including empty string
        expect(serialize<EmptyStringUnion>('')).toBe('');
        expect(serialize<EmptyStringUnion>('a')).toBe('a');
        expect(serialize<EmptyStringUnion>('b')).toBe('b');
        expect(deserialize<EmptyStringUnion>('')).toBe('');
        expect(deserialize<EmptyStringUnion>('a')).toBe('a');

        // is() returns correct boolean
        expect(is<EmptyStringUnion>('')).toBe(true);
        expect(is<EmptyStringUnion>('a')).toBe(true);
        expect(is<EmptyStringUnion>('b')).toBe(true);
        expect(is<EmptyStringUnion>('c')).toBe(false);
        expect(is<EmptyStringUnion>(null)).toBe(false);
        expect(is<EmptyStringUnion>(undefined)).toBe(false);
        expect(is<EmptyStringUnion>(0)).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<EmptyStringUnion>('')).toEqual([]);
        expect(validate<EmptyStringUnion>('a')).toEqual([]);
        const errors = validate<EmptyStringUnion>('c');
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('type');
    });

    test('zero vs string zero (0 | "0" | 1 | "1")', () => {
        type ZeroStringZero = 0 | '0' | 1 | '1';

        // Serialize preserves exact types (no loose coercion)
        expect(serialize<ZeroStringZero>(0)).toBe(0);
        expect(serialize<ZeroStringZero>('0')).toBe('0');
        expect(serialize<ZeroStringZero>(1)).toBe(1);
        expect(serialize<ZeroStringZero>('1')).toBe('1');

        // Deserialize with loosely=false preserves exact types
        expect(deserialize<ZeroStringZero>(0, { loosely: false })).toBe(0);
        expect(deserialize<ZeroStringZero>('0', { loosely: false })).toBe('0');
        expect(deserialize<ZeroStringZero>(1, { loosely: false })).toBe(1);
        expect(deserialize<ZeroStringZero>('1', { loosely: false })).toBe('1');

        // Deserialize with loose coercion (default): strings may convert to numbers
        // when a number literal in the union matches the string representation
        expect(deserialize<ZeroStringZero>(0)).toBe(0);
        expect(deserialize<ZeroStringZero>(1)).toBe(1);
        // '0' and '1' are coerced to 0 and 1 by loose type guards
        expect(deserialize<ZeroStringZero>('0')).toBe(0);
        expect(deserialize<ZeroStringZero>('1')).toBe(1);

        // is() distinguishes correctly between number and string (uses exact matching)
        expect(is<ZeroStringZero>(0)).toBe(true);
        expect(is<ZeroStringZero>('0')).toBe(true);
        expect(is<ZeroStringZero>(1)).toBe(true);
        expect(is<ZeroStringZero>('1')).toBe(true);
        expect(is<ZeroStringZero>(2)).toBe(false);
        expect(is<ZeroStringZero>('2')).toBe(false);
        expect(is<ZeroStringZero>(false)).toBe(false);
        expect(is<ZeroStringZero>('')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<ZeroStringZero>(0)).toEqual([]);
        expect(validate<ZeroStringZero>('0')).toEqual([]);
        const errors = validate<ZeroStringZero>(2);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('type');
    });

    test('all-falsy union (false | 0 | "")', () => {
        type AllFalsy = false | 0 | '';

        // All falsy values work
        expect(serialize<AllFalsy>(false)).toBe(false);
        expect(serialize<AllFalsy>(0)).toBe(0);
        expect(serialize<AllFalsy>('')).toBe('');
        expect(deserialize<AllFalsy>(false)).toBe(false);
        expect(deserialize<AllFalsy>(0)).toBe(0);
        expect(deserialize<AllFalsy>('')).toBe('');

        // is() returns correct boolean for all falsy values
        expect(is<AllFalsy>(false)).toBe(true);
        expect(is<AllFalsy>(0)).toBe(true);
        expect(is<AllFalsy>('')).toBe(true);
        expect(is<AllFalsy>(true)).toBe(false);
        expect(is<AllFalsy>(1)).toBe(false);
        expect(is<AllFalsy>('a')).toBe(false);
        expect(is<AllFalsy>(null)).toBe(false);
        expect(is<AllFalsy>(undefined)).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<AllFalsy>(false)).toEqual([]);
        expect(validate<AllFalsy>(0)).toEqual([]);
        expect(validate<AllFalsy>('')).toEqual([]);
        const trueErrors = validate<AllFalsy>(true);
        expect(trueErrors.length).toBe(1);
        expect(trueErrors[0].code).toBe('type');
        const oneErrors = validate<AllFalsy>(1);
        expect(oneErrors.length).toBe(1);
        expect(oneErrors[0].code).toBe('type');
    });

    test('negative number literals', () => {
        type NegativeNums = -1 | -2 | -3;

        // Valid negative values work
        expect(serialize<NegativeNums>(-1)).toBe(-1);
        expect(serialize<NegativeNums>(-2)).toBe(-2);
        expect(serialize<NegativeNums>(-3)).toBe(-3);
        expect(deserialize<NegativeNums>(-1)).toBe(-1);
        expect(deserialize<NegativeNums>(-2)).toBe(-2);
        expect(deserialize<NegativeNums>(-3)).toBe(-3);

        // is() returns correct boolean
        expect(is<NegativeNums>(-1)).toBe(true);
        expect(is<NegativeNums>(-2)).toBe(true);
        expect(is<NegativeNums>(-3)).toBe(true);
        expect(is<NegativeNums>(1)).toBe(false);
        expect(is<NegativeNums>(0)).toBe(false);
        expect(is<NegativeNums>(-4)).toBe(false);
        expect(is<NegativeNums>('-1')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<NegativeNums>(-1)).toEqual([]);
        expect(validate<NegativeNums>(-2)).toEqual([]);
        const positiveErrors = validate<NegativeNums>(1);
        expect(positiveErrors.length).toBe(1);
        expect(positiveErrors[0].code).toBe('type');
        const zeroErrors = validate<NegativeNums>(0);
        expect(zeroErrors.length).toBe(1);
        expect(zeroErrors[0].code).toBe('type');
    });

    test('float literals', () => {
        type FloatLiterals = 1.5 | 2.5 | 3.5;

        // Valid float values work
        expect(serialize<FloatLiterals>(1.5)).toBe(1.5);
        expect(serialize<FloatLiterals>(2.5)).toBe(2.5);
        expect(serialize<FloatLiterals>(3.5)).toBe(3.5);
        expect(deserialize<FloatLiterals>(1.5)).toBe(1.5);
        expect(deserialize<FloatLiterals>(2.5)).toBe(2.5);
        expect(deserialize<FloatLiterals>(3.5)).toBe(3.5);

        // is() returns correct boolean
        expect(is<FloatLiterals>(1.5)).toBe(true);
        expect(is<FloatLiterals>(2.5)).toBe(true);
        expect(is<FloatLiterals>(3.5)).toBe(true);
        expect(is<FloatLiterals>(1)).toBe(false);
        expect(is<FloatLiterals>(2)).toBe(false);
        expect(is<FloatLiterals>(1.6)).toBe(false);
        expect(is<FloatLiterals>(0)).toBe(false);
        expect(is<FloatLiterals>('1.5')).toBe(false);

        // validate() returns errors for invalid values
        expect(validate<FloatLiterals>(1.5)).toEqual([]);
        expect(validate<FloatLiterals>(2.5)).toEqual([]);
        const intErrors = validate<FloatLiterals>(1);
        expect(intErrors.length).toBe(1);
        expect(intErrors[0].code).toBe('type');
        const wrongFloatErrors = validate<FloatLiterals>(1.6);
        expect(wrongFloatErrors.length).toBe(1);
        expect(wrongFloatErrors[0].code).toBe('type');
    });
});

describe('literal union - contexts', () => {
    test('root level literal union (not wrapped in object)', () => {
        // Direct use of literal union type at root level
        type Status = 'active' | 'inactive' | 'pending';

        // Valid values work
        expect(serialize<Status>('active')).toBe('active');
        expect(deserialize<Status>('pending')).toBe('pending');
        expect(is<Status>('inactive')).toBe(true);

        // Invalid values produce errors
        expect(is<Status>('unknown')).toBe(false);
        const errors = validate<Status>('unknown');
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('');
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('unknown');
    });

    test('arrays of literal unions', () => {
        type Tags = ('a' | 'b' | 'c')[];

        // Valid arrays work
        expect(serialize<Tags>(['a', 'b'])).toEqual(['a', 'b']);
        expect(deserialize<Tags>(['b', 'c', 'a'])).toEqual(['b', 'c', 'a']);
        expect(is<Tags>(['a', 'c'])).toBe(true);

        // Empty array is valid
        expect(serialize<Tags>([])).toEqual([]);
        expect(is<Tags>([])).toBe(true);

        // Note: is() for arrays currently checks array type but may not deeply check elements
        // Use validate() for full validation of array elements
        const errors = validate<Tags>(['a', 'invalid', 'b']);
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('1');
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('invalid');
    });

    test('tuple with literal union', () => {
        type NamedStatus = [string, 'active' | 'inactive'];

        // Valid tuples work
        expect(serialize<NamedStatus>(['item1', 'active'])).toEqual(['item1', 'active']);
        expect(deserialize<NamedStatus>(['item2', 'inactive'])).toEqual(['item2', 'inactive']);
        expect(is<NamedStatus>(['test', 'active'])).toBe(true);

        // Invalid literal union element in tuple
        expect(is<NamedStatus>(['test', 'unknown'])).toBe(false);
        const errors = validate<NamedStatus>(['test', 'unknown']);
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('1');
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('unknown');
    });

    test('nested object property', () => {
        type Config = { outer: { inner: 'a' | 'b' | 'c' } };

        // Valid nested values work
        expect(serialize<Config>({ outer: { inner: 'a' } })).toEqual({ outer: { inner: 'a' } });
        expect(deserialize<Config>({ outer: { inner: 'b' } })).toEqual({ outer: { inner: 'b' } });
        expect(is<Config>({ outer: { inner: 'c' } })).toBe(true);

        // Invalid nested value produces error with correct path
        expect(is<Config>({ outer: { inner: 'invalid' } })).toBe(false);
        const errors = validate<Config>({ outer: { inner: 'invalid' } });
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('outer.inner');
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('invalid');
    });

    test('optional literal union property', () => {
        type OptionalConfig = { prop?: 'x' | 'y' };

        // Undefined/missing property is valid
        expect(serialize<OptionalConfig>({})).toEqual({});
        expect(deserialize<OptionalConfig>({})).toEqual({});
        expect(is<OptionalConfig>({})).toBe(true);

        // Valid values work
        expect(serialize<OptionalConfig>({ prop: 'x' })).toEqual({ prop: 'x' });
        expect(is<OptionalConfig>({ prop: 'y' })).toBe(true);

        // Invalid value still produces error
        expect(is<OptionalConfig>({ prop: 'invalid' as any })).toBe(false);
        const errors = validate<OptionalConfig>({ prop: 'invalid' as any });
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('prop');
        expect(errors[0].code).toBe('type');
        expect(errors[0].value).toBe('invalid');
    });

    test('multiple literal union properties in one object', () => {
        type MultiUnion = {
            status: 'active' | 'inactive';
            priority: 1 | 2 | 3;
            flag: true | false;
        };

        // All valid values work
        expect(serialize<MultiUnion>({ status: 'active', priority: 1, flag: true })).toEqual({ status: 'active', priority: 1, flag: true });
        expect(is<MultiUnion>({ status: 'inactive', priority: 3, flag: false })).toBe(true);

        // Single invalid property
        const errors1 = validate<MultiUnion>({ status: 'unknown' as any, priority: 1, flag: true });
        expect(errors1.length).toBe(1);
        expect(errors1[0].path).toBe('status');

        // Multiple invalid properties produce multiple errors
        const errors2 = validate<MultiUnion>({ status: 'unknown' as any, priority: 99 as any, flag: true });
        expect(errors2.length).toBe(2);
        const paths = errors2.map(e => e.path);
        expect(paths).toContain('status');
        expect(paths).toContain('priority');
    });
});

describe('literal union - error messages', () => {
    test('error path for nested property', () => {
        type DeepConfig = { level1: { level2: { value: 'a' | 'b' } } };

        const errors = validate<DeepConfig>({ level1: { level2: { value: 'invalid' } } });
        expect(errors.length).toBe(1);
        expect(errors[0].path).toBe('level1.level2.value');
    });

    test('error path for array element', () => {
        type ArrayOfUnions = ('x' | 'y' | 'z')[];

        // Error at first invalid element
        const errors1 = validate<ArrayOfUnions>(['x', 'invalid', 'y']);
        expect(errors1.length).toBe(1);
        expect(errors1[0].path).toBe('1');

        // Error at last element
        const errors2 = validate<ArrayOfUnions>(['x', 'y', 'invalid']);
        expect(errors2.length).toBe(1);
        expect(errors2[0].path).toBe('2');

        // Multiple invalid elements
        const errors3 = validate<ArrayOfUnions>(['invalid1', 'x', 'invalid2']);
        expect(errors3.length).toBe(2);
        expect(errors3[0].path).toBe('0');
        expect(errors3[1].path).toBe('2');
    });

    test('error message contains value with type (stringifyValueWithType format)', () => {
        type Status = 'active' | 'inactive';

        // String value - format is 'Cannot convert string "value" to ...'
        const errors1 = validate<Status>('unknown');
        expect(errors1[0].message).toMatch(/Cannot convert string "unknown"/);

        // Number value (wrong type entirely)
        const errors2 = validate<Status>(123);
        expect(errors2[0].message).toMatch(/Cannot convert number 123/);

        // Object value (wrong type entirely)
        const errors3 = validate<Status>({});
        expect(errors3[0].message).toMatch(/Cannot convert object/);

        // Null value
        const errors4 = validate<Status>(null);
        expect(errors4[0].message).toMatch(/Cannot convert null/);

        // Undefined value
        const errors5 = validate<Status>(undefined);
        expect(errors5[0].message).toMatch(/Cannot convert undefined/);
    });

    test('error includes actual value in error.value field', () => {
        type Colors = 'red' | 'green' | 'blue';

        // String value
        const errors1 = validate<Colors>('purple');
        expect(errors1[0].value).toBe('purple');

        // Number value
        const errors2 = validate<Colors>(42);
        expect(errors2[0].value).toBe(42);

        // Object value
        const obj = { color: 'red' };
        const errors3 = validate<Colors>(obj);
        expect(errors3[0].value).toBe(obj);

        // Nested property value
        type Config = { color: 'red' | 'green' };
        const errors4 = validate<Config>({ color: 'purple' });
        expect(errors4[0].value).toBe('purple');
    });
});
