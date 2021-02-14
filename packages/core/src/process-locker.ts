/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem } from './core';

const LOCKS: { [id: string]: { time: number, queue: Function[] } } = {};

/**
 * This lock mechanism works only for one process (worker).
 *
 * live-mutex: has horrible API and doesn't allow to check if an key is currently locked.
 * proper-filelock: No way to do a correct mutex locking with event-driven blocking acquire() method.
 * redislock: Very bad performance on high-load (when multiple locks on the same key `wait`, since it loops)
 * mongodb lock: even worse performance than redis. Jesus.
 */
export class ProcessLock {
    private holding = false;
    protected ttlTimeout: any;

    constructor(
        public readonly id: string,
    ) {
    }

    public async acquire(ttl: number = 0, timeout: number = 0) {
        if (this.holding) {
            throw new Error('Lock already acquired');
        }

        return new Promise<void>((resolve, reject) => {
            const ourTake = () => {
                LOCKS[this.id].time = Date.now() / 1000;

                this.holding = true;
                resolve();

                if (ttl) {
                    this.ttlTimeout = setTimeout(() => {
                        this.unlock();
                    }, ttl * 1000);
                }
            };

            if (timeout > 0) {
                setTimeout(() => {
                    if (LOCKS[this.id]) arrayRemoveItem(LOCKS[this.id].queue, ourTake);
                    //reject is never handled when resolve is called first
                    reject('Lock timed out ' + this.id);
                }, timeout * 1000);
            }

            if (LOCKS[this.id]) {
                LOCKS[this.id].queue.push(ourTake);
            } else {
                LOCKS[this.id] = {
                    time: Date.now() / 1000,
                    queue: []
                };

                this.holding = true;
                resolve();

                if (ttl) {
                    this.ttlTimeout = setTimeout(() => {
                        this.unlock();
                    }, ttl * 1000);
                }
            }
        });
    }

    public isLocked() {
        return this.holding;
    }

    public tryLock(ttl: number = 0) {
        this.holding = false;

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                time: Date.now() / 1000,
                queue: []
            };
            this.holding = true;

            if (ttl) {
                this.ttlTimeout = setTimeout(() => {
                    this.unlock();
                }, ttl * 1000);
            }
        }

        return this.holding;
    }

    public unlock() {
        clearTimeout(this.ttlTimeout);

        if (!this.holding) {
            return;
        }

        this.holding = false;

        if (LOCKS[this.id].queue.length) {
            //there are other locks waiting.
            //so we pick the next, and call it
            const next: Function = LOCKS[this.id].queue.shift()!;
            next();
        } else {
            //nobody is waiting, so we just delete that lock
            delete LOCKS[this.id];
        }
    }
}

export class ProcessLocker {
    /**
     *
     * @param id
     * @param ttl optional defines when the times automatically unlocks.
     * @param timeout if after `timeout` seconds the lock isn't acquired, it throws an error.
     */
    public async acquireLock(id: string, ttl: number = 0, timeout: number = 0): Promise<ProcessLock> {
        const lock = new ProcessLock(id);
        await lock.acquire(ttl, timeout);

        return lock;
    }

    public async tryLock(id: string, ttl: number = 0): Promise<ProcessLock | undefined> {
        const lock = new ProcessLock(id);

        if (lock.tryLock(ttl)) {
            return lock;
        }

        return;
    }

    public isLocked(id: string): boolean {
        return !!LOCKS[id];
    }
}

export class Mutex {
    protected promise?: Promise<void>;
    protected resolver?: Function;

    unlock(): void {
        if (this.resolver) this.resolver();
        this.promise = undefined;
    }

    async lock(): Promise<void> {
        while (this.promise) {
            await this.promise;
        }
        this.promise = new Promise((resolver) => {
            this.resolver = resolver;
        });
    }
}