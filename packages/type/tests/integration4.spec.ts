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
import { assertType, Group, groupAnnotation, ReflectionKind } from '../src/reflection/type.js';
import { typeOf } from '../src/reflection/reflection.js';

test('group from enum', () => {
    enum Groups {
        Default = 'default',
        Private = 'private'
    }

    type FieldGroupDefault = Group<Groups.Default>;
    type FieldGroupPrivate = Group<Groups.Private>;

    type a = string & FieldGroupDefault;
    type b = number & FieldGroupPrivate;
    type c = number & FieldGroupDefault & FieldGroupPrivate;

    const typeA = typeOf<a>();
    assertType(typeA, ReflectionKind.string);
    expect(groupAnnotation.getFirst(typeA)).toBe(Groups.Default);

    const typeB = typeOf<b>();
    assertType(typeB, ReflectionKind.number);
    expect(groupAnnotation.getFirst(typeB)).toBe(Groups.Private);

    const typeC = typeOf<c>();
    assertType(typeC, ReflectionKind.number);
    expect(groupAnnotation.getAnnotations(typeC)).toEqual([Groups.Default, Groups.Private]);
});

test('class base from fn', () => {
    function mixinPositions(base: any) {
        class Positions extends base {
            x: number & Group<'position'> = 0;
            y: number & Group<'position'> = 0;
        }

        return Positions;
    }

    class Base {
        createdAt!: Date & Group<'base'> & Group<'timestamps'>;
    }

    class Clazz extends mixinPositions(Base) {

    }

    const type = typeOf<Clazz>();
    assertType(type, ReflectionKind.class);

    assertType(type.types[0], ReflectionKind.property);
    expect(type.types[0].name).toBe('createdAt');
    expect(groupAnnotation.getAnnotations(type.types[0].type)).toEqual(['base', 'timestamps']);

    assertType(type.types[1], ReflectionKind.property);
    expect(type.types[1].name).toBe('x');
    expect(groupAnnotation.getAnnotations(type.types[1].type)).toEqual(['position']);
});
