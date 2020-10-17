import {Buffer} from 'buffer';

export type Types =
    'objectId'
    | 'uuid'
    | 'literal'
    | 'class'
    | 'map'
    | 'partial'
    | 'patch'
    | 'array'
    | 'union'
    | 'moment'
    | 'date'
    | 'enum'
    | 'any'
    | 'string'
    | 'number'
    | 'boolean'
    | 'Int8Array'
    | 'Uint8Array'
    | 'Uint8ClampedArray'
    | 'Int16Array'
    | 'Uint16Array'
    | 'Int32Array'
    | 'Uint32Array'
    | 'Float32Array'
    | 'Float64Array'
    | 'arrayBuffer';

/**
 * Type for @f.partial().
 *
 * Differs to standard Partial<> in a way that it supports sub class fields using dot based paths (like mongoDB)
 */
export type PartialField<T> = {
    [P in keyof T & string]?: T[P]
} & {
    //it's currently not possible to further define it
    //https://github.com/Microsoft/TypeScript/issues/12754
    [path: string]: any
}

export type PartialEntity<T> = { [name in keyof T & string]?: T[name] };

export const typedArrayMap = new Map<any, Types>();
typedArrayMap.set(String, 'string');
typedArrayMap.set(Number, 'number');
typedArrayMap.set(Date, 'date');
typedArrayMap.set(Boolean, 'boolean');
typedArrayMap.set(Int8Array, 'Int8Array');
typedArrayMap.set(Buffer, 'Uint8Array');
typedArrayMap.set(Uint8Array, 'Uint8Array');
typedArrayMap.set(Uint8ClampedArray, 'Uint8ClampedArray');
typedArrayMap.set(Int16Array, 'Int16Array');
typedArrayMap.set(Uint16Array, 'Uint16Array');
typedArrayMap.set(Int32Array, 'Int32Array');
typedArrayMap.set(Uint32Array, 'Uint32Array');
typedArrayMap.set(Float32Array, 'Float32Array');
typedArrayMap.set(Float64Array, 'Float64Array');
typedArrayMap.set(ArrayBuffer, 'arrayBuffer');

export type TypedArrays = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Uint8ClampedArray | Float32Array | Float64Array;

export const typedArrayNamesMap = new Map<Types, any>();
typedArrayNamesMap.set('Int8Array', Int8Array);
typedArrayNamesMap.set('Uint8Array', Uint8Array);
typedArrayNamesMap.set('Uint8ClampedArray', Uint8ClampedArray);
typedArrayNamesMap.set('Int16Array', Int16Array);
typedArrayNamesMap.set('Uint16Array', Uint16Array);
typedArrayNamesMap.set('Int32Array', Int32Array);
typedArrayNamesMap.set('Uint32Array', Uint32Array);
typedArrayNamesMap.set('Float32Array', Float32Array);
typedArrayNamesMap.set('Float64Array', Float64Array);

export const binaryTypes: Types[] = [...typedArrayNamesMap.keys(), 'arrayBuffer'];
