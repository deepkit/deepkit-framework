import { BrokerAdapter, BrokerCacheOptions, BrokerLockOptions } from '../broker.js';
import { Type } from '@deepkit/type';
import { ProcessLock } from '@deepkit/core';

export class BrokerMemoryAdapter implements BrokerAdapter {
    protected cache: { [key: string]: any } = {};
    protected channels: { [key: string]: ((m: any) => void)[] } = {};
    protected locks: { [key: string]: ProcessLock } = {};

    async disconnect(): Promise<void> {
    }

    async lock(id: string, options: BrokerLockOptions): Promise<void> {
        const lock = new ProcessLock(id);
        await lock.acquire(options.ttl, options.timeout);
        this.locks[id] = lock;
    }

    async tryLock(id: string, options: BrokerLockOptions): Promise<boolean> {
        const lock = new ProcessLock(id);
        if (lock.tryLock(options.ttl)) {
            this.locks[id] = lock;
            return true;
        }
        return false;
    }

    async release(id: string): Promise<void> {
        if (this.locks[id]) {
            this.locks[id].unlock();
            delete this.locks[id];
        }
    }

    async getCache(key: string): Promise<any> {
        return this.cache[key];
    }

    async setCache(key: string, value: any, options: BrokerCacheOptions) {
        this.cache[key] = value;
    }

    async increase(key: string, value: any): Promise<void> {
        if (!(key in this.cache)) this.cache[key] = 0;
        this.cache[key] += value;
    }

    async subscribe(key: string, callback: (message: any) => void, type: Type): Promise<{ unsubscribe: () => Promise<void> }> {
        if (!(key in this.channels)) this.channels[key] = [];
        const fn = (m: any) => {
            callback(m);
        };
        this.channels[key].push(fn);

        return {
            unsubscribe: async () => {
                const index = this.channels[key].indexOf(fn);
                if (index !== -1) this.channels[key].splice(index, 1);
            }
        };
    }

    async publish<T>(key: string, message: T): Promise<void> {
        if (!(key in this.channels)) return;
        for (const callback of this.channels[key]) {
            callback(message);
        }
    }
}

