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
import { ReceiveType, typeOf } from '../../../src/reflection/reflection';

function equalType<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = typeOf([], a);
    const bType = typeOf([], b);
    expect(aType).toEqual(bType as any);
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
