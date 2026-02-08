/**
 * Serialization tests for objects: object literals, classes, nested objects
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { Excluded, PrimaryKey, UUID, hasCircularReference, typeOf, uuid } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';
import { expectBytes, toBuffer } from '../test-utils.js';

const { serialize, deserialize } = bson;

test('nested object', () => {
    const serializer = getBSONSerializer<{ name: { anotherOne: string } }>();
    const object = { name: { anotherOne: 'Peter2' } };
    expectBytes(serializer(object), serialize(object));
});

test('deeply nested object', () => {
    const serializer = getBSONSerializer<{ a: { b: { c: { d: string } } } }>();
    const object = { a: { b: { c: { d: 'deep' } } } };
    expectBytes(serializer(object), serialize(object));
});

test('multiple properties', () => {
    const serializer = getBSONSerializer<{
        name: string;
        tags: string[];
        priority: number;
        position: number;
        valid: boolean;
        created: Date;
    }>();

    const object = {
        name: 'Peter4',
        tags: ['a', 'b', 'c'],
        priority: 15,
        position: 149943944399,
        valid: true,
        created: new Date(),
    };

    expectBytes(serializer(object), serialize(object));
});

test('optional field', () => {
    const serializer = getBSONSerializer<{
        find: string;
        batchSize: number;
        limit?: number;
        skip?: number;
    }>();

    const result = serializer({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    const bsonOfficial = serialize({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    expectBytes(result, bsonOfficial);
});

test('complex optional fields', () => {
    const serializer = getBSONSerializer<{
        find: string;
        batchSize: number;
        limit?: number;
        filter: any;
        projection: any;
        sort: any;
        skip?: number;
    }>();

    const result = serializer({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });
    const bsonOfficial = serialize({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    expectBytes(result, bsonOfficial);
});

test('Excluded property', () => {
    const serializer = getBSONSerializer<{
        id: number;
        password: string & Excluded;
    }>();

    expectBytes(serializer({ id: 1, password: 'asdasd' }), serialize({ id: 1 }));
});

test('Excluded for bson', () => {
    class Model {
        id: UUID & PrimaryKey = uuid();
        excludedForMongo: string & Excluded<'bson'> = 'excludedForMongo';
        constructor(public name: string) {}
    }

    const model = new Model('asd');

    interface Message {
        insert: string;
        $db: string;
        documents: Model[];
    }

    const serializer = getBSONSerializer<Message>();
    const bsonData = toBuffer(serializer({ insert: 'a', $db: 'b', documents: [model] }));

    // Use official bson library to verify our serialized output is valid BSON
    const back = deserialize(bsonData) as any;
    expect(back.documents[0].name).toBe('asd');
    expect(back.documents[0].excludedForMongo).toBeUndefined();
});

test('Promise unwrapping', () => {
    const serializer = getBSONSerializer<{ id: Promise<number> }>();
    expectBytes(serializer({ id: 1 as any }), serialize({ id: 1 }));
});

test('circular reference detection', () => {
    interface Model {
        id: number;
        another?: Model;
    }

    expect(hasCircularReference(typeOf<Model>())).toBe(true);

    const serializer = getBSONSerializer<Model>();

    // Non-circular case
    const model: Model = { id: 1 };
    const model2: Model = { id: 2 };
    model.another = model2;

    const bsonData = toBuffer(serializer(model));
    // Use official bson library to verify our serialized output is valid BSON
    const back = deserialize(bsonData);
    expect(back).toEqual(model);
});

test('complex recursive', () => {
    class ModuleApi {
        api?: ModuleApi;
        imports: ModuleApi[] = [];
        constructor(public name: string) {}
    }

    const data = {
        name: 'a',
        api: { imports: [], name: 'a2' },
        imports: [
            {
                name: 'b',
                api: { imports: [], name: 'b2' },
                imports: [{ imports: [], name: 'c' }],
            },
        ],
    };

    // Key test: getBSONSerializer should NOT stack overflow for recursive types
    const serializer = getBSONSerializer<ModuleApi>();

    const bsonData = toBuffer(serializer(data));
    // Use official bson library to verify our serialized output is valid BSON
    const back = deserialize(bsonData);
    expect(back).toEqual(data);
});
