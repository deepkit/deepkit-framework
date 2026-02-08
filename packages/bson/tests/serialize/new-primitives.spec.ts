import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONSerializer } from '../../index.js';

test('number (double) serialization', () => {
    const serialize = getBSONSerializer<{ value: number }>();

    const testCases = [{ value: 0 }, { value: 1 }, { value: -1 }, { value: 42 }, { value: 3.14159 }, { value: -273.15 }, { value: Number.MAX_SAFE_INTEGER }, { value: Number.MIN_SAFE_INTEGER }];

    for (const data of testCases) {
        const [buffer, size] = serialize(data);
        const ours = buffer.slice(0, size);
        const theirs = bson.serialize(data);

        expect(Array.from(ours)).toEqual(Array.from(theirs));
    }
});

test('boolean serialization', () => {
    const serialize = getBSONSerializer<{ active: boolean }>();

    const testCases = [{ active: true }, { active: false }];

    for (const data of testCases) {
        const [buffer, size] = serialize(data);
        const ours = buffer.slice(0, size);
        const theirs = bson.serialize(data);

        expect(Array.from(ours)).toEqual(Array.from(theirs));
    }
});

test('bigint serialization', () => {
    const serialize = getBSONSerializer<{ value: bigint }>();

    const testCases = [
        { value: 0n },
        { value: 1n },
        { value: -1n },
        { value: 9223372036854775807n }, // max int64
        { value: -9223372036854775808n }, // min int64
        { value: 1234567890123456789n },
    ];

    for (const data of testCases) {
        const [buffer, size] = serialize(data);
        const ours = buffer.slice(0, size);

        // bson-js uses Long class for int64
        const theirs = bson.serialize({ value: bson.Long.fromBigInt(data.value) });

        expect(Array.from(ours)).toEqual(Array.from(theirs));
    }
});

test('null serialization', () => {
    const serialize = getBSONSerializer<{ value: null }>();

    const data = { value: null };
    const [buffer, size] = serialize(data);
    const ours = buffer.slice(0, size);
    const theirs = bson.serialize(data);

    expect(Array.from(ours)).toEqual(Array.from(theirs));
});

test('mixed primitives', () => {
    const serialize = getBSONSerializer<{
        name: string;
        age: number;
        active: boolean;
    }>();

    const data = {
        name: 'Alice',
        age: 30,
        active: true,
    };

    const [buffer, size] = serialize(data);
    const ours = buffer.slice(0, size);
    const theirs = bson.serialize(data);

    expect(Array.from(ours)).toEqual(Array.from(theirs));
});
