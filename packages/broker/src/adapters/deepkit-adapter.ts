import { BrokerAdapter, BrokerCacheOptions, BrokerLockOptions, BrokerQueueMessage, Release } from '../broker.js';
import { getTypeJitContainer, ReflectionKind, Type, TypePropertySignature } from '@deepkit/type';
import {
    brokerBusPublish,
    brokerBusResponseHandleMessage,
    brokerBusSubscribe,
    brokerGet,
    brokerIncrement,
    brokerLock,
    BrokerQueueMessageHandled,
    BrokerQueuePublish,
    BrokerQueueResponseHandleMessage,
    BrokerQueueSubscribe,
    BrokerQueueUnsubscribe,
    brokerResponseIncrement,
    brokerSet,
    BrokerType
} from '../model.js';
import { createRpcMessage, RpcBaseClient, RpcMessage, RpcMessageRouteType } from '@deepkit/rpc';
import { deserializeBSON, deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer, serializeBSON } from '@deepkit/bson';
import { arrayRemoveItem } from '@deepkit/core';

interface TypeSerialize {
    encode(v: any): Uint8Array;

    decode(v: Uint8Array, offset: number): any;
}

function getSerializer(type: Type): TypeSerialize {
    const container = getTypeJitContainer(type);
    if (container.brokerSerializer) return container.brokerSerializer;

    const standaloneType = type.kind === ReflectionKind.objectLiteral || (type.kind === ReflectionKind.class && type.types.length);

    if (!standaloneType) {
        //BSON only supports objects, so we wrap it into a {v: type} object.
        type = {
            kind: ReflectionKind.objectLiteral,
            types: [{
                kind: ReflectionKind.propertySignature,
                name: 'v',
                type: type,
            } as TypePropertySignature]
        };

        const decoder = getBSONDeserializer<any>(undefined, type);
        const encoder = getBSONSerializer(undefined, type);

        return container.brokerSerializer = {
            decode: (v: Uint8Array, offset: number) => decoder(v, offset).v,
            encode: (v: any) => encoder({ v }),
        };
    }

    const decoder = getBSONDeserializer<any>(undefined, type);
    const encoder = getBSONSerializer(undefined, type);

    return container.brokerSerializer = {
        decode: (v: Uint8Array, offset: number) => decoder(v, offset),
        encode: (v: any) => encoder(v),
    };
}

/**
 * This is the Broker adapter for Deepkit Broker server.
 */
export class BrokerDeepkitAdapter extends RpcBaseClient implements BrokerAdapter {
    protected activeChannels = new Map<string, { listeners: number, callbacks: ((v: Uint8Array) => void)[] }>();
    protected consumers = new Map<string, { listeners: number, callbacks: ((id: number, v: Uint8Array) => void)[] }>();

    protected onMessage(message: RpcMessage) {
        if (message.routeType === RpcMessageRouteType.server) {
            if (message.type === BrokerType.EntityFields) {
                // const fields = message.parseBody<brokerEntityFields>();
                // this.knownEntityFields.set(fields.name, fields.fields);
                this.transporter.send(createRpcMessage(message.id, BrokerType.Ack, undefined, RpcMessageRouteType.server));
            } else if (message.type === BrokerType.ResponseSubscribeMessage) {
                const body = message.parseBody<brokerBusResponseHandleMessage>();
                const channel = this.activeChannels.get(body.c);
                if (!channel) return;
                for (const callback of channel.callbacks) callback(body.v);
            } else if (message.type === BrokerType.QueueResponseHandleMessage) {
                const body = message.parseBody<BrokerQueueResponseHandleMessage>();
                const consumer = this.consumers.get(body.c);
                if (!consumer) return;
                for (const callback of consumer.callbacks) callback(body.id, body.v);
            }
        } else {
            super.onMessage(message);
        }
    }

    async disconnect(): Promise<void> {
        super.disconnect();
    }

    async setCache(key: string, value: any, options: BrokerCacheOptions, type: Type): Promise<void> {
        const serializer = getSerializer(type);
        await this.sendMessage<brokerSet>(BrokerType.Set, { n: key, v: serializer.encode(value) }).ackThenClose();
    }

    async getCache(key: string, type: Type): Promise<any> {
        const first: RpcMessage = await this.sendMessage<brokerGet>(BrokerType.Get, { n: key }).firstThenClose(BrokerType.ResponseGet);
        if (first.buffer && first.buffer.byteLength > first.bodyOffset) {
            const serializer = getSerializer(type);
            return serializer.decode(first.buffer, first.bodyOffset);
        }
    }

    async increment(key: string, value: any): Promise<number> {
        const response = await this.sendMessage<brokerIncrement>(BrokerType.Increment, { n: key, v: value })
            .waitNext<brokerResponseIncrement>(BrokerType.ResponseIncrement);
        return response.v;
    }

    async lock(id: string, options: BrokerLockOptions): Promise<undefined | Release> {
        const subject = this.sendMessage<brokerLock>(BrokerType.Lock, { id, ttl: options.ttl, timeout: options.timeout });
        await subject.waitNext(BrokerType.ResponseLock); //or throw error

        return async () => {
            await subject.send(BrokerType.Unlock).ackThenClose();
            subject.release();
        };
    }

    async tryLock(id: string, options: BrokerLockOptions): Promise<undefined | Release> {
        const subject = this.sendMessage<brokerLock>(BrokerType.TryLock, { id, ttl: options.ttl });
        const message = await subject.waitNextMessage();
        if (message.type === BrokerType.ResponseLockFailed) {
            subject.release();
            return;
        }

        if (message.type === BrokerType.ResponseLock) {
            return async () => {
                await subject.send(BrokerType.Unlock).ackThenClose();
            };
        }

        throw new Error(`Invalid message returned. Expected Lock, but got ${message.type}`);
    }

    async publish(key: string, message: any, type: Type): Promise<void> {
        const serializer = getSerializer(type);
        const v = serializer.encode(message);
        await this.sendMessage<brokerBusPublish>(BrokerType.Publish, { c: key, v: v })
            .ackThenClose();

        return undefined;
    }

    async subscribe(key: string, callback: (message: any) => void, type: Type): Promise<Release> {
        const serializer = getSerializer(type);

        const parsedCallback = (next: Uint8Array) => {
            try {
                const parsed = serializer.decode(next, 0);
                callback(parsed);
            } catch (error: any) {
                console.log('message', Buffer.from(next).toString('utf8'), deserializeBSONWithoutOptimiser(next));
                console.error(`Could not parse channel message ${key}: ${error}`);
            }
        };

        let channel = this.activeChannels.get(key);
        if (!channel) {
            channel = {
                listeners: 0,
                callbacks: [],
            };
            this.activeChannels.set(key, channel);
        }

        channel.listeners++;
        channel.callbacks.push(parsedCallback);

        if (channel.listeners === 1) {
            await this.sendMessage<brokerBusSubscribe>(BrokerType.Subscribe, { c: key })
                .ackThenClose();
        }

        return async () => {
            channel!.listeners--;
            arrayRemoveItem(channel!.callbacks, parsedCallback);
            if (channel!.listeners === 0) {
                await this.sendMessage<brokerBusSubscribe>(BrokerType.Unsubscribe, { c: key })
                    .ackThenClose();
            }
        };
    }

    async produce<T>(key: string, message: T, type: Type, options?: { delay?: number; priority?: number; }): Promise<void> {
        await this.sendMessage<BrokerQueuePublish>(BrokerType.QueuePublish, {
            c: key,
            v: serializeBSON(message, undefined, type),
            delay: options?.delay,
            priority: options?.priority
        }).ackThenClose();
    }

    async consume(key: string, callback: (message: BrokerQueueMessage<any>) => Promise<void>, options: { maxParallel: number }, type: Type): Promise<Release> {
        // when this is acked, we start receiving messages via BrokerQueueResponseHandleMessage
        await this.sendMessage<BrokerQueueSubscribe>(BrokerType.QueueSubscribe, { c: key, maxParallel: options.maxParallel })
            .ackThenClose();

        this.consumers.set(key, {
            listeners: 1,
            callbacks: [async (id: number, next: Uint8Array) => {
                const data = deserializeBSON(next, 0, undefined, type);
                const message = new BrokerQueueMessage(key, data);
                await callback(message);

                await this.sendMessage<BrokerQueueMessageHandled>(BrokerType.QueueMessageHandled, {
                    id, c: key,
                    success: message.state === 'done',
                    error: message.error ? String(message.error) : undefined,
                    delay: message.delayed,
                }).ackThenClose();
            }]
        });

        return async () => {
            await this.sendMessage<BrokerQueueUnsubscribe>(BrokerType.QueueUnsubscribe, { c: key })
                .ackThenClose();
        };
    }
}
