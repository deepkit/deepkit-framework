/**
 * Deserialization tests for special types: Date, ObjectId, UUID, RegExp
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MongoId, UUID } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../../index.js';

const { Binary, ObjectId: OfficialObjectId, serialize } = bson;

test('Date', () => {
    const deserializer = getBSONDeserializer<{ created: Date }>();

    const dates = [new Date('2023-06-15T12:30:00.000Z'), new Date('1900-01-01T00:00:00.000Z'), new Date('2100-12-31T23:59:59.999Z')];

    for (const date of dates) {
        const bson = serialize({ created: date });
        const result = deserializer(bson);
        expect(result.created).toEqual(date);
        expect(result.created).toBeInstanceOf(Date);
    }
});

test('UUID', () => {
    const deserializer = getBSONDeserializer<{ uuid: UUID }>();

    const uuidStr = '75ed2328-89f2-4b89-9c49-1498891d616d';
    const uuidPlain = Buffer.from([0x75, 0xed, 0x23, 0x28, 0x89, 0xf2, 0x4b, 0x89, 0x9c, 0x49, 0x14, 0x98, 0x89, 0x1d, 0x61, 0x6d]);
    const uuidBinary = new Binary(uuidPlain, 4);

    const bson = serialize({ uuid: uuidBinary });
    const result = deserializer(bson);
    expect(result.uuid).toBe(uuidStr);
});

test('MongoId (ObjectId)', () => {
    const deserializer = getBSONDeserializer<{ _id: MongoId }>();

    const objectIdStr = '507f191e810c19729de860ea';
    const bson = serialize({ _id: new OfficialObjectId(objectIdStr) });
    const result = deserializer(bson);
    expect(result._id).toBe(objectIdStr);
});

test('RegExp', () => {
    const deserializer = getBSONDeserializer<{ pattern: RegExp }>();

    const patterns = [/abc/, /test/gi, /^start.*end$/m];

    for (const pattern of patterns) {
        const bson = serialize({ pattern });
        const result = deserializer(bson);
        expect(result.pattern).toBeInstanceOf(RegExp);
        expect(result.pattern.source).toBe(pattern.source);
        expect(result.pattern.flags).toBe(pattern.flags);
    }
});

test('optional MongoId', () => {
    const deserializer = getBSONDeserializer<{ _id?: MongoId }>();
    const bson = serialize({ _id: null });
    const result = deserializer(bson);
    expect(result._id).toBeUndefined();
});

test('MongoId round-trip', () => {
    const serializer = getBSONSerializer<{ _id: MongoId }>();
    const deserializer = getBSONDeserializer<{ _id: MongoId }>();

    const objectIdStr = '507f191e810c19729de860ea';
    const [buf, size] = serializer({ _id: objectIdStr });
    const result = deserializer(buf.slice(0, size));
    expect(result._id).toBe(objectIdStr);
});

test('UUID round-trip', () => {
    const serializer = getBSONSerializer<{ uuid: UUID }>();
    const deserializer = getBSONDeserializer<{ uuid: UUID }>();

    const uuidStr = '75ed2328-89f2-4b89-9c49-1498891d616d';
    const [buf, size] = serializer({ uuid: uuidStr });
    const result = deserializer(buf.slice(0, size));
    expect(result.uuid).toBe(uuidStr);
});
