import {Buffer} from 'buffer';

export interface TypedArrayClassType<T> {
    new(...args: any[]): T;

    readonly BYTES_PER_ELEMENT: number;
}

export interface TypedArray {
    /**
     * The size in bytes of each element in the array.
     */
    readonly BYTES_PER_ELEMENT: number;

    /**
     * The ArrayBuffer instance referenced by the array.
     */
    readonly buffer: ArrayBufferLike;

    /**
     * The length of the array.
     */
    readonly length: number;

    /**
     * The length in bytes of the array.
     */
    readonly byteLength: number;

    /**
     * The offset in bytes of the array.
     */
    readonly byteOffset: number;
}

export function nodeBufferToTypedArray<K>(buf: Buffer, type: TypedArrayClassType<K>): K {
    return new type(buf.buffer, buf.byteOffset, buf.length / type.BYTES_PER_ELEMENT);
}

/**
 * When using Buffer.from() node is using a buffer from the buffer pool.
 * This makes it necessary to create the given TypedArray using byteOffset and byteLength accordingly.
 *
 * Note: The created TypedArray.buffer is pointing probably to a larger Buffer. Make sure
 * to use byteLength/byeOffset correctly or use typedArrayToArrayBuffer() if you want to use
 * a raw ArrayBuffer that represents the actual data correctly.
 */
export function base64ToTypedArray<K>(base64: string, type: TypedArrayClassType<K>): K {
    return nodeBufferToTypedArray(Buffer.from(base64, 'base64'), type);
}

/**
 * Creates a new fresh ArrayBuffer with given data.
 * Note: Regular Buffer.from(base64, 'base64) creates in Node a shared buffer, this function makes
 * sure a copy happens and the ArrayBuffer is not shared.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    return nodeBufferToArrayBuffer(Buffer.from(base64, 'base64'));
}

/**
 * When using Buffer.from() node is using a buffer from the buffer pool.
 * This makes it necessary to create the a new ArrayType using slice to make a copy.
 *
 * This makes a copy.
 */
export function nodeBufferToArrayBuffer<K>(buf: Buffer): ArrayBuffer {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * In node environment the TypedArray.buffer is probably a larger buffer from the buffer pool.
 * This makes it necessary to create a Buffer with offset & length so that it accurately represents
 * the given TypedArray.
 */
export function typedArrayToBuffer<K>(typedArray: TypedArray): Buffer {
    return Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
}

export function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
    return Buffer.from(arrayBuffer).toString('base64');
}

export function typedArrayToBase64(typedArray: TypedArray): string {
    return typedArrayToBuffer(typedArray).toString('base64');
}

/**
 * Same as Buffer.from() but creates a ArrayBuffer that is not shared.
 */
export function arrayBufferFrom(data: string, encoding?: string): ArrayBuffer {
    return nodeBufferToArrayBuffer(Buffer.from(data, encoding as any));
}


/**
 * Same as Buffer.from(arrayBuffer).toString(encoding), but more in line with the current API.
 */
export function arrayBufferTo(arrayBuffer: ArrayBuffer, encoding?: string | 'utf8' | 'base64' | 'ascii') {
    return Buffer.from(arrayBuffer).toString(encoding);
}
