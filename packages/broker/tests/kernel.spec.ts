import { sleep } from '@deepkit/core';
import { AsyncSubscription } from '@deepkit/core-rxjs';
import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { BehaviorSubject } from 'rxjs';
import { BrokerDirectClient } from '../src/client';
import { BrokerKernel } from '../src/kernel';

test('basics', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    await client.set('id', schema, { v: 123 });

    {
        const v = await client.getOrUndefined('id', schema);
        expect(v).toEqual({ v: 123 });
    }

    {
        const v = await client.getOrUndefined('id-unknown', schema);
        expect(v).toBe(undefined);
    }

    {
        await client.increment('inc', 5);
        expect(await client.getIncrement('inc')).toBe(5);
        await client.increment('inc', 5);
        await client.increment('inc', 5);
        expect(await client.getIncrement('inc')).toBe(15);
    }

    {
        await client.delete('inc');
        expect(await client.getOrUndefined('inc', schema)).toBe(undefined);
    }
});


test('pub-sub', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const subject = new BehaviorSubject<any>(undefined);
    await client.subscribe('channel1', schema, v => subject.next(v));

    await client.publish('channel1', schema, { v: 1345 });
    await sleep(0.01);
    expect(subject.value).toEqual({ v: 1345 });

    await client.publish('channel1', schema, { v: 555 });
    await sleep(0.01);
    expect(subject.value).toEqual({ v: 555 });
});

test('lock', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    {
        const lock1 = await client.lock('lock1');

        expect(await client.isLocked('lock1')).toBe(true);
        await lock1.unsubscribe();
        expect(await client.isLocked('lock1')).toBe(false);
    }

    {
        const lock1 = await client.lock('lock1');
        const lock2 = await client.tryLock('lock2');
        expect(lock2).toBeInstanceOf(AsyncSubscription);
        
        const lock1_2 = await client.tryLock('lock1');
        expect(lock1_2).toBe(undefined);

        await lock1.unsubscribe();
        const lock1_3 = await client.tryLock('lock1');
        expect(lock1_3).toBeInstanceOf(AsyncSubscription);
    }
});

test('entity-fields', async () => {
    const kernel = new BrokerKernel();
    const client1 = new BrokerDirectClient(kernel);
    const client2 = new BrokerDirectClient(kernel);

    {
        const sub = await client1.publishEntityFields('model', ['foo', 'bar']);
        expect(await client1.getEntityFields('model')).toEqual(['foo', 'bar']);
        await sub.unsubscribe();
        expect(await client1.getEntityFields('model')).toEqual([]);
    }

    {
        const sub = await client1.publishEntityFields('model', ['foo', 'bar']);
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar']);
        await sub.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual([]);
    }
});