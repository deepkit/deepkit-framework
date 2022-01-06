/** @reflection never */
import { expect, test } from '@jest/globals';
import { pack, unpack } from '../../src/reflection/processor';
import { ReflectionOp } from '../../src/reflection/type';

Error.stackTraceLimit = 200;

test('pack', () => {
    expect(pack([ReflectionOp.string])).toEqual([String.fromCharCode(33 + ReflectionOp.string)]);
    expect(pack([ReflectionOp.string, ReflectionOp.optional])).toEqual([String.fromCharCode(33 + ReflectionOp.string, 33 + ReflectionOp.optional)]);
    expect(pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number])).toEqual([String.fromCharCode(33 + ReflectionOp.union, 33 + ReflectionOp.string, 33 + ReflectionOp.number)]);
});

test('unpack', () => {
    expect(unpack([String.fromCharCode(33 + ReflectionOp.string)])).toEqual({ ops: [ReflectionOp.string], stack: [] });
    expect(unpack([String, String.fromCharCode(33 + ReflectionOp.string)])).toEqual({ ops: [ReflectionOp.string], stack: [String] });
    expect(unpack([String, String.fromCharCode(33 + ReflectionOp.string)])).toEqual({ ops: [ReflectionOp.string], stack: [String] });
    expect(unpack([String.fromCharCode(33 + ReflectionOp.string, 33 + ReflectionOp.optional)])).toEqual({ ops: [ReflectionOp.string, ReflectionOp.optional], stack: [] });
    expect(unpack(pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number]))).toEqual({
        ops: [ReflectionOp.union, ReflectionOp.string, ReflectionOp.number],
        stack: []
    });
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
