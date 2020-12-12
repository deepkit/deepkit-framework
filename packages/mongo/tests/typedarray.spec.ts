import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {f, getClassSchema, jsonSerializer} from '@deepkit/type';
import bson from 'bson';
import {mongoSerializer} from '../src/mongo-serializer';

const {Binary} = bson;

test('Int8Array', async () => {
    class Clazz {
        @f ints: Int8Array = new Int8Array();
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    clazz.ints[0] = 1;
    clazz.ints[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('Int8Array');

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.ints).toBe('string');
    expect(plain.ints).toBe('AUA=');

    const mongo = mongoSerializer.for(Clazz).serialize(clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz3 = mongoSerializer.for(Clazz).deserialize(mongo);
    expect(clazz3.ints).toBeInstanceOf(Int8Array);
    expect(clazz3.ints[0]).toBe(1);
    expect(clazz3.ints[1]).toBe(64);

    const mongo2 = mongoSerializer.for(Clazz).from(jsonSerializer, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'));
});

test('arrayBuffer', async () => {
    class Clazz {
        @f ints?: ArrayBuffer;
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    (clazz.ints as any)[0] = 1;
    (clazz.ints as any)[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('arrayBuffer');
    expect(new Int8Array(clazz.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz.ints!)[1]).toBe(64);

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.ints).toBe('string');
    expect(plain.ints).toBe('AUA=');

    const mongo = mongoSerializer.for(Clazz).serialize(clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz2 = mongoSerializer.for(Clazz).deserialize(mongo);
    expect(clazz2.ints).not.toBeInstanceOf(Int8Array);
    expect(clazz2.ints).toBeInstanceOf(ArrayBuffer);
    expect(clazz2.ints!.byteLength).toBe(2);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);

    const mongo2 = mongoSerializer.for(Clazz).from(jsonSerializer, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'));
});

test('arrayBuffer 2', async () => {
    class Clazz {
        @f ints?: ArrayBuffer;
    }

    const clazz = new Clazz();
    clazz.ints = new ArrayBuffer(2);
    new Int8Array(clazz.ints)[0] = 1;
    new Int8Array(clazz.ints)[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('arrayBuffer');
    expect(new Int8Array(clazz.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz.ints!)[1]).toBe(64);

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.ints).toBe('string');
    expect(plain.ints).toBe('AUA=');

    const mongo = mongoSerializer.for(Clazz).serialize(clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz2 = mongoSerializer.for(Clazz).deserialize(mongo);
    expect(clazz2.ints).not.toBeInstanceOf(Int8Array);
    expect(clazz2.ints).toBeInstanceOf(ArrayBuffer);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);

    const mongo2 = mongoSerializer.for(Clazz).from(jsonSerializer, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'));
});
