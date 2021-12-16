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
import { reflect, ReflectionClass } from '../../../src/reflection/reflection';
import { BackReference, Embedded, Excluded, int8, integer, PrimaryKey, Reference } from '../../../src/reflection/type';
import { createSerializeFunction, SerializationError } from '../../../src/serializer';
import { cast, deserialize, serialize } from '../../../src/serializer-facade';
import { jsonSerializer } from '../../../src/serializer-json';
import { getClassName } from '@deepkit/core';

test('serializer', () => {
    class User {
        username!: string;
        created!: Date;
    }

    const fn = createSerializeFunction(reflect(User), jsonSerializer.deserializeRegistry);
    const o = fn({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(o).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z')
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
        created: new Date('2021-10-19T00:22:58.257Z')
    });
});

test('cast class', () => {
    class User {
        created: Date = new Date;

        constructor(public username: string) {
        }
    }

    const user = cast<User>({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(user).toBeInstanceOf(User);
    expect(user).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z')
    });
});


test('default value', () => {
    class User {
        logins: number = 0;
    }

    {
        const user = cast<User>({});
        expect(user).toBeInstanceOf(User);
        expect(user).toEqual({
            logins: 0
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2
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
            logins: undefined
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2
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
            logins: 2
        });
    }

    {
        const user = cast<User>({ logins: 2 });
        expect(user).toEqual({
            logins: 2
        });
    }

    {
        const user = cast<User>({ logins: null });
        expect(user).toEqual({
            logins: undefined
        });
    }

    {
        const user = cast<User>({ logins: undefined });
        expect(user).toEqual({
            logins: undefined
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
    expect(cast<int8>(1000)).toBe(128);
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
        const value = cast<Map<string, number>>([['a', 1], ['a', 2], ['b', 3]]);
        expect(value).toEqual(new Map([['a', 2], ['b', 3]]));
    }
    {
        const value = cast<Map<string, number>>([['a', 1], [2, '2'], ['b', 3]]);
        expect(value).toEqual(new Map([['a', 1], ['2', 2], ['b', 3]]));
    }
    {
        const value = serialize<Map<string, number>>(new Map([['a', 2], ['b', 3]]));
        expect(value).toEqual([['a', 2], ['b', 3]]);
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

test('union string number', () => {
    expect(cast<string | number>('a')).toEqual('a');
    expect(cast<string | number>(2)).toEqual(2);

    expect(cast<string | integer>(2)).toEqual(2);
    expect(cast<string | integer>('3')).toEqual('3');

    expect(cast<string | integer>(2.2)).toEqual(2);
    expect(cast<string | integer>('2.2')).toEqual('2.2');

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

test('union loose string number', () => {
    expect(cast<string | number>('a', { loosely: true })).toEqual('a');
    expect(cast<string | number>(2, { loosely: true })).toEqual(2);
    expect(cast<string | number>(-2, { loosely: true })).toEqual(-2);

    expect(cast<string | integer>(2, { loosely: true })).toEqual(2);
    expect(cast<string | integer>('3', { loosely: true })).toEqual(3);

    expect(cast<string | integer>(2.2, { loosely: true })).toEqual(2);
    expect(cast<string | integer>(-2.2, { loosely: true })).toEqual(-2);
    expect(cast<string | integer>('2.2', { loosely: true })).toEqual(2);
    expect(cast<string | integer>(false)).toEqual('false');
    expect(cast<string | integer>(true)).toEqual('true');
});

test('union loose string boolean', () => {
    expect(cast<string | boolean>('a', { loosely: true })).toEqual('a');
    expect(cast<string | boolean>(1, { loosely: true })).toEqual(true);
    expect(cast<string | boolean>(0, { loosely: true })).toEqual(false);
    expect(cast<string | boolean>(-1, { loosely: true })).toEqual('-1');
    expect(cast<string | boolean>(2, { loosely: true })).toEqual('2');
    expect(cast<string | boolean>('true', { loosely: true })).toEqual(true);
    expect(cast<string | boolean>('true2', { loosely: true })).toEqual('true2');
});

test('union loose number boolean', () => {
    expect(cast<number | boolean>('a', { loosely: true })).toEqual(undefined);
    expect(cast<number | boolean>(1, { loosely: true })).toEqual(true);
    expect(cast<number | boolean>('1', { loosely: true })).toEqual(true);
    expect(cast<number | boolean>('1')).toEqual(1);
    expect(cast<number | boolean>(0, { loosely: true })).toEqual(false);
    expect(cast<number | boolean>(-1, { loosely: true })).toEqual(-1);
    expect(cast<number | boolean>(2, { loosely: true })).toEqual(2);
    expect(cast<number | boolean>('2', { loosely: true })).toEqual(2);
    expect(cast<number | boolean>('true', { loosely: true })).toEqual(true);
    expect(cast<number | boolean>('true')).toEqual(undefined);
    expect(cast<number | boolean>('true2', { loosely: true })).toEqual(undefined);
});

test('union string date', () => {
    expect(cast<string | Date>('a')).toEqual('a');
    expect(cast<string | Date>('2021-11-24T16:21:13.425Z')).toBeInstanceOf(Date);
    expect(cast<string | Date>(1637781902866)).toBeInstanceOf(Date);
    expect(cast<string | Date>('1637781902866')).toBe('1637781902866');
});

test('union string bigint', () => {
    expect(cast<string | bigint>('a')).toEqual('a');
    expect(cast<string | bigint>(2n)).toEqual(2n);
    expect(cast<string | bigint>(2)).toEqual(2n);
    expect(cast<string | bigint>('2')).toEqual('2');
    expect(cast<string | bigint>('2a')).toEqual('2a');
});

test('union loose string bigint', () => {
    expect(cast<string | bigint>('a', { loosely: true })).toEqual('a');
    expect(cast<string | bigint>(2n, { loosely: true })).toEqual(2n);
    expect(cast<string | bigint>(2, { loosely: true })).toEqual(2n);
    expect(cast<string | bigint>('2', { loosely: true })).toEqual(2n);
    expect(cast<string | bigint>('2a', { loosely: true })).toEqual('2a');
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
    expect(cast<number | User>('2asd')).toEqual(undefined);

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
    expect(() => cast<number>('123abc')).toThrow('Cannot convert 123abc to number');
    expect(() => cast<{ a: string }>(false)).toThrow('Cannot convert false to {\n  a: string;\n}');
    expect(() => cast<{ a: number }>({ a: 'abc' })).toThrow('a: Cannot convert abc to number');
    expect(() => cast<{ a: { b: number } }>({ a: 'abc' })).toThrow('a: Cannot convert abc to {\n  b: number;\n}');
    expect(() => cast<{ a: { b: number } }>({ a: { b: 'abc' } })).toThrow('a.b: Cannot convert abc to number');
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
    expect(() => cast<BagOfNumbers>({ a: 'b' })).toThrow(SerializationError as any);
    expect(() => cast<BagOfNumbers>({ a: 'b' })).toThrow('a: ');
    expect(cast<BagOfNumbers>({ a: '1' })).toEqual({ a: 1 });
    expect(() => cast<BagOfNumbers>({ a: 'b', b: 'c' })).toThrow(SerializationError as any);
    expect(() => cast<BagOfNumbers>({ a: 'b', b: 'c' })).toThrow('a: ');

    +expect(cast<BagOfStrings>({ a: 1 })).toEqual({ a: '1' });
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
        constructor(public username: string) {
        }

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

        constructor(public username: string) {
        }
    }

    interface Team {
        lead: User & Reference;
    }

    {
        const res = cast<Team>({ lead: { id: 1, username: 'Peter' } });
        expect(res).toEqual({ lead: { id: 1, username: 'Peter' } });
        expect(res.lead).toBeInstanceOf(User);
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
        constructor(public username: string) {
        }
    }

    interface Team {
        leads: User[] & BackReference;
    }

    const res = cast<Team>({ leads: [{ username: 'Peter' }] });
    expect(res).toEqual({ leads: [{ username: 'Peter' }] });
    expect(res.leads[0]).toBeInstanceOf(User);
});

test('value object single field', () => {
    class Price {
        constructor(public amount: integer) {
        }

        isFree() {
            return this.amount === 0;
        }
    }

    class Product {
        constructor(public title: string, public price: Embedded<Price>) {

        }
    }

    const product = new Product('Brick', new Price(34));
    const productJson = serialize<Product>(product);
    expect(productJson).toEqual({ title: 'Brick', price: 34 });

    {
        const product = deserialize<Product>(productJson);
        expect(product).toEqual({ title: 'Brick', price: { amount: 34 } });
        expect(product.price).toBeInstanceOf(Price);
        expect(product.price.isFree()).toBe(false);
    }
});

test('value object multi field', () => {
    class Price {
        constructor(public amount: integer, public currency: string) {
        }

        isFree() {
            return this.amount === 0;
        }
    }

    class Product {
        constructor(public title: string, public price: Embedded<Price>) {

        }
    }

    const product = new Product('Brick', new Price(34, 'EUR'));
    const productJson = serialize<Product>(product);
    expect(productJson).toEqual({ title: 'Brick', price_amount: 34, price_currency: 'EUR' });

    {
        const product = deserialize<Product>(productJson);
        expect(product).toEqual({ title: 'Brick', price: { amount: 34, currency: 'EUR' } });
        expect(product.price).toBeInstanceOf(Price);
        expect(product.price.isFree()).toBe(false);
    }
});

test('value object prefix + multi field', () => {
    class Price {
        constructor(public amount: integer = 0, public currency: string = 'EUR') {
        }

        isFree() {
            return this.amount === 0;
        }
    }

    class Product {
        constructor(public title: string, public price: Embedded<Price, {prefix: ''}>) {

        }
    }

    const product = new Product('Brick', new Price(34, 'EUR'));
    const productJson = serialize<Product>(product);
    expect(productJson).toEqual({ title: 'Brick', amount: 34, currency: 'EUR' });

    {
        const product = deserialize<Product>(productJson);
        expect(product).toEqual({ title: 'Brick', price: { amount: 34, currency: 'EUR' } });
        expect(product.price).toBeInstanceOf(Price);
        expect(product.price.isFree()).toBe(false);
    }

    {
        const product = deserialize<Product>({title: 'Brick'});
        expect(product).toEqual({ title: 'Brick', price: {amount: 0, currency: 'EUR'}});
        expect(product.price).toBeInstanceOf(Price);
        expect(product.price.isFree()).toBe(true);
    }

    {
        const product = deserialize<Product>({title: 'Brick', amount: 2.333});
        expect(product).toEqual({ title: 'Brick', price: {amount: 2, currency: 'EUR'}});
        expect(product.price).toBeInstanceOf(Price);
        expect(product.price.isFree()).toBe(false);
    }
});
