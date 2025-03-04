import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { BrokerAdapterBase, BrokerInvalidateCacheMessage } from './broker.js';
import { parseTime } from './utils.js';
import { ConsoleLogger, LoggerInterface } from '@deepkit/logger';
import { asyncOperation } from '@deepkit/core';

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

function parseBrokerCacheItemOptions(options: Partial<BrokerCacheItemOptions>): BrokerCacheItemOptionsResolved {
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

export class BrokerCacheError extends Error {
}

export interface BrokerAdapterCache extends BrokerAdapterBase {
    getCache(key: string, type: Type): Promise<{ value: any, ttl: number } | undefined>;

    getCacheMeta(key: string): Promise<{ ttl: number } | undefined>;

    setCache(key: string, value: any, options: BrokerCacheItemOptionsResolved, type: Type): Promise<void>;

    invalidateCache(key: string): Promise<void>;

    onInvalidateCache(callback: (message: BrokerInvalidateCacheMessage) => void): void;
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

        //outdated: no need to wait for L2 to be updated, we can return the value already
        await this.adapter.setCache(this.key, entry.value, this.options, this.type);

        return entry.value;
    }
}

export class BrokerCache {
    private config: BrokerCacheOptionsResolved;
    private store: BrokerCacheStore;

    constructor(
        private adapter: BrokerAdapterCache,
        config: Partial<BrokerCacheOptions> = {},
        private logger: LoggerInterface = new ConsoleLogger(),
    ) {
        this.config = parseBrokerCacheOptions(config);
        this.store = new BrokerCacheStore(this.config);
        this.adapter.onInvalidateCache((message) => {
            this.store.invalidate(message.key);
        });
    }

    item<T>(key: string, builder: CacheBuilder<T>, options?: Partial<BrokerCacheItemOptions>, type?: ReceiveType<T>): BrokerCacheItem<T> {
        return new BrokerCacheItem(
            key, builder,
            parseBrokerCacheItemOptions(Object.assign({}, this.config, options)),
            this.adapter, this.store, resolveReceiveType(type),
            this.logger
        );
    }
}
