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
import { typeInfer } from '../../../src/reflection/processor';
import { removeTypeName, typeOf } from '../../../src/reflection/reflection';
import { assertType, ReflectionKind, ReflectionVisibility, Type, Widen } from '../../../src/reflection/type';
import { expectEqualType } from '../../utils';

test('infer T from function primitive', () => {
    function fn<T extends string | number>(v: T) {
        return typeOf<T>();
    }

    expect(fn('abc')).toEqual({ kind: ReflectionKind.literal, literal: 'abc' } as Type);
    expect(fn(23)).toEqual({ kind: ReflectionKind.literal, literal: 23 } as Type);
});

test('infer T from function boxed primitive', () => {
    type Box<T> = { a: T };

    function fn<T extends string | number>(v: Box<T>) {
        return typeOf<T>();
    }

    //TS infers literals
    expectEqualType(fn({ a: 'abc' }), { kind: ReflectionKind.literal, literal: 'abc' } as Type);
    expectEqualType(fn({ a: 23 }), { kind: ReflectionKind.literal, literal: 23 } as Type);
});

test('infer T from function conditional', () => {
    type Box<T> = T extends string ? true : false;

    function fn<T extends string | number, U extends Box<T>>(v: T) {
        return typeOf<U>();
    }

    expect(fn('abc')).toMatchObject({ kind: ReflectionKind.literal, literal: true });
    expect(fn(23)).toMatchObject({ kind: ReflectionKind.literal, literal: false });
});

test('infer T from function branded primitive', () => {
    type PrimaryKey<A> = A & { __brand?: 'primaryKey' };

    function fn<T extends PrimaryKey<any>>(v: T) {
        return typeOf<T>();
    }

    //TS infers literal
    expect(fn('abc')).toEqual({ kind: ReflectionKind.literal, literal: 'abc' } as Type);
    expect(fn(23)).toEqual({ kind: ReflectionKind.literal, literal: 23 } as Type);
});

test('infer T from function union primitive object', () => {
    function fn<T extends string | { a: string | number }>(v: T) {
        return typeOf<T>();
    }

    expect(fn('abc')).toEqual({ kind: ReflectionKind.literal, literal: 'abc' } as Type);

    //TS infers {a: string}
    expectEqualType(fn({ a: 'abc' }), {
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string, origin: { kind: ReflectionKind.literal, literal: 'abc' } } }
        ]
    } as Type);
});

test('infer T from interface function', () => {
    interface Wrap<T> {
        add(item: T): void;
    }

    const wrap: any = {};
    wrap.add = (item: string): void => undefined;

    expectEqualType(typeInfer(wrap), typeOf<{ add(item: string): void }>() as any);
    expectEqualType(typeOf<typeof wrap>(), typeOf<{ add(item: string): void }>() as any);
    expectEqualType(typeOf<typeof wrap>(), removeTypeName(typeOf<Wrap<string>>()) as any);

    type a = typeof wrap extends Wrap<infer T> ? T : never;
    expectEqualType(removeTypeName(typeOf<a>()), typeOf<string>());
});

test('extends string generates literal in constrained type', () => {
    type Brand<T> = T & { __meta?: 'brand' };

    type f<T> = T extends { a: infer R } ? { b: R } : never;
    type f1 = f<{ a: 'asd' }>;

    const f = <T>(v: T): { a: T } => ({ a: v }); //{a: string}
    const f1 = <T>(v: Brand<T>) => ({ a: v }); //{a: 'abc'}
    const f2 = <T extends string>(v: T) => ({ a: v }); //{a: 'abc'}
    const f3 = <T extends string | any>(v: T) => ({ a: v }); //{a: string}

    const rf = f('abc'); //{a: string}
    const rf1 = f1('abc'); //{a: 'abc'}
    const rf2 = f2('abc'); //{a: 'abc'}
    const rf3 = f3('abc'); //{a: string}

    const h = <T>(v: T) => v; //'abc'
    const h2 = <T extends string>(v: T) => v; //'abc'
    const h3 = <T extends string | any>(v: T) => v; //'abc'

    const rh1 = h('abc'); //'abc'
    const rh2 = h2('abc'); //'abc'
    const rh3 = h3('abc'); //'abc'

    //=> This rule is not even well understood among typescript developers, so we resolve always the narrowed type.
    // The user needs to use Widen<T> if they want to widen it.
    // We keep the code to make sure it compiles and runs correctly.
});

test('infer T from class', () => {
    function bla<T extends string | number>(v: T) {
        class P {
            typeNarrow!: T;
            type!: Widen<T>;
        }

        return P;
    }

    const clazz = bla('abc');
    const o = new clazz;
    o.type = 'another-value';

    const type = typeInfer(clazz);
    assertType(type, ReflectionKind.class);
    expect(type.types).toMatchObject([
        { kind: ReflectionKind.property, name: 'typeNarrow', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.literal, literal: 'abc' }, } as Type,
        { kind: ReflectionKind.property, name: 'type', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string }, } as Type,
    ] as any);
});

test('T as tuple rest', () => {
    type Tuple<T extends any[]> = ['hi', ...T];
    type r = Tuple<[string, number]>;

    const type = typeOf<r>();
    expectEqualType(type, typeOf<['hi', string, number]>() as any, { noTypeNames: true });
});

test('T array length', () => {
    type Tuple<T extends any[]> = ['hi', T['length']];
    type r = Tuple<string[]>;
    expectEqualType(typeOf<r>(), typeOf<['hi', number]>() as any, { noTypeNames: true });

    type r2 = Tuple<[string, number]>;
    expectEqualType(typeOf<r2>(), typeOf<['hi', 2]>() as any, { noTypeNames: true });
});
