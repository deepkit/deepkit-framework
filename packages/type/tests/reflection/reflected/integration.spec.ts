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
import { propertiesOf, reflect, ReflectionClass, ReflectionFunction, typeOf, valuesOf } from '../../../src/reflection/reflection';
import { integer, PrimaryKey, ReflectionKind, ReflectionVisibility, Type, TypeClass, TypeIndexSignature, TypeObjectLiteral } from '../../../src/reflection/type';
import { t } from '../../../src/decorator';

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

test('class constructor', () => {
    class Entity1 {
        constructor(title: string) {}
    }

    class Entity2 {
        constructor(public title: string) {}
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

test('typeof class', () => {
    class Entity {a!: string;}

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
    class Entity<T> {a!: T;}

    expect(typeOf<Entity<string>>()).toEqual({
        kind: ReflectionKind.class,
        classType: Entity,
        types: [{ kind: ReflectionKind.property, name: 'a', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.string } }]
    } as TypeClass);

    expect(reflect(Entity, typeOf<string>())).toEqual({
        kind: ReflectionKind.class,
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

        constructor(public username: string) {}

        say(text: string): void {
            console.log(`${this.username}: ${text}`);
        }
    }

    const reflection = ReflectionClass.from(User);
    expect(reflection.getMethodNames()).toEqual(['constructor', 'say']);

    const sayMethod = reflection.getMethod('say')!;
    expect(sayMethod.getParameterNames()).toEqual(['text']);
    expect(sayMethod.getParameter('text')!.kind).toBe(ReflectionKind.parameter);
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
        id: integer & PrimaryKey = 0;
    }

    const type = reflect(User);
    console.log(type);
})

test('decorate class', () => {
});

test('decorate interface', () => {
    function decorate<T>(decorate: { [P in keyof T]?: any }): any {}

    interface User {
        /**
         * @description Hello what up?
         * asdasd
         *
         * das
         */
        username: string;
    }

    decorate<User>({
        username: t.validate(() => 0)
    });
});

// test('class generic instance', () => {
//     class Request<T> {
//         fetch(): T {
//             return {} as any;
//         }
//     }
//
//     const r = new Request<string>();
//
//     reflect(r);
// });
//
// test('interface generic instance', () => {
//     interface Request<T> {
//         fetch(): T;
//     }
//
//     const r = { fetch() { return '';} } as Request<string>;
//
//     reflect(r);
// });

// test('pass type to function', () => {
//     function receiver<T>() {
//         return typeOf<T>();
//     }
//
//     const type1 = receiver<string>();
//     const type2 = receiver<number>();
// });
//
// test('infer type to function', () => {
//     function receiver<T>(type: T) {
//         return typeOf<T>();
//     }
//
//     const type1 = receiver('asd');
//     const type2 = receiver(123);
// });
//
// test('infer from function call return', () => {
//     class Response {
//         constructor(public success: boolean) {}
//     }
//
//     class StreamApiResponseClass<T> {
//         constructor(public response: T) {}
//     }
//
//     function StreamApiResponse<T>(responseBodyClass: ClassType<T>): ClassType<StreamApiResponseClass<T>> {
//         return class extends StreamApiResponseClass<T> {};
//     }
//
//     const t = StreamApiResponse(Response);
// });

// test('typeof T in function', () => {
//     //todo: should this be supported?
//     function t<T>(a: T) {
//         return typeOf<T>();
//     }
//
//     const type = t('asd');
// });
