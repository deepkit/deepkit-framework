import 'jest-extended'
import 'reflect-metadata';
import {classToPlain, f, getClassSchema, plainToClass} from "@marcj/marshal";
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

    const clazz3 = mongoToClass(Clazz, mongo);
    expect(clazz3.ints).toBeInstanceOf(Int8Array);
    expect(clazz3.ints[0]).toBe(1);
    expect(clazz3.ints[1]).toBe(64);

    const mongo2 = plainToMongo(Clazz, plain);
    expect(mongo2.ints).toBeInstanceOf(Binary);
});
