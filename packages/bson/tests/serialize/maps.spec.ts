/**
 * Serialization tests for Maps and index signatures
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

const { serialize } = bson;

test('Map with string keys serializes as object', () => {
    const serializer = getBSONSerializer<{ name: Map<string, string> }>();
    const object = { name: new Map([['abc', 'Peter']]) };
    // Map<string, V> serializes as BSON object
    expectBytes(serializer(object), serialize({ name: { abc: 'Peter' } }));
});

test('Map with multiple string entries', () => {
    const serializer = getBSONSerializer<{ data: Map<string, number> }>();
    const object = {
        data: new Map([
            ['a', 1],
            ['b', 2],
            ['c', 3],
        ]),
    };
    // Map<string, V> serializes as BSON object
    expectBytes(serializer(object), serialize({ data: { a: 1, b: 2, c: 3 } }));
});

test('index signature', () => {
    const serializer = getBSONSerializer<{ [name: string]: number }>();
    expectBytes(serializer({ a: 5 }), serialize({ a: 5 }));
    expectBytes(serializer({ a: 5, b: 6 }), serialize({ a: 5, b: 6 }));
});

test('index signature with properties (requires union support)', () => {
    const serializer = getBSONSerializer<{
        id: number;
        [name: string]: number | string;
    }>();

    expectBytes(serializer({ id: 1, a: 5 }), serialize({ id: 1, a: 5 }));
    expectBytes(serializer({ id: 1, a: 5, b: 6 }), serialize({ id: 1, a: 5, b: 6 }));
});

test('nested index signature', () => {
    const serializer = getBSONSerializer<{ data: { [key: string]: string } }>();
    const object = { data: { foo: 'bar', baz: 'qux' } };
    expectBytes(serializer(object), serialize(object));
});
