/** @reflection never */
import { expect, test } from '@jest/globals';
import { Processor } from '../../src/reflection/processor';
import { ReflectionKind, ReflectionVisibility, Type, TypeObjectLiteral, TypeUnion } from '../../src/reflection/type';
import { MappedModifier, ReflectionOp, RuntimeStackEntry } from '../../src/reflection/compiler';
import { isArray, isObject } from '@deepkit/core';
import { isExtendable } from '../../src/reflection/extends';

Error.stackTraceLimit = 200;

function expectType(pack: ReflectionOp[] | { ops: ReflectionOp[], stack: RuntimeStackEntry[], inputs?: RuntimeStackEntry[] }, expectObject: Partial<Type> | number | string | boolean): void {
    const processor = new Processor();
    const type = processor.run(isArray(pack) ? pack : pack.ops, isArray(pack) ? [] : pack.stack, isArray(pack) ? [] : pack.inputs);
    if (isObject(expectObject)) {
        expect(type).toMatchObject(expectObject);
    } else {
        expect(type).toEqual(expectObject);
    }
}

enum MyEnum {
    first, second, third
}

test('query', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.pointer, 0, ReflectionOp.query], stack: ['a'] }, {
        kind: ReflectionKind.number
    });
});

test('extends primitive', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.number, ReflectionOp.extends], stack: [] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.number, ReflectionOp.extends], stack: [1] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.number, ReflectionOp.extends], stack: ['asd'] }, false);
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.extends], stack: [] }, false);

    expectType({ ops: [ReflectionOp.string, ReflectionOp.string, ReflectionOp.extends], stack: [] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['asd'] }, true);
    expect(isExtendable({ kind: ReflectionKind.boolean }, { kind: ReflectionKind.boolean })).toBe(true);
    expect(isExtendable({ kind: ReflectionKind.literal, literal: true }, { kind: ReflectionKind.boolean })).toBe(true);
});

test('extends fn', () => {
    expect(isExtendable(
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.boolean }, parameters: [] },
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.boolean }, parameters: [] }
    )).toBe(true);

    expect(isExtendable(
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.string }, parameters: [] },
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.boolean }, parameters: [] }
    )).toBe(false);

    expect(isExtendable(
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.literal, literal: true }, parameters: [] },
        { kind: ReflectionKind.function, return: { kind: ReflectionKind.boolean }, parameters: [] }
    )).toBe(true);
});

test('arg', () => {
    //after initial stack, an implicit frame is created. arg references always relative to the current frame.
    expectType({ ops: [ReflectionOp.arg, 0], stack: ['a'] }, 'a');
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.arg, 0], stack: ['a'] }, 'a');

    //frame is started automatically when a sub routine is called, but we do it here manually to make sure arg works correctly
    expectType({ ops: [ReflectionOp.pointer, 1, ReflectionOp.pointer, 0, ReflectionOp.frame, ReflectionOp.arg, 0], stack: ['a', 'b'] }, 'a');
    expectType({ ops: [ReflectionOp.pointer, 1, ReflectionOp.pointer, 0, ReflectionOp.frame, ReflectionOp.arg, 1], stack: ['a', 'b'] }, 'b');
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.pointer, 0, ReflectionOp.frame, ReflectionOp.arg, 1], stack: ['a', 'b'] }, 'a');
});

test('call sub routine', () => {
    expectType({ ops: [ReflectionOp.jump, 4, ReflectionOp.string, ReflectionOp.return, ReflectionOp.call, 2], stack: [] }, { kind: ReflectionKind.string });
    expectType({ ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2], stack: [] }, { kind: ReflectionKind.number });
    expectType({ ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2, ReflectionOp.union], stack: [] }, {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.number }], //only number, since `return` returns only latest stack entry, not all
    });
    expectType({
        ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2, ReflectionOp.undefined, ReflectionOp.union],
        stack: []
    }, {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }],
    });
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.jump, 6, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2, ReflectionOp.undefined, ReflectionOp.union],
        stack: []
    }, {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }],
    });
});

test('type argument', () => {
    //type A<T> = T extends string;
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.arg, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['a'] }, true);
});

test('conditional', () => {
    //1 ? string : number
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [1] }, {
        kind: ReflectionKind.string
    });

    //0 ? string : number
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [0] }, {
        kind: ReflectionKind.number
    });
});

test('jump conditional', () => {
    //1 ? string : number
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2],
        stack: [1]
    }, {
        kind: ReflectionKind.string
    });

    //0 ? string : number
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2],
        stack: [0]
    }, {
        kind: ReflectionKind.number
    });

    //(0 ? string : number) | undefined
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2, ReflectionOp.undefined, ReflectionOp.union],
        stack: [0]
    }, {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }]
    });
});

test('object literal', () => {
    expectType({
        ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral],
        stack: ['a', 'b']
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.number }, name: 'a' },
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string }, name: 'b' },
        ]
    });

    expectType([ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral], {
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.indexSignature, index: { kind: ReflectionKind.string }, type: { kind: ReflectionKind.number } }
        ]
    });

    expectType({
        ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral],
        stack: ['a']
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.number }, name: 'a' },
            { kind: ReflectionKind.indexSignature, index: { kind: ReflectionKind.string }, type: { kind: ReflectionKind.number } }
        ]
    });

    expectType([ReflectionOp.string, ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.indexSignature, ReflectionOp.objectLiteral], {
        kind: ReflectionKind.objectLiteral,
        members: [
            {
                kind: ReflectionKind.indexSignature,
                index: { kind: ReflectionKind.string },
                type: { kind: ReflectionKind.union, members: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] }
            }
        ]
    });
});

test('method', () => {
    expectType({ ops: [ReflectionOp.string, ReflectionOp.method, 0], stack: ['name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.public,
        parameters: [],
        return: { kind: ReflectionKind.string }
    });
    expectType({ ops: [ReflectionOp.string, ReflectionOp.string, ReflectionOp.method, 0], stack: ['name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.public,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.string }
    });
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.method, 0, ReflectionOp.protected], stack: ['name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.protected,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.number }
    });
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.method, 0, ReflectionOp.protected, ReflectionOp.abstract,], stack: ['name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.protected,
        abstract: true,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.number }
    });
});

test('property', () => {
    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        visibility: ReflectionVisibility.public,
        type: { kind: ReflectionKind.string }
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.optional], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        optional: true,
        visibility: ReflectionVisibility.public,
        type: { kind: ReflectionKind.string }
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.protected], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        visibility: ReflectionVisibility.protected,
        type: { kind: ReflectionKind.string }
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.optional, ReflectionOp.protected], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        optional: true,
        visibility: ReflectionVisibility.protected,
        type: { kind: ReflectionKind.string }
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.optional, ReflectionOp.private], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        optional: true,
        visibility: ReflectionVisibility.private,
        type: { kind: ReflectionKind.string }
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.optional, ReflectionOp.abstract, ReflectionOp.private], stack: ['name'] }, {
        kind: ReflectionKind.property,
        name: 'name',
        optional: true,
        abstract: true,
        visibility: ReflectionVisibility.private,
        type: { kind: ReflectionKind.string }
    });
});

test('class', () => {
    class MyClass {}

    expectType({
        ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.number, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['name', 'id']
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        members: [{
            kind: ReflectionKind.property,
            name: 'name',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.string }
        }, {
            kind: ReflectionKind.property,
            name: 'id',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.number }
        }]
    });
});

test('mapped type simple', () => {
    type A<T extends string> = { [P in T]: boolean };
    type B = { [P in 'a' | 'b']: boolean };
    type B1 = A<'a' | 'b'>;

    expectType({
        ops: [
            ReflectionOp.jump, 4,
            ReflectionOp.boolean, ReflectionOp.return,
            ReflectionOp.template, 0, ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.mappedType, 2, 0
        ],
        stack: ['T'],
        inputs: [{ kind: ReflectionKind.union, members: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] } as TypeUnion]
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.boolean }
        }, {
            kind: ReflectionKind.propertySignature,
            name: 'b',
            type: { kind: ReflectionKind.boolean }
        }]
    });
});

test('mapped type optional simple', () => {
    type A<T extends string> = { [P in T]: boolean };
    type B = { [P in 'a' | 'b']: boolean };
    type B1 = A<'a' | 'b'>;

    expectType({
        ops: [
            ReflectionOp.jump, 4,
            ReflectionOp.boolean, ReflectionOp.return,
            ReflectionOp.template, 0, ReflectionOp.var, ReflectionOp.loads, 0, 0, ReflectionOp.mappedType, 2, 0 | MappedModifier.optional
        ],
        stack: ['T'],
        inputs: [{ kind: ReflectionKind.union, members: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] } as TypeUnion]
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.boolean },
            optional: true,
        }, {
            kind: ReflectionKind.propertySignature,
            name: 'b',
            type: { kind: ReflectionKind.boolean },
            optional: true,
        }]
    });
});

test('mapped type keyof and query', () => {
    type A<T> = { [P in keyof T]: T[P] };
    type B1 = A<{ a: number, b: string }>;

    expectType({
        ops: [
            ReflectionOp.template, 0,
            ReflectionOp.jump, 12,
            ReflectionOp.loads, 2, 0, ReflectionOp.loads, 1, 0, ReflectionOp.query, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4, 0
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, members: [{
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.number }
            }, {
                kind: ReflectionKind.propertySignature,
                name: 'b',
                type: { kind: ReflectionKind.string }
            }]
        } as TypeObjectLiteral]
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.number }
        }, {
            kind: ReflectionKind.propertySignature,
            name: 'b',
            type: { kind: ReflectionKind.string }
        }]
    });
});

test('mapped type keyof and fixed', () => {
    type A<T> = { [P in keyof T]: boolean };
    type B1 = A<{ a: number, b: string }>;

    expectType({
        ops: [
            ReflectionOp.template, 0,
            ReflectionOp.jump, 6,
            ReflectionOp.boolean, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, members: [{
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.number }
            }, {
                kind: ReflectionKind.propertySignature,
                name: 'b',
                type: { kind: ReflectionKind.string }
            }]
        } as TypeObjectLiteral]
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.boolean }
        }, {
            kind: ReflectionKind.propertySignature,
            name: 'b',
            type: { kind: ReflectionKind.boolean }
        }]
    });
});

test('mapped type keyof and conditional', () => {
    type A<T> = { [P in keyof T]: T[P] extends number ? boolean : never };
    type B1 = A<{ a: number, b: string }>;

    expectType({
        ops: [
            ReflectionOp.template, 0,
            ReflectionOp.jump, 18,
            ReflectionOp.frame, ReflectionOp.loads, 3, 0, ReflectionOp.loads, 2, 0, ReflectionOp.query, ReflectionOp.number, ReflectionOp.extends, ReflectionOp.boolean, ReflectionOp.never, ReflectionOp.condition, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, members: [{
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.number }
            }, {
                kind: ReflectionKind.propertySignature,
                name: 'b',
                type: { kind: ReflectionKind.string }
            }]
        } as TypeObjectLiteral]
    }, {
        kind: ReflectionKind.objectLiteral,
        members: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.boolean }
        }, {
            kind: ReflectionKind.propertySignature,
            name: 'b',
            type: { kind: ReflectionKind.never }
        }]
    });
});

test('infer property signature', () => {
    type A<T> = T extends { a: infer K } ? K : never;
    type B1 = A<{ a: number }>;

    expectType({
        ops: [
            ReflectionOp.template, 0,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.frame, ReflectionOp.infer, 1, 0, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral, ReflectionOp.extends,
            ReflectionOp.loads, 0, 0, ReflectionOp.never, ReflectionOp.condition,
        ],
        stack: ['T', 'a'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, members: [{
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.number }
            }]
        }]
    }, { kind: ReflectionKind.number });
});

// test('infer function parameters', () => {
//     type A<T> = T extends (...args: infer K) => any ? K : never;
//     type B1 = A<(a: string, b: number) => void>;
//
//     expectType({
//         ops: [],
//         stack: ['T'],
//         inputs: []
//     }, {});
// });
//
// test('infer index signature', () => {
//     type A<T> = T extends { [name: string]: infer K } ? K : never;
//     type B1 = A<{ a: number, b: string }>;
//
//     expectType({
//         ops: [],
//         stack: ['T'],
//         inputs: []
//     }, {});
// });


test('generic class', () => {
    class MyClass<T> {
        name!: T;
    }

    expectType({
        ops: [ReflectionOp.template, 0, ReflectionOp.loads, 0, 0, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['T', 'name'],
        inputs: [{ kind: ReflectionKind.string }]
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        members: [{
            kind: ReflectionKind.property,
            name: 'name',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.string }
        }]
    });

    expectType({
        ops: [ReflectionOp.template, 0, ReflectionOp.loads, 0, 0, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['T', 'name']
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        members: [{
            kind: ReflectionKind.property,
            name: 'name',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.template, name: 'T' }
        }]
    });
});

test('basic types', () => {
    expectType([ReflectionOp.string], { kind: ReflectionKind.string });
    expectType([ReflectionOp.number], { kind: ReflectionKind.number });
    expectType([ReflectionOp.boolean], { kind: ReflectionKind.boolean });
    expectType([ReflectionOp.void], { kind: ReflectionKind.void });
    expectType([ReflectionOp.undefined], { kind: ReflectionKind.undefined });
    expectType([ReflectionOp.bigint], { kind: ReflectionKind.bigint });
    expectType([ReflectionOp.null], { kind: ReflectionKind.null });
    expectType({ ops: [ReflectionOp.literal, 0], stack: ['a'] }, { kind: ReflectionKind.literal, literal: 'a' });
});

test('more advances types', () => {
    class Entity {}

    expectType([ReflectionOp.undefined, ReflectionOp.string, ReflectionOp.union], {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

    expectType([ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.string, ReflectionOp.union], {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

    expectType([ReflectionOp.date], { kind: ReflectionKind.class, classType: Date, members: [] });
    expectType([ReflectionOp.uint8Array], { kind: ReflectionKind.class, classType: Uint8Array, members: [] });
    expectType([ReflectionOp.int8Array], { kind: ReflectionKind.class, classType: Int8Array, members: [] });
    expectType([ReflectionOp.uint8ClampedArray], { kind: ReflectionKind.class, classType: Uint8ClampedArray, members: [] });
    expectType([ReflectionOp.uint16Array], { kind: ReflectionKind.class, classType: Uint16Array, members: [] });
    expectType([ReflectionOp.int16Array], { kind: ReflectionKind.class, classType: Int16Array, members: [] });
    expectType([ReflectionOp.uint32Array], { kind: ReflectionKind.class, classType: Uint32Array, members: [] });
    expectType([ReflectionOp.int32Array], { kind: ReflectionKind.class, classType: Int32Array, members: [] });
    expectType([ReflectionOp.float32Array], { kind: ReflectionKind.class, classType: Float32Array, members: [] });
    expectType([ReflectionOp.float64Array], { kind: ReflectionKind.class, classType: Float64Array, members: [] });
    expectType([ReflectionOp.bigInt64Array], { kind: ReflectionKind.class, classType: BigInt64Array, members: [] });
    expectType([ReflectionOp.arrayBuffer], { kind: ReflectionKind.class, classType: ArrayBuffer, members: [] });

    expectType([ReflectionOp.string, ReflectionOp.promise], { kind: ReflectionKind.promise, type: { kind: ReflectionKind.string } });

    expectType({ ops: [ReflectionOp.enum, 0], stack: [() => MyEnum] }, { kind: ReflectionKind.enum, enumType: MyEnum });
    expectType([ReflectionOp.string, ReflectionOp.set], { kind: ReflectionKind.class, classType: Set, types: [{ kind: ReflectionKind.string }] });
    expectType([ReflectionOp.string, ReflectionOp.number, ReflectionOp.map], {
        kind: ReflectionKind.class, classType: Map, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]
    });

    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union], {
        kind: ReflectionKind.union,
        members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }]
    });

    expectType([ReflectionOp.frame, ReflectionOp.string, ReflectionOp.void, ReflectionOp.function], {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.void },
    });

    expectType([ReflectionOp.string, ReflectionOp.void, ReflectionOp.function], {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.void },
    });

    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.void, ReflectionOp.function], {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.union, members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] }],
        return: { kind: ReflectionKind.void },
    });

    expectType([
        ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union,
        ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union,
        ReflectionOp.void, ReflectionOp.function
    ], {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.union, members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
            { kind: ReflectionKind.union, members: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] },
        ],
        return: { kind: ReflectionKind.void },
    });

    expectType([ReflectionOp.string, ReflectionOp.array], { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } });
    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.array], {
        kind: ReflectionKind.array, elementType: { kind: ReflectionKind.union, members: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
    });

    expectType([ReflectionOp.string, ReflectionOp.array, ReflectionOp.void, ReflectionOp.function], {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } },
        ],
        return: { kind: ReflectionKind.void },
    });
});
