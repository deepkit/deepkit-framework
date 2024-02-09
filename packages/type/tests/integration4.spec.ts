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
import { assertType, AutoIncrement, ExtractTypeAnnotationOptions, Group, groupAnnotation, PrimaryKey, ReflectionKind, TypeAnnotation } from '../src/reflection/type.js';
import { typeOf } from '../src/reflection/reflection.js';
import { cast } from '../src/serializer-facade.js';

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


test('complex recursive union type does not cause stack size exceeding 1', () => {
    type JSONValue = null | boolean | number | string | JSONObject | JSONArray;

    type JSONArray = JSONValue[];

    type JSONObject = {
        [k: string]: JSONValue;
    };

    expect(cast<JSONValue>({ username: 'Peter' })).toEqual({ username: 'Peter' });
    expect(cast<JSONValue>(['Peter'])).toEqual(['Peter']);
    expect(cast<JSONValue>('Peter')).toBe('Peter');
    expect(cast<JSONValue>(null)).toBe(null);
    expect(cast<JSONValue>(true)).toBe(true);
    expect(cast<JSONValue>(false)).toBe(false);
    expect(cast<JSONValue>(1)).toBe(1);
    expect(cast<JSONValue>(0)).toBe(0);
    expect(cast<JSONValue>(0.5)).toBe(0.5);
    expect(cast<JSONValue>([])).toEqual([]);
    expect(cast<JSONValue>({})).toEqual({});
});

test('complex recursive union type does not cause stack size exceeding 2', () => {
    type JSONValue = null | boolean | number | JSONObject | JSONArray | string;

    type JSONArray = [JSONValue];

    type JSONObject = {
        [k: string]: JSONValue;
    };

    const user = cast<JSONObject>({ username: 'Peter' });
    expect(cast<JSONObject>({ username: 'Peter' })).toEqual({ username: 'Peter' });
    expect(cast<JSONArray>(['Peter'])).toEqual(['Peter']);
    expect(cast<JSONValue>('Peter')).toBe('Peter');
    expect(cast<JSONValue>(null)).toBe(null);
    expect(cast<JSONValue>(true)).toBe(true);
    expect(cast<JSONValue>(false)).toBe(false);
    expect(cast<JSONValue>(1)).toBe(1);
    expect(cast<JSONValue>(0)).toBe(0);
    expect(cast<JSONValue>(0.5)).toBe(0.5);
    expect(cast<JSONValue>([{}])).toEqual([{}]);
    expect(cast<JSONValue>([])).toEqual([null]);
    expect(cast<JSONValue>({})).toEqual({});
});

test('array', () => {
    class Address {
        name: string = '';
        street: string = '';
        zip: string = '';
    }

    class Person {
        id: number & PrimaryKey & AutoIncrement = 0;
        tags: string[] = [];
        addresses: Address[] = [];
    }

    expect(cast<Person>({ id: 1, tags: ['a', 'b'], addresses: [{ name: 'a', street: 'b', zip: 'c' }] })).toEqual({
        id: 1,
        tags: ['a', 'b'],
        addresses: [{ name: 'a', street: 'b', zip: 'c' }],
    });
});

test('union loosely', () => {
    type a = { date: Date } | { id: number };

    expect(cast<a>({ date: '2020-08-05T00:00:00.000Z' })).toEqual({ date: new Date('2020-08-05T00:00:00.000Z') });
    expect(cast<a>({ id: 2 })).toEqual({ id: 2 });
    expect(cast<a>({ id: '3' })).toEqual({ id: 3 });
});
