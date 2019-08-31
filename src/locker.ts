import {Injectable} from 'injection-js';
import {AsyncSubscription} from '@marcj/estdlib-rxjs';

const LOCKS: { [id: string]: { expire: number, done: Promise<void> } } = {};

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

    /**
     * @param timeout in seconds
     */
    public async acquire(timeout: number = 30) {
        if (this.holding) {
            throw new Error('Lock already acquired');
        }

        while (LOCKS[this.id]) {
            await LOCKS[this.id].done;
        }

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                expire: ((Date.now() / 1000) + timeout), done: new Promise<void>((resolve) => {
                    this.resolve = resolve;
                })
            };
            this.holding = true;
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.unlock();
        }, timeout * 1000);
    }

    public async prolong(seconds: number) {
        if (!this.holding) {
            throw new Error('Lock already expired, could not prolong.');
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.unlock();
        }, seconds * 1000);

        LOCKS[this.id].expire = (Date.now() / 1000 + seconds);
    }

    public isLocked() {
        return this.holding;
    }

    public async tryLock(timeout: number) {
        const now = Date.now() / 1000;

        this.holding = false;

        if (!LOCKS[this.id]) {
            LOCKS[this.id] = {
                expire: (now + timeout), done: new Promise<void>((resolve) => {
                    this.resolve = resolve;
                })
            };
            this.holding = true;
        }

        return this.holding;
    }

    public async unlock() {
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

    public async acquireLock(id: string, timeout?: number): Promise<Lock> {
        const lock = new Lock(id);
        await lock.acquire(timeout);

        return lock;
    }

    public async acquireLockWithAutoExtending(id: string, timeout: number = 0.1): Promise<AsyncSubscription> {
        const lock = await this.acquireLock(id, timeout);

        let t: any;

        const extend = () => {
            if (lock.isLocked()) {
                lock.prolong(timeout);

                t = setTimeout(extend, (timeout / 2) * 1000);
            }
        };

        t = setTimeout(extend, (timeout / 2) * 1000);

        return new AsyncSubscription(async () => {
            clearTimeout(timeout);
            await lock.unlock();
        });
    }

    public async tryLock(id: string, timeout: number = 0.1): Promise<Lock | undefined> {
        const lock = new Lock(id);

        if (await lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        const now = Date.now() / 1000;

        if (LOCKS[id] && LOCKS[id].expire <= now) {
            delete LOCKS[id];
        }

        return !!LOCKS[id];
    }
}
