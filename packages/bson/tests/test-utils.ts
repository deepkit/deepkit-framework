import { expect } from '@deepkit/run/expect';

import { SerializeResult } from '../index.js';

/**
 * Compare serialized BSON bytes against expected buffer.
 * Handles Buffer vs Uint8Array comparison using Array.from().
 */
export function expectBytes(result: SerializeResult, expected: Uint8Array | Buffer): void {
    const [buffer, size] = result;
    expect(Array.from(buffer.subarray(0, size))).toEqual(Array.from(expected));
}

/**
 * Extract buffer slice from SerializeResult tuple.
 */
export function toBuffer(result: SerializeResult): Uint8Array {
    const [buffer, size] = result;
    return buffer.slice(0, size);
}
