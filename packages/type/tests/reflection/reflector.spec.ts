/** @reflection never */
import { expect, test } from '@jest/globals';
import { PackStruct, ReflectionOp } from '../../src/reflection';
import { extractPackStruct, ReflectionKind, ReflectionVisibility, Type } from '../../src/reflector';

Error.stackTraceLimit = 200;

function expectType(pack: PackStruct, expectObject: Partial<Type>): void {
    const type = extractPackStruct(pack);
    expect(type).toMatchObject(expectObject);
}

enum MyEnum {
    first, second, third
}

class MyClass {
    title!: string;
}

test('extract method', () => {
    expectType(new PackStruct([ReflectionOp.method, ReflectionOp.string]), {
        kind: ReflectionKind.method,
        visibility: ReflectionVisibility.public,
        parameters: [],
        return: { kind: ReflectionKind.string }
    });
    expectType(new PackStruct([ReflectionOp.method, ReflectionOp.string, ReflectionOp.string]), {
        kind: ReflectionKind.method,
        visibility: ReflectionVisibility.public,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.string }
    });
    expectType(new PackStruct([ReflectionOp.method, ReflectionOp.protected, ReflectionOp.string, ReflectionOp.string]), {
        kind: ReflectionKind.method,
        visibility: ReflectionVisibility.protected,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.string }
    });
    expectType(new PackStruct([ReflectionOp.method, ReflectionOp.protected, ReflectionOp.abstract, ReflectionOp.string, ReflectionOp.string]), {
        kind: ReflectionKind.method,
        visibility: ReflectionVisibility.protected,
        abstract: true,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.string }
    });
});

test('extract property', () => {
    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        visibility: ReflectionVisibility.public,
        type: { kind: ReflectionKind.string }
    });

    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.optional, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        optional: true,
        visibility: ReflectionVisibility.public,
        type: { kind: ReflectionKind.string }
    });

    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.protected, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        visibility: ReflectionVisibility.protected,
        type: { kind: ReflectionKind.string }
    });

    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.optional, ReflectionOp.protected, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        optional: true,
        visibility: ReflectionVisibility.protected,
        type: { kind: ReflectionKind.string }
    });

    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.optional, ReflectionOp.private, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        optional: true,
        visibility: ReflectionVisibility.private,
        type: { kind: ReflectionKind.string }
    });

    expectType(new PackStruct([ReflectionOp.property, ReflectionOp.optional, ReflectionOp.abstract, ReflectionOp.private, ReflectionOp.string]), {
        kind: ReflectionKind.property,
        optional: true,
        abstract: true,
        visibility: ReflectionVisibility.private,
        type: { kind: ReflectionKind.string }
    });
});

test('extract all', () => {
    expectType(new PackStruct([ReflectionOp.string]), { kind: ReflectionKind.string });
    expectType(new PackStruct([ReflectionOp.number]), { kind: ReflectionKind.number });
    expectType(new PackStruct([ReflectionOp.boolean]), { kind: ReflectionKind.boolean });
    expectType(new PackStruct([ReflectionOp.void]), { kind: ReflectionKind.void });
    expectType(new PackStruct([ReflectionOp.undefined]), { kind: ReflectionKind.undefined });
    expectType(new PackStruct([ReflectionOp.bigint]), { kind: ReflectionKind.bigint });
    expectType(new PackStruct([ReflectionOp.null]), { kind: ReflectionKind.null });
    expectType(new PackStruct([ReflectionOp.literal], ['a']), { kind: ReflectionKind.literal, literal: 'a' });

    expectType(new PackStruct([ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.up]), {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }]
    });

    expectType(new PackStruct([ReflectionOp.class], [() => Uint32Array]), { kind: ReflectionKind.class, classType: Uint32Array, types: [] });
    expectType(new PackStruct([ReflectionOp.date]), { kind: ReflectionKind.class, classType: Date, types: [] });
    expectType(new PackStruct([ReflectionOp.uint8Array]), { kind: ReflectionKind.class, classType: Uint8Array, types: [] });
    expectType(new PackStruct([ReflectionOp.int8Array]), { kind: ReflectionKind.class, classType: Int8Array, types: [] });
    expectType(new PackStruct([ReflectionOp.uint8ClampedArray]), { kind: ReflectionKind.class, classType: Uint8ClampedArray, types: [] });
    expectType(new PackStruct([ReflectionOp.uint16Array]), { kind: ReflectionKind.class, classType: Uint16Array, types: [] });
    expectType(new PackStruct([ReflectionOp.int16Array]), { kind: ReflectionKind.class, classType: Int16Array, types: [] });
    expectType(new PackStruct([ReflectionOp.uint32Array]), { kind: ReflectionKind.class, classType: Uint32Array, types: [] });
    expectType(new PackStruct([ReflectionOp.int32Array]), { kind: ReflectionKind.class, classType: Int32Array, types: [] });
    expectType(new PackStruct([ReflectionOp.float32Array]), { kind: ReflectionKind.class, classType: Float32Array, types: [] });
    expectType(new PackStruct([ReflectionOp.float64Array]), { kind: ReflectionKind.class, classType: Float64Array, types: [] });
    expectType(new PackStruct([ReflectionOp.bigInt64Array]), { kind: ReflectionKind.class, classType: BigInt64Array, types: [] });
    expectType(new PackStruct([ReflectionOp.arrayBuffer]), { kind: ReflectionKind.class, classType: ArrayBuffer, types: [] });

    expectType(new PackStruct([ReflectionOp.promise, ReflectionOp.string]), { kind: ReflectionKind.promise, type: { kind: ReflectionKind.string } });
    expectType(new PackStruct([ReflectionOp.partial, ReflectionOp.class], [() => MyClass]), {
        kind: ReflectionKind.partial,
        type: { kind: ReflectionKind.class, classType: MyClass, types: [] }
    });

    expectType(new PackStruct([ReflectionOp.partial, ReflectionOp.class], [() => MyClass]), {
        kind: ReflectionKind.partial,
        type: { kind: ReflectionKind.class, classType: MyClass, types: [] }
    });

    expectType(new PackStruct([ReflectionOp.genericClass, ReflectionOp.string, ReflectionOp.up], [Date]), {
        kind: ReflectionKind.class, classType: Date, types: [{ kind: ReflectionKind.string }]
    });
    expectType(new PackStruct([ReflectionOp.genericClass, ReflectionOp.string], [Date]), { kind: ReflectionKind.class, classType: Date, types: [{ kind: ReflectionKind.string }] });
    expectType(new PackStruct([ReflectionOp.enum], [() => MyEnum]), { kind: ReflectionKind.enum, enumType: MyEnum });
    expectType(new PackStruct([ReflectionOp.set, ReflectionOp.string]), { kind: ReflectionKind.class, classType: Set, types: [{ kind: ReflectionKind.string }] });
    expectType(new PackStruct([ReflectionOp.map, ReflectionOp.string, ReflectionOp.number]), {
        kind: ReflectionKind.class, classType: Map, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]
    });

    expectType(new PackStruct([ReflectionOp.record, ReflectionOp.string, ReflectionOp.number]), {
        kind: ReflectionKind.record, key: { kind: ReflectionKind.string }, value: { kind: ReflectionKind.number }
    });

    //last ReflectionOp.up is optional
    expectType(new PackStruct([ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined]), {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }]
    });

    expectType(new PackStruct([ReflectionOp.function, ReflectionOp.string, ReflectionOp.void, ReflectionOp.up]), {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.void },
    });

    //last ReflectionOp.up is optional
    expectType(new PackStruct([ReflectionOp.function, ReflectionOp.string, ReflectionOp.void]), {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.string }],
        return: { kind: ReflectionKind.void },
    });

    expectType(new PackStruct([ReflectionOp.function, ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.up, ReflectionOp.void]), {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] }],
        return: { kind: ReflectionKind.void },
    });

    expectType(new PackStruct([ReflectionOp.function,
        ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.up,
        ReflectionOp.union, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.up,
        ReflectionOp.void]), {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
            { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] },
        ],
        return: { kind: ReflectionKind.void },
    });

    expectType(new PackStruct([ReflectionOp.array, ReflectionOp.string]), { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } });
    expectType(new PackStruct([ReflectionOp.array, ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.up]), {
        kind: ReflectionKind.array, elementType: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
    });

    expectType(new PackStruct([ReflectionOp.array, ReflectionOp.class], [() => Uint32Array]), {
        kind: ReflectionKind.array, elementType: { kind: ReflectionKind.class, classType: Uint32Array, types: [] }
    });

    expectType(new PackStruct([ReflectionOp.function, ReflectionOp.array, ReflectionOp.string, ReflectionOp.void]), {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.string } },
        ],
        return: { kind: ReflectionKind.void },
    });
});
