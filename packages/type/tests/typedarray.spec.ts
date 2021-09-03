import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import {
    base64ToArrayBuffer,
    base64ToTypedArray,
    getClassSchema,
    getPropertyClassToXFunction,
    jsonSerializer,
    PropertySchema,
    t,
    typedArrayMap,
    typedArrayNamesMap,
    typedArrayToBase64,
    typedArrayToBuffer
} from '../index';
import { Buffer } from 'buffer';

test('mapping', async () => {
    class Clazz {
        @t Int8Array: Int8Array = new Int8Array();
        @t Uint8Array: Uint8Array = new Uint8Array();
        @t Uint8ClampedArray: Uint8ClampedArray = new Uint8ClampedArray();
        @t Int16Array: Int16Array = new Int16Array();
        @t Uint16Array: Uint16Array = new Uint16Array();
        @t Int32Array: Int32Array = new Int32Array();
        @t Uint32Array: Uint32Array = new Uint32Array();
        @t Float32Array: Float32Array = new Float32Array();
        @t Float64Array: Float64Array = new Float64Array();
    }

    const classSchema = getClassSchema(Clazz);
    for (const [i, v] of classSchema.getPropertiesMap().entries()) {
        expect(v.type).toBe(i);
        expect(typedArrayNamesMap.has(i as any)).toBe(true);
        expect(typedArrayMap.has(typedArrayNamesMap.get(i as any))).toBe(true);
    }
});

test('Int8Array', async () => {
    class Clazz {
        @t ints: Int8Array = new Int8Array();
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    clazz.ints[0] = 'a'.charCodeAt(0);
    clazz.ints[1] = 'm'.charCodeAt(0);

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('Int8Array');

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.ints.data).toBe('string');
    expect(plain.ints.data).toBe('YW0=');

    const clazz2 = jsonSerializer.for(Clazz).deserialize(plain);
    expect(clazz2.ints).toBeInstanceOf(Int8Array);
    expect(clazz2.ints[0]).toBe('a'.charCodeAt(0));
    expect(clazz2.ints[1]).toBe('m'.charCodeAt(0));
});

test('Float32Array', async () => {
    class Clazz {
        @t floats: Float32Array = new Float32Array();
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
    expect(base64ToArrayBuffer('AACAQ+Tqs0Y=').byteLength).toBe(8);
    expect(new Float32Array(base64ToArrayBuffer('AACAQ+Tqs0Y=')).length).toBe(2);
    expect(base64ToTypedArray('AACAQ+Tqs0Y=', Float32Array).length).toBe(2);

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.floats.data).toBe('string');
    expect(plain.floats.data).toBe('AACAQ+Tqs0Y=');


    //this errors since Buffer.buffer is corrupt
    // expect(Buffer.from('ab').buffer.byteLength).toBe(2);
    // expect(Buffer.from('AACAQ+Tqs0Y=', 'base64').buffer.byteLength).toBe(8);
    const buf = Buffer.from('AACAQ+Tqs0Y=', 'base64');
    const a32 = new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT);
    expect(a32.length).toBe(2);
    expect(a32[0]).toBe(256.0);
    expect(a32[1]).toBeCloseTo(23029.445, 3);

    expect(new Float32Array(new Uint8Array(Buffer.from('AACAQ/ZDCU8=', 'base64')).buffer).length).toBe(2);

    const clazz2 = jsonSerializer.for(Clazz).deserialize(plain);
    expect(clazz2.floats).toBeInstanceOf(Float32Array);
    expect(clazz2.floats.length).toBe(2);
    expect(clazz2.floats.byteLength).toBe(8);
    expect(Buffer.from(clazz2.floats.buffer, clazz2.floats.byteOffset, clazz2.floats.byteLength).byteLength).toBe(8);
    expect(Buffer.from(clazz2.floats.buffer, clazz2.floats.byteOffset, clazz2.floats.byteLength).length).toBe(8);
    expect(typedArrayToBuffer(clazz2.floats).byteLength).toBe(8);
    expect(typedArrayToBuffer(clazz2.floats).length).toBe(8);
    expect(typedArrayToBase64(clazz2.floats)).toBe('AACAQ+Tqs0Y=');

    expect(Buffer.from(clazz2.floats).toString('base64')).not.toBe('AACAQ+Tqs0Y=');
    // since node uses Buffer pooling, the underlying buffer is way bigger
    // expect(Buffer.from(clazz2.floats.buffer).toString('base64')).not.toBe('AACAQ+Tqs0Y=');

    expect(clazz2.floats.length).toBe(2);
    expect(clazz2.floats.byteLength).toBe(8);

    expect(clazz2.floats[0]).toBe(256.0);
    expect(clazz2.floats[1]).toBeCloseTo(23029.445, 3);
});

test('arrayBuffer', async () => {
    class Clazz {
        @t ints?: ArrayBuffer;
    }

    const clazz = new Clazz();
    clazz.ints = new Int8Array(2);
    (clazz.ints as Int8Array)[0] = 1;
    (clazz.ints as Int8Array)[1] = 64;

    expect(getClassSchema(Clazz).getProperty('ints').type).toBe('arrayBuffer');
    expect(new Int8Array(clazz.ints!)[0]).toBe(1);
    expect(new Int8Array(clazz.ints!)[1]).toBe(64);

    const plain = jsonSerializer.for(Clazz).serialize(clazz);
    expect(typeof plain.ints.data).toBe('string');
    expect(plain.ints.data).toBe('AUA=');

    const clazz2 = jsonSerializer.for(Clazz).deserialize(plain);
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
    const transport = {
        encoding: p.toJSONNonReference(),
        value: getPropertyClassToXFunction(p, jsonSerializer)(v)
    };

    expect((p.isTypedArray)).toBe(true);
    expect(transport.encoding.type).toBe('Uint8Array');
    expect(transport.value.data).toBe(v.toString('base64'));
});
