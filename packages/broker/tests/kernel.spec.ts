import { sleep } from '@deepkit/core';
import { AsyncSubscription } from '@deepkit/core-rxjs';
import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { BehaviorSubject } from 'rxjs';
import { BrokerDirectClient } from '../src/client';
import { BrokerKernel } from '../src/kernel';

Error.stackTraceLimit = 1000;

test('basics', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const keyId = client.key('id', schema);
    await keyId.set({ v: 123 });

    {
        const v = await keyId.get();
        expect(v).toEqual({ v: 123 });
    }

    {
        const v = await keyId.getOrUndefined();
        expect(v).toEqual({ v: 123 });
    }

    {
        const v = await client.key('id-unknown', schema).getOrUndefined();
        expect(v).toBe(undefined);
    }

    {
        let n = await client.increment('inc', 5);
        expect(n).toBe(5);
        expect(await client.getIncrement('inc')).toBe(5);
        n = await client.increment('inc', 5);
        expect(n).toBe(10);
        n = await client.increment('inc', 5);
        expect(n).toBe(15);
        expect(await client.getIncrement('inc')).toBe(15);
    }

    {
        await client.delete('inc');
        expect(await client.key('inc', schema).getOrUndefined()).toBe(undefined);
    }
});


test('pub-sub', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    {
        const schema = t.schema({ value: t.number });

        const subject = new BehaviorSubject<any>(undefined);
        const channel1 = client.channel('channel1', schema);
        await channel1.subscribe(v => subject.next(v));

        await channel1.publish({ value: 1345 });
        await sleep(0);
        expect(subject.value).toEqual({ value: 1345 });

        await channel1.publish({ value: 555 });
        await sleep(0);
        expect(subject.value).toEqual({ value: 555 });
    }

    {
        const subject = new BehaviorSubject<any>(undefined);
        const channel2 = client.channel('channel2', t.string);
        await channel2.subscribe(v => subject.next(v));
        await channel2.publish('myValue');
        await sleep(0);
        expect(subject.value).toEqual('myValue');
    }

    {
        const subject = new BehaviorSubject<any>(undefined);
        const channel3 = client.channel('channel3', t.number);
        await channel3.subscribe(v => subject.next(v));
        await channel3.publish(123132);
        await sleep(0);
        expect(subject.value).toEqual(123132);
    }

    {
        const ClassA = t.schema({
            type: t.literal('a').discriminant,
            name: t.string,
        });
        const ClassB = t.schema({
            type: t.literal('b').discriminant,
            id: t.number,
        });
        const subject = new BehaviorSubject<any>(undefined);
        const channel4 = client.channel('channel4', t.union(ClassA, ClassB));
        await channel4.subscribe(v => subject.next(v));
        await channel4.publish({ type: 'a', name: 'bar' });
        await sleep(0);
        expect(subject.value).toEqual({ type: 'a', name: 'bar' });
        expect(subject.value).toBeInstanceOf(ClassA.classType);

        await channel4.publish({ type: 'b', id: 555 });
        await sleep(0);
        expect(subject.value).toEqual({ type: 'b', id: 555 });
        expect(subject.value).toBeInstanceOf(ClassB.classType);
    }
});

test('lock', async () => {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    {
        const lock1 = await client.lock('lock1');

        expect(await client.isLocked('lock1')).toBe(true);
        expect(await client.tryLock('lock1')).toBe(undefined);
        await lock1.unsubscribe();
        expect(await client.isLocked('lock1')).toBe(false);
    }

    {
        const lock1 = await client.lock('lock1');
        const lock2 = await client.tryLock('lock2');
        expect(lock2).toBeInstanceOf(AsyncSubscription);
        await lock2!.unsubscribe();

        const lock1_2 = await client.tryLock('lock1');
        expect(lock1_2).toBe(undefined);

        await lock1.unsubscribe();
        const lock1_3 = await client.tryLock('lock1');
        expect(lock1_3).toBeInstanceOf(AsyncSubscription);
        await lock1_3!.unsubscribe();
    }
});

test('entity-fields', async () => {
    const kernel = new BrokerKernel();
    const client1 = new BrokerDirectClient(kernel);
    const client2 = new BrokerDirectClient(kernel);

    {
        expect(await client1.getEntityFields('model')).toEqual([]);
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

    {
        const sub1 = await client1.publishEntityFields('model', ['foo', 'bar']);
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar']);
        const sub2 = await client1.publishEntityFields('model', ['foo', 'bar', 'another']);
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar', 'another']);

        await sub2.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar']);
        await sub1.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual([]);
    }

    {
        const sub1 = await client1.publishEntityFields('model', ['foo', 'bar']);
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar']);
        const sub2 = await client1.publishEntityFields('model', ['foo', 'bar', 'field3']);
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar', 'field3']);

        await sub2.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual(['foo', 'bar']);
        const sub3 = await client1.publishEntityFields('model', ['field4']);
        await sub1.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual(['field4']);
        await sub3.unsubscribe();
        expect(await client2.getEntityFields('model')).toEqual([]);
    }
});
