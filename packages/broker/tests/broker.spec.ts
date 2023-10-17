import { expect, jest, test } from '@jest/globals';
import { Broker, BrokerAdapter, BrokerBusChannel, BrokerCacheKey } from '../src/broker.js';
import { BrokerMemoryAdapter } from '../src/adapters/memory-adapter.js';

jest.setTimeout(30000);

export let adapterFactory: () => Promise<BrokerAdapter> = async () => new BrokerMemoryAdapter();

export function setAdapterFactory(factory: () => Promise<BrokerAdapter>) {
    adapterFactory = factory;
}

test('cache api', async () => {
    const broker = new Broker(await adapterFactory());

    type User = { id: number, username: string };

    {
        type UserCache = BrokerCacheKey<User, 'user/:id', { id: number }>;
        broker.provideCache<UserCache>((parameters) => {
            return { id: parameters.id, username: 'peter' };
        });

        const userCache = broker.cache<UserCache>();

        const entry = await userCache.get({ id: 2 });
        expect(entry).toEqual({ id: 2, username: 'peter' });
    }

    {
        const entry = await broker.get<User>('user/' + 2, async () => {
            return { id: 2, username: 'peter' };
        });
        expect(entry).toEqual({ id: 2, username: 'peter' });
    }

    {
        const entry = await broker.get('user/' + 2, async (): Promise<User> => {
            return { id: 2, username: 'peter' };
        });
        expect(entry).toEqual({ id: 2, username: 'peter' });
    }
});

test('bus api', async () => {
    const broker = new Broker(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };
    type EventChannel = BrokerBusChannel<Events, '/events'>;

    const channel = broker.bus<EventChannel>();

    await channel.subscribe((event) => {
        expect(event).toEqual({ type: 'user-created', id: 2 });
    });

    await channel.publish({ type: 'user-created', id: 2 });
});

test('lock api', async () => {
    const broker = new Broker(await adapterFactory());

    const lock1 = broker.lock('my-lock', { ttl: 1000 });
    const lock2 = broker.lock('my-lock', { ttl: 1000 });

    await lock1.acquire();
    expect(lock1.acquired).toBe(true);
    expect(lock2.acquired).toBe(false);
    expect(await lock2.try()).toBe(false);
    expect(lock2.acquired).toBe(false);

    await lock1.release();
    expect(lock1.acquired).toBe(false);
});
