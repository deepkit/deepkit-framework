import {Injectable} from 'injection-js';
import {AsyncSubscription} from '@marcj/estdlib-rxjs';

const LOCKS: { [id: string]: { time: number, done: Promise<void> } } = {};

/**
 * This lock mechanism works only for one process.
 * @todo implement a small ws server that can be used a centralized lock server.
 *
 * live-mutex: has horrible API and doesn't allow to check if an key is currently locked.
 * proper-filelock: No way to do a correct mutex locking with event-driven blocking acquire() method.
 * redislock: Very bad performance on high-load (when multiple locks on the same key `wait`, since it loops)
 * mongodb lock: even worse performance than redis. Jesus.
 */
export class Lock {
    private holding = false;
    private safeGuardOnExitUnsubscribe?: Function;
    private timeoutTimer?: any;
    private resolve?: Function;

    constructor(
        public readonly id: string,
    ) {
    }

    public async acquire(timeout?: number) {
        if (this.holding) {
            throw new Error('Lock already acquired');
        }

        while (LOCKS[this.id]) {
            await LOCKS[this.id].done;
        }

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                time: Date.now() / 1000,
                done: new Promise<void>((resolve) => {
                    this.resolve = resolve;
                })
            };
            this.holding = true;
        }

        if (timeout) {
            setTimeout(() => {
                this.unlock();
            }, timeout * 1000);
        }
    }

    public isLocked() {
        return this.holding;
    }

    public async tryLock(timeout?: number) {
        this.holding = false;

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                time: Date.now() / 1000,
                done: new Promise<void>((resolve) => {
                    this.resolve = resolve;
                })
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

    public async unlock() {
        if (!this.holding) {
            return;
        }

        this.holding = false;

        delete LOCKS[this.id];

        if (this.resolve) {
            this.resolve();
        }

        if (this.safeGuardOnExitUnsubscribe) {
            this.safeGuardOnExitUnsubscribe();
        }
    }
}

@Injectable()
export class Locker {
    constructor() {
    }

    /**
     *
     * @param id
     * @param timeout optional defines when the times automatically unlocks.
     */
    public async acquireLock(id: string, timeout?: number): Promise<Lock> {
        const lock = new Lock(id);
        await lock.acquire(timeout);

        return lock;
    }

    public async tryLock(id: string, timeout?: number): Promise<Lock | undefined> {
        const lock = new Lock(id);

        if (await lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        return !!LOCKS[id];
    }
}
