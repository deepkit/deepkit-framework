/**
 * Deserialization tests for arrays, tuples, and Sets
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONDeserializer } from '../../index.js';
import { deserializeBSON } from '../../index.js';

const { serialize } = bson;

test('string array', () => {
    const deserializer = getBSONDeserializer<{ items: string[] }>();
    const bson = serialize({ items: ['a', 'b', 'c'] });
    expect(deserializer(bson)).toEqual({ items: ['a', 'b', 'c'] });
});

test('number array', () => {
    const deserializer = getBSONDeserializer<{ items: number[] }>();
    const bson = serialize({ items: [1, 2, 3] });
    expect(deserializer(bson)).toEqual({ items: [1, 2, 3] });
});

test('empty array', () => {
    const deserializer = getBSONDeserializer<{ items: string[] }>();
    const bson = serialize({ items: [] });
    expect(deserializer(bson)).toEqual({ items: [] });
});

test('nested array', () => {
    const deserializer = getBSONDeserializer<{ matrix: number[][] }>();
    const bson = serialize({
        matrix: [
            [1, 2],
            [3, 4],
        ],
    });
    expect(deserializer(bson)).toEqual({
        matrix: [
            [1, 2],
            [3, 4],
        ],
    });
});

test('array of objects', () => {
    const deserializer = getBSONDeserializer<{ items: { id: number; name: string }[] }>();
    const data = {
        items: [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
        ],
    };
    const bson = serialize(data);
    expect(deserializer(bson)).toEqual(data);
});

test('Set from array', () => {
    const deserializer = getBSONDeserializer<{ items: Set<string> }>();
    // Sets are serialized as arrays
    const bson = serialize({ items: ['a', 'b', 'c'] });
    const result = deserializer(bson);
    expect(result.items).toBeInstanceOf(Set);
    expect([...result.items]).toEqual(['a', 'b', 'c']);
});

test('tuple', () => {
    const deserializer = getBSONDeserializer<{ pair: [string, number] }>();
    const bson = serialize({ pair: ['hello', 42] });
    expect(deserializer(bson)).toEqual({ pair: ['hello', 42] });
});

test('tuple with different types', () => {
    const deserializer = getBSONDeserializer<{ data: [number, string, boolean] }>();
    const bson = serialize({ data: [1, 'test', true] });
    expect(deserializer(bson)).toEqual({ data: [1, 'test', true] });
});

test('union array', () => {
    const deserializer = getBSONDeserializer<{ items: (string | number)[] }>();
    const bson = serialize({ items: ['a', 1, 'b', 2] });
    expect(deserializer(bson)).toEqual({ items: ['a', 1, 'b', 2] });
});

// Tuple with rest elements - critical tests
test('tuple [...number[]]', () => {
    type T = { v: [...number[]] };
    expect(deserializeBSON<T>(serialize({ v: [34] }))).toEqual({ v: [34] });
    expect(deserializeBSON<T>(serialize({ v: ['44'] }))).toEqual({ v: [44] }); // coerced
    expect(deserializeBSON<T>(serialize({ v: [34, 55] }))).toEqual({ v: [34, 55] });
    expect(deserializeBSON<T>(serialize({ v: ['44', 55] }))).toEqual({ v: [44, 55] });
});

test('tuple [string, ...number[]]', () => {
    type T = { v: [string, ...number[]] };
    expect(deserializeBSON<T>(serialize({ v: [34] }))).toEqual({ v: ['34'] }); // first coerced to string
    expect(deserializeBSON<T>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
    expect(deserializeBSON<T>(serialize({ v: [34, 55] }))).toEqual({ v: ['34', 55] });
    expect(deserializeBSON<T>(serialize({ v: ['44', 55, 66] }))).toEqual({ v: ['44', 55, 66] });
});

test('tuple [...number[], string]', () => {
    type T = { v: [...number[], string] };
    expect(deserializeBSON<T>(serialize({ v: [34] }))).toEqual({ v: ['34'] }); // last is string
    expect(deserializeBSON<T>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
    expect(deserializeBSON<T>(serialize({ v: [34, '55'] }))).toEqual({ v: [34, '55'] });
    expect(deserializeBSON<T>(serialize({ v: ['44', 55, '66'] }))).toEqual({ v: [44, 55, '66'] });
});

test('tuple [...number[], string, boolean]', () => {
    type T = { v: [...number[], string, boolean] };
    expect(deserializeBSON<T>(serialize({ v: [true] }))).toEqual({ v: [true] }); // minimal
    expect(deserializeBSON<T>(serialize({ v: [34, true] }))).toEqual({ v: ['34', true] });
    expect(deserializeBSON<T>(serialize({ v: ['44', 55, '66', true] }))).toEqual({ v: [44, 55, '66', true] });
});

test('tuple [string, ...number[], boolean]', () => {
    type T = { v: [string, ...number[], boolean] };
    expect(deserializeBSON<T>(serialize({ v: ['abc', true] }))).toEqual({ v: ['abc', true] });
    expect(deserializeBSON<T>(serialize({ v: ['abc', 12, true] }))).toEqual({ v: ['abc', 12, true] });
    expect(deserializeBSON<T>(serialize({ v: ['abc', 12, 23, true] }))).toEqual({ v: ['abc', 12, 23, true] });
});

test('tuple truncates extra elements', () => {
    type T = { v: [string, number] };
    expect(deserializeBSON<T>(serialize({ v: ['abc', 34, 55] }))).toEqual({ v: ['abc', 34] });
});

test('tuple coerces types', () => {
    type T = { v: [string, number] };
    expect(deserializeBSON<T>(serialize({ v: ['abc', '44'] }))).toEqual({ v: ['abc', 44] });
});

test('tuple single element', () => {
    type T = { v: [number] };
    expect(deserializeBSON<T>(serialize({ v: [34] }))).toEqual({ v: [34] });
    expect(deserializeBSON<T>(serialize({ v: ['44'] }))).toEqual({ v: [44] });
});
