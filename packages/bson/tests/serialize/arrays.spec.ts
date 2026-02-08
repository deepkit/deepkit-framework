/**
 * Serialization tests for arrays, tuples, and Sets
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONSerializer } from '../../index.js';
import { expectBytes, toBuffer } from '../test-utils.js';

const { deserialize, serialize } = bson;

test('string array', () => {
    const serializer = getBSONSerializer<{ name: string[] }>();
    const object = { name: ['Peter3'] };
    expectBytes(serializer(object), serialize(object));
});

test('number array', () => {
    const serializer = getBSONSerializer<{ values: number[] }>();
    expectBytes(serializer({ values: [1, 2, 3] }), serialize({ values: [1, 2, 3] }));
    expectBytes(serializer({ values: [] }), serialize({ values: [] }));
});

test('mixed type array', () => {
    const serializer = getBSONSerializer<{ items: (string | number)[] }>();
    expectBytes(serializer({ items: ['a', 1, 'b', 2] }), serialize({ items: ['a', 1, 'b', 2] }));
});

test('Set serializes as array', () => {
    const serializer = getBSONSerializer<{ name: Set<string> }>();
    const object = { name: new Set(['abc', 'Peter']) };
    expectBytes(serializer(object), serialize({ name: ['abc', 'Peter'] }));
});

test('Set round-trip via bson', () => {
    const serializer = getBSONSerializer<{ v: Set<string> }>();
    const value = { v: new Set(['a', 'b']) };

    const bsonData = toBuffer(serializer(value));
    // Set is serialized as array, so bson.deserialize returns array
    const back = deserialize(Buffer.from(bsonData));
    expect(back.v).toEqual(['a', 'b']);
});

test('nested array', () => {
    const serializer = getBSONSerializer<{ matrix: number[][] }>();
    const object = {
        matrix: [
            [1, 2],
            [3, 4],
            [5, 6],
        ],
    };
    expectBytes(serializer(object), serialize(object));
});

test('array of objects', () => {
    const serializer = getBSONSerializer<{ items: { id: number; name: string }[] }>();
    const object = {
        items: [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
        ],
    };
    expectBytes(serializer(object), serialize(object));
});

test('array round-trip', () => {
    const serializer = getBSONSerializer<{ v: string[] }>();
    const value = { v: ['a', 'b'] };
    const bsonData = toBuffer(serializer(value));
    const back = deserialize(Buffer.from(bsonData));
    expect(back).toEqual(value);
});
