import { expect, test } from '@jest/globals';
import { BrokerState } from '../src/kernel.js';
import { restoreState, snapshotState } from '../src/snapshot';
import { QueueMessageState } from '../src/model.js';
import {hash} from "../src/utils";

test('snapshot', () => {
    const state = new BrokerState();

    state.queues.set('test', {
        currentId: 2,
        messages: new Map([
            ['f59c78c4', { id: 1, tries: 1, state: QueueMessageState.inFlight, v: new Uint8Array([1, 2, 3]), lastError: 'error', delay: 0 }],
            ['54728d95', { id: 2, tries: 0, state: QueueMessageState.pending, v: new Uint8Array([3, 3, 3]), delay: 0 }],
        ]),
        consumers: [],
        name: 'test',
    });

    state.queues.set('test2', {
        currentId: 2,
        messages: new Map([
            ['cff47f20', { id: 1, tries: 0, state: QueueMessageState.pending, v: new Uint8Array([5, 5, 5]), delay: 0 }],
            ['65297411', { id: 2, tries: 0, state: QueueMessageState.pending, v: new Uint8Array([4, 4, 4]), delay: 0 }],
        ]),
        consumers: [],
        name: 'test2',
    });

    const chunks: Uint8Array[] = [];
    snapshotState(state, (v) => {
        chunks.push(v);
    });

    const buffer = Buffer.concat(chunks);

    const newState = new BrokerState();
    let offset = 0;
    restoreState(newState, (size: number) => {
        const res = buffer.subarray(offset, offset + size);
        offset += res.byteLength;
        return res;
    });

    expect(newState.queues).toEqual(state.queues);
});
