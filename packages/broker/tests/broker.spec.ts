import { afterEach, expect, jest, test } from '@jest/globals';
import { BrokerAdapter, BrokerBus,  BrokerLock, BrokerQueue } from '../src/broker.js';
import { BrokerMemoryAdapter } from '../src/adapters/memory-adapter.js';
import { sleep } from '@deepkit/core';
import { BrokerCache } from '../src/broker-cache.js';

jest.setTimeout(10000);

let lastAdapter: BrokerAdapter | undefined;
export let adapterFactory: () => Promise<BrokerAdapter> = async () => lastAdapter = new BrokerMemoryAdapter();

export function setAdapterFactory(factory: () => Promise<BrokerAdapter>) {
    adapterFactory = factory;
}

afterEach(() => {
    if (lastAdapter) lastAdapter.disconnect();
});

type User = { id: number, username: string, created: Date };

test('cache2', async () => {
    const cache = new BrokerCache(await adapterFactory());

    const created = new Date;
    let called = 0;
    const builder = async () => {
        called++;
        return { id: 2, username: 'peter', created };
    };

    const item = cache.item<User>('user/' + 2, builder);

    const entry1 = await item.get();
    expect(called).toBe(1);
    expect(entry1).toEqual({ id: 2, username: 'peter', created });

    const entry2 = await item.get();
    expect(called).toBe(1);
    expect(entry2).toEqual({ id: 2, username: 'peter', created });

    const entry3 = await cache.item<User>('user/' + 2, builder).get();
    expect(called).toBe(1);
    expect(entry3).toEqual({ id: 2, username: 'peter', created });

    await item.invalidate();
    const entry4 = await item.get();
    expect(called).toBe(2);
    expect(entry4).toEqual({ id: 2, username: 'peter', created });
});

test('cache3', async () => {
    const cache = new BrokerCache(await adapterFactory());

    let build = 0;
    const item = cache.item<number>('key', async () => {
        return build++;
    }, { ttl: '100ms' });

    expect(await item.exists()).toBe(false);

    const entry1 = await item.get();
    expect(entry1).toBe(0);
    expect(await item.exists()).toBe(true);

    await sleep(0.01);

    const entry2 = await item.get();
    expect(entry2).toBe(0);

    await sleep(0.105);

    expect(await item.exists()).toBe(false);
    const entry3 = await item.get();
    expect(entry3).toBe(1);
});

test('bus', async () => {
    const bus = new BrokerBus(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

    const channel = bus.channel<Events>('/events');

    await channel.subscribe((event) => {
        expect(event).toEqual({ type: 'user-created', id: 2 });
    });

    await channel.publish({ type: 'user-created', id: 2 });
});

test('lock', async () => {
    const lock = new BrokerLock(await adapterFactory());

    const lock1 = lock.item('my-lock', { ttl: 1000 });
    const lock2 = lock.item('my-lock', { ttl: 1000 });

    await lock1.acquire();
    expect(lock1.acquired).toBe(true);
    expect(lock2.acquired).toBe(false);
    expect(await lock2.try()).toBe(undefined);
    expect(lock2.acquired).toBe(false);

    await lock1.release();
    expect(lock1.acquired).toBe(false);
});

test('lock2', async () => {
    const lock = new BrokerLock(await adapterFactory());

    {
        const lock1 = await lock.item('lock1').acquire();

        expect(lock1.acquired).toBe(true);
        expect(await lock.item('lock1').try()).toBe(undefined);
        await lock1.release();
        expect(await lock1.isReserved()).toBe(false);
    }

    {
        const lock1 = await lock.item('lock1').acquire();
        const lock2 = await lock.item('lock2').try();
        expect(lock2).not.toBe(undefined);
        await lock2!.release();

        const lock1_2 = await lock.item('lock1').try();
        expect(lock1_2).toBe(undefined);

        await lock1.release();
        const lock1_3 = await lock.item('lock1').try();
        expect(lock1_3).not.toBe(undefined);
        await lock1_3!.release();
    }
});

test('queue', async () => {
    const queue = new BrokerQueue(await adapterFactory());

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered');

    const p = new Promise<any>(async (resolve) => {
        await channel.consume(async (message) => {
            console.log(message);
            resolve(message.data);
        });
    });

    await channel.produce({ id: 3, username: 'peter' });

    expect(await p).toEqual({ id: 3, username: 'peter' });
});

test('queue message deduplication', async () => {
    const queue = new BrokerQueue(await adapterFactory());

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered');

    const cb: jest.Mock<Parameters<typeof channel.consume>[0]> = jest.fn();

    await channel.consume(cb);

    await channel.produce({ id: 3, username: 'peter' });

    await channel.produce({ id: 3, username: 'peter' });

    expect(cb).toHaveBeenCalledTimes(1);
});
