import { expect, jest, test } from '@jest/globals';
import { Broker, BrokerAdapter, BrokerBusChannel, BrokerCacheKey, BrokerQueueChannel } from '../src/broker.js';
import { BrokerMemoryAdapter } from '../src/adapters/memory-adapter.js';

jest.setTimeout(10000);

export let adapterFactory: () => Promise<BrokerAdapter> = async () => new BrokerMemoryAdapter();

export function setAdapterFactory(factory: () => Promise<BrokerAdapter>) {
    adapterFactory = factory;
}

type User = { id: number, username: string, created: Date };

test('cache1', async () => {
    const broker = new Broker(await adapterFactory());


    type UserCache = BrokerCacheKey<User, 'user/:id', { id: number }>;
    broker.provideCache<UserCache>((parameters) => {
        return { id: parameters.id, username: 'peter', created: new Date };
    });

    const userCache = broker.cache<UserCache>();

    const entry = await userCache.get({ id: 2 });
    expect(entry).toEqual({ id: 2, username: 'peter', created: expect.any(Date) });
})

test('cache2', async () => {
    const broker = new Broker(await adapterFactory());

    const created = new Date;
    let called = 0;
    const builder = async () => {
        called++;
        return { id: 2, username: 'peter', created };
    };
    const entry1 = await broker.get<User>('user/' + 2, builder);
    expect(called).toBe(1);
    expect(entry1).toEqual({ id: 2, username: 'peter', created });

    const entry2 = await broker.get<User>('user/' + 2, builder);
    expect(called).toBe(1);
    expect(entry2).toEqual({ id: 2, username: 'peter', created });
});

test('cache3', async () => {
    const broker = new Broker(await adapterFactory());

    const entry = await broker.get('user/' + 2, async (): Promise<User> => {
        return { id: 2, username: 'peter', created: new Date };
    });
    expect(entry).toEqual({ id: 2, username: 'peter', created: expect.any(Date) });
});

test('bus', async () => {
    const broker = new Broker(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

    const channel = broker.bus<Events>('/events');

    await channel.subscribe((event) => {
        expect(event).toEqual({ type: 'user-created', id: 2 });
    });

    await channel.publish({ type: 'user-created', id: 2 });
});

test('bus2', async () => {
    const broker = new Broker(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };
    type EventChannel = BrokerBusChannel<Events, '/events'>;

    const channel = broker.busChannel<EventChannel>();

    await channel.subscribe((event) => {
        expect(event).toEqual({ type: 'user-created', id: 2 });
    });

    await channel.publish({ type: 'user-created', id: 2 });
});

test('lock', async () => {
    const broker = new Broker(await adapterFactory());

    const lock1 = broker.lock('my-lock', { ttl: 1000 });
    const lock2 = broker.lock('my-lock', { ttl: 1000 });

    await lock1.acquire();
    expect(lock1.acquired).toBe(true);
    expect(lock2.acquired).toBe(false);
    expect(await lock2.try()).toBe(undefined);
    expect(lock2.acquired).toBe(false);

    await lock1.release();
    expect(lock1.acquired).toBe(false);
});

test('lock2', async () => {
    const broker = new Broker(await adapterFactory());

    {
        const lock1 = await broker.lock('lock1').acquire();

        expect(lock1.acquired).toBe(true);
        expect(await broker.lock('lock1').try()).toBe(undefined);
        await lock1.release();
        expect(await lock1.isReserved()).toBe(false);
    }

    {
        const lock1 = await broker.lock('lock1').acquire();
        const lock2 = await broker.lock('lock2').try();
        expect(lock2).not.toBe(undefined);
        await lock2!.release();

        const lock1_2 = await broker.lock('lock1').try();
        expect(lock1_2).toBe(undefined);

        await lock1.release();
        const lock1_3 = await broker.lock('lock1').try();
        expect(lock1_3).not.toBe(undefined);
        await lock1_3!.release();
    }
});

test('queue', async () => {
    const broker = new Broker(await adapterFactory());

    type User = { id: number, username: string };
    type QueueA = BrokerQueueChannel<User, 'user/registered'>;

    const queue = broker.queue<QueueA>();

    const p = new Promise<any>(async (resolve) => {
        await queue.consume(async (message) => {
            console.log(message);
            resolve(message.data);
        });
    });

    await queue.produce({ id: 3, username: 'peter' });

    expect(await p).toEqual({ id: 3, username: 'peter' });
});
