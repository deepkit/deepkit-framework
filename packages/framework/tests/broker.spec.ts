import { BrokerKernel } from '@deepkit/broker';
import { sleep } from '@deepkit/core';
import { cast, entity, PrimaryKey, UUID, uuid } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { BehaviorSubject } from 'rxjs';
import { DirectBroker, EntityChannelMessageType } from '../src/lib/broker/broker.js';

test('entity channel number', async () => {
    const kernel = new BrokerKernel();
    const client = new DirectBroker(kernel);

    @entity.name('model')
    class Model {
        id: number = 0;
        version: number = 0;
        title: string = '';
    }

    {
        const subject = new BehaviorSubject<any>(undefined);
        const channel = client.entityChannel(Model);
        await channel.subscribe(v => subject.next(v));

        await channel.publishRemove([23]);
        await sleep(0);
        expect(subject.value).toEqual({ type: EntityChannelMessageType.remove, ids: [23] });

        await channel.publishPatch(23, 5, { $set: { username: true } }, { title: 'asd' });
        await sleep(0);
        expect(subject.value).toEqual({
            type: EntityChannelMessageType.patch,
            id: 23,
            version: 5,
            patch: { $set: { username: true } },
            item: { title: 'asd' }
        });

        await channel.publishAdd(cast<Model>({ id: 1243, version: 0, title: 'peter' }));
        await sleep(0);
        expect(subject.value).toEqual({
            type: EntityChannelMessageType.add,
            id: 1243,
            item: { id: 1243, version: 0, title: 'peter' }
        });
    }
});

test('entity channel uuid', async () => {
    const kernel = new BrokerKernel();
    const client = new DirectBroker(kernel);

    @entity.name('modelUuid')
    class Model {
        id: string & PrimaryKey & UUID = uuid();
        version: number = 0;
        title: string = '';
    }

    {
        const subject = new BehaviorSubject<any>(undefined);
        const channel = client.entityChannel(Model);
        await channel.subscribe(v => subject.next(v));

        const item = new Model();

        await channel.publishRemove([item.id]);
        await sleep(0);
        expect(subject.value).toEqual({ type: EntityChannelMessageType.remove, ids: [item.id] });

        await channel.publishPatch(item.id, 5, { $set: { username: true } }, { title: 'asd' });
        await sleep(0);
        expect(subject.value).toEqual({
            type: EntityChannelMessageType.patch,
            id: item.id,
            version: 5,
            patch: { $set: { username: true } },
            item: { title: 'asd' }
        });

        await channel.publishAdd(cast<Model>({ id: item.id, version: 0, title: 'peter' }));
        await sleep(0);
        expect(subject.value).toEqual({
            type: EntityChannelMessageType.add,
            id: item.id,
            item: { id: item.id, version: 0, title: 'peter' }
        });
    }
});
