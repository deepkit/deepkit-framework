/** @reflection never */
import { expect, test } from '@jest/globals';
import { executeType } from '../../src/reflection/processor';
import { ReflectionKind, ReflectionVisibility, Type } from '../../src/reflection/type';
import { ReflectionOp, RuntimeStackEntry } from '../../src/reflection/compiler';
import { isArray, isObject } from '@deepkit/core';

Error.stackTraceLimit = 200;

function expectType(pack: ReflectionOp[] | { ops: ReflectionOp[], stack: RuntimeStackEntry[] }, expectObject: Partial<Type> | number | string | boolean): void {
    const type = executeType(isArray(pack) ? pack : pack.ops, isArray(pack) ? [] : pack.stack);
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
    expectType({ ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.push, 0, ReflectionOp.query], stack: ['a']}, {
        kind: ReflectionKind.number
    });
});

test('extends', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.number, ReflectionOp.extends], stack: []}, true);
    expectType({ ops: [ReflectionOp.push, 0, ReflectionOp.number, ReflectionOp.extends], stack: [1]}, true);
    expectType({ ops: [ReflectionOp.push, 0, ReflectionOp.number, ReflectionOp.extends], stack: ['asd']}, false);
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.extends], stack: []}, false);

    expectType({ ops: [ReflectionOp.string, ReflectionOp.string, ReflectionOp.extends], stack: []}, true);
    expectType({ ops: [ReflectionOp.push, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['asd']}, true);
});

test('type argument', () => {
    // expectType({ ops: [ReflectionOp.t, ReflectionOp.number, ReflectionOp.extends], stack: []}, true);
});

test('conditional', () => {
    expectType({ ops: [ReflectionOp.push, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [1]}, {
        kind: ReflectionKind.string
    });

    expectType({ ops: [ReflectionOp.push, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [0]}, {
        kind: ReflectionKind.number
    });
});

test('object literal', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral], stack: ['a', 'b'] }, {
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

    expectType({ ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral], stack: ['a']}, {
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
