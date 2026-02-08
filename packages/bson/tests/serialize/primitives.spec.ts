/**
 * Serialization tests for primitive types: string, number, boolean, null, undefined, bigint
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONSerializer } from '../../index.js';
import { hexToByte, uuidStringToByte } from '../../src/model.js';
import { expectBytes, toBuffer } from '../test-utils.js';

const { Long, serialize } = bson;

test('hexToByte utility', () => {
    expect(hexToByte('00')).toBe(0);
    expect(hexToByte('01')).toBe(1);
    expect(hexToByte('0f')).toBe(15);
    expect(hexToByte('10')).toBe(16);
    expect(hexToByte('ff')).toBe(255);
    expect(hexToByte('f0')).toBe(240);
    expect(hexToByte('50')).toBe(80);
    expect(hexToByte('7f')).toBe(127);
    expect(hexToByte('f00f', 1)).toBe(15);
    expect(hexToByte('f0ff', 1)).toBe(255);
    expect(hexToByte('f00001', 2)).toBe(1);
    expect(hexToByte('f8')).toBe(16 * 15 + 8);
    expect(hexToByte('41')).toBe(16 * 4 + 1);
});

test('uuidStringToByte utility', () => {
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 1)).toBe(16 * 15 + 8);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 4)).toBe(16 * 4 + 1);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 6)).toBe(16 * 4 + 4);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 7)).toBe(16 * 2 + 15);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 8)).toBe(16 * 11 + 7);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 10)).toBe(16 * 12 + 3);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 11)).toBe(16 * 10 + 1);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 15)).toBe(16 * 6 + 12);
});

test('string', () => {
    const serializer = getBSONSerializer<{ name: string }>();
    expectBytes(serializer({ name: 'Peter' }), serialize({ name: 'Peter' }));
    expectBytes(serializer({ name: '' }), serialize({ name: '' }));
    expectBytes(serializer({ name: 'a' }), serialize({ name: 'a' }));
});

test('number int', () => {
    const serializer = getBSONSerializer<{ value: number }>();
    expectBytes(serializer({ value: 0 }), serialize({ value: 0 }));
    expectBytes(serializer({ value: 24 }), serialize({ value: 24 }));
    expectBytes(serializer({ value: -24 }), serialize({ value: -24 }));
    expectBytes(serializer({ value: 2147483647 }), serialize({ value: 2147483647 })); // max int32
});

test('number double', () => {
    const serializer = getBSONSerializer<{ value: number }>();
    expectBytes(serializer({ value: 149943944399 }), serialize({ value: 149943944399 }));
    expectBytes(serializer({ value: 3.14159 }), serialize({ value: 3.14159 }));
    expectBytes(serializer({ value: -3.14159 }), serialize({ value: -3.14159 }));
});

test('boolean', () => {
    const serializer = getBSONSerializer<{ valid: boolean }>();
    expectBytes(serializer({ valid: true }), serialize({ valid: true }));
    expectBytes(serializer({ valid: false }), serialize({ valid: false }));
});

test('optional number', () => {
    const serializer = getBSONSerializer<{ position?: number }>();
    expectBytes(serializer({ position: 24 }), serialize({ position: 24 }));
    expectBytes(serializer({ position: undefined }), serialize({ position: null }));
    expectBytes(serializer({}), serialize({}));
});

test('bigint native', () => {
    const serializer = getBSONSerializer<{ position: bigint }>();
    // bigint serializes to long format
    const result = serializer({ position: 3364367088039355000n });
    // getBSONSerializer returns [Uint8Array, number] tuple
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(2);
    expect(result[0]).toBeInstanceOf(Uint8Array);
    expect(result[1]).toBeGreaterThan(0);

    // Verify it matches bson-js Long format
    expectBytes(result, serialize({ position: Long.fromBigInt(3364367088039355000n) }));
});

test('bigint values', () => {
    const serializer = getBSONSerializer<{ position: bigint }>();

    expectBytes(serializer({ position: 123456n }), serialize({ position: Long.fromNumber(123456) }));
    expectBytes(serializer({ position: -123456n }), serialize({ position: Long.fromNumber(-123456) }));
    expectBytes(serializer({ position: 3364367088039355000n }), serialize({ position: Long.fromBigInt(3364367088039355000n) }));
    expectBytes(serializer({ position: -3364367088039355000n }), serialize({ position: Long.fromBigInt(-3364367088039355000n) }));
});

test('undefined for required string throws', () => {
    // Undefined for required string throws
    expect(() => getBSONSerializer<{ name: string }>()({ name: undefined as any })).toThrow();
});
