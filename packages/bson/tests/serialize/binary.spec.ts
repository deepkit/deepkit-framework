/**
 * Serialization tests for binary types: Uint8Array, ArrayBuffer, TypedArrays
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MongoId, nodeBufferToArrayBuffer } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

const { Binary, ObjectId: OfficialObjectId, serialize } = bson;

test('Uint8Array', () => {
    const serializer = getBSONSerializer<{ binary: Uint8Array }>();
    const data = { binary: new Uint8Array(32) };
    const [buffer, size] = serializer(data);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(size).toBeGreaterThan(0);
});

test('Uint16Array', () => {
    const serializer = getBSONSerializer<{ binary: Uint16Array }>();
    const data = { binary: new Uint16Array(32) };
    const [buffer, size] = serializer(data);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(size).toBeGreaterThan(0);
});

test('ArrayBuffer', () => {
    const serializer = getBSONSerializer<{ binary: ArrayBuffer }>();
    const arrayBuffer = new ArrayBuffer(5);
    const view = new Uint8Array(arrayBuffer);
    view[0] = 22;
    view[1] = 44;
    view[2] = 55;
    view[3] = 66;
    view[4] = 77;

    const [buffer, size] = serializer({ binary: arrayBuffer });
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(size).toBeGreaterThan(0);
});

test('ArrayBuffer with MongoId', () => {
    const serializer = getBSONSerializer<{
        name: string;
        secondId: MongoId;
        preview: ArrayBuffer;
    }>();

    const message = {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: nodeBufferToArrayBuffer(Buffer.from('Baar', 'utf8')),
    };

    const mongoMessage = {
        name: message.name,
        secondId: new OfficialObjectId(message.secondId),
        preview: new Binary(Buffer.from(message.preview)),
    };

    expectBytes(serializer(message), serialize(mongoMessage));
});

test('Uint16Array with MongoId', () => {
    const serializer = getBSONSerializer<{
        name: string;
        secondId: MongoId;
        preview: Uint16Array;
    }>();

    const message = {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: new Uint16Array(nodeBufferToArrayBuffer(Buffer.from('LAA3AEIATQBYAA==', 'base64'))),
    };

    expect(message.preview).toBeInstanceOf(Uint16Array);
    expect(message.preview.byteLength).toBe(10);

    const mongoMessage = {
        name: message.name,
        secondId: new OfficialObjectId(message.secondId),
        preview: new Binary(Buffer.from(new Uint8Array(message.preview.buffer, message.preview.byteOffset, message.preview.byteLength))),
    };

    expectBytes(serializer(message), serialize(mongoMessage));
});
