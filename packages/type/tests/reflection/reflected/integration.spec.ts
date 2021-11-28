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
import { decorate, propertiesOf, reflect, ReflectionClass, ReflectionFunction, resolveIntersection, typeOf, valuesOf } from '../../../src/reflection/reflection';
import {
    assertType,
    BackReference,
    integer,
    PrimaryKey,
    Reference,
    ReflectionKind,
    ReflectionVisibility,
    Type,
    TypeClass,
    TypeIndexSignature,
    TypeIntersection,
    TypeNumber,
    TypeNumberBrand,
    TypeObjectLiteral,
    TypeString,
    TypeTuple
} from '../../../src/reflection/type';
import { ClassType } from '@deepkit/core';
import { t } from '../../../src/decorator';

test('class', () => {
    class Entity {
        tags!: string[];
    }

    const type = reflect(Entity);
    expect(type).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [
            {
                kind: ReflectionKind.property,
                visibility: ReflectionVisibility.public,
                name: 'tags',
                type: { kind: ReflectionKind.array, type: { kind: ReflectionKind.string } }
            }
        ]
    });
});

test('class optional question mark', () => {
    class Entity {
        title?: string;
    }

    const type = reflect(Entity);
    expect(type).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [
            {
                kind: ReflectionKind.property,
                visibility: ReflectionVisibility.public,
                name: 'title',
                optional: true,
                type: { kind: ReflectionKind.string }
            }
        ]
    });
});

test('class optional union', () => {
    class Entity {
        title: string | undefined;
    }

    const type = reflect(Entity);
    expect(type).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [
            {
                kind: ReflectionKind.property,
                visibility: ReflectionVisibility.public,
                name: 'title',
                optional: true,
                type: { kind: ReflectionKind.string }
            }
        ]
    });
});

test('class constructor', () => {
    class Entity1 {
        constructor(title: string) {
        }
    }

    class Entity2 {
        constructor(public title: string) {
        }
    }

    expect(reflect(Entity1)).toEqual({
        kind: ReflectionKind.class,
        classType: Entity1,
        types: [
            {
                kind: ReflectionKind.method,
                visibility: ReflectionVisibility.public,
                name: 'constructor',
                parameters: [
                    { kind: ReflectionKind.parameter, name: 'title', type: { kind: ReflectionKind.string } }
                ],
                return: { kind: ReflectionKind.any }
            }
        ]
    } as Type);

    expect(reflect(Entity2)).toEqual({
        kind: ReflectionKind.class,
        classType: Entity2,
        types: [
            {
                kind: ReflectionKind.method,
                visibility: ReflectionVisibility.public,
                name: 'constructor',
                parameters: [
                    { kind: ReflectionKind.parameter, name: 'title', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }
                ],
                return: { kind: ReflectionKind.any }
            },
            {
                kind: ReflectionKind.property,
                visibility: ReflectionVisibility.public,
                name: 'title',
                type: { kind: ReflectionKind.string }
            },
        ]
    } as Type);
});

test('interface', () => {
    interface Entity {
        tags: string[];
    }

    const type = typeOf<Entity>();
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature,
                name: 'tags',
                type: { kind: ReflectionKind.array, type: { kind: ReflectionKind.string } }
            }
        ]
    });
});

test('tuple', () => {
    {
        const type = typeOf<[string]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.string } }
            ]
        } as TypeTuple);
    }
    {
        const type = typeOf<[string, number]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.string } },
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.number } }
            ]
        } as TypeTuple);
    }
});

test('named tuple', () => {
    {
        const type = typeOf<[title: string]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.string }, name: 'title' }
            ]
        } as TypeTuple);
    }
    {
        const type = typeOf<[title: string, prio: number]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.string }, name: 'title' },
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.number }, name: 'prio' }
            ]
        } as TypeTuple);
    }
});

test('rest tuple', () => {
    {
        const type = typeOf<[...string[]]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.rest, type: { kind: ReflectionKind.string } } }
            ]
        } as TypeTuple);
    }
    {
        const type = typeOf<[...string[], number]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.rest, type: { kind: ReflectionKind.string } } },
                { kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.number } }
            ]
        } as TypeTuple);
    }
});

test('rest named tuple', () => {
    {
        const type = typeOf<[...title: string[]]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, name: 'title', type: { kind: ReflectionKind.rest, type: { kind: ReflectionKind.string } } }
            ]
        } as TypeTuple);
    }
    {
        const type = typeOf<[...title: string[], prio: number]>();
        expect(type).toEqual({
            kind: ReflectionKind.tuple,
            types: [
                { kind: ReflectionKind.tupleMember, name: 'title', type: { kind: ReflectionKind.rest, type: { kind: ReflectionKind.string } } },
                { kind: ReflectionKind.tupleMember, name: 'prio', type: { kind: ReflectionKind.number } },
            ]
        } as TypeTuple);
    }
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
    expect(typeOf<t>()).toEqual({ kind: ReflectionKind.union, types: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] });
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
        types: [
            {
                kind: ReflectionKind.indexSignature,
                index: { kind: ReflectionKind.string },
                type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }] }
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
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
    } as TypeObjectLiteral);
});

test('typeof object literal with function', () => {
    expect(typeOf<{ add(item: string): any }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{
            kind: ReflectionKind.methodSignature,
            name: 'add',
            parameters: [{ kind: ReflectionKind.parameter, name: 'item', type: { kind: ReflectionKind.string } }],
            return: { kind: ReflectionKind.any }
        }]
    } as TypeObjectLiteral);
});

test('typeof class', () => {
    class Entity {
        a!: string;
    }

    expect(typeOf<Entity>()).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);

    expect(reflect(Entity)).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);
});

test('typeof generic class', () => {
    class Entity<T> {
        a!: T;
    }

    expect(typeOf<Entity<string>>()).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        arguments: [typeOf<string>()],
        types: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);

    expect(reflect(Entity, typeOf<string>())).toEqual({
        kind: ReflectionKind.class,
        arguments: [typeOf<string>()],
        classType: Entity,
        types: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
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
            { kind: ReflectionKind.parameter, name: 'text', type: { kind: ReflectionKind.string } },
            { kind: ReflectionKind.parameter, name: 'size', type: { kind: ReflectionKind.number } },
        ],
        return: { kind: ReflectionKind.string }
    });
});

test('type function', () => {
    type pad = (text: string, size: number) => string;

    expect(typeOf<pad>()).toEqual({
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.parameter, name: 'text', type: { kind: ReflectionKind.string } },
            { kind: ReflectionKind.parameter, name: 'size', type: { kind: ReflectionKind.number } },
        ],
        return: { kind: ReflectionKind.string }
    });
});

test('query literal', () => {
    type o = { a: string | number };

    expect(typeOf<o['a']>()).toEqual({
        kind: ReflectionKind.union,
        types: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });
});

test('query union from keyof', () => {
    type o = { a: string, b: string, c: number };

    expect(typeOf<o[keyof o]>()).toEqual({
        kind: ReflectionKind.union,
        types: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });
});

test('query union manual', () => {
    type o = { a: string, b: string, c: number };

    expect(typeOf<o['a' | 'b' | 'c']>()).toEqual({
        kind: ReflectionKind.union,
        types: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });
});

test('query number index', () => {
    type o = [string, string, number];

    expect(typeOf<o[number]>()).toEqual({
        kind: ReflectionKind.union,
        types: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.number },
        ]
    });

    expect(typeOf<o[0]>()).toEqual({ kind: ReflectionKind.string });
    expect(typeOf<o[1]>()).toEqual({ kind: ReflectionKind.string });
    expect(typeOf<o[2]>()).toEqual({ kind: ReflectionKind.number });
});

test('type alias partial', () => {
    type Partial2<T> = {
        [P in keyof T]?: T[P];
    }

    type o = { a: string };
    type p = Partial2<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
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
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
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
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', readonly: true, optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('object literal optional', () => {
    expect(typeOf<{ a?: string }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('object literal readonly', () => {
    expect(typeOf<{ readonly a: string }>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', readonly: true, type: { kind: ReflectionKind.string } }]
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
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });
});

test('global partial', () => {
    type o = { a: string };
    type p = Partial<o>;

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', optional: true, type: { kind: ReflectionKind.string } }]
    });

});

test('global record', () => {
    type p = Record<string, number>;
    //equivalent to
    type a = { [K in string]: number };

    expect(typeOf<p>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.indexSignature, type: { kind: ReflectionKind.number }, index: { kind: ReflectionKind.string } }]
    } as Type);

    expect(typeOf<a>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.indexSignature, type: { kind: ReflectionKind.number }, index: { kind: ReflectionKind.string } }]
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
        types: [
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
        types: [
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
        types: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.number } },
        ]
    });
});

test('user interface', () => {
    interface User {
        username: string;
        created: Date;
    }

    const type = typeOf<User>();
    console.log((type as any).types);
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'username',
                type: { kind: ReflectionKind.string }
            },
            {
                kind: ReflectionKind.propertySignature, name: 'created',
                type: { kind: ReflectionKind.class, classType: Date, types: [] }
            },
        ]
    });
});

test('generic static', () => {
    interface Request<T> {
        body: T;
    }

    interface Body {
        title: string;
    }

    const type = typeOf<Request<Body>>();
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body',
                type: {
                    kind: ReflectionKind.objectLiteral, types: [
                        { kind: ReflectionKind.propertySignature, name: 'title', type: { kind: ReflectionKind.string } }
                    ]
                }
            },
        ]
    });

    expect(typeOf<Request<string>>()).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body',
                type: { kind: ReflectionKind.string }
            },
        ]
    });
});

test('generic dynamic', () => {
    interface Request<T extends object> {
        body: T;
    }

    interface Body {
        title: string;
    }

    const type = typeOf<Request<any>>([typeOf<Body>()]);
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body',
                type: {
                    kind: ReflectionKind.objectLiteral, types: [
                        { kind: ReflectionKind.propertySignature, name: 'title', type: { kind: ReflectionKind.string } }
                    ]
                }
            },
        ]
    });

    expect(typeOf<Request<any>>([typeOf<string>()])).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body',
                type: { kind: ReflectionKind.string }
            },
        ]
    });
});

test('reflection class', () => {
    class User {
        created: Date = new Date;

        constructor(public username: string) {
        }

        say(text: string): void {
            console.log(`${this.username}: ${text}`);
        }
    }

    const reflection = ReflectionClass.from(User);
    expect(reflection.getMethodNames()).toEqual(['constructor', 'say']);

    const sayMethod = reflection.getMethod('say')!;
    expect(sayMethod.getParameterNames()).toEqual(['text']);
    expect(sayMethod.getParameterType('text')!.kind).toBe(ReflectionKind.string);
    expect(sayMethod.getReturnType().kind).toEqual(ReflectionKind.void);

    expect(reflection.getPropertyNames()).toEqual(['created', 'username']);
    expect(reflection.getProperty('username')!.type).toEqual({ kind: ReflectionKind.string }); //string
    expect(reflection.getProperty('username')!.isPublic()).toBe(true); //true
});

test('reflection function', () => {
    function say(text: string): void {
        console.log(`Text: ${text}`);
    }

    const reflection = ReflectionFunction.from(say);
    reflection.getParameters(); //[text: string]
    reflection.getReturnType(); //[void]

    expect(reflection.getParameterNames()).toEqual(['text']);
    expect(reflection.getParameter('text')!.kind).toBe(ReflectionKind.parameter);
    expect(reflection.getParameterType('text')!.kind).toBe(ReflectionKind.string);

    expect(reflection.getReturnType().kind).toBe(ReflectionKind.void);
});

test('primaryKey', () => {
    class User {
        id: number & PrimaryKey = 0;
    }

    const reflection = ReflectionClass.from(User);
    const property = reflection.getProperty('id')!;
    expect(property.getType().kind).toBe(ReflectionKind.number);
    const brands = (property.getType() as TypeNumber).brands;
    expect(brands![0]).toEqual(typeOf<{ __meta?: 'primaryKey' }>());
});

test('Reference', () => {
    interface User {
        id: number & PrimaryKey;

        pages: Page[] & BackReference;
    }

    interface Page {
        owner: User & Reference;
    }

    const reflection = ReflectionClass.from(typeOf<Page>());
    const property = reflection.getProperty('owner')!;
    const owner = property.getType();
    expect(owner).toMatchObject({
        kind: ReflectionKind.intersection,
        types: [
            typeOf<User>(),
            typeOf<Reference>(),
        ]
    });
});

test('resolve intersection with reference', () => {
    class Image {
        id: number = 0;
    }

    const { resolved, decorations } = resolveIntersection(typeOf<Image & Reference>() as TypeIntersection);
    assertType(resolved, ReflectionKind.class);
    expect(resolved.classType).toBe(Image);
    expect(decorations[0]).toEqual(typeOf<Reference>());
});

test('circular interface', () => {
    interface User {
        pages: Page[] & BackReference;

        page: Page & BackReference;
    }

    interface Page {
        owner: User & Reference;
    }

    const user = typeOf<User>();
    const page = typeOf<Page>();

    expect(user === typeOf<User>()).toBe(true);
    assertType(user, ReflectionKind.objectLiteral);
    assertType(page, ReflectionKind.objectLiteral);

    assertType(page.types[0], ReflectionKind.propertySignature);
    expect(page.types[0].name).toBe('owner');
    assertType(page.types[0].type, ReflectionKind.intersection);
    expect(page.types[0].type.types[0] === user).toBe(true);
    expect(page.types[0].type.types[1]).toEqual(typeOf<Reference>());
});

test('built in numeric type', () => {
    class User {
        id: integer = 0;
    }

    const reflection = ReflectionClass.from(User);
    const property = reflection.getProperty('id')!;
    expect(property.getType().kind).toBe(ReflectionKind.number);
    expect((property.getType() as TypeNumber).brand).toBe(TypeNumberBrand.integer);
});

test('custom brands', () => {
    type Username = string & { __brand: 'username' };

    class User {
        username: Username = '' as Username;
    }

    const reflection = ReflectionClass.from(User);
    const property = reflection.getProperty('username')!;
    expect(property.getType().kind).toBe(ReflectionKind.string);
    expect((property.getType() as TypeNumber).brands![0]).toEqual(typeOf<{ __brand: 'username' }>());
});

test('ts-brand', () => {
    type Brand<Base,
        Branding,
        ReservedName extends string = '__type__'> = Base & { [K in ReservedName]: Branding } & { __witness__: Base };

    const type = typeOf<Brand<string, 'uuid'>>();
    const expected: TypeString = {
        kind: ReflectionKind.string,
        brands: [
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, name: '__type__', type: { kind: ReflectionKind.literal, literal: 'uuid' } },
                ]
            },
            {
                kind: ReflectionKind.objectLiteral, types: []
            }
        ]
    };
    (expected.brands![1] as TypeObjectLiteral).types.push({ kind: ReflectionKind.propertySignature, name: '__witness__', type: expected });
    expect(type).toEqual(expected);
});

test('decorate class', () => {
    @t.group('a')
    class User {
        username: string = '';
    }

    const reflection = ReflectionClass.from(User);
    expect(reflection.groups).toEqual(['a']);
});

test('decorate class property', () => {
    class User {
        @t.group('a')
        username: string = '';
    }

    const reflection = ReflectionClass.from(User);
    const username = reflection.getProperty('username');
    expect(username!.groups).toEqual(['a']);
});

test('enum const', () => {
    const enum MyEnum {
        a, b, c
    }

    const type = typeOf<MyEnum>();
    expect(type).toEqual({
        kind: ReflectionKind.enum,
        enum: { a: 0, b: 1, c: 2 },
        values: [0, 1, 2]
    });
});

test('enum default', () => {
    enum MyEnum {
        a, b, c
    }

    const type = typeOf<MyEnum>();

    expect(type).toEqual({
        kind: ReflectionKind.enum,
        enum: { a: 0, b: 1, c: 2 },
        values: [0, 1, 2]
    });
});

test('enum initializer 1', () => {
    enum MyEnum {
        a = 3, b, c
    }

    const type = typeOf<MyEnum>();

    expect(type).toEqual({
        kind: ReflectionKind.enum,
        enum: { a: 3, b: 4, c: 5 },
        values: [3, 4, 5]
    });
});

test('enum initializer 2', () => {
    enum MyEnum {
        a = 0,
        b = 1 << 0,
        c = 1 << 1,
        d = 1 << 2,
    }

    const type = typeOf<MyEnum>();

    expect(type).toEqual({
        kind: ReflectionKind.enum,
        enum: { a: 0, b: 1, c: 2, d: 4 },
        values: [0, 1, 2, 4]
    });
});

test('decorate class inheritance', () => {
    class Timestamp {
        @t.group('base')
        created: Date = new Date;
    }

    class User extends Timestamp {
        @t.group('a')
        username: string = '';
    }

    const reflection = ReflectionClass.from(User);
    const username = reflection.getProperty('username');
    expect(username!.groups).toEqual(['a']);

    const created = reflection.getProperty('created');
    expect(created!.groups).toEqual(['base']);
});

test('decorate class inheritance override decorator data', () => {
    class Timestamp {
        @t.group('base')
        created: Date = new Date;
    }

    class User extends Timestamp {
        @t.group('a')
        created: Date = new Date;
    }

    const reflection = ReflectionClass.from(User);
    const created = reflection.getProperty('created');
    expect(created!.groups).toEqual(['base', 'a']);
});

test('decorate interface', () => {
    interface User {
        /**
         * @description test
         */
        username: string;
    }

    const reflection = decorate<User>({
        username: t.group('a')
    });

    const username = reflection.getProperty('username')!;
    expect(username.getKind()).toBe(ReflectionKind.string);
    expect(username.groups).toEqual(['a']);
    expect(username.getDescription()).toEqual('test');
});

test('set constructor parameter manually', () => {
    class Response {
        constructor(public success: boolean) {
        }
    }

    class StreamApiResponseClass<T> {
        constructor(public response: T) {
        }
    }

    function StreamApiResponse<T>(responseBodyClass: ClassType<T>) {
        class A extends StreamApiResponseClass<T> {
            constructor(@t.type(responseBodyClass) public response: T) {
                super(response);
            }
        }

        return A;
    }

    {
        const classType = StreamApiResponse(Response);
        const reflection = ReflectionClass.from(classType);
        expect(reflection.getMethods().length).toBe(1);
        expect(reflection.getProperties().length).toBe(1);
        expect(reflection.getMethod('constructor')!.getParameters().length).toBe(1);
        expect(reflection.getMethod('constructor')!.getParameter('response')!.getType().kind).toBe(ReflectionKind.class);
        expect(reflection.getMethods()[0].getName()).toBe('constructor');
        const responseType = reflection.getProperty('response')!.getType();
        expect(responseType.kind).toBe(ReflectionKind.class);
        if (responseType.kind === ReflectionKind.class) {
            expect(responseType.classType).toBe(Response);
        }
    }

    {
        const type = typeOf<StreamApiResponseClass<Response>>();
        const reflection = ReflectionClass.from(type);
        if (type.kind === ReflectionKind.class) {
            const t1 = type.arguments![0] as TypeClass;
            expect(t1.kind).toBe(ReflectionKind.class);
            expect(t1.classType).toBe(Response);
        }
        expect(reflection.getMethods().length).toBe(1);
        expect(reflection.getProperties().length).toBe(1);
        expect(reflection.getMethod('constructor')!.getParameters().length).toBe(1);
        expect(reflection.getMethod('constructor')!.getParameter('response')!.getType().kind).toBe(ReflectionKind.class);
        const responseType = reflection.getProperty('response')!.getType();
        expect(responseType.kind).toBe(ReflectionKind.class);
        if (responseType.kind === ReflectionKind.class) {
            expect(responseType.classType).toBe(Response);
        }

        expect(reflection.getMethods()[0].getName()).toBe('constructor');
    }
});

test('circular type 1', () => {
    type Page = {
        title: string;
        children: Page[]
    }

    const type = typeOf<Page>();

    expect(type.kind).toBe(ReflectionKind.objectLiteral);
    if (type.kind === ReflectionKind.objectLiteral) {
        const c = type.types[1];
        expect(c.kind).toBe(ReflectionKind.propertySignature);
        if (c.kind === ReflectionKind.propertySignature) {
            const cType = c.type;
            expect(cType.kind).toBe(ReflectionKind.array);
            if (cType.kind === ReflectionKind.array) {
                expect(cType.type.kind).toBe(ReflectionKind.objectLiteral);
                expect(cType.type === type).toBe(true);
            }
        }
    }
});

test('circular type 2', () => {
    type Document = {
        title: string;
        root: Node;
    }

    type Node = {
        children: Node[]
    }

    const type = typeOf<Document>();

    expect(type.kind).toBe(ReflectionKind.objectLiteral);

    if (type.kind === ReflectionKind.objectLiteral) {
        const rootProperty = type.types[1];
        expect(rootProperty.kind).toBe(ReflectionKind.propertySignature);
        if (rootProperty.kind === ReflectionKind.propertySignature) {
            const rootType = rootProperty.type;
            expect(rootType.kind).toBe(ReflectionKind.objectLiteral);
            if (rootType.kind === ReflectionKind.objectLiteral) {
                const childrenProperty = rootType.types[0];
                expect(childrenProperty.kind).toBe(ReflectionKind.propertySignature);
                if (childrenProperty.kind === ReflectionKind.propertySignature) {
                    expect(childrenProperty.type.kind).toBe(ReflectionKind.array);
                    if (childrenProperty.type.kind === ReflectionKind.array) {
                        expect(childrenProperty.type.type).toBe(rootType);
                    }
                }
            }
        }
    }
});

test('circular interface 2', () => {
    interface Document {
        title: string;
        root: Node;
    }

    interface Node {
        children: Node[];
    }

    const type = typeOf<Document>();

    expect(type.kind).toBe(ReflectionKind.objectLiteral);

    if (type.kind === ReflectionKind.objectLiteral) {
        const rootProperty = type.types[1];
        expect(rootProperty.kind).toBe(ReflectionKind.propertySignature);
        if (rootProperty.kind === ReflectionKind.propertySignature) {
            const rootType = rootProperty.type;
            expect(rootType.kind).toBe(ReflectionKind.objectLiteral);
            if (rootType.kind === ReflectionKind.objectLiteral) {
                const childrenProperty = rootType.types[0];
                expect(childrenProperty.kind).toBe(ReflectionKind.propertySignature);
                if (childrenProperty.kind === ReflectionKind.propertySignature) {
                    expect(childrenProperty.type.kind).toBe(ReflectionKind.array);
                    if (childrenProperty.type.kind === ReflectionKind.array) {
                        expect(childrenProperty.type.type).toBe(rootType);
                    }
                }
            }
        }
    }
});

test('circular class 2', () => {
    class Document {
        title!: string;
        root!: Node;
    }

    class Node {
        children!: Node[];
    }

    const type = typeOf<Document>();

    expect(type.kind).toBe(ReflectionKind.class);

    if (type.kind === ReflectionKind.class) {
        const rootProperty = type.types[1];
        expect(rootProperty.kind).toBe(ReflectionKind.property);
        if (rootProperty.kind === ReflectionKind.property) {
            const rootType = rootProperty.type;
            expect(rootType.kind).toBe(ReflectionKind.class);
            if (rootType.kind === ReflectionKind.class) {
                const childrenProperty = rootType.types[0];
                expect(childrenProperty.kind).toBe(ReflectionKind.property);
                if (childrenProperty.kind === ReflectionKind.property) {
                    expect(childrenProperty.type.kind).toBe(ReflectionKind.array);
                    if (childrenProperty.type.kind === ReflectionKind.array) {
                        expect(childrenProperty.type.type).toBe(rootType);
                    }
                }
            }
        }
    }
});

test('circular class 3', () => {
    class Document {
        title!: string;
        root!: Node;
    }

    class Node {
        document!: Document;
        children!: Node[];
    }

    const type = typeOf<Document>();

    expect(type.kind).toBe(ReflectionKind.class);

    if (type.kind === ReflectionKind.class) {
        const rootProperty = type.types[1];
        expect(rootProperty.kind).toBe(ReflectionKind.property);
        if (rootProperty.kind === ReflectionKind.property) {
            const rootType = rootProperty.type;
            expect(rootType.kind).toBe(ReflectionKind.class);
            if (rootType.kind === ReflectionKind.class) {
                const documentProperty = rootType.types[0];
                expect(documentProperty.kind).toBe(ReflectionKind.property);
                if (documentProperty.kind === ReflectionKind.property) {
                    expect(documentProperty.type.kind).toBe(ReflectionKind.class);
                    expect(documentProperty.type).toBe(type);
                }

                const childrenProperty = rootType.types[1];
                expect(childrenProperty.kind).toBe(ReflectionKind.property);
                if (childrenProperty.kind === ReflectionKind.property) {
                    expect(childrenProperty.type.kind).toBe(ReflectionKind.array);
                    if (childrenProperty.type.kind === ReflectionKind.array) {
                        expect(childrenProperty.type.type).toBe(rootType);
                    }
                }
            }
        }
    }
});
