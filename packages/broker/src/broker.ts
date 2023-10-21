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

export type Release = () => Promise<void>;

export interface BrokerAdapter {
    lock(id: string, options: BrokerLockOptions): Promise<undefined | Release>;

    isLocked(id: string): Promise<boolean>;

    tryLock(id: string, options: BrokerLockOptions): Promise<undefined | Release>;

    getCache(key: string, type: Type): Promise<any>;

    setCache(key: string, value: any, options: BrokerCacheOptions, type: Type): Promise<void>;

    increment(key: string, value: any): Promise<number>;

    publish(name: string, message: any, type: Type): Promise<void>;

    subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release>;

    consume(name: string, callback: (message: any) => Promise<void>, options: { maxParallel: number }, type: Type): Promise<Release>;

    produce(name: string, message: any, type: Type, options?: { delay?: number, priority?: number }): Promise<void>;

    disconnect(): Promise<void>;
}

export const onBrokerLock = new EventToken('broker.lock');

export interface BrokerCacheOptions {
    ttl: number;
    tags: string[];
}

export class CacheError extends Error {
}

export type BrokerBusChannel<Type, Name extends string> = [Name, Type];

export type BrokerCacheKey<Type, Key extends string, Parameters extends object = {}> = [Key, Parameters, Type];

export type BrokerQueueChannel<Type, Name extends string> = [Name, Type];

export type CacheBuilder<T extends BrokerCacheKey<any, any, any>> = (parameters: T[1], options: BrokerCacheOptions) => T[2] | Promise<T[2]>;

export class BrokerQueueMessage<T> {
    public state: 'pending' | 'done' | 'failed' = 'pending';
    public error?: Error;

    public tries: number = 0;
    public delayed: number = 0;

    constructor(
        public channel: string,
        public data: T,
    ) {
    }

    public failed(error: Error) {
        this.state = 'failed';
        this.error = error;
    }

    public delay(seconds: number) {
        this.delayed = seconds;
    }
}


export class BrokerQueue<T> {
    constructor(
        public name: string,
        private adapter: BrokerAdapter,
        private type: Type,
    ) {
    }

    async produce<T>(message: T, options?: { delay?: number, priority?: number }): Promise<void> {
        await this.adapter.produce(this.name, message, this.type, options);
    }

    async consume(callback: (message: BrokerQueueMessage<T>) => Promise<void> | void, options: { maxParallel?: number } = {}): Promise<Release> {
        return await this.adapter.consume(this.name, async (message) => {
            try {
                await callback(message);
            } catch (error: any) {
                message.state = 'failed';
                message.error = error;
            }
        }, Object.assign({ maxParallel: 1 }, options), this.type);
    }
}

export class BrokerBus<T> {
    constructor(
        public name: string,
        private adapter: BrokerAdapter,
        private type: Type,
    ) {
    }

    async publish<T>(message: T) {
        return this.adapter.publish(this.name, message, this.type);
    }

    async subscribe(callback: (message: T) => void): Promise<Release> {
        return this.adapter.subscribe(this.name, callback, this.type);
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

    async increment(parameters: T[1], value: number) {
        const cacheKey = this.getCacheKey(parameters);
        await this.adapter.increment(cacheKey, value);
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

export class BrokerLockError extends Error {

}

export class BrokerLock {
    protected releaser?: Release;

    constructor(
        private id: string,
        private adapter: BrokerAdapter,
        private options: BrokerLockOptions,
    ) {
    }

    /**
     * Returns true if the current lock object is the holder of the lock.
     *
     * This does not check whether the lock is acquired by someone else.
     */
    get acquired(): boolean {
        return this.releaser !== undefined;
    }

    /**
     * Acquires the lock. If the lock is already acquired by someone else, this method waits until the lock is released.
     *
     * @throws BrokerLockError when lock is already acquired by this object.
     */
    async acquire(): Promise<this> {
        if (this.releaser) throw new BrokerLockError(`Lock already acquired. Call release first.`);
        this.releaser = await this.adapter.lock(this.id, this.options);
        return this;
    }

    /**
     * Checks if the lock is acquired by someone else.
     */
    async isReserved(): Promise<boolean> {
        return await this.adapter.isLocked(this.id);
    }

    /**
     * Tries to acquire the lock.
     * If the lock is already acquired, nothing happens.
     *
     * @throws BrokerLockError when lock is already acquired by this object.
     */
    async try(): Promise<this | undefined> {
        if (this.releaser) throw new BrokerLockError(`Lock already acquired. Call release first.`);
        this.releaser = await this.adapter.tryLock(this.id, this.options);
        return this.releaser ? this : undefined;
    }

    /**
     * Releases the lock.
     */
    async release(): Promise<void> {
        if (!this.releaser) return;
        await this.releaser();
        this.releaser = undefined;
    }
}

export class Broker {
    constructor(
        private readonly adapter: BrokerAdapter
    ) {
    }

    /**
     * Creates a new BrokerLock for the given id and options.
     *
     * The object returned can be used to acquire and release the lock.
     */
    public lock(id: string, options: Partial<BrokerLockOptions> = {}): BrokerLock {
        return new BrokerLock(id, this.adapter, Object.assign({ ttl: 60 * 2, timeout: 30 }, options));
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

        const cache = await this.adapter.getCache(key, type);
        if (cache !== undefined) return cache;

        const options: BrokerCacheOptions = { ttl: 30, tags: [] };
        const value = await builder(options);
        await this.adapter.setCache(key, value, options, type);
        return value;
    }

    public bus<T>(path: string, type?: ReceiveType<T>): BrokerBus<T> {
        type = resolveReceiveType(type);
        return new BrokerBus(path, this.adapter, type);
    }

    public busChannel<T extends BrokerBusChannel<any, any>>(type?: ReceiveType<T>): BrokerBus<T[1]> {
        type = resolveReceiveType(type);
        if (type.kind !== ReflectionKind.tuple) throw new CacheError(`Invalid type given`);
        if (type.types[0].type.kind !== ReflectionKind.literal) throw new CacheError(`Invalid type given`);
        const path = String(type.types[0].type.literal);
        return new BrokerBus(path, this.adapter, type.types[1].type);
    }

    public queue<T extends BrokerQueueChannel<any, any>>(type?: ReceiveType<T>): BrokerQueue<T[1]> {
        type = resolveReceiveType(type);
        if (type.kind !== ReflectionKind.tuple) throw new CacheError(`Invalid type given`);
        if (type.types[0].type.kind !== ReflectionKind.literal) throw new CacheError(`Invalid type given`);
        const name = String(type.types[0].type.literal);
        return new BrokerQueue(name, this.adapter, type.types[1].type);
    }
}
