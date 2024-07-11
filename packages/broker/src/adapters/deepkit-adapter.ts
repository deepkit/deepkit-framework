import {
    BrokerAdapter,
    BrokerAdapterQueueProduceOptionsResolved,
    BrokerQueueMessage,
    BrokerTimeOptionsResolved,
    Release,
} from '../broker.js';
import { getTypeJitContainer, ReflectionKind, Type, TypePropertySignature } from '@deepkit/type';
import {
    brokerBusPublish,
    brokerBusResponseHandleMessage,
    brokerBusSubscribe,
    brokerGet,
    brokerGetCache,
    brokerIncrement,
    brokerInvalidateCache,
    brokerInvalidateCacheMessage,
    brokerLock,
    brokerLockId,
    BrokerQueueMessageHandled,
    BrokerQueuePublish,
    BrokerQueueResponseHandleMessage,
    BrokerQueueSubscribe,
    BrokerQueueUnsubscribe,
    brokerResponseGet,
    brokerResponseGetCache,
    brokerResponseGetCacheMeta,
    brokerResponseIncrement,
    brokerResponseIsLock,
    brokerSet,
    brokerSetCache,
    BrokerType,
    QueueMessageProcessing,
} from '../model.js';
import {
    ClientTransportAdapter,
    createRpcMessage,
    RpcBaseClient,
    RpcMessage,
    RpcMessageRouteType,
    RpcWebSocketClientAdapter,
} from '@deepkit/rpc';
import { deserializeBSON, getBSONDeserializer, getBSONSerializer, serializeBSON } from '@deepkit/bson';
import { arrayRemoveItem } from '@deepkit/core';
import { BrokerCacheItemOptionsResolved } from '../broker-cache.js';
import { fastHash } from '../utils.js';
import { BrokerKeyValueOptionsResolved } from '../broker-key-value.js';

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

export class BrokerDeepkitConnection extends RpcBaseClient {
    activeChannels = new Map<string, { listeners: number, callbacks: ((v: Uint8Array) => void)[] }>();
    consumers = new Map<string, { listeners: number, callbacks: ((id: number, v: Uint8Array) => void)[] }>();

    subscribedToInvalidations?: ((message: brokerInvalidateCacheMessage) => void)[];

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
            } else if (message.type === BrokerType.ResponseInvalidationCache) {
                const body = message.parseBody<brokerInvalidateCacheMessage>();
                if (this.subscribedToInvalidations) {
                    for (const callback of this.subscribedToInvalidations) callback(body);
                }
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
}

export interface Server {
    url: string;
    weight?: number;
    secretKey?: string;
    transport?: ClientTransportAdapter;
}

export class BrokerDeepkitAdapterOptions {
    servers: Server[] = [];
}

export class BrokerDeepkitPool {
    connections: { connection: BrokerDeepkitConnection, server: Server }[] = [];

    constructor(public options: BrokerDeepkitAdapterOptions) {
    }

    getConnection(key: string): BrokerDeepkitConnection {
        if (!this.options.servers.length) throw new Error('No servers defined');

        if (this.options.servers.length === 1) {
            if (!this.connections.length) this.createConnection(this.options.servers[0]);
            return this.connections[0].connection;
        }

        //key is used for consistent hashing
        throw new Error('Not implemented');
    }

    protected createConnection(server: Server): BrokerDeepkitConnection {
        const transport = server.transport || new RpcWebSocketClientAdapter(server.url);

        const connection = new BrokerDeepkitConnection(transport);
        connection.token.set(server.secretKey);
        this.connections.push({ connection, server });
        return connection;
    }

    async disconnect(): Promise<void> {
        for (const connection of this.connections) {
            // we just disconnect, and not clear the connection object since we store state on it (like activeChannels, invalidation callbacks, etc)
            await connection.connection.disconnect();
        }
    }
}

/**
 * This is the Broker adapter for Deepkit Broker server.
 */
export class BrokerDeepkitAdapter implements BrokerAdapter {
    protected pool = new BrokerDeepkitPool(this.options);
    protected onInvalidateCacheCallbacks: ((message: brokerInvalidateCacheMessage) => void)[] = [];

    constructor(public options: BrokerDeepkitAdapterOptions) {
    }

    async disconnect(): Promise<void> {
        await this.pool.disconnect();
    }

    onInvalidateCache(callback: (message: brokerInvalidateCacheMessage) => void): void {
        this.onInvalidateCacheCallbacks.push(callback);
    }

    async invalidateCache(key: string): Promise<void> {
        await this.pool.getConnection('cache/' + key).sendMessage<brokerInvalidateCache>(BrokerType.InvalidateCache, { n: key }).ackThenClose();
    }

    async setCache(key: string, value: any, options: BrokerCacheItemOptionsResolved, type: Type): Promise<void> {
        const serializer = getSerializer(type);
        const v = serializer.encode(value);
        await this.pool.getConnection('cache/' + key).sendMessage<brokerSetCache>(BrokerType.SetCache, { n: key, v, ttl: options.ttl }).ackThenClose();
    }

    async getCacheMeta(key: string): Promise<{ ttl: number } | undefined> {
        const first = await this.pool.getConnection('cache/' + key)
            .sendMessage<brokerGetCache>(BrokerType.GetCacheMeta, { n: key })
            .firstThenClose<brokerResponseGetCacheMeta>(BrokerType.ResponseGetCacheMeta);
        if ('missing' in first) return undefined;
        return first;
    }

    async getCache(key: string, type: Type): Promise<{ value: any, ttl: number } | undefined> {
        const connection = this.pool.getConnection('cache/' + key);

        if (!connection.subscribedToInvalidations) {
            connection.subscribedToInvalidations = this.onInvalidateCacheCallbacks;
            await connection
                .sendMessage(BrokerType.EnableInvalidationCacheMessages)
                .ackThenClose();
        }

        const first = await connection
            .sendMessage<brokerGetCache>(BrokerType.GetCache, { n: key })
            .firstThenClose<brokerResponseGetCache>(BrokerType.ResponseGetCache);

        const serializer = getSerializer(type);
        return first.v && first.ttl !== undefined ? { value: serializer.decode(first.v, 0), ttl: first.ttl } : undefined;
    }

    async set(key: string, value: any, options: BrokerKeyValueOptionsResolved, type: Type): Promise<void> {
        const serializer = getSerializer(type);
        const v = serializer.encode(value);
        await this.pool.getConnection('key/' + key).sendMessage<brokerSet>(BrokerType.Set, { n: key, v, ttl: options.ttl }).ackThenClose();
    }

    async get(key: string, type: Type): Promise<any> {
        const first = await this.pool.getConnection('key/' + key)
            .sendMessage<brokerGet>(BrokerType.Get, { n: key })
            .firstThenClose<brokerResponseGet>(BrokerType.ResponseGet);
        if (first.v) {
            const serializer = getSerializer(type);
            return serializer.decode(first.v, 0);
        }
    }

    async remove(key: string): Promise<any> {
        await this.pool.getConnection('key/' + key)
            .sendMessage<brokerGet>(BrokerType.Delete, { n: key }).ackThenClose();
    }

    async increment(key: string, value: any): Promise<number> {
        const response = await this.pool.getConnection('increment/' + key)
            .sendMessage<brokerIncrement>(BrokerType.Increment, { n: key, v: value })
            .firstThenClose<brokerResponseIncrement>(BrokerType.ResponseIncrement);
        return response.v;
    }

    async isLocked(id: string): Promise<boolean> {
        const response = await this.pool.getConnection('lock/' + id)
            .sendMessage<brokerLockId>(BrokerType.IsLocked, { id })
            .firstThenClose<brokerResponseIsLock>(BrokerType.ResponseIsLock);
        return response.v;
    }

    async lock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release> {
        const subject = this.pool.getConnection('lock/' + id)
            .sendMessage<brokerLock>(BrokerType.Lock, { id, ttl: options.ttl, timeout: options.timeout });
        await subject.waitNext(BrokerType.ResponseLock); //or throw error

        return async () => {
            await subject.send(BrokerType.Unlock).ackThenClose();
            subject.release();
        };
    }

    async tryLock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release> {
        const subject = this.pool.getConnection('lock/' + id)
            .sendMessage<brokerLock>(BrokerType.TryLock, { id, ttl: options.ttl });
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

        await this.pool.getConnection('bus/' + key)
            .sendMessage<brokerBusPublish>(BrokerType.Publish, { c: key, v: v })
            .ackThenClose();

        return undefined;
    }

    async subscribe(key: string, callback: (message: any) => void, type: Type): Promise<Release> {
        const connection = this.pool.getConnection('bus/' + key);
        return await this._subscribe(connection, key, callback, type);
    }

    protected async _subscribe(connection: BrokerDeepkitConnection, key: string, callback: (message: any) => void, type: Type): Promise<Release> {
        const serializer = getSerializer(type);

        const parsedCallback = (next: Uint8Array) => {
            try {
                const parsed = serializer.decode(next, 0);
                callback(parsed);
            } catch (error: any) {
                console.error(`Could not parse channel message ${key}: ${error}`);
            }
        };

        let channel = connection.activeChannels.get(key);
        if (!channel) {
            channel = {
                listeners: 0,
                callbacks: [],
            };
            connection.activeChannels.set(key, channel);
        }

        channel.listeners++;
        channel.callbacks.push(parsedCallback);

        if (channel.listeners === 1) {
            await connection.sendMessage<brokerBusSubscribe>(BrokerType.Subscribe, { c: key })
                .ackThenClose();
        }

        return async () => {
            channel!.listeners--;
            arrayRemoveItem(channel!.callbacks, parsedCallback);
            if (channel!.listeners === 0) {
                await connection.sendMessage<brokerBusSubscribe>(BrokerType.Unsubscribe, { c: key })
                    .ackThenClose();
            }
        };
    }

    async produce<T>(key: string, message: T, type: Type, options?: BrokerAdapterQueueProduceOptionsResolved): Promise<void> {
        const value = serializeBSON(message, undefined, type);
        if (options?.process === QueueMessageProcessing.exactlyOnce) {
            options.hash ??= fastHash(value);
        }
        await this.pool.getConnection('queue/' + key)
            .sendMessage<BrokerQueuePublish>(BrokerType.QueuePublish, {
                c: key,
                v: value,
                ...options,
            } as BrokerQueuePublish).ackThenClose();
    }

    async consume(key: string, callback: (message: BrokerQueueMessage<any>) => Promise<void>, options: { maxParallel: number }, type: Type): Promise<Release> {
        const connection = this.pool.getConnection('queue/' + key);
        // when this is acked, we start receiving messages via BrokerQueueResponseHandleMessage
        await connection.sendMessage<BrokerQueueSubscribe>(BrokerType.QueueSubscribe, { c: key, maxParallel: options.maxParallel })
            .ackThenClose();

        connection.consumers.set(key, {
            listeners: 1,
            callbacks: [async (id: number, next: Uint8Array) => {
                const data = deserializeBSON(next, 0, undefined, type);
                const message = new BrokerQueueMessage(key, data);
                await callback(message);

                await connection.sendMessage<BrokerQueueMessageHandled>(BrokerType.QueueMessageHandled, {
                    id, c: key,
                    success: message.state === 'done',
                    error: message.error ? String(message.error) : undefined,
                    delay: message.delayed,
                }).ackThenClose();
            }]
        });

        return async () => {
            await connection.sendMessage<BrokerQueueUnsubscribe>(BrokerType.QueueUnsubscribe, { c: key })
                .ackThenClose();
        };
    }
}
