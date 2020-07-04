import 'jest-extended'
import 'reflect-metadata';
import {classToPlain, f, getClassSchema} from "@super-hornet/marshal";
import {classToMongo, mongoToClass, plainToMongo} from "..";
import {Binary} from 'mongodb';

test('Int8Array', async () => {
    class Clazz {
        @f ints: Int8Array = new Int8Array();
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    clazz.ints[0] = 1;
    clazz.ints[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('Int8Array');

    const plain = classToPlain(Clazz, clazz);
    expect(plain.ints).toBeString();
    expect(plain.ints).toBe('AUA=');

    const mongo = classToMongo(Clazz, clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz3 = mongoToClass(Clazz, mongo);
    expect(clazz3.ints).toBeInstanceOf(Int8Array);
    expect(clazz3.ints[0]).toBe(1);
    expect(clazz3.ints[1]).toBe(64);

    const mongo2 = plainToMongo(Clazz, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'))
});

test('arrayBuffer', async () => {
    class Clazz {
        @f ints?: ArrayBuffer;
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    clazz.ints[0] = 1;
    clazz.ints[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('arrayBuffer');
    expect(new Int8Array(clazz.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz.ints!)[1]).toBe(64);

    const plain = classToPlain(Clazz, clazz);
    expect(plain.ints).toBeString();
    expect(plain.ints).toBe('AUA=');

    const mongo = classToMongo(Clazz, clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz2 = mongoToClass(Clazz, mongo);
    expect(clazz2.ints).not.toBeInstanceOf(Int8Array);
    expect(clazz2.ints).toBeInstanceOf(ArrayBuffer);
    expect(clazz2.ints!.byteLength).toBe(2);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);

    const mongo2 = plainToMongo(Clazz, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'))
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

    const plain = classToPlain(Clazz, clazz);
    expect(plain.ints).toBeString();
    expect(plain.ints).toBe('AUA=');

    const mongo = classToMongo(Clazz, clazz);
    expect(mongo.ints).toBeInstanceOf(Binary);
    expect(mongo.ints.toString('base64')).toBe('AUA=');

    const clazz2 = mongoToClass(Clazz, mongo);
    expect(clazz2.ints).not.toBeInstanceOf(Int8Array);
    expect(clazz2.ints).toBeInstanceOf(ArrayBuffer);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);

    const mongo2 = plainToMongo(Clazz, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
    expect(mongo2.ints.toString('base64')).toBe(mongo.ints.toString('base64'))
});
