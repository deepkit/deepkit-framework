/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { expect, test } from '@jest/globals';
import { typeOf } from '../../../src/reflection/reflection';
import { assertType, ReflectionKind, stringifyResolvedType, Type } from '../../../src/reflection/type';
import { expectEqualType } from '../../utils';

test('array stack', () => {
    type Pop<T extends unknown[]> = T extends [...infer U, unknown] ? U : never
    type Push<T extends unknown[], U> = [...T, U]
    type Shift<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never
    type Unshift<T extends unknown[], U> = [U, ...T]
});

test('StringToNum', () => {
    type test<A extends 0[] = []> = `${A['length']}`;
    expectEqualType(typeOf<test>(), { kind: ReflectionKind.literal, literal: '0', typeName: 'test' } as Type);

    type StringToNum<T extends string, A extends 0[] = []> = `${A['length']}` extends T ? A['length'] : StringToNum<T, [...A, 0]>;
    const type = typeOf<StringToNum<'100'>>();
    expectEqualType(type, { kind: ReflectionKind.literal, literal: 100 } as Type as any);
});

test('circular generic 1', () => {
    type RegExpForString<T> = T extends string ? (RegExp | T) : T;
    type MongoAltQuery<T> = T extends Array<infer U> ? (T | RegExpForString<U>) : RegExpForString<T>;

    type QuerySelector<T> = {
        $eq?: T;
        $not?: QuerySelector<T>;
    }
    // type Condition<T> = QuerySelector<T>;

    type FilterQuery<T> = {
        [P in keyof T]?: QuerySelector<T[P]>;
    };

    interface Product {
        id: number;
        title: string;
    }

    type t = QuerySelector<Product>;
    const type = typeOf<t>();
});

test('circular generic 2', () => {
    //this tests if FilterQuery<> is correctly instantiated in a circular type
    interface Product {
        id: number;
        title: string;
    }

    type RootQuerySelector<T> = {
        /** https://docs.mongodb.com/manual/reference/operator/query/and/#op._S_and */
        $and?: Array<FilterQuery<T>>;
        $another?: Array<FilterQuery<Product>>;
    }

    type FilterQuery<T> = {
        [P in keyof T]?: string;
    } & RootQuerySelector<T>;

    interface User {
        id: number;
        username: string;
    }

    type t = FilterQuery<User>;
    const type = typeOf<t>();
    assertType(type, ReflectionKind.objectLiteral);

    //$and
    assertType(type.types[2], ReflectionKind.propertySignature);
    assertType(type.types[2].type, ReflectionKind.array);
    assertType(type.types[2].type.type, ReflectionKind.objectLiteral);
    //$and.username
    assertType(type.types[2].type.type.types[1], ReflectionKind.propertySignature);
    expect(type.types[2].type.type.types[1].name).toBe('username');

    //$another
    assertType(type.types[3], ReflectionKind.propertySignature);
    assertType(type.types[3].type, ReflectionKind.array);
    assertType(type.types[3].type.type, ReflectionKind.objectLiteral);
    //$another.title
    assertType(type.types[3].type.type.types[1], ReflectionKind.propertySignature);
    expect(type.types[3].type.type.types[1].name).toBe('title');
});

test('nested template literal', () => {
    type t0 = `yes-${string}` | `no-${string}`;
    type t1 = `${number}.title:${t0}` | `${number}.size:${t0}`;
    type t2 = `items.${t1}`;
    const type = typeOf<t2>();
    expect(stringifyResolvedType(type)).toBe('`items.${number}.title:yes-${string}` | `items.${number}.title:no-${string}` | `items.${number}.size:yes-${string}` | `items.${number}.size:no-${string}`');

    type SubKeys<T, K extends string> = K extends keyof T ? `${K}.${Keys<T[K]>}` : never;
    type Keys<T> =
        T extends (infer A)[] ? `${number}.${Keys<A>}` :
            T extends object ? Extract<keyof T, string> | SubKeys<T, Extract<keyof T, string>> :
                never;

    type t10 = Keys<{ id: number, items: { title: string, size: number }[] }>;
    const type2 = typeOf<t10>();
    expect(stringifyResolvedType(type2)).toBe('\'id\' | \'items\' | `items.${number}.title` | `items.${number}.size`');
});

test('union to intersection', () => {

    //functions are contra-variant
    type UnionToIntersection<T> =
        (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never

});

test('dotted path', () => {
    interface Product {
        id: number;
        title: string;
    }

    interface User {
        id: number;
        username: string;
        products: Product[];
        mainProduct: Product;
    }

    type PathKeys<T> = object extends T ? string :
        T extends (infer A)[] ? `${number}.${PathKeys<A>}` :
            T extends object ? Extract<keyof T, string> | SubKeys<T, Extract<keyof T, string>> :
                never;

    type SubKeys<T, K extends string> = K extends keyof T ? `${K}.${PathKeys<T[K]>}` : never;

    type t1 = PathKeys<User>;
    const type = typeOf<t1>();
    expect(stringifyResolvedType(type)).toBe('\'id\' | \'username\' | \'products\' | \'mainProduct\' | `products.${number}.id` | `products.${number}.title` | \'mainProduct.id\' | \'mainProduct.title\'');
});

test('dotted object', () => {
    interface Admin {
        firstName: string;
        lastName: string;
    }

    interface Product {
        id: number;
        title: string;
        title2: string;
        owner: User;
    }

    interface User {
        id: number;
        username: string;
        products: Product[];
        mainProduct: Product;
    }

    type O<T, K extends string, Prefix extends string, Depth extends number[]> = K extends keyof T ? { [_ in `${Prefix}.${K}`]?: T[K] } | (T[K] extends object ? SubObjects<T[K], Extract<keyof T[K], string>, `${Prefix}.${K}`, [...Depth, 1]> : {}) : {};

    type SubObjects<T, K extends string, Prefix extends string, Depth extends number[]> =
        Depth['length'] extends 10 ? {} : //bail out when too deep
            K extends keyof T ? T[K] extends Array<infer A> ? SubObjects<A, Extract<keyof A, string>, `${Prefix}.${K}.${number}`, [...Depth, 1]> :
                T[K] extends object ? O<T[K], Extract<keyof T[K], string>, Prefix extends '' ? K : `${Prefix}.${K}`, Depth> : { [P in `${Prefix}.${K}`]?: T[K] } : {};

    type FilterQuery<T> = SubObjects<T, Extract<keyof T, string>, 'root', []>;

    // for (let i = 0; i < 100; i++) {
    //     type t1 = FilterQuery<User>;
    //     const start = Date.now();
    //     const type = typeOf<t1>();
    //     console.log('took', Date.now() - start);
    // }
    type t1 = FilterQuery<User>;
    const o: t1 = {};
    const type = typeOf<t1>();
    console.log(stringifyResolvedType(type));
    // expect(stringifyResolvedType(type)).toBe("'id' | 'username' | 'products' | 'mainProduct' | `products.${number}.id` | `products.${number}.title` | 'mainProduct.id' | 'mainProduct.title'")
});
