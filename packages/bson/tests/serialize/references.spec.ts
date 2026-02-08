/**
 * Serialization tests for references
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { PrimaryKey, Reference, createReference } from '@deepkit/type';

import { SerializeResult, getBSONSerializer } from '../../index.js';

const { deserialize, serialize } = bson;

// Helper to extract buffer from tuple result
function toBuffer(result: SerializeResult): Uint8Array {
    const [buffer, size] = result;
    return buffer.slice(0, size);
}

test('reference serializes to primary key', () => {
    class Entity {
        public id: number & PrimaryKey = 0;
        constructor(public title: string) {}
    }

    const object = { v: createReference(Entity, { id: 5 }) };
    const serializer = getBSONSerializer<{ v: Entity & Reference }>();

    const bsonData = toBuffer(serializer(object));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.v).toEqual(5);

    expect(Buffer.from(bsonData)).toEqual(serialize({ v: 5 }));
});

test('deep reference', () => {
    class Entity {
        public id: number & PrimaryKey = 0;
        constructor(public title: string) {}
    }

    const object = { v: { item: createReference(Entity, { id: 5 }) } };
    const serializer = getBSONSerializer<{ v: { item: Entity & Reference } }>();

    const bsonData = toBuffer(serializer(object));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.v.item).toEqual(5);

    expect(Buffer.from(bsonData)).toEqual(serialize({ v: { item: 5 } }));
});

test('reference in array', () => {
    class Entity {
        public id: number & PrimaryKey = 0;
        constructor(public title: string) {}
    }

    const object = {
        items: [createReference(Entity, { id: 1 }), createReference(Entity, { id: 2 })],
    };

    const serializer = getBSONSerializer<{ items: (Entity & Reference)[] }>();

    const bsonData = toBuffer(serializer(object));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.items).toEqual([1, 2]);
});
