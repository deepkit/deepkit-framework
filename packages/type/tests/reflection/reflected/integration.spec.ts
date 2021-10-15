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
import { propertiesOf, reflect, typeOf, valuesOf } from '../../../src/reflection/reflection';
import { ReflectionKind, ReflectionVisibility, TypeClass, TypeObjectLiteral } from '../../../src/reflection/type';

test('class', () => {
    class Entity {
        tags!: string[];
    }

    const type = reflect(Entity);
    expect(type).toMatchObject({
        kind: ReflectionKind.class,
        classType: Entity,
        members: [
            {
                kind: ReflectionKind.property,
                visibility: ReflectionVisibility.public,
                name: 'tags',
                type: { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } }
            }
        ]
    });
});

test('typeof primitives', () => {
    expect(typeOf<string>()).toEqual({ kind: ReflectionKind.string });
    expect(typeOf<number>()).toEqual({ kind: ReflectionKind.number });
    expect(typeOf<boolean>()).toEqual({ kind: ReflectionKind.boolean });
    expect(typeOf<bigint>()).toEqual({ kind: ReflectionKind.bigint });
    expect(typeOf<null>()).toEqual({ kind: ReflectionKind.null });
    expect(typeOf<undefined>()).toEqual({ kind: ReflectionKind.undefined });
    expect(typeOf<any>()).toEqual({ kind: ReflectionKind.any });
    expect(typeOf<never>()).toEqual({ kind: ReflectionKind.never });
    expect(typeOf<void>()).toEqual({ kind: ReflectionKind.void });
});

test('typeof union', () => {
    expect(typeOf<'a' | 'b'>()).toEqual({ kind: ReflectionKind.union, members: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] });
});

test('valuesOf', () => {
    expect(valuesOf<'a' | 'b'>()).toEqual(['a', 'b']);
});

test('typeof T in function', () => {
    //todo: should this be supported?
    function t<T>(a: T) {
        return typeOf<T>();
    }

    const type = t('asd');
});

test('propertiesOf', () => {
    expect(propertiesOf<{ a: string, b: number }>()).toEqual(['a', 'b']);
});

test('typeof object literal', () => {
    expect(typeOf<{ a: string }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
    } as TypeObjectLiteral);
});

test('typeof interface', () => {
    interface Entity {a: string;}

    expect(typeOf<Entity>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
    } as TypeObjectLiteral);
});

test('typeof class', () => {
    class Entity {a!: string;}

    expect(typeOf<Entity>()).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        members: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);

    expect(reflect(Entity)).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        members: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);
});


test('typeof generic class', () => {
    class Entity<T> {a!: T;}

    expect(typeOf<Entity<string>>()).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        members: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);

    expect(reflect(Entity, typeOf<string>())).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        members: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);
});

test('function', () => {
    function pad(text: string, size: number): string {
        return text;
    }

    const type = reflect(pad);
    expect(type).toMatchObject({
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ],
        return: { kind: ReflectionKind.string }
    });
});

test('type function', () => {
    type pad = (text: string, size: number) => string;

    expect(typeOf<pad>()).toMatchObject({
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ],
        return: { kind: ReflectionKind.string }
    });
});

test('query', () => {
    type o = { a: string | number };

    expect(typeOf<o['a']>()).toMatchObject({
        kind: ReflectionKind.union,
        members: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });
});
