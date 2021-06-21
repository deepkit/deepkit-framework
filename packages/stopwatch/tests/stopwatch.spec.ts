import { Stopwatch, StopwatchStore } from '../src/stopwatch';
import { FrameCategory } from '../src/types';
import { expect, test } from '@jest/globals';

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
