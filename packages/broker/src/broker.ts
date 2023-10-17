import { ReceiveType, reflect, ReflectionKind, resolveReceiveType, Type } from '@deepkit/type';
import { EventToken } from '@deepkit/event';

export interface BrokerLockOptions {
    /**
     * Time to live in seconds. Default 2 minutes.
     *
     * The lock is automatically released after this time.
     * This is to prevent deadlocks.
     */
    ttl: number;

    /**
     * Timeout when acquiring the lock in seconds. Default 30 seconds.
     * Ween a lock is not acquired after this time, an error is thrown.
     */
    timeout: number;
}

export interface BrokerAdapter {
    lock(id: string, options: BrokerLockOptions): Promise<void>;

    tryLock(id: string, options: BrokerLockOptions): Promise<boolean>;

    release(id: string): Promise<void>;

    getCache(key: string, type: Type): Promise<any>;

    setCache(key: string, value: any, options: BrokerCacheOptions, type: Type): Promise<void>;

    increase(key: string, value: any): Promise<void>;

    publish(key: string, message: any, type: Type): Promise<void>;

    subscribe(key: string, callback: (message: any) => void, type: Type): Promise<{ unsubscribe: () => Promise<void> }>;

    disconnect(): Promise<void>;
}

export const onBrokerLock = new EventToken('broker.lock');

export interface BrokerCacheOptions {
    ttl: number;
    tags: string[];
}

export class CacheError extends Error {
}

export type BrokerBusChannel<Type, Channel extends string, Parameters extends object = {}> = [Channel, Parameters, Type];

export type BrokerCacheKey<Type, Key extends string, Parameters extends object = {}> = [Key, Parameters, Type];

export type CacheBuilder<T extends BrokerCacheKey<any, any, any>> = (parameters: T[1], options: BrokerCacheOptions) => T[2] | Promise<T[2]>;

export class BrokerBus<T> {
    constructor(
        private channel: string,
        private adapter: BrokerAdapter,
        private type: Type,
    ) {
    }

    async publish<T>(message: T) {
        return this.adapter.publish(this.channel, message, this.type);
    }

    async subscribe(callback: (message: T) => void): Promise<{ unsubscribe: () => Promise<void> }> {
        return this.adapter.subscribe(this.channel, callback, this.type);
    }
}

export class BrokerCache<T extends BrokerCacheKey<any, any, any>> {
    constructor(
        private key: string,
        private builder: CacheBuilder<T>,
        private options: BrokerCacheOptions,
        private adapter: BrokerAdapter,
        private type: Type,
    ) {
    }

    protected getCacheKey(parameters: T[1]): string {
        //this.key contains parameters e.g. user/:id, id comes from parameters.id. let's replace all of it.
        //note: we could create JIT function for this, but it's probably not worth it.
        return this.key.replace(/:([a-zA-Z0-9_]+)/g, (v, name) => {
            if (!(name in parameters)) throw new CacheError(`Parameter ${name} not given`);
            return String(parameters[name]);
        });
    }

    async set(parameters: T[1], value: T[2], options: Partial<BrokerCacheOptions> = {}) {
        const cacheKey = this.getCacheKey(parameters);
        await this.adapter.setCache(cacheKey, value, { ...this.options, ...options }, this.type);
    }

    async increase(parameters: T[1], value: number) {
        const cacheKey = this.getCacheKey(parameters);
        await this.adapter.increase(cacheKey, value);
    }

    async get(parameters: T[1]): Promise<T[2]> {
        const cacheKey = this.getCacheKey(parameters);
        let entry = await this.adapter.getCache(cacheKey, this.type);
        if (entry !== undefined) return entry;

        const options: BrokerCacheOptions = { ...this.options };
        entry = await this.builder(parameters, options);
        await this.adapter.setCache(cacheKey, entry, options, this.type);

        return entry;
    }
}

export class BrokerLock {
    public acquired: boolean = false;

    constructor(
        private id: string,
        private adapter: BrokerAdapter,
        private options: BrokerLockOptions,
    ) {
    }

    async acquire(): Promise<void> {
        await this.adapter.lock(this.id, this.options);
        this.acquired = true;
    }

    async try(): Promise<boolean> {
        if (this.acquired) return true;

        return this.acquired = await this.adapter.tryLock(this.id, this.options);
    }

    async release(): Promise<void> {
        this.acquired = false;
        await this.adapter.release(this.id);
    }
}

export class Broker {
    constructor(
        private readonly adapter: BrokerAdapter
    ) {
    }

    public lock(id: string, options: Partial<BrokerLockOptions> = {}): BrokerLock {
        return new BrokerLock(id, this.adapter, Object.assign({ ttl: 60*2, timeout: 30 }, options));
    }

    public disconnect(): Promise<void> {
        return this.adapter.disconnect();
    }

    protected cacheProvider: { [path: string]: (...args: any[]) => any } = {};

    public provideCache<T extends BrokerCacheKey<any, any, any>>(provider: (options: T[1]) => T[2] | Promise<T[2]>, type?: ReceiveType<T>) {
        type = resolveReceiveType(type);
        if (type.kind !== ReflectionKind.tuple) throw new CacheError(`Invalid type given`);
        if (type.types[0].type.kind !== ReflectionKind.literal) throw new CacheError(`Invalid type given`);
        const path = String(type.types[0].type.literal);
        this.cacheProvider[path] = provider;
    }

    public cache<T extends BrokerCacheKey<any, any, any>>(type?: ReceiveType<T>): BrokerCache<T> {
        type = resolveReceiveType(type);
        if (type.kind !== ReflectionKind.tuple) throw new CacheError(`Invalid type given`);
        if (type.types[0].type.kind !== ReflectionKind.literal) throw new CacheError(`Invalid type given`);
        const path = String(type.types[0].type.literal);
        const provider = this.cacheProvider[path];
        if (!provider) throw new CacheError(`No cache provider for cache ${type.typeName} (${path}) registered`);

        return new BrokerCache<T>(path, provider, { ttl: 30, tags: [] }, this.adapter, type.types[2].type);
    }

    public async get<T>(key: string, builder: (options: BrokerCacheOptions) => Promise<T>, type?: ReceiveType<T>): Promise<T> {
        if (!type) {
            //type not manually provided via Broker.get<Type>, so we try to extract it from the builder.
            const fn = reflect(builder);
            if (fn.kind !== ReflectionKind.function) throw new CacheError(`Can not detect type of builder function`);
            type = fn.return;
            while (type.kind === ReflectionKind.promise) type = type.type;
        } else {
            type = resolveReceiveType(type);
        }

        const cache = this.adapter.getCache(key, type);
        if (cache !== undefined) return cache;

        const options: BrokerCacheOptions = { ttl: 30, tags: [] };
        const value = builder(options);
        await this.adapter.setCache(key, value, options, type);
        return value;
    }

    public bus<T extends BrokerBusChannel<any, any>>(type?: ReceiveType<T>): BrokerBus<T[2]> {
        type = resolveReceiveType(type);
        if (type.kind !== ReflectionKind.tuple) throw new CacheError(`Invalid type given`);
        if (type.types[0].type.kind !== ReflectionKind.literal) throw new CacheError(`Invalid type given`);
        const path = String(type.types[0].type.literal);

        return new BrokerBus(path, this.adapter, type.types[2].type);
    }

    public queue<T>(channel: string, type?: ReceiveType<T>) {

    }
}
