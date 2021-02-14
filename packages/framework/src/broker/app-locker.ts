/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AsyncSubscription } from '@deepkit/core-rxjs';
import { injectable } from '@deepkit/injector';
import { Broker } from './broker';

export class AppLock {
    constructor(protected subscription: AsyncSubscription) {
    }

    async release() {
        await this.subscription.unsubscribe();
    }
}

/**
 * An global application lock (across workers, processes, and nodes).
 * It provides a way to acquire locks on the central broker process atomically.
*/
@injectable()
export class AppLocker {
    constructor(protected broker: Broker) {
    }

    /**
     * Locks the given id. If the lock is already aquired by someone else, it waits max `timeout` seconds.
     *
     * Make sure the call `release` on the result AppLock to get a dead-lock.
     *
     * @param id
     * @param ttl time to live in seconds. The lock automatically releases when ttl is reached. 0 for no limit.
     * @param timeout in seconds. When the lock is already aquired the times defines when to give up aquisiting the lock. 0 for no limit.
     *
     * @example
     * ```typescript
     *
     * class MyController {
     *   constructor(protected appLocker: AppLocker) {
     *   }
     *
     *   async doSomething() {
     *     const lock = this.appLocker.acquireLock('myId);
     *     try {
     *         //do you stuff here
     *     } finally {
     *       //important to have it in finally to not accidantely keep the lock alive forever.
     *       lock.release();
     *     }
     *   }
     * }
     *
     * ```
     */
    public async acquireLock(id: string, ttl: number = 0, timeout: number = 0): Promise<AppLock> {
        return new AppLock(await this.broker.lock(id, ttl, timeout));
    }

    /**
     * Tries to acquire the lock and give immediately up when already locked by someone else.
     *
     * @param id
     * @param ttl time to live in seconds. The lock automatically releases when ttl is reached. 0 for no limit.
     */
    public async tryLock(id: string, ttl: number = 0): Promise<AppLock | undefined> {
        const subscription = await this.broker.tryLock(id, ttl);
        if (!subscription) return subscription;

        return new AppLock(subscription);
    }

    /**
     * Returns true if the lock is already aquired by someone.
    */
    public async isLocked(id: string): Promise<boolean> {
        return this.broker.isLocked(id);
    }
}
