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
import { ReflectionKind, ReflectionVisibility, TypeClass, TypeIndexSignature, TypeObjectLiteral } from '../../../src/reflection/type';

test('class', () => {
    class Entity {
        tags!: string[];
    }

    const type = reflect(Entity);
    expect(type).toEqual({
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

test('interface', () => {
    interface Entity {
        tags: string[];
    }

    const type = typeOf<Entity>();
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [
            {
                kind: ReflectionKind.propertySignature,
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
    type t = 'a' | 'b';
    expect(typeOf<t>()).toEqual({ kind: ReflectionKind.union, members: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] });
});

test('valuesOf union', () => {
    type t = 'a' | 'b';
    expect(valuesOf<t>()).toEqual(['a', 'b']);
    expect(valuesOf<string | number>()).toEqual([{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]);
});

test('valuesOf object literal', () => {
    type t = { a: string, b: number };
    expect(valuesOf<t>()).toEqual([{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]);
});

test('propertiesOf inline', () => {
    expect(propertiesOf<{ a: string, b: number }>()).toEqual(['a', 'b']);
});

test('object literal index signature', () => {
    type t = { [name: string]: string | number, a: string, };
    expect(typeOf<t>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [
            {
                kind: ReflectionKind.indexSignature,
                index: { kind: ReflectionKind.string },
                type: { kind: ReflectionKind.union, members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }] }
            } as TypeIndexSignature,
            {
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.string }
            }
        ]
    });
});

test('propertiesOf external', () => {
    type o = { a: string, b: number };
    expect(propertiesOf<o>()).toEqual(['a', 'b']);
});

test('propertiesOf class', () => {
    class User {
        a!: string;
        b!: string;
    }

    expect(propertiesOf<User>()).toEqual(['a', 'b']);
});

test('typeof object literal', () => {
    expect(typeOf<{ a: string }>()).toEqual({
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
    expect(type).toEqual({
        kind: ReflectionKind.function,
        name: 'pad',
        parameters: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ],
        return: { kind: ReflectionKind.string }
    });
});

test('type function', () => {
    type pad = (text: string, size: number) => string;

    expect(typeOf<pad>()).toEqual({
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

    expect(typeOf<o['a']>()).toEqual({
        kind: ReflectionKind.union,
        members: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });
});

test('type alias partial', () => {
    type Partial2<T> = {
        [P in keyof T]?: T[P];
    }

    type o = { a: string };
    type p = Partial2<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('type alias required', () => {
    type Required2<T> = {
        [P in keyof T]-?: T[P];
    }

    type o = { a?: string };
    type p = Required2<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
    });
});

test('type alias partial readonly', () => {
    type Partial2<T> = {
        readonly [P in keyof T]?: T[P];
    }

    type o = { a: string };
    type p = Partial2<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', readonly: true, optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('object literal optional', () => {
    expect(typeOf<{ a?: string }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('object literal readonly', () => {
    expect(typeOf<{ readonly a: string }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', readonly: true, type: { kind: ReflectionKind.string } }]
    });
});

test('type alias partial remove readonly', () => {
    type Partial2<T> = {
        -readonly [P in keyof T]?: T[P];
    }

    type o = { readonly a: string };
    type p = Partial2<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('type alias all string', () => {
    type AllString<T> = {
        [P in keyof T]: string;
    }

    type o = { a: string, b: number };
    type p = AllString<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.string } }
        ]
    });
});

test('type alias conditional type', () => {
    type IsString<T> = {
        [P in keyof T]: T[P] extends string ? true : false;
    }

    type o = { a: string, b: number };
    type p = IsString<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.literal, literal: true, } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.literal, literal: false, } },
        ]
    });
});

test('type alias infer', () => {
    type InferTypeOfT<T> = {
        [P in keyof T]: T[P] extends { t: infer OT } ? OT : never
    }

    type o = { a: { t: string }, b: { t: number } };
    type p = InferTypeOfT<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.number } },
        ]
    });
});

// test('typeof T in function', () => {
//     //todo: should this be supported?
//     function t<T>(a: T) {
//         return typeOf<T>();
//     }
//
//     const type = t('asd');
// });
