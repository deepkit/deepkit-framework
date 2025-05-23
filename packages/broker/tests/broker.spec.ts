import { afterEach, expect, jest, test } from '@jest/globals';
import { BrokerAdapter, BrokerBus, BrokerBusChannel, BrokerLock, BrokerQueue, provideBusChannel, provideBusSubject } from '../src/broker.js';
import { BrokerMemoryAdapter } from '../src/adapters/memory-adapter.js';
import { sleep } from '@deepkit/core';
import { BrokerCache } from '../src/broker-cache.js';
import { QueueMessageProcessing } from '../src/model.js';
import { BrokerKeyValue } from '../src/broker-key-value.js';
import { InjectorContext, InjectorModule, provide } from '@deepkit/injector';
import { Subject } from 'rxjs';

jest.setTimeout(10000);

let lastAdapter: BrokerAdapter | undefined;
export let adapterFactory: () => Promise<BrokerAdapter> = async () => lastAdapter = new BrokerMemoryAdapter();

export function setAdapterFactory(factory: () => Promise<BrokerAdapter>) {
    adapterFactory = factory;
}

afterEach(async () => {
    if (lastAdapter) await lastAdapter.disconnect();
});

type User = { id: number, username: string, created: Date };

test('key-value 1', async () => {
    const keyValue = new BrokerKeyValue(await adapterFactory());

    const item = keyValue.item<number>('key1');
    expect(await item.get()).toBe(undefined);
    await item.set(23);
    expect(await item.get()).toBe(23);

    expect(await keyValue.get<number>('key1')).toBe(23);
    await keyValue.set<number>('key1', 24);
    expect(await item.get()).toBe(24);
});

test('key-value 2', async () => {
    const keyValue = new BrokerKeyValue(await adapterFactory());

    const item = keyValue.item<number>('key1');
    expect(await item.increment(2)).toBe(2);
    expect(await item.increment(2)).toBe(4);
    expect(await item.increment(-2)).toBe(2);
});

test('key-value 3', async () => {
    const keyValue = new BrokerKeyValue(await adapterFactory());

    const item = keyValue.item<number>('key1');
    expect(await item.increment(0)).toBe(0);
    expect(await item.increment(5)).toBe(5);
    expect(await item.increment(-2)).toBe(3);

    await item.remove();
    expect(await item.increment(0)).toBe(0);
});

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
    const adapter = await adapterFactory();
    const cache = new BrokerCache(adapter);

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
    await adapter.disconnect();
});

test('bus channel', async () => {
    const bus = new BrokerBus(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

    const channel = bus.channel<Events>('/events');

    await channel.subscribe((event) => {
        expect(event).toEqual({ type: 'user-created', id: 2 });
    });

    await channel.publish({ type: 'user-created', id: 2 });
});

test('bus channel injector', async () => {
    const bus = new BrokerBus(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };
    type EventChannel = BrokerBusChannel<Events>;

    const module = new InjectorModule([
        provide<BrokerBus>({ useValue: bus }),
        provideBusChannel<EventChannel>('user-events'),
    ]);
    const injector = new InjectorContext(module);

    const channel1 = injector.get<EventChannel>();
    const channel2 = injector.get<EventChannel>();
    expect(channel1 === channel2).toBe(true);
    const events: Events[] = [];
    await channel2.subscribe((event) => {
        events.push(event);
    });
    await channel1.publish({ type: 'user-created', id: 2 });
    await sleep(0.1);
    expect(events.length).toBe(1);
});

test('bus subject', async () => {
    const bus = new BrokerBus(await adapterFactory());
    const handles: BrokerBus['subjectHandles'] = (bus as any).subjectHandles;

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

    const caughtEvents: Events[] = [];

    async function call() {
        const subject1 = bus.subject<Events>('/events');
        const subject2 = bus.subject<Events>('/events');
        subject2.subscribe((event) => {
            caughtEvents.push(event);
        });
        subject1.next({ type: 'user-created', id: 2 });
        await sleep(0.1);
    }

    await call();
    expect(handles.size).toBe(1);
    expect(caughtEvents.length).toBe(1);
    await sleep(0.1);
    (global as any).gc();
    await sleep(0.1);
    expect(handles.size).toBe(0);
});

test('bus subject injector', async () => {
    const bus = new BrokerBus(await adapterFactory());

    type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };
    type EventSubject = Subject<Events>;
    type EventSubject2 = Subject<{ type: 'another' }>;

    const module = new InjectorModule([
        provide<BrokerBus>({ useValue: bus }),
        provideBusSubject<EventSubject>('user-events'),
        provideBusSubject<EventSubject2>('another'),
    ]);
    const injector = new InjectorContext(module);

    const subject1 = injector.get<EventSubject>();
    const events: Events[] = [];
    subject1.subscribe((event) => {
        events.push(event);
    });
    const subject2 = injector.get<EventSubject>();
    expect(subject1 === subject2).toBe(false);
    subject2.next({ type: 'user-created', id: 2 });
    await sleep(0.1);
    expect(events).toEqual([
        { type: 'user-created', id: 2 },
    ]);
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

test('lock dispose', async () => {
    const lock = new BrokerLock(await adapterFactory());

    const lock1 = lock.item('my-lock', { ttl: 500 });

    {
            await using hold = await lock1.hold();
        expect(lock1.acquired).toBe(true);
    }

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
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

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

    await sleep(0);
    await adapter.disconnect();
});

test('queue message process exactly once options for broker channel', async () => {
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered', {
        process: QueueMessageProcessing.exactlyOnce,
    });

    let consumed: number = 0;
    await channel.consume(() => {
        consumed++;
    });

    await channel.produce({ id: 3, username: 'peter' });

    await channel.produce({ id: 3, username: 'peter' });

    expect(consumed).toBe(1);

    await adapter.disconnect();
});

test('queue message process exactly once with deduplication interval options for broker channel', async () => {
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered', {
        process: QueueMessageProcessing.exactlyOnce,
        deduplicationInterval: '1s',
    });

    let consumed: number = 0;
    await channel.consume(() => {
        consumed++;
    });

    await channel.produce({ id: 3, username: 'peter' });

    await sleep(1);

    await channel.produce({ id: 3, username: 'peter' });

    expect(consumed).toBe(2);

    await sleep(0);
    await adapter.disconnect();
});

test('queue message process exactly once options for producer', async () => {
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered', {
        process: QueueMessageProcessing.atLeastOnce,
    });

    let consumed: number = 0;
    await channel.consume(() => {
        consumed++;
    });

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
    });

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
    });

    expect(consumed).toBe(1);
    await sleep(0);
    await adapter.disconnect();
});

test('queue message process exactly once with deduplication interval options for producer', async () => {
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered', {
        process: QueueMessageProcessing.atLeastOnce,
    });

    let consumed: number = 0;
    await channel.consume(() => {
        consumed++;
    });

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
        deduplicationInterval: '1s',
    });

    await sleep(1);

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
        deduplicationInterval: '1s',
    });

    expect(consumed).toBe(2);

    await sleep(0);
    await adapter.disconnect();
});

test('queue message process exactly once with custom hash for producer', async () => {
    const adapter = await adapterFactory();
    const queue = new BrokerQueue(adapter);

    type User = { id: number, username: string };

    const channel = queue.channel<User>('user/registered', {
        process: QueueMessageProcessing.atLeastOnce,
    });

    let consumed: number = 0;
    await channel.consume(() => {
        consumed++;
    });

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
        hash: 1,
    });

    await channel.produce({ id: 3, username: 'peter' }, {
        process: QueueMessageProcessing.exactlyOnce,
        hash: 2,
    });

    expect(consumed).toBe(2);

    await sleep(0);
    await adapter.disconnect();
});
