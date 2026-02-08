/**
 * Serialization tests for special types: Date, ObjectId, UUID, RegExp
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { MongoId, UUID } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

const { Binary, ObjectId: OfficialObjectId, serialize } = bson;

test('Date', () => {
    const serializer = getBSONSerializer<{ created: Date }>();

    expectBytes(serializer({ created: new Date('2900-10-12T00:00:00.000Z') }), serialize({ created: new Date('2900-10-12T00:00:00.000Z') }));
    expectBytes(serializer({ created: new Date('1900-10-12T00:00:00.000Z') }), serialize({ created: new Date('1900-10-12T00:00:00.000Z') }));
    expectBytes(serializer({ created: new Date('1000-10-12T00:00:00.000Z') }), serialize({ created: new Date('1000-10-12T00:00:00.000Z') }));
});

test('UUID', () => {
    const serializer = getBSONSerializer<{ uuid: UUID }>();
    const object = { uuid: '75ed2328-89f2-4b89-9c49-1498891d616d' };

    const uuidPlain = Buffer.from([0x75, 0xed, 0x23, 0x28, 0x89, 0xf2, 0x4b, 0x89, 0x9c, 0x49, 0x14, 0x98, 0x89, 0x1d, 0x61, 0x6d]);
    const uuidBinary = new Binary(uuidPlain, 4);

    expectBytes(serializer(object), serialize({ uuid: uuidBinary }));
});

test('MongoId (ObjectId)', () => {
    const serializer = getBSONSerializer<{ _id: MongoId }>();
    const object = { _id: '507f191e810c19729de860ea' };
    const nativeBson = { _id: new OfficialObjectId('507f191e810c19729de860ea') };

    expectBytes(serializer(object), serialize(nativeBson));
});

test('RegExp', () => {
    const serializer = getBSONSerializer<{ id: RegExp }>();
    expectBytes(serializer({ id: /asd/g }), serialize({ id: /asd/g }));
    expectBytes(serializer({ id: /abc/i }), serialize({ id: /abc/i }));
    expectBytes(serializer({ id: /test/gim }), serialize({ id: /test/gim }));
});
