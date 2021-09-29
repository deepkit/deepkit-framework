/** @reflection never */
import { expect, test } from '@jest/globals';
import { Processor } from '../../src/reflection/processor';
import { ReflectionKind, ReflectionVisibility, Type } from '../../src/reflection/type';
import { ReflectionOp, RuntimeStackEntry } from '../../src/reflection/compiler';
import { isArray, isObject } from '@deepkit/core';

Error.stackTraceLimit = 200;

function expectType(pack: ReflectionOp[] | { ops: ReflectionOp[], stack: RuntimeStackEntry[] }, expectObject: Partial<Type> | number | string | boolean): void {
    const processor = new Processor();
    const type = processor.run(isArray(pack) ? pack : pack.ops, isArray(pack) ? [] : pack.stack);
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

test('extends', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.number, ReflectionOp.extends], stack: [] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.number, ReflectionOp.extends], stack: [1] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.number, ReflectionOp.extends], stack: ['asd'] }, false);
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.extends], stack: [] }, false);

    expectType({ ops: [ReflectionOp.string, ReflectionOp.string, ReflectionOp.extends], stack: [] }, true);
    expectType({ ops: [ReflectionOp.pointer, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['asd'] }, true);
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
        types: [{ kind: ReflectionKind.number }], //only number, since `return` returns only latest stack entry, not all
    });
    expectType({
        ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2, ReflectionOp.undefined, ReflectionOp.union],
        stack: []
    }, {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }],
    });
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.jump, 6, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2, ReflectionOp.undefined, ReflectionOp.union],
        stack: []
    }, {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }],
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
    expectType({ ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2], stack: [1] }, {
        kind: ReflectionKind.string
    });

    //0 ? string : number
    expectType({ ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2], stack: [0] }, {
        kind: ReflectionKind.number
    });

    //(0 ? string : number) | undefined
    expectType({ ops: [ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.pointer, 0, ReflectionOp.jumpCondition, 0, 2, ReflectionOp.undefined, ReflectionOp.union], stack: [0] }, {
        kind: ReflectionKind.union,
        types: [{kind: ReflectionKind.number}, {kind: ReflectionKind.undefined}]
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
                type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] }
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
        types: [{ kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

    expectType([ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.string, ReflectionOp.union], {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

    expectType({ ops: [ReflectionOp.class, 0], stack: [() => Entity] }, { kind: ReflectionKind.class, classType: Entity, types: [] });
    expectType([ReflectionOp.date], { kind: ReflectionKind.class, classType: Date, types: [] });
    expectType([ReflectionOp.uint8Array], { kind: ReflectionKind.class, classType: Uint8Array, types: [] });
    expectType([ReflectionOp.int8Array], { kind: ReflectionKind.class, classType: Int8Array, types: [] });
    expectType([ReflectionOp.uint8ClampedArray], { kind: ReflectionKind.class, classType: Uint8ClampedArray, types: [] });
    expectType([ReflectionOp.uint16Array], { kind: ReflectionKind.class, classType: Uint16Array, types: [] });
    expectType([ReflectionOp.int16Array], { kind: ReflectionKind.class, classType: Int16Array, types: [] });
    expectType([ReflectionOp.uint32Array], { kind: ReflectionKind.class, classType: Uint32Array, types: [] });
    expectType([ReflectionOp.int32Array], { kind: ReflectionKind.class, classType: Int32Array, types: [] });
    expectType([ReflectionOp.float32Array], { kind: ReflectionKind.class, classType: Float32Array, types: [] });
    expectType([ReflectionOp.float64Array], { kind: ReflectionKind.class, classType: Float64Array, types: [] });
    expectType([ReflectionOp.bigInt64Array], { kind: ReflectionKind.class, classType: BigInt64Array, types: [] });
    expectType([ReflectionOp.arrayBuffer], { kind: ReflectionKind.class, classType: ArrayBuffer, types: [] });

    expectType([ReflectionOp.string, ReflectionOp.promise], { kind: ReflectionKind.promise, type: { kind: ReflectionKind.string } });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.class, 0], stack: [() => Entity] }, {
        kind: ReflectionKind.class, classType: Entity, types: [{ kind: ReflectionKind.string }]
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.class, 0], stack: [() => Entity] }, {
        kind: ReflectionKind.class,
        classType: Entity,
        types: [{ kind: ReflectionKind.string }]
    });
    expectType({ ops: [ReflectionOp.enum, 0], stack: [() => MyEnum] }, { kind: ReflectionKind.enum, enumType: MyEnum });
    expectType([ReflectionOp.string, ReflectionOp.set], { kind: ReflectionKind.class, classType: Set, types: [{ kind: ReflectionKind.string }] });
    expectType([ReflectionOp.string, ReflectionOp.number, ReflectionOp.map], {
        kind: ReflectionKind.class, classType: Map, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]
    });

    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union], {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }]
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
        parameters: [{ kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] }],
        return: { kind: ReflectionKind.void },
    });

    expectType([
        ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union,
        ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union,
        ReflectionOp.void, ReflectionOp.function
    ], {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
            { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] },
        ],
        return: { kind: ReflectionKind.void },
    });

    expectType([ReflectionOp.string, ReflectionOp.array], { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } });
    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.array], {
        kind: ReflectionKind.array, elementType: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
    });

    expectType({ ops: [ReflectionOp.class, 0, ReflectionOp.array], stack: [() => Uint32Array] }, {
        kind: ReflectionKind.array, elementType: { kind: ReflectionKind.class, classType: Uint32Array, types: [] }
    });

    expectType([ReflectionOp.string, ReflectionOp.array, ReflectionOp.void, ReflectionOp.function], {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } },
        ],
        return: { kind: ReflectionKind.void },
    });
});
