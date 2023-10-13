/** @reflection never */
import { expect, test } from '@jest/globals';
import { pack } from '../src/reflection/processor.js';
import {
    assertType,
    copyAndSetParent,
    findMember,
    ParentLessType,
    ReflectionKind,
    ReflectionVisibility,
    TypeObjectLiteral,
    TypePropertySignature,
    TypeUnion
} from '../src/reflection/type.js';
import { MappedModifier, ReflectionOp } from '@deepkit/type-spec';
import { isExtendable } from '../src/reflection/extends.js';
import { assertValidParent, expectEqualType, expectType } from './utils.js';
import { typeOf } from '../src/reflection/reflection.js';

Error.stackTraceLimit = 200;

test('assertEqualType 1', () => {
    expectEqualType({ kind: ReflectionKind.string }, { kind: ReflectionKind.string });
    expectEqualType({ kind: ReflectionKind.number }, { kind: ReflectionKind.number });
    expectEqualType({ kind: ReflectionKind.literal, literal: 'asd' }, { kind: ReflectionKind.literal, literal: 'asd' });
    expect(() => expectEqualType({ kind: ReflectionKind.literal, literal: 'asd' }, {
        kind: ReflectionKind.literal,
        literal: 'asd2'
    })).toThrow('Invalid type .literal: asd !== asd2');

    const a: ParentLessType = { kind: ReflectionKind.tuple, types: [{ kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.string } }] };
    expectEqualType(a, a);
    expect(() => expectEqualType(a, {
        kind: ReflectionKind.tuple,
        types: [{ kind: ReflectionKind.tupleMember, type: { kind: ReflectionKind.number } }]
    })).toThrow('Invalid type .types.0.type.kind: 5 !== 6');

    const b: ParentLessType = {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'b', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.never }
    };
    expectEqualType(b, b);
    expect(() => expectEqualType(b, {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'c', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.never }
    })).toThrow('Invalid type .parameters.0.name');
    expect(() => expectEqualType(b, {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'b', type: { kind: ReflectionKind.number } }],
        return: { kind: ReflectionKind.never }
    })).toThrow('Invalid type .parameters.0.type.kind');
    expect(() => expectEqualType(b, {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'b', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.number }
    })).toThrow('Invalid type .return.kind');
});

test('assertEqualType 2', () => {
    assertValidParent({ kind: ReflectionKind.string });
    assertValidParent({ kind: ReflectionKind.literal, literal: 'asd' });
    assertValidParent(copyAndSetParent({ kind: ReflectionKind.literal, literal: 'asd' }));
    expect(() => assertValidParent({ kind: ReflectionKind.literal, literal: 'asd', parent: Object as any })).toThrow('Parent was set, but not expected at');
});


enum MyEnum {
    first, second, third
}


test('simple', () => {
    expectType([ReflectionOp.string], { kind: ReflectionKind.string });
    expectType([ReflectionOp.string, ReflectionOp.number], { kind: ReflectionKind.number });
});

test('query', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.literal, 0, ReflectionOp.indexAccess], stack: ['a'] }, {
        kind: ReflectionKind.number
    });
});

test('inline', () => {
    const external = pack([ReflectionOp.string]);
    expectType({ ops: [ReflectionOp.inline, 0], stack: [external] }, { kind: ReflectionKind.string });
});

test('extends primitive', () => {
    expectType({ ops: [ReflectionOp.number, ReflectionOp.number, ReflectionOp.extends], stack: [] }, { kind: ReflectionKind.literal, literal: true });
    // expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.number, ReflectionOp.extends], stack: [1] }, true);
    // expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.number, ReflectionOp.extends], stack: ['asd'] }, false);
    expectType({ ops: [ReflectionOp.string, ReflectionOp.number, ReflectionOp.extends], stack: [] }, { kind: ReflectionKind.literal, literal: false });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.string, ReflectionOp.extends], stack: [] }, { kind: ReflectionKind.literal, literal: true });
    // expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['asd'] }, true);
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
    expectType({ ops: [ReflectionOp.arg, 0], stack: [{ kind: ReflectionKind.literal, literal: 'a' }] }, { kind: ReflectionKind.literal, literal: 'a' });
    // expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.arg, 0], stack: ['a'] }, 'a');

    //frame is started automatically when a sub routine is called, but we do it here manually to make sure arg works correctly
    // expectType({ ops: [ReflectionOp.arg, 1, ReflectionOp.arg, 0, ReflectionOp.frame, ReflectionOp.arg, 0], stack: ['a', 'b'] }, 'a');
    // expectType({ ops: [ReflectionOp.arg, 1, ReflectionOp.arg, 0, ReflectionOp.frame, ReflectionOp.arg, 1], stack: ['a', 'b'] }, 'b');
    // expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.arg, 0, ReflectionOp.frame, ReflectionOp.arg, 1], stack: ['a', 'b'] }, 'a');
});

test('call sub routine', () => {
    expectType({ ops: [ReflectionOp.jump, 4, ReflectionOp.string, ReflectionOp.return, ReflectionOp.call, 2], stack: [] }, { kind: ReflectionKind.string });
    expectType({ ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.call, 2], stack: [] }, { kind: ReflectionKind.number });
    expectType({
        ops: [ReflectionOp.jump, 5, ReflectionOp.string, ReflectionOp.number, ReflectionOp.return, ReflectionOp.boolean, ReflectionOp.call, 2, ReflectionOp.union],
        stack: []
    }, {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.boolean }, { kind: ReflectionKind.number }], //not string, since `return` returns only latest stack entry, not all
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
    expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.arg, 0, ReflectionOp.string, ReflectionOp.extends], stack: ['a'] }, { kind: ReflectionKind.literal, literal: true });
});

test('conditional', () => {
    //1 ? string : number
    expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [1] }, {
        kind: ReflectionKind.string
    });

    //0 ? string : number
    expectType({ ops: [ReflectionOp.arg, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.condition], stack: [0] }, {
        kind: ReflectionKind.number
    });
});

test('jump conditional', () => {
    //1 ? string : number
    expectType({
        ops: [ReflectionOp.jump, 6, ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.arg, 0, ReflectionOp.jumpCondition, 2, 4],
        stack: [1]
    }, {
        kind: ReflectionKind.string
    });

    //0 ? string : number
    expectType({
        ops: [ReflectionOp.jump, 6, ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.arg, 0, ReflectionOp.jumpCondition, 2, 4],
        stack: [0]
    }, {
        kind: ReflectionKind.number
    });

    //(0 ? string : number) | undefined
    expectType({
        ops: [ReflectionOp.jump, 6, ReflectionOp.string, ReflectionOp.return, ReflectionOp.number, ReflectionOp.return, ReflectionOp.arg, 0, ReflectionOp.jumpCondition, 2, 4, ReflectionOp.undefined, ReflectionOp.union],
        stack: [0]
    }, {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }]
    });
});

test('object literal', () => {
    expectType({
        ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral],
        stack: ['a', 'b']
    }, {
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.number }, name: 'a' },
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string }, name: 'b' },
        ]
    });

    expectType([ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral], copyAndSetParent({
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.indexSignature, index: { kind: ReflectionKind.string }, type: { kind: ReflectionKind.number } }
        ]
    }));

    expectType({
        ops: [ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral],
        stack: ['a']
    }, {
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.number }, name: 'a' },
            { kind: ReflectionKind.indexSignature, index: { kind: ReflectionKind.string }, type: { kind: ReflectionKind.number } }
        ]
    });

    expectType([ReflectionOp.string, ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.indexSignature, ReflectionOp.objectLiteral], {
        kind: ReflectionKind.objectLiteral,
        types: [
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
    expectType({ ops: [ReflectionOp.string, ReflectionOp.parameter, 0, ReflectionOp.string, ReflectionOp.method, 1], stack: ['param', 'name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.public,
        parameters: [{ kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.string }
    });
    expectType({ ops: [ReflectionOp.string, ReflectionOp.parameter, 0, ReflectionOp.number, ReflectionOp.method, 1, ReflectionOp.protected], stack: ['param', 'name'] }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.protected,
        parameters: [{ kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.number }
    });
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.parameter, 0, ReflectionOp.number, ReflectionOp.method, 1, ReflectionOp.protected, ReflectionOp.abstract],
        stack: ['param', 'name']
    }, {
        kind: ReflectionKind.method,
        name: 'name',
        visibility: ReflectionVisibility.protected,
        abstract: true,
        parameters: [{ kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.string } }],
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
    expectType({
        ops: [ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.number, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['name', 'id']
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        types: [{
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
            ReflectionOp.typeParameter, 0, ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.mappedType, 2, 0
        ],
        stack: ['T'],
        inputs: [{ kind: ReflectionKind.union, types: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] } as TypeUnion]
    }, {
        kind: ReflectionKind.objectLiteral,
        types: [{
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
            ReflectionOp.typeParameter, 0, ReflectionOp.var, ReflectionOp.loads, 0, 0, ReflectionOp.mappedType, 2, 0 | MappedModifier.optional
        ],
        stack: ['T'],
        inputs: [{ kind: ReflectionKind.union, types: [{ kind: ReflectionKind.literal, literal: 'a' }, { kind: ReflectionKind.literal, literal: 'b' }] } as TypeUnion]
    }, {
        kind: ReflectionKind.objectLiteral,
        types: [{
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
            ReflectionOp.typeParameter, 0,
            ReflectionOp.jump, 12,
            ReflectionOp.loads, 2, 0, ReflectionOp.loads, 1, 0, ReflectionOp.indexAccess, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4, 0
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, types: [{
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
        types: [{
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
            ReflectionOp.typeParameter, 0,
            ReflectionOp.jump, 6,
            ReflectionOp.boolean, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4, 0
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, types: [{
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
        types: [{
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
            ReflectionOp.typeParameter, 0,
            ReflectionOp.jump, 18,
            ReflectionOp.frame, ReflectionOp.loads, 3, 0, ReflectionOp.loads, 2, 0, ReflectionOp.indexAccess, ReflectionOp.number, ReflectionOp.extends, ReflectionOp.boolean, ReflectionOp.never, ReflectionOp.condition, ReflectionOp.return,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.keyof, ReflectionOp.mappedType, 4, 0
        ],
        stack: ['T'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, types: [{
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
        types: [{
            kind: ReflectionKind.propertySignature,
            name: 'a',
            type: { kind: ReflectionKind.boolean }
        }]
    });
});

test('infer property signature', () => {
    type A<T> = T extends { a: infer K } ? K : never;
    type B1 = A<{ a: number }>;

    expectType({
        ops: [
            ReflectionOp.typeParameter, 0,
            ReflectionOp.frame, ReflectionOp.var, ReflectionOp.loads, 1, 0, ReflectionOp.frame, ReflectionOp.infer, 1, 0, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral, ReflectionOp.extends,
            ReflectionOp.loads, 0, 0, ReflectionOp.never, ReflectionOp.condition,
        ],
        stack: ['T', 'a'],
        inputs: [{
            kind: ReflectionKind.objectLiteral, types: [{
                kind: ReflectionKind.propertySignature,
                name: 'a',
                type: { kind: ReflectionKind.number }
            }]
        } as TypeObjectLiteral]
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
        ops: [ReflectionOp.typeParameter, 0, ReflectionOp.loads, 0, 0, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['T', 'name'],
        inputs: [{ kind: ReflectionKind.string }]
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        types: [{
            kind: ReflectionKind.property,
            name: 'name',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.string }
        }]
    });

    expectType({
        ops: [ReflectionOp.typeParameter, 0, ReflectionOp.loads, 0, 0, ReflectionOp.property, 1, ReflectionOp.class],
        stack: ['T', 'name']
    }, {
        kind: ReflectionKind.class,
        classType: Object,
        types: [{
            kind: ReflectionKind.property,
            name: 'name',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.typeParameter, name: 'T' }
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
    class Entity {
    }

    expectType([ReflectionOp.undefined, ReflectionOp.string, ReflectionOp.union], {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

    expectType([ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.string, ReflectionOp.union], {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }, { kind: ReflectionKind.string }]
    });

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

    // expectType([ReflectionOp.string, ReflectionOp.promise], { kind: ReflectionKind.promise, type: { kind: ReflectionKind.string } });

    // expectType({ ops: [ReflectionOp.enum, 0], stack: [() => MyEnum] }, { kind: ReflectionKind.enum, enum: MyEnum, values: Object.keys(MyEnum) });
    expectType([ReflectionOp.string, ReflectionOp.set], { kind: ReflectionKind.class, classType: Set, types: [], arguments: [{ kind: ReflectionKind.string }] });
    expectType([ReflectionOp.string, ReflectionOp.number, ReflectionOp.map], {
        kind: ReflectionKind.class, classType: Map, types: [], arguments: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]
    });

    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union], {
        kind: ReflectionKind.union,
        types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }]
    });

    expectType({ ops: [ReflectionOp.frame, ReflectionOp.string, ReflectionOp.parameter, 0, ReflectionOp.void, ReflectionOp.function], stack: ['param'] }, {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.void },
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.parameter, 0, ReflectionOp.void, ReflectionOp.function], stack: ['param'] }, {
        kind: ReflectionKind.function,
        parameters: [{ kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.string } }],
        return: { kind: ReflectionKind.void },
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.parameter, 0, ReflectionOp.void, ReflectionOp.function], stack: ['param'] }, {
        kind: ReflectionKind.function,
        parameters: [{
            kind: ReflectionKind.parameter,
            name: 'param',
            type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] }
        }],
        return: { kind: ReflectionKind.void },
    });

    expectType({
        ops: [
            ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.parameter, 0,
            ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.parameter, 1,
            ReflectionOp.void, ReflectionOp.function
        ], stack: ['param', 'param2']
    }, {
        kind: ReflectionKind.function,
        parameters: [
            {
                kind: ReflectionKind.parameter,

                name: 'param',
                type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] }
            },
            {
                kind: ReflectionKind.parameter,

                name: 'param2',
                type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }] }
            },
        ],
        return: { kind: ReflectionKind.void },
    });

    expectType([ReflectionOp.string, ReflectionOp.array], { kind: ReflectionKind.array, type: { kind: ReflectionKind.string } });
    expectType([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.array], {
        kind: ReflectionKind.array, type: { kind: ReflectionKind.union, types: [{ kind: ReflectionKind.string }, { kind: ReflectionKind.undefined }] },
    });

    expectType({ ops: [ReflectionOp.string, ReflectionOp.array, ReflectionOp.parameter, 0, ReflectionOp.void, ReflectionOp.function], stack: ['param'] }, {
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.parameter, name: 'param', type: { kind: ReflectionKind.array, type: { kind: ReflectionKind.string } } },
        ],
        return: { kind: ReflectionKind.void },
    });
});

test('inline class', () => {
    const external = pack({ ops: [ReflectionOp.string, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral], stack: ['a'] });

    expectType({ ops: [ReflectionOp.inline, 0], stack: [external] }, {
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string } }]
    });
});

test('inline class circular', () => {
    const external = pack({ ops: [ReflectionOp.inline, 0, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral], stack: ['a'] });
    external.unshift(external);

    const expected: TypeObjectLiteral = {
        kind: ReflectionKind.objectLiteral,
        types: [{ kind: ReflectionKind.propertySignature, parent: undefined as any, name: 'a', type: { kind: ReflectionKind.string } }]
    };
    (expected.types[0] as TypePropertySignature).parent = expected;
    (expected.types[0] as TypePropertySignature).type = expected;
    expectType({ ops: [ReflectionOp.inline, 0], stack: [external] }, expected);
});

test('keyof indexAccess on any', () => {
    type DeepPartial<T> = {
        [P in keyof T]?: T[P]
    };

    interface ChangesInterface<T> {
        $set?: DeepPartial<T>;
        $inc?: Partial<T>;
    }

    const t = typeOf<ChangesInterface<any>>();
    assertType(t, ReflectionKind.objectLiteral);
    const $set = findMember('$set', t.types);
    assertType($set, ReflectionKind.propertySignature);
    assertType($set.type, ReflectionKind.objectLiteral);
    const indexSignature = $set.type.types[0];
    assertType(indexSignature, ReflectionKind.indexSignature);
    assertType(indexSignature.type, ReflectionKind.any);
    expect(indexSignature.type.parent == indexSignature).toBe(true);
});
