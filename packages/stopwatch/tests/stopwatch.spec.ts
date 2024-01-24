import { expect, test } from '@jest/globals';

import { Stopwatch, StopwatchStore } from '../src/stopwatch.js';
import { FrameCategory, decodeCompoundKey, encodeCompoundKey } from '../src/types.js';

class Store extends StopwatchStore {
    getZone(): { [p: string]: any } | undefined {
        return undefined;
    }

    async run<T>(data: { [p: string]: any }, cb: () => Promise<T>): Promise<T> {
        throw new Error('Not implemented');
    }
}

test('frame', () => {
    const store = new Store();
    const stopwatch = new Stopwatch(store);
    const frame = stopwatch.start('/images/logo.png', FrameCategory.http, true);
    frame.data({ url: '/images/logo.png', clientIp: '127.0.0.1', method: 'GET' });
    frame.end();

    expect(store.frameQueue.length).toBe(2);
    expect(store.dataQueue.length).toBe(1);
});

test('cid', () => {
    expect(encodeCompoundKey(1, 0)).toBe(256);
    expect(encodeCompoundKey(1, 1)).toBe(257);
    expect(encodeCompoundKey(2, 0)).toBe(512);
    expect(encodeCompoundKey(3, 0)).toBe(768);
    expect(encodeCompoundKey(3, 1)).toBe(769);

    expect(decodeCompoundKey(encodeCompoundKey(0, 0))).toEqual([0, 0]);
    expect(decodeCompoundKey(encodeCompoundKey(1, 0))).toEqual([1, 0]);
    expect(decodeCompoundKey(encodeCompoundKey(2, 0))).toEqual([2, 0]);
    expect(decodeCompoundKey(encodeCompoundKey(0, 1))).toEqual([0, 1]);
    expect(decodeCompoundKey(encodeCompoundKey(1, 1))).toEqual([1, 1]);
    expect(decodeCompoundKey(encodeCompoundKey(2, 1))).toEqual([2, 1]);
});
