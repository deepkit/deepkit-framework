/**
 * Deserialization tests for type coercion (graceful conversions)
 *
 * BSON deserializer performs type coercion when the wire type doesn't match
 * the expected type but can be reasonably converted.
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { BinaryBigInt, SignedBinaryBigInt } from '@deepkit/type';

import { deserializeBSON, getBSONDeserializer } from '../../index.js';

const { Binary, serialize } = bson;

describe('number coercion', () => {
    test('number from string', () => {
        type T = { v: number };
        expect(deserializeBSON<T>(serialize({ v: '123' }))).toEqual({ v: 123 });
        expect(deserializeBSON<T>(serialize({ v: '-456' }))).toEqual({ v: -456 });
        expect(deserializeBSON<T>(serialize({ v: '3.14' }))).toEqual({ v: 3.14 });
    });

    test('number from boolean true', () => {
        type T = { v: number };
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: 1 });
    });

    test('number from boolean false', () => {
        type T = { v: number };
        expect(deserializeBSON<T>(serialize({ v: false }))).toEqual({ v: 0 });
    });

    test('number from object defaults to 0', () => {
        type T = { v: number };
        expect(deserializeBSON<T>(serialize({ v: {} }))).toEqual({ v: 0 });
    });

    test('number from negative value', () => {
        type T = { v: number };
        expect(deserializeBSON<T>(serialize({ v: -1234 }))).toEqual({ v: -1234 });
    });
});

describe('bigint coercion', () => {
    test('bigint from number', () => {
        type T = { v: bigint };
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: 123n });
    });

    test('bigint from string', () => {
        type T = { v: bigint };
        expect(deserializeBSON<T>(serialize({ v: '123' }))).toEqual({ v: 123n });
    });

    test('bigint from boolean true', () => {
        type T = { v: bigint };
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: 1n });
    });

    test('bigint from boolean false', () => {
        type T = { v: bigint };
        expect(deserializeBSON<T>(serialize({ v: false }))).toEqual({ v: 0n });
    });

    test('bigint from object defaults to 0n', () => {
        type T = { v: bigint };
        expect(deserializeBSON<T>(serialize({ v: {} }))).toEqual({ v: 0n });
    });
});

describe('BinaryBigInt coercion', () => {
    test('BinaryBigInt from binary', () => {
        const buffer = Buffer.from([100]);
        type T = { v: BinaryBigInt };
        const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });
        expect(deserializeBSON<T>(bson)).toEqual({ v: 100n });
    });

    test('BinaryBigInt from string', () => {
        type T = { v: BinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: '123' }))).toEqual({ v: 123n });
    });

    test('BinaryBigInt from boolean', () => {
        type T = { v: BinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: 1n });
        expect(deserializeBSON<T>(serialize({ v: false }))).toEqual({ v: 0n });
    });

    test('BinaryBigInt from object defaults to 0n', () => {
        type T = { v: BinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: {} }))).toEqual({ v: 0n });
    });
});

describe('SignedBinaryBigInt coercion', () => {
    test('SignedBinaryBigInt from binary positive', () => {
        const buffer = Buffer.from([0, 100]); // signum 0 = positive
        type T = { v: SignedBinaryBigInt };
        const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });
        expect(deserializeBSON<T>(bson)).toEqual({ v: 100n });
    });

    test('SignedBinaryBigInt from binary negative', () => {
        const buffer = Buffer.from([255, 100]); // signum 255 = -1 = negative
        type T = { v: SignedBinaryBigInt };
        const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });
        expect(deserializeBSON<T>(bson)).toEqual({ v: -100n });
    });

    test('SignedBinaryBigInt from string', () => {
        type T = { v: SignedBinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: '123' }))).toEqual({ v: 123n });
    });

    test('SignedBinaryBigInt from boolean', () => {
        type T = { v: SignedBinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: 1n });
        expect(deserializeBSON<T>(serialize({ v: false }))).toEqual({ v: 0n });
    });

    test('SignedBinaryBigInt from object defaults to 0n', () => {
        type T = { v: SignedBinaryBigInt };
        expect(deserializeBSON<T>(serialize({ v: {} }))).toEqual({ v: 0n });
    });
});

describe('string coercion', () => {
    test('string from number', () => {
        type T = { v: string };
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: '123' });
        expect(deserializeBSON<T>(serialize({ v: -456 }))).toEqual({ v: '-456' });
        expect(deserializeBSON<T>(serialize({ v: 3.14 }))).toEqual({ v: '3.14' });
    });

    test('string from object throws', () => {
        type T = { v: string };
        expect(() => deserializeBSON<T>(serialize({ v: {} }))).toThrow('Cannot convert bson type OBJECT to string');
    });

    test('string array with number coercion', () => {
        type T = { v: string[] };
        const bson = serialize({ v: [1, '2'] });
        expect(deserializeBSON<T>(bson)).toEqual({ v: ['1', '2'] });
    });
});

describe('boolean coercion', () => {
    test('boolean from number truthy', () => {
        type T = { v: boolean };
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: true });
        expect(deserializeBSON<T>(serialize({ v: 1 }))).toEqual({ v: true });
        expect(deserializeBSON<T>(serialize({ v: -1 }))).toEqual({ v: true });
    });

    test('boolean from number falsy', () => {
        type T = { v: boolean };
        expect(deserializeBSON<T>(serialize({ v: 0 }))).toEqual({ v: false });
    });

    test('boolean from string truthy', () => {
        type T = { v: boolean };
        expect(deserializeBSON<T>(serialize({ v: '123' }))).toEqual({ v: true });
        expect(deserializeBSON<T>(serialize({ v: 'true' }))).toEqual({ v: true });
        expect(deserializeBSON<T>(serialize({ v: 'false' }))).toEqual({ v: true }); // non-empty string is truthy
    });

    test('boolean from string empty is falsy', () => {
        type T = { v: boolean };
        expect(deserializeBSON<T>(serialize({ v: '' }))).toEqual({ v: false });
    });
});

describe('null and undefined coercion', () => {
    test('null type from null', () => {
        type T = { v: null };
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: null });
    });

    test('null type from undefined', () => {
        type T = { v: null };
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: null });
    });

    test('null type from missing', () => {
        type T = { v: null };
        expect(deserializeBSON<T>(serialize({}))).toEqual({ v: null });
    });

    test('null type from number throws', () => {
        type T = { v: null };
        expect(() => deserializeBSON<T>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to null');
    });

    test('null type from object throws', () => {
        type T = { v: null };
        expect(() => deserializeBSON<T>(serialize({ v: {} }))).toThrow('Cannot convert bson type OBJECT to null');
    });

    test('undefined type from null', () => {
        type T = { v: undefined };
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: undefined });
    });

    test('undefined type from undefined', () => {
        type T = { v: undefined };
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: undefined });
    });

    test('undefined type from missing', () => {
        type T = { v: undefined };
        expect(deserializeBSON<T>(serialize({}))).toEqual({ v: undefined });
    });

    test('undefined type from number throws', () => {
        type T = { v: undefined };
        expect(() => deserializeBSON<T>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to undefined');
    });
});

describe('literal type defaults', () => {
    test('string literal defaults when null', () => {
        type T = { v: 'abc' };
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: 'abc' });
    });

    test('string literal defaults when undefined', () => {
        type T = { v: 'abc' };
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: 'abc' });
    });

    test('string literal defaults when missing', () => {
        type T = { v: 'abc' };
        expect(deserializeBSON<T>(serialize({}))).toEqual({ v: 'abc' });
    });

    test('string literal defaults even when wrong type', () => {
        type T = { v: 'abc' };
        expect(deserializeBSON<T>(serialize({ v: 1234 }))).toEqual({ v: 'abc' });
    });

    test('number literal defaults', () => {
        type T = { v: 123 };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 123 });
    });

    test('boolean literal defaults', () => {
        type T = { v: true };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: true });
    });
});

describe('Date coercion', () => {
    test('Date from date', () => {
        const date = new Date();
        type T = { v: Date };
        expect(deserializeBSON<T>(serialize({ v: date }))).toEqual({ v: date });
    });

    test('Date from ISO string', () => {
        const date = new Date();
        type T = { v: Date };
        expect(deserializeBSON<T>(serialize({ v: date.toJSON() }))).toEqual({ v: date });
    });

    test('Date from timestamp number', () => {
        const date = new Date();
        type T = { v: Date };
        expect(deserializeBSON<T>(serialize({ v: date.valueOf() }))).toEqual({ v: date });
    });
});

describe('invalid object coercion', () => {
    test('number from invalid object defaults to 0', () => {
        const bson = serialize({ v: { a: 1 } });
        expect(deserializeBSON<{ v: number }>(bson).v).toEqual(0);
    });

    test('bigint from invalid object defaults to 0n', () => {
        const bson = serialize({ v: { a: 1 } });
        expect(deserializeBSON<{ v: bigint }>(bson).v).toEqual(BigInt(0));
    });

    test('boolean from invalid object defaults to false', () => {
        const bson = serialize({ v: { a: 1 } });
        expect(deserializeBSON<{ v: boolean }>(bson).v).toEqual(false);
    });
});
