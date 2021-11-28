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
import { assertType, ReflectionKind, Type, typeInfer } from '../../../src/reflection/type';

test('infer T from function primitive', () => {
    function fn<T extends string | number>(v: T) {
        return typeOf<T>();
    }

    expect(fn('abc')).toEqual({ kind: ReflectionKind.literal, literal: 'abc' } as Type);
    expect(fn(23)).toEqual({ kind: ReflectionKind.literal, literal: 23 } as Type);
});

test('infer T from function union primitive object', () => {
    function fn<T extends string | { a: string | number }>(v: T) {
        return typeOf<T>();
    }

    expect(fn('abc')).toEqual({ kind: ReflectionKind.literal, literal: 'abc' } as Type);
    expect(fn({ a: 'abc' })).toEqual({
        kind: ReflectionKind.objectLiteral, types: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }
        ]
    } as Type);
});

test('infer T from interface function', () => {
    interface Wrap<T> {
        add(item: T): void;
    }

    const wrap: any = {};
    wrap.add = (item: string): void => undefined;

    expect(typeInfer(wrap)).toEqual(typeOf<{ add(item: string): void }>());
    expect(typeOf<typeof wrap>()).toEqual(typeOf<{ add(item: string): void }>());
    expect(typeOf<typeof wrap>()).toEqual(typeOf<Wrap<string>>());

    type a = typeof wrap extends Wrap<infer T> ? T : never;
    expect(typeOf<a>()).toEqual(typeOf<string>());
});

test('infer T from class', () => {
    class Wrap<T> {
        constructor(item: T) {
        }

        type() {
            return typeOf<T>();
        }
    }

    const o = new Wrap('abc');
    // expect(o.type()).toEqual({ kind: ReflectionKind.string });

    function bla<T>(v: T) {
        class P {
            type!: T;
        }

        return P;
    }

    const clazz = bla('abc');
    const type = typeInfer(clazz);
    assertType(type, ReflectionKind.class);
    //todo: TypeParameterDeclaration in compiler needs to be fixed to support that
    expect(type.types).toEqual([
        { kind: ReflectionKind.property, name: 'type', type: { kind: ReflectionKind.string } }
    ]);
});
