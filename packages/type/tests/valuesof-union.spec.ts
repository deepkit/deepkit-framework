/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt, Apollo Software Limited, SamJakob
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { test } from '@jest/globals';

import { typeOf, valuesOf } from '../src/reflection/reflection';
import { expectEqualType } from './utils';

test('typeOf infers a simple union', () => {
    type t = 'a' | 'b';
    expectEqualType(valuesOf<t>(), ['a', 'b']);
});

test('typeOf infers a literal key on a union', () => {
    type t = { foo: 'a' } | { foo: 'b' };
    expectEqualType(valuesOf<t['foo']>(), ['a', 'b']);

    type t2 = { 1: 'a' } | { 1: 'b' };
    type t3 = { [1]: 'a' } | { [1]: 'b' };
    expectEqualType(valuesOf<t2[1]>(), ['a', 'b']);
    expectEqualType(valuesOf<t3[1]>(), ['a', 'b']);

    const mySymbol = Symbol('mySymbol');
    type t4 = { [mySymbol]: 'a'; 1: 2 } | { [mySymbol]: 'b'; 1: 4 };
    expectEqualType(valuesOf<t4[typeof mySymbol | 1]>(), ['a', 2, 'b', 4]);

    type t5 = ['a'] | ['b'];
    expectEqualType(valuesOf<t5[0]>(), ['a', 'b']);
});

type AdvancedTest = { foo: 1; bar: 2; baz: 3 } | { foo: 4; bar: 5; baz: 6 };

test('typeOf infers a union key on a union', () => {
    expectEqualType(valuesOf<AdvancedTest['foo' | 'baz']>(), [1, 3, 4, 6]);

    type AdvancedTest2 = { 1: 'foo'; 2: 'bar'; 3: 'baz' } | { 1: 'fizz'; 2: 'buzz'; 3: 'fizzbuzz' };
    expectEqualType(valuesOf<AdvancedTest2[1 | 3]>(), ['foo', 'baz', 'fizz', 'fizzbuzz']);

    type AdvancedTest3 = { [1]: 'foo'; [2]: 'bar'; [3]: 'baz' } | { [1]: 'fizz'; [2]: 'buzz'; [3]: 'fizzbuzz' };
    expectEqualType(valuesOf<AdvancedTest3[1 | 3]>(), ['foo', 'baz', 'fizz', 'fizzbuzz']);

    const mySymbol = Symbol('mySymbol');
    type AdvancedTest4 = { [mySymbol]: 'foo'; bar: 'bar'; baz: 'baz' } | { [mySymbol]: 'fizz'; bar: 'buzz'; baz: 'fizzbuzz' };
    // Note: the current implementation reduces duplicate values
    expectEqualType(valuesOf<AdvancedTest4[typeof mySymbol | 'baz']>(), ['foo', 'baz', 'fizz']);

    type AdvancedTest5 = ['a', 'b'] | ['c', 'd'];
    expectEqualType(valuesOf<AdvancedTest5[0 | 1]>(), ['a', 'b', 'c', 'd']);
});

class AdvancedTestClass {
    public foo() {}
    public bar() {}
    public baz() {}
    private fizz() {}
}

type MoreAdvancedTest = AdvancedTest | AdvancedTestClass;

test('typeOf infers a union key on a union with a class', () => {
    expectEqualType(valuesOf<MoreAdvancedTest['foo' | 'baz']>(), [1, 3, 4, 6, typeOf<AdvancedTestClass['foo']>(), typeOf<AdvancedTestClass['baz']>()]);
});
