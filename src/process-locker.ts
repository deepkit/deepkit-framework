import {Injectable} from 'injection-js';

const LOCKS: { [id: string]: { time: number, queue: Function[] } } = {};

/**
 * This lock mechanism works only for one process.
 * @todo implement a small ws server that can be used a centralized lock server.
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

    public async acquire(timeout?: number) {
        if (this.holding) {
            throw new Error('Lock already acquired');
        }

        return new Promise<void>((resolve) => {
            const ourTake = () => {
                LOCKS[this.id].time = Date.now() / 1000;

                this.holding = true;
                resolve();

                if (timeout) {
                    setTimeout(() => {
                        this.unlock();
                    }, timeout * 1000);
                }
            };

            if (LOCKS[this.id]) {
                LOCKS[this.id].queue.push(ourTake);
            } else {
                LOCKS[this.id] = {
                    time: Date.now() / 1000,
                    queue: []
                };

                this.holding = true;
                resolve();

                if (timeout) {
                    setTimeout(() => {
                        this.unlock();
                    }, timeout * 1000);
                }
            }
        });
    }

    public isLocked() {
        return this.holding;
    }

    public async tryLock(timeout?: number) {
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

    public async unlock() {
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

@Injectable()
export class ProcessLocker {
    constructor() {
    }

    /**
     *
     * @param id
     * @param timeout optional defines when the times automatically unlocks.
     */
    public async acquireLock(id: string, timeout?: number): Promise<ProcessLock> {
        const lock = new ProcessLock(id);
        await lock.acquire(timeout);

        return lock;
    }

    public async tryLock(id: string, timeout?: number): Promise<ProcessLock | undefined> {
        const lock = new ProcessLock(id);

        if (await lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        return !!LOCKS[id];
    }
}
