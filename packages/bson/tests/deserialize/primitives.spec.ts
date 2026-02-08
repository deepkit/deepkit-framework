/**
 * Deserialization tests for primitive types
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { deserializeBSONWithoutOptimiser, getBSONDeserializer, serializeBSONWithoutOptimiser } from '../../index.js';

const { Long, serialize } = bson;

test('string', () => {
    const deserializer = getBSONDeserializer<{ name: string }>();
    const bson = serialize({ name: 'Peter' });
    expect(deserializer(bson)).toEqual({ name: 'Peter' });
});

test('empty string', () => {
    const deserializer = getBSONDeserializer<{ name: string }>();
    const bson = serialize({ name: '' });
    expect(deserializer(bson)).toEqual({ name: '' });
});

test('number int', () => {
    const deserializer = getBSONDeserializer<{ value: number }>();
    expect(deserializer(serialize({ value: 0 }))).toEqual({ value: 0 });
    expect(deserializer(serialize({ value: 24 }))).toEqual({ value: 24 });
    expect(deserializer(serialize({ value: -24 }))).toEqual({ value: -24 });
});

test('number double', () => {
    const deserializer = getBSONDeserializer<{ value: number }>();
    expect(deserializer(serialize({ value: 3.14159 }))).toEqual({ value: 3.14159 });
    expect(deserializer(serialize({ value: -3.14159 }))).toEqual({ value: -3.14159 });
});

test('number long', () => {
    const deserializer = getBSONDeserializer<{ value: number }>();
    const bson = serialize({ value: Long.fromBigInt(3364367088039355000n) });
    const result = deserializer(bson);
    // Long values may be converted to number (with potential precision loss for very large values)
    expect(result.value).toBeCloseTo(3364367088039355000, -5);
});

test('boolean', () => {
    const deserializer = getBSONDeserializer<{ valid: boolean }>();
    expect(deserializer(serialize({ valid: true }))).toEqual({ valid: true });
    expect(deserializer(serialize({ valid: false }))).toEqual({ valid: false });
});

test('null for optional', () => {
    const deserializer = getBSONDeserializer<{ v?: string }>();
    const bson = serialize({ v: null });
    expect(deserializer(bson).v).toBe(undefined);
});

test('NaN deserializes to 0', () => {
    // Official behavior is to serialize NaN to NaN
    const bson = serialize({ v: NaN });

    // Without optimizer converts NaN to 0
    const back1 = deserializeBSONWithoutOptimiser(bson);
    expect(back1.v).toBe(0);

    // Typed deserializer converts NaN to 0
    const deserializer = getBSONDeserializer<{ v: number }>();
    const back2 = deserializer(bson);
    expect(back2.v).toBe(0);
});

test('undefined for required string defaults to empty string', () => {
    const deserializer = getBSONDeserializer<{ name: string }>();
    const bson = serializeBSONWithoutOptimiser({ name: undefined });
    expect(deserializer(bson)).toEqual({ name: '' });
});

test('undefined for required number defaults to 0', () => {
    const deserializer = getBSONDeserializer<{ id: number }>();
    const bson = serializeBSONWithoutOptimiser({ id: undefined });
    expect(deserializer(bson)).toEqual({ id: 0 });
});

test('undefined for required object throws', () => {
    const deserializer = getBSONDeserializer<{ set: { id: number } }>();
    const bson = serializeBSONWithoutOptimiser({ set: undefined });
    expect(() => deserializer(bson)).toThrow('Cannot convert bson type UNDEFINED to {id: number}');
});

test('string fallback from number', () => {
    type T = { v: string[] };
    const bson = serialize({ v: [1, '2'] });
    const back = getBSONDeserializer<T>()(bson);
    expect(back.v).toEqual(['1', '2']);
});
