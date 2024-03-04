/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { test } from '@jest/globals';
import { equalType } from './utils.js';

test('Exclude', () => {
    equalType<Exclude<'a' | 'b' | 'c', 'b'>, 'a' | 'c'>();

    type o = { a: string, b: number, c: boolean }
    equalType<Exclude<keyof o, 'b' | 'c'>, 'a'>();
});

test('Extract', () => {
    equalType<Extract<'a' | 'b' | 'c', 'b'>, 'b'>();
    equalType<Extract<'a' | 'b' | 'c', 'b' | 'c'>, 'b' | 'c'>();
});

test('Pick', () => {
    type o = { a: string, b: number, c: boolean }
    equalType<Pick<o, 'a'>, { a: string }>();
    equalType<Pick<o, 'a' | 'b'>, { a: string, b: number }>();
    equalType<Pick<o, Exclude<keyof o, 'c'>>, { a: string, b: number }>();
});

test('Omit', () => {
    equalType<Omit<{ a: string, b: number, c: boolean }, 'b' | 'c'>, { a: string }>();
    equalType<Omit<{ a: string, b: number, c: boolean }, 'a'>, { b: number, c: boolean }>();
});

test('Omit 2', () => {
    interface A {
        readonly a: string;
        readonly value: string;
    }

    type B = Omit<A, 'value'>;
    equalType<B, { readonly a: string }>();
});


test('Awaited', () => {
    type T1 = Promise<string> extends object ? true : false;
    equalType<T1, true>();

    type T2 = Promise<string> extends { then(onfulfilled: infer F, ...args: infer _): any } ? true : false;
    equalType<T2, true>();

    type T22 = Promise<string> extends object & { then(onfulfilled: infer F, ...args: infer _): any } ? true : false;
    equalType<T22, true>();

    type T3 = Promise<string> extends { then(onfulfilled: infer F, ...args: infer _): any } ? F : false;
    equalType<T3 extends (value: string) => any ? true : never, true>();

    type T33 = Promise<string> extends (object & { then(onfulfilled: infer F, ...args: infer _): any }) ? F : false;
    equalType<T33 extends ((value: string) => any) ? true : never, true>();

    type T4 = ((value: string) => any) extends ((value: infer V, ...args: infer _) => any) ? V : never;
    equalType<T4, string>();

    type T44 = T33 extends ((value: infer V, ...args: infer _) => any) ? V : never;
    equalType<T44, string>();

    equalType<Awaited<Promise<string>>, string>();
    equalType<Awaited<Promise<Promise<string>>>, string>();
    equalType<Promise<string>, Promise<string>>();
});

test('intersection object', () => {
    type a1 = string & {}
    type a2 = null & {}
    type a3 = undefined & {}
    type a4 = (string | undefined) & {}
    type a5 = (number | 'abc' | undefined) & {}
    equalType<a1, string>();
    equalType<a2, never>();
    equalType<a3, never>();
    equalType<a4, string>();
    equalType<a5, number | 'abc'>();
});

test('NonNullable', () => {
    type t = NonNullable<'a' | null | string | undefined>;
    equalType<t, 'a' | string>();
});

test('Record', () => {
    equalType<Record<string, number>, { [index: string]: number }>();
});

test('Partial', () => {
    type o = { a: string, b: number, c: boolean }
    equalType<Partial<o>, { a?: string, b?: number, c?: boolean }>();
});

test('Required', () => {
    type o = { a: string, b?: number, c?: boolean }
    equalType<Required<o>, { a: string, b: number, c: boolean }>();
});

test('ReturnType', () => {
    type fn = (a: string, ...r: any[]) => void;
    type fn2 = (a: string, ...r: any[]) => string;
    type fn3 = () => string | boolean;

    equalType<ReturnType<fn>, void>();
    equalType<ReturnType<fn2>, string>();
    equalType<ReturnType<fn3>, string | boolean>();
});

test('Parameters runtime', () => {
    function fn(a: string, ...r: any[]): void {
    }

    equalType<Parameters<typeof fn>, [a: string, ...r: any[]]>();
});

test('Parameters type', () => {
    type fn = (a: string, ...r: any[]) => void;

    type r = Parameters<fn>;
    equalType<r, [a: string, ...r: any[]]>();
});

test('Parameters single type', () => {
    type fn = (a: string) => void;

    type r = Parameters<fn>;
    equalType<r, [a: string]>();
});

test('Parameters single type no rest', () => {
    type FirstParam<T extends (...args: any) => any> = T extends (k: infer I) => void ? I : never
    type fn = (a: string) => void;

    type r = FirstParam<fn>;
    equalType<r, string>();
});

test('sub Parameters type', () => {
    type SubParameters<T extends (...args: any) => any> = T extends (foo: string, ...args: infer P) => any ? P : never;
    type fn = (a: string, ...r: number[]) => void;
    type r = SubParameters<fn>;
    equalType<r, number[]>();

    type fn2 = (a: string, b: number, ...r: boolean[]) => void;
    type r2 = SubParameters<fn2>;
    equalType<r2, [b: number, ...r: boolean[]]>();
});

test('ConstructorParameters', () => {
    class User {
        constructor(public username: string, password?: string) {
        }
    }
    equalType<ConstructorParameters<typeof User>, [username: string, password?: string]>();

    type constructor = new (a: string, b: number) => void;
    equalType<ConstructorParameters<constructor>, [a: string, b: number]>();
});
