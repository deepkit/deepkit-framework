import 'jest-extended'
import 'reflect-metadata';
import {f, getClassSchema, typedArrayMap, typedArrayNamesMap} from "../src/decorators";
import {classToPlain, plainToClass} from "../src/mapper";
import {eachPair} from '@marcj/estdlib';

test('mapping', async () => {
    class Clazz {
        @f Int8Array: Int8Array = new Int8Array();
        @f Uint8Array: Uint8Array = new Uint8Array();
        @f Uint8ClampedArray: Uint8ClampedArray = new Uint8ClampedArray();
        @f Int16Array: Int16Array = new Int16Array();
        @f Uint16Array: Uint16Array = new Uint16Array();
        @f Int32Array: Int32Array = new Int32Array();
        @f Uint32Array: Uint32Array = new Uint32Array();
        @f Float32Array: Float32Array = new Float32Array();
        @f Float64Array: Float64Array = new Float64Array();
    }

    const classSchema = getClassSchema(Clazz);
    for (const [i, v] of eachPair(classSchema.classProperties)) {
        expect(v.type).toBe(i);
        expect(typedArrayNamesMap.has(i as any)).toBe(true);
        expect(typedArrayMap.has(typedArrayNamesMap.get(i as any))).toBe(true);
    }
});

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

    const clazz2 = plainToClass(Clazz, plain);
    expect(clazz2.ints).toBeInstanceOf(Int8Array);
    expect(clazz2.ints[0]).toBe(1);
    expect(clazz2.ints[1]).toBe(64);
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

    const clazz2 = plainToClass(Clazz, plain);
    expect(clazz2.ints).not.toBeInstanceOf(Int8Array);
    expect(clazz2.ints).toBeInstanceOf(ArrayBuffer);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);
});
