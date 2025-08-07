/** @group Binary */

declare const Buffer: any;

/**
 * Create a buffer of the given size (uninitialized, so it may contain random data).
 *
 * Note that the result is either Uin8Array or Buffer, depending on the environment.
 * Buffer from NodeJS works slightly different than Uint8Array.
 */
export const createBuffer: (size: number) => Uint8Array = 'undefined' !== typeof Buffer && 'function' === typeof Buffer.allocUnsafe ? Buffer.allocUnsafe : (size) => new Uint8Array(size);

/**
 * Concat multiple buffers into one.
 */
export function bufferConcat(chunks: Uint8Array[], length?: number): Uint8Array {
    if (undefined === length) {
        length = 0;
        for (const chunk of chunks) length += chunk.length;
    }

    const result = createBuffer(length);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

const textEncoder = new TextDecoder();

export const uint8ArrayToUtf8 = 'undefined' !== typeof Buffer ? (buffer: Uint8Array) => Buffer.from(buffer).toString('utf8') : (buffer: Uint8Array) => textEncoder.decode(buffer);

/**
 * Convert a buffer to a string.
 */
export function bufferToString(buffer: string | Uint8Array): string {
    if ('string' === typeof buffer) return buffer;
    return uint8ArrayToUtf8(buffer);
}

export function nativeBase64ToUint8Array(base64: string): Uint8Array {
    const raw = atob(base64);
    const rawLength = raw.length;
    const array = createBuffer(rawLength);

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

/**
 * Converts a base64 string to a Uint8Array.
 */
export const base64ToUint8Array: (v: string) => Uint8Array = 'undefined' === typeof Buffer ? nativeBase64ToUint8Array : (base64: string) => Buffer.from(base64, 'base64');
