/** @reflection never */
import { expect, test } from '@jest/globals';
import { pack, packSize, ReflectionOp, unpack } from '../../src/reflection/compiler';

Error.stackTraceLimit = 200;

test('pack', () => {
    expect(pack([ReflectionOp.string])).toBe(ReflectionOp.string);
    expect(pack([ReflectionOp.string, ReflectionOp.optional])).toBe((ReflectionOp.optional * (packSize ** 1)) + ReflectionOp.string);
    expect(pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number])).toBe((ReflectionOp.number * (packSize ** 2)) + (ReflectionOp.string * (packSize ** 1)) + ReflectionOp.union);
});

test('unpack', () => {
    // expect(unpack(ReflectionOp.string)).toEqual({ ops: [ReflectionOp.string], stack: [] });
    // expect(unpack([String, ReflectionOp.string])).toEqual({ ops: [ReflectionOp.string], stack: [String] });
    // expect(unpack([String, ReflectionOp.string])).toEqual({ ops: [ReflectionOp.string], stack: [String] });
    // expect(unpack((ReflectionOp.optional * (packSize ** 1)) + ReflectionOp.string)).toEqual({ ops: [ReflectionOp.string, ReflectionOp.optional], stack: [] });
    // expect(unpack(pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number]))).toEqual({ ops: [ReflectionOp.union, ReflectionOp.string, ReflectionOp.number], stack: [] });
});

test('round-trip', () => {
    expect(unpack(pack([ReflectionOp.string]))).toEqual({ ops: [ReflectionOp.string], stack: [] });
    expect(unpack(pack([ReflectionOp.string, ReflectionOp.optional]))).toEqual({ ops: [ReflectionOp.string, ReflectionOp.optional], stack: [] });
    expect(unpack(pack([ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean]))).toEqual({
        ops: [ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean],
        stack: []
    });

    {
        const ops = [ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean, ReflectionOp.number];
        expect(unpack(pack(ops))).toEqual({ ops, stack: [] });
    }

    {
        const ops = [ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean, ReflectionOp.number, ReflectionOp.optional];
        expect(unpack(pack(ops))).toEqual({ ops, stack: [] });
    }

    {
        const ops = [
            ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number,
        ];
        expect(unpack(pack(ops))).toEqual({ ops, stack: [] });
    }

    {
        const ops = [
            ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
        ];
        expect(unpack(pack(ops))).toEqual({ ops, stack: [] });
    }

    {
        const ops = [
            ReflectionOp.string, ReflectionOp.optional, ReflectionOp.boolean,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
            ReflectionOp.number, ReflectionOp.optional,
        ];
        expect(unpack(pack(ops))).toEqual({ ops, stack: [] });
    }
});
