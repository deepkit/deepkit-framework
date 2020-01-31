import 'jest-extended'
import 'reflect-metadata';
import {f, getClassSchema, isTypedArray, PropertySchema, typedArrayMap, typedArrayNamesMap} from "../src/decorators";
import {classToPlain, plainToClass, propertyClassToPlain} from "../src/mapper";
import {eachPair} from '@marcj/estdlib';
import {Buffer} from 'buffer';
import {base64ToTypedArray, typedArrayToBase64, typedArrayToBuffer} from "..";

const someText = `Loµ˚∆¨¥§∞¢´´†¥¨¨¶§∞¢®©˙∆rem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`;


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
    clazz.ints[0] = 'a'.charCodeAt(0);
    clazz.ints[1] = 'm'.charCodeAt(0);

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('Int8Array');

    const plain = classToPlain(Clazz, clazz);
    expect(plain.ints).toBeString();
    expect(plain.ints).toBe('YW0=');

    const clazz2 = plainToClass(Clazz, plain);
    expect(clazz2.ints).toBeInstanceOf(Int8Array);
    expect(clazz2.ints[0]).toBe('a'.charCodeAt(0));
    expect(clazz2.ints[1]).toBe('m'.charCodeAt(0));
});


test('bencharmk', async () => {
    const count = 20_0000;

    const base64 = Buffer.from(someText).toString('base64');

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            new Uint8Array(new Uint8Array(Buffer.from(base64, 'base64')).buffer).buffer;
        }
        console.log('Buffer double convertion took', performance.now() - start, 'for', count, 'iterations', (performance.now() - start)/count, 'ms per item');
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            base64ToTypedArray(base64, Uint8Array).buffer;
        }
        console.log('base64ToTypedArray took', performance.now() - start, 'for', count, 'iterations', (performance.now() - start)/count, 'ms per item');
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            new Uint8Array(Buffer.from(base64, 'base64')).buffer
        }
        console.log('Uint8Array().buffer took', performance.now() - start, 'for', count, 'iterations', (performance.now() - start)/count, 'ms per item');
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            new Uint8Array(Buffer.from(base64, 'base64')).buffer
        }
        console.log('Uint8Array().buffer took', performance.now() - start, 'for', count, 'iterations', (performance.now() - start)/count, 'ms per item');
    }
});

test('Float32Array', async () => {
    class Clazz {
        @f floats: Float32Array = new Float32Array();
    }

    const clazz = new Clazz();
    clazz.floats = new Float32Array(2);
    clazz.floats[0] = 256.0;
    clazz.floats[1] = 23029.445;
    console.log(clazz.floats);

    expect(clazz.floats.buffer.byteLength).toBe(8);
    expect(clazz.floats.buffer.byteLength).toBe(Float32Array.BYTES_PER_ELEMENT * 2);
    // expect(Buffer.from(clazz.floats).byteLength).toBe(Float32Array.BYTES_PER_ELEMENT * 2);
    expect(Buffer.from(clazz.floats.buffer).byteLength).toBe(Float32Array.BYTES_PER_ELEMENT * 2);

    expect(getClassSchema(Clazz).getProperty('floats').type).toBe('Float32Array');

    expect(typedArrayToBase64(clazz.floats)).toBe('AACAQ+Tqs0Y=');

    const plain = classToPlain(Clazz, clazz);
    expect(plain.floats).toBeString();
    expect(plain.floats).toBe('AACAQ+Tqs0Y=');


    //this errors since Buffer.buffer is corrupt
    // expect(Buffer.from('ab').buffer.byteLength).toBe(2);
    // expect(Buffer.from('AACAQ+Tqs0Y=', 'base64').buffer.byteLength).toBe(8);
    const buf = Buffer.from('AACAQ+Tqs0Y=', 'base64');
    const a32 = new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT);
    expect(a32.length).toBe(2);
    expect(a32[0]).toBe(256.0);
    expect(a32[1]).toBeCloseTo(23029.445, 3);

    expect(new Float32Array(new Uint8Array(Buffer.from('AACAQ/ZDCU8=', 'base64')).buffer).length).toBe(2);

    const clazz2 = plainToClass(Clazz, plain);
    expect(clazz2.floats).toBeInstanceOf(Float32Array);
    expect(clazz2.floats.length).toBe(2);
    expect(clazz2.floats.byteLength).toBe(8);
    expect(Buffer.from(clazz2.floats.buffer, clazz2.floats.byteOffset, clazz2.floats.byteLength).byteLength).toBe(8);
    expect(Buffer.from(clazz2.floats.buffer, clazz2.floats.byteOffset, clazz2.floats.byteLength).length).toBe(8);
    expect(typedArrayToBuffer(clazz2.floats).byteLength).toBe(8);
    expect(typedArrayToBuffer(clazz2.floats).length).toBe(8);
    expect(typedArrayToBase64(clazz2.floats)).toBe('AACAQ+Tqs0Y=');

    expect(Buffer.from(clazz2.floats).toString('base64')).not.toBe('AACAQ+Tqs0Y=');
    //since node uses Buffer pooling, the underlying buffer is way bigger
    expect(Buffer.from(clazz2.floats.buffer).toString('base64')).not.toBe('AACAQ+Tqs0Y=');

    expect(clazz2.floats.length).toBe(2);
    expect(clazz2.floats.byteLength).toBe(8);

    expect(clazz2.floats[0]).toBe(256.0);
    expect(clazz2.floats[1]).toBeCloseTo(23029.445, 3);
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
    expect(clazz2.ints!.byteLength).toBe(2);
    expect(new Int8Array(clazz2.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz2.ints!)[1]).toBe(64);
});


test('Buffer compat', () => {
    const p = new PropertySchema('result');
    const v = Buffer.from('Peter', 'utf8');

    p.setFromJSValue(v);

    expect(p.type).toBe('Uint8Array');
    const transport =  {
        encoding: p.toJSON(),
        value: propertyClassToPlain(Object, 'result', v, p),
    };

    expect(isTypedArray(p.type)).toBe(true);
    expect(transport.encoding.type).toBe('Uint8Array');
    expect(transport.value).toBe(v.toString('base64'));
});
