import { BrokerAdapterBus, BrokerAdapterCache, BrokerAdapterKeyValue, BrokerAdapterLock, BrokerCacheItemOptionsResolved, BrokerKeyValueOptionsResolved, BrokerTimeOptionsResolved, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';
import { AutoBuffer, getBsonEncoder } from '@deepkit/bson';
import Redis, { Callback, RedisOptions } from 'ioredis';
import { arrayRemoveItem, fixAsyncOperation } from '@deepkit/core';
import { Logger } from '@deepkit/logger';

export type RedisBrokerAdapterOptions = RedisOptions & {
    prefix?: string; // optional prefix for all keys
}

export class RedisBrokerAdapter implements BrokerAdapterBus, BrokerAdapterKeyValue, BrokerAdapterCache, BrokerAdapterLock {
    protected subscriptions = new Map<string, {
        handler: (message: Buffer, callbacks: Callback[]) => void,
        callbacks: Callback[]
    }>();

    private prefix = this.config.prefix || '';
    private redis = new Redis({
        autoResubscribe: true,
        enableAutoPipelining: true,
        commandTimeout: 60000,
        reconnectOnError: (_err: Error) => true,
        ...this.config,
    });

    private redisSubscribe = this.redis.duplicate({
        commandTimeout: undefined,
        enableAutoPipelining: false,
    });

    protected onInvalidateCacheCallbacks: ((key: string) => void)[] = [];

    constructor(
        private config: RedisBrokerAdapterOptions,
        public logger: Logger,
    ) {
        this.redisSubscribe.on('messageBuffer', (channelBuffer: Buffer, message: Buffer) => {
            const channel = channelBuffer.toString('utf8');
            if (channel === this.getInvalidateCacheChannel()) {
                const keyToInvalidate = message.toString('utf8');
                for (const callback of this.onInvalidateCacheCallbacks) callback(keyToInvalidate);
                return;
            }
            const handler = this.subscriptions.get(channel);
            if (!handler) return;
            handler.handler(message, handler.callbacks);
        });
    }

    async isLocked(id: string): Promise<boolean> {
        const lockKey = `${this.prefix}lock:${id}`;
        return await this.redis.exists(lockKey).then(result => result === 1);
    }

    async lock(id: string, options: BrokerTimeOptionsResolved): Promise<Release | undefined> {
        const lockKey = `${this.prefix}lock:${id}`;
        const retryDelay = 100; // retry every 100 ms

        while (true) {
            const result = await this.redis.set(lockKey, '1', 'PX', options.ttl, 'NX');
            if (result === 'OK') break;
            await new Promise(res => setTimeout(res, retryDelay));
        }

        return async () => {
            await this.redis.del(lockKey);
        };
    }

    async tryLock(id: string, options: BrokerTimeOptionsResolved): Promise<Release | undefined> {
        const lockKey = `${this.prefix}lock:${id}`;
        const result = await this.redis.set(lockKey, '1', 'PX', options.ttl, 'NX');
        if (result !== 'OK') return undefined;
        return async () => {
            await this.redis.del(lockKey);
        };
    }

    async disconnect(): Promise<void> {
        this.redis.disconnect();
        this.redisSubscribe.disconnect();
    }

    private autoBuffer = new AutoBuffer();

    private serialize(message: any, type: Type): Uint8Array {
        const encoder = getBsonEncoder(type);
        this.autoBuffer.apply(encoder.encode, message);
        return this.autoBuffer.buffer;
    }

    async publish(name: string, message: any, type: Type): Promise<void> {
        const bson = this.serialize(message, type);
        await this.redis.publish(`${this.prefix}${name}`, Buffer.from(bson));
    }

    async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
        const channelName = `${this.prefix}${name}`;
        let handler = this.subscriptions.get(channelName);
        if (!handler) {
            const encoder = getBsonEncoder(type);
            handler = {
                handler: (message: Buffer, callbacks: Callback[]) => {
                    try {
                        const deserialized = encoder.decode(message, 0);
                        for (const callback of callbacks) {
                            callback(deserialized);
                        }
                    } catch (error) {
                        this.logger.error(`Error handling message for channel ${channelName}`, error);
                    }
                },
                callbacks: [],
            };
            this.subscriptions.set(channelName, handler);
            try {
                await this.redisSubscribe.subscribe(channelName);
            } catch (error) {
                this.subscriptions.delete(channelName);
                throw error;
            }
        }
        handler.callbacks.push(callback);
        return async () => {
            arrayRemoveItem(handler.callbacks, callback);
            if (handler.callbacks.length === 0) {
                this.subscriptions.delete(channelName);
                await this.redisSubscribe.unsubscribe(channelName);
            }
        };
    }

    async get(key: string, type: Type): Promise<any> {
        const fullKey = `${this.prefix}${key}`;
        const encoder = getBsonEncoder(type);
        const data = await this.redis.getBuffer(fullKey);
        if (!data) return undefined;
        return encoder.decode(data);
    }

    async increment(key: string, value: number): Promise<number> {
        const fullKey = `${this.prefix}${key}`;
        return await this.redis.incrby(fullKey, value);
    }

    async remove(key: string): Promise<any> {
        const fullKey = `${this.prefix}${key}`;
        await this.redis.del(fullKey);
    }

    async set(key: string, value: any, options: BrokerKeyValueOptionsResolved, type: Type): Promise<any> {
        const fullKey = `${this.prefix}${key}`;
        const encoder = getBsonEncoder(type);
        const data = encoder.encode(value);
        if (options.ttl) {
            await this.redis.set(fullKey, Buffer.from(data), 'PX', options.ttl);
        } else {
            await this.redis.set(fullKey, Buffer.from(data));
        }
    }

    async getCache(key: string, type: Type): Promise<{ value: any; ttl: number } | undefined> {
        const fullKey = `${this.prefix}${key}`;
        const encoder = getBsonEncoder(type);
        const data = await fixAsyncOperation(this.redis.getBuffer(fullKey));
        if (!data) return undefined;

        const value = encoder.decode(data);
        const ttl = await this.redis.ttl(fullKey);
        return { value, ttl: ttl * 1000 }; // convert to milliseconds
    }

    protected invalidationSubscribed = false;

    async setCache(key: string, value: any, options: BrokerCacheItemOptionsResolved, type: Type): Promise<void> {
        const fullKey = `${this.prefix}${key}`;
        const encoder = getBsonEncoder(type);
        const data = encoder.encode(value);
        if (options.ttl) {
            await fixAsyncOperation(this.redis.set(fullKey, Buffer.from(data), 'PX', options.ttl));
        } else {
            await fixAsyncOperation(this.redis.set(fullKey, Buffer.from(data)));
        }

        if (!this.invalidationSubscribed) {
            this.invalidationSubscribed = true;
            this.redisSubscribe.subscribe(this.getInvalidateCacheChannel());
        }
    }

    async getCacheMeta(key: string): Promise<{ ttl: number } | undefined> {
        const fullKey = `${this.prefix}${key}`;
        const ttl = await fixAsyncOperation(this.redis.ttl(fullKey));
        if (ttl < 0) return undefined; // key does not exist or has no TTL
        return { ttl: ttl * 1000 }; // convert to milliseconds
    }

    async invalidateCache(key: string): Promise<void> {
        const fullKey = `${this.prefix}${key}`;
        await fixAsyncOperation(this.redis.del(fullKey));
        await this.redis.publish(this.getInvalidateCacheChannel(), key);
    }

    protected getInvalidateCacheChannel(): string {
        return `${this.prefix}invalidate_cache`;
    }

    onInvalidateCache(callback: (key: string) => void): void {
        this.onInvalidateCacheCallbacks.push(callback);
    }
}

