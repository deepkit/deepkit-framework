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
import { ReceiveType, removeTypeName, resolveReceiveType } from '../../../src/reflection/reflection';
import { expectEqualType } from '../../utils';

function equalType<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = removeTypeName(resolveReceiveType(a));
    const bType = removeTypeName(resolveReceiveType(b));
    expectEqualType(aType, bType as any);
}

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

test('NonNullable', () => {
    equalType<NonNullable<'a' | null | string | undefined>, 'a' | string>();
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
