import { ReceiveType, ReflectionKind, resolveReceiveType, Type } from '@deepkit/type';
import { EventToken } from '@deepkit/event';
import { parse } from '@lukeed/ms';
import { asyncOperation, formatError } from '@deepkit/core';
import { ConsoleLogger, LoggerInterface } from '@deepkit/logger';

export interface BrokerTimeOptions {
    /**
     * Time to live in milliseconds. 0 means no ttl.
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    ttl: string | number;

    /**
     * Timeout in milliseconds. 0 means no timeout.
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    timeout: number | string;
}

export interface BrokerTimeOptionsResolved {
    /**
     * Time to live in milliseconds. 0 means no ttl.
     */
    ttl: number;

    /**
     * Timeout in milliseconds. 0 means no timeout.
     */
    timeout: number;
}

function parseBrokerTimeoutOptions(options: Partial<BrokerTimeOptions>): BrokerTimeOptionsResolved {
    return {
        ttl: parseTime(options.ttl) ?? 0,
        timeout: parseTime(options.timeout) ?? 0,
    };
}

function parseTime(value?: string | number): number | undefined {
    if ('undefined' === typeof value) return;
    if ('string' === typeof value) return value ? parse(value) || 0 : undefined;
    return value;
}

export interface BrokerCacheOptions {
    /**
     * Relative time to live in milliseconds. 0 means no ttl.
     *
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    ttl: number | string;

    /**
     * How many ms the cache is allowed to be stale. Set to 0 to disable stale cache.
     * Default is 1000ms.
     * Improves performance by serving slightly stale cache while the cache is being rebuilt.
     */
    maxStale: number | string;

    /**
     * How many ms the cache is allowed to be stored in-memory. Set to 0 to disable in-memory cache.
     */
    inMemoryTtl: number | string;
}

export interface BrokerCacheOptionsResolved extends BrokerCacheOptions {
    ttl: number;
    maxStale: number;
    inMemoryTtl: number;
}

export interface BrokerCacheItemOptions {
    /**
     * Relative time to live in milliseconds. 0 means no ttl.
     *
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    ttl: number | string;

    tags: string[];

    /**
     * How many ms the cache is allowed to be stale. Set to 0 to disable stale cache.
     * Default is 1000ms.
     * Improves performance by serving slightly stale cache while the cache is being rebuilt.
     */
    maxStale: number | string;
}

export interface BrokerCacheItemOptionsResolved extends BrokerCacheItemOptions {
    ttl: number;
    maxStale: number;
}

function parseBrokerKeyOptions(options: Partial<BrokerCacheItemOptions>): BrokerCacheItemOptionsResolved {
    return {
        ttl: parseTime(options.ttl) ?? 30_000,
        maxStale: parseTime(options.maxStale) ?? 1_000,
        tags: options.tags || [],
    };
}

function parseBrokerCacheOptions(options: Partial<BrokerCacheOptions>): BrokerCacheOptionsResolved {
    return {
        ttl: parseTime(options.ttl) ?? 60_000,
        maxStale: parseTime(options.maxStale) ?? 10_000,
        inMemoryTtl: parseTime(options.inMemoryTtl) ?? 60_000,
    };
}

export type Release = () => Promise<void>;

export interface BrokerInvalidateCacheMessage {
    key: string;
    ttl: number;
}

export interface BrokerAdapterCache {
    getCache(key: string, type: Type): Promise<{ value: any, ttl: number } | undefined>;

    getCacheMeta(key: string): Promise<{ ttl: number } | undefined>;

    setCache(key: string, value: any, options: BrokerCacheItemOptionsResolved, type: Type): Promise<void>;

    invalidateCache(key: string): Promise<void>;

    onInvalidateCache(callback: (message: BrokerInvalidateCacheMessage) => void): void;
}

export interface BrokerAdapter extends BrokerAdapterCache {
    lock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release>;

    isLocked(id: string): Promise<boolean>;

    tryLock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release>;

    get(key: string, type: Type): Promise<any>;

    set(key: string, value: any, type: Type): Promise<any>;

    increment(key: string, value: any): Promise<number>;

    /**
     * Publish a message on the bus aka pub/sub.
     */
    publish(name: string, message: any, type: Type): Promise<void>;

    /**
     * Subscribe to messages on the bus aka pub/sub.
     */
    subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release>;

    /**
     * Consume messages from a queue.
     */
    consume(name: string, callback: (message: any) => Promise<void>, options: { maxParallel: number }, type: Type): Promise<Release>;

    /**
     * Produce a message to a queue.
     */
    produce(name: string, message: any, type: Type, options?: { delay?: number, priority?: number }): Promise<void>;

    disconnect(): Promise<void>;
}

export const onBrokerLock = new EventToken('broker.lock');

export class CacheError extends Error {
}

export type BrokerBusChannel<Type, Name extends string> = [Name, Type];

export type BrokerQueueChannel<Type, Name extends string> = [Name, Type];

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

export type CacheBuilder<T> = () => T | Promise<T>;

interface CacheStoreEntry {
    value: any;
    ttl: number; //absolute timestamp in ms
    inMemoryTtl?: number; //absolute timestamp in ms
    built: number; //how many times the cache was built
    building?: Promise<any>;
}

export class BrokerCacheStore {
    /**
     * This is a short-lived cache pool for the current process.
     * Values are fetched from the broker when not available and stored here for a short time (configurable).
     */
    cache = new Map<string, CacheStoreEntry>();

    constructor(public config: BrokerCacheOptionsResolved) {
    }

    invalidate(key: string) {
        if (this.config.maxStale) {
            //don't delete immediately as it might be allowed to read stale cache while it is being rebuilt.
            const entry = this.cache.get(key);
            if (!entry) return;
            entry.ttl = Date.now();
            setTimeout(() => {
                if (this.cache.get(key) === entry) {
                    this.cache.delete(key);
                }
            }, this.config.maxStale);
        } else {
            // no stale reading allowed, so we can delete it immediately
            this.cache.delete(key);
        }
    }

    set(key: string, value: CacheStoreEntry) {
        if (!this.config.inMemoryTtl) return;

        const ttl = value.inMemoryTtl = Date.now() + this.config.inMemoryTtl;
        this.cache.set(key, value);

        setTimeout(() => {
            if (ttl === this.cache.get(key)?.ttl) {
                // still the same value, so we can delete it
                this.cache.delete(key);
            }
        }, this.config.inMemoryTtl);
    }
}

export class BrokerCacheItem<T> {
    constructor(
        private key: string,
        private builder: CacheBuilder<T>,
        private options: BrokerCacheItemOptionsResolved,
        private adapter: BrokerAdapterCache,
        private store: BrokerCacheStore,
        private type: Type,
        private logger: LoggerInterface,
    ) {
    }

    protected build(entry: CacheStoreEntry): Promise<void> {
        return entry.building = asyncOperation<void>(async (resolve) => {
            entry.value = await this.builder();
            entry.ttl = Date.now() + this.options.ttl;
            entry.built++;
            entry.building = undefined;
            resolve();
        });
    }

    async set(value: T) {
        await this.adapter.setCache(this.key, value, this.options, this.type);
    }

    async invalidate() {
        await this.adapter.invalidateCache(this.key);
    }

    async exists(): Promise<boolean> {
        const entry = this.store.cache.get(this.key);
        if (entry) {
            return entry.ttl > Date.now();
        }

        const l2Entry = await this.adapter.getCacheMeta(this.key);
        return !!l2Entry && l2Entry.ttl > Date.now();
    }

    async get(): Promise<T> {
        //read L1
        let entry = this.store.cache.get(this.key);
        if (!entry) {
            //read from L2
            const l2Entry = await this.adapter.getCache(this.key, this.type);
            if (l2Entry) {
                entry = { value: l2Entry.value, built: 0, ttl: l2Entry.ttl };
                this.store.set(this.key, entry);
            }
        }

        if (entry) {
            //check ttl
            const delta = entry.ttl - Date.now();
            if (delta <= 0) {
                //cache is expired, rebuild it.

                //if entry.building is set, then this process already started rebuilding the cache.
                // we simply wait and return the result
                if (entry.building) {
                    // if the delta is small enough, we simply serve the old value
                    if (entry.built > 0 && delta < this.options.maxStale) return entry.value;

                    await entry.building;
                    return entry.value;
                }
            } else {
                //cache is still valid
                return entry.value;
            }
        } else {
            entry = { value: undefined, built: 0, ttl: Date.now() + this.options.ttl };
            this.store.set(this.key, entry);
        }

        //cache is expired or nearly created, rebuild it.
        await this.build(entry);
        //no need to wait for L2 to be updated, we can return the value already
        this.adapter.setCache(this.key, entry.value, this.options, this.type).catch((error: any) => {
            this.logger.warn(`Could not send cache to L2 ${this.key}: ${formatError(error)}`);
        });

        return entry.value;
    }
}

export class BrokerLockError extends Error {

}

export class BrokerLock {
    protected releaser?: Release;

    constructor(
        private id: string,
        private adapter: BrokerAdapter,
        private options: BrokerTimeOptionsResolved,
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

export class BrokerCache {
    private store = new BrokerCacheStore(this.config);

    constructor(private adapter: BrokerAdapterCache, private config: BrokerCacheOptionsResolved, private logger: LoggerInterface) {
        this.adapter.onInvalidateCache((message) => {
            this.store.invalidate(message.key);
        });
    }

    item<T>(key: string, builder: CacheBuilder<T>, options?: Partial<BrokerCacheItemOptions>, type?: ReceiveType<T>): BrokerCacheItem<T> {
        return new BrokerCacheItem(key, builder, parseBrokerKeyOptions(Object.assign({}, this.config, options)), this.adapter, this.store, resolveReceiveType(type), this.logger);
    }
}

export interface BrokerConfig {
    cache?: Partial<BrokerCacheOptions>;
}

export class Broker {
    public readonly cache: BrokerCache = new BrokerCache(this.adapter, parseBrokerCacheOptions(this.config.cache || {}), this.logger);

    constructor(
        private readonly adapter: BrokerAdapter,
        private readonly config: Partial<BrokerConfig> = {},
        private readonly logger: LoggerInterface = new ConsoleLogger(),
    ) {
    }

    /**
     * Creates a new BrokerLock for the given id and options.
     *
     * The object returned can be used to acquire and release the lock.
     */
    public lock(id: string, options: Partial<BrokerTimeOptions> = {}): BrokerLock {
        const parsedOptions = parseBrokerTimeoutOptions(options);
        parsedOptions.ttl ||= 60 * 2 * 1000; //2 minutes
        parsedOptions.timeout ||= 30 * 1000; //30 seconds
        return new BrokerLock(id, this.adapter, parsedOptions);
    }

    public disconnect(): Promise<void> {
        return this.adapter.disconnect();
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
