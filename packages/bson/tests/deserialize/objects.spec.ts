/**
 * Deserialization tests for objects and classes
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONDeserializer, getBSONSerializer } from '../../index.js';

const { serialize } = bson;

test('simple object', () => {
    const deserializer = getBSONDeserializer<{ name: string; age: number }>();
    const bson = serialize({ name: 'Alice', age: 30 });
    expect(deserializer(bson)).toEqual({ name: 'Alice', age: 30 });
});

test('nested object', () => {
    const deserializer = getBSONDeserializer<{ user: { name: string; profile: { bio: string } } }>();
    const data = { user: { name: 'Alice', profile: { bio: 'Hello' } } };
    const bson = serialize(data);
    expect(deserializer(bson)).toEqual(data);
});

test('optional fields', () => {
    const deserializer = getBSONDeserializer<{ name: string; age?: number }>();

    // With optional field present
    expect(deserializer(serialize({ name: 'Alice', age: 30 }))).toEqual({ name: 'Alice', age: 30 });

    // Without optional field
    expect(deserializer(serialize({ name: 'Alice' }))).toEqual({ name: 'Alice' });

    // With null (converts to undefined)
    expect(deserializer(serialize({ name: 'Alice', age: null }))).toEqual({ name: 'Alice' });
});

test('class instance', () => {
    class User {
        constructor(
            public name: string,
            public age: number,
        ) {}
    }

    const deserializer = getBSONDeserializer<User>();
    const bson = serialize({ name: 'Alice', age: 30 });
    const result = deserializer(bson);

    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
});

test('class with defaults', () => {
    class Settings {
        theme: string = 'light';
        notifications: boolean = true;
    }

    const deserializer = getBSONDeserializer<Settings>();

    // Partial data uses defaults (depending on implementation)
    const bson = serialize({ theme: 'dark' });
    const result = deserializer(bson);
    expect(result.theme).toBe('dark');
});

test('index signature', () => {
    const deserializer = getBSONDeserializer<{ [key: string]: number }>();
    const bson = serialize({ a: 1, b: 2, c: 3 });
    expect(deserializer(bson)).toEqual({ a: 1, b: 2, c: 3 });
});

test('index signature with union value', () => {
    const deserializer = getBSONDeserializer<{ [key: string]: string | number }>();
    const bson = serialize({ name: 'Alice', age: 30 });
    expect(deserializer(bson)).toEqual({ name: 'Alice', age: 30 });
});

test('recursive object', () => {
    interface Node {
        value: number;
        children?: Node[];
    }

    const deserializer = getBSONDeserializer<Node>();
    const serializer = getBSONSerializer<Node>();

    const data: Node = {
        value: 1,
        children: [
            { value: 2, children: [] },
            { value: 3, children: [{ value: 4 }] },
        ],
    };

    const [buf, size] = serializer(data);
    const result = deserializer(buf.slice(0, size));
    expect(result).toEqual(data);
});

test('Map', () => {
    const deserializer = getBSONDeserializer<{ data: Map<string, number> }>();
    // Maps are serialized as arrays of [key, value] pairs
    const bson = serialize({
        data: [
            ['a', 1],
            ['b', 2],
        ],
    });
    const result = deserializer(bson);

    expect(result.data).toBeInstanceOf(Map);
    expect(result.data.get('a')).toBe(1);
    expect(result.data.get('b')).toBe(2);
});
