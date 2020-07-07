import {arrayRemoveItem} from '@super-hornet/core';

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
                    setTimeout(() => {
                        this.unlock();
                    }, ttl * 1000);
                }
            };

            if (timeout > 0) {
                setTimeout(() => {
                    arrayRemoveItem(LOCKS[this.id].queue, ourTake);
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
                    setTimeout(() => {
                        this.unlock();
                    }, ttl * 1000);
                }
            }
        });
    }

    public isLocked() {
        return this.holding;
    }

    public tryLock(timeout?: number) {
        this.holding = false;

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                time: Date.now() / 1000,
                queue: []
            };
            this.holding = true;

            if (timeout) {
                setTimeout(() => {
                    this.unlock();
                }, timeout * 1000);
            }
        }

        return this.holding;
    }

    public unlock() {
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

    public async tryLock(id: string, timeout?: number): Promise<ProcessLock | undefined> {
        const lock = new ProcessLock(id);

        if (lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        return !!LOCKS[id];
    }
}
