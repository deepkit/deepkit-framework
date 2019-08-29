import {Collection} from 'typeorm';
import {Database} from "@marcj/marshal-mongo";
import {sleep} from "@marcj/estdlib";
import {Entity, Field, Index, IDField, MongoIdField} from "@marcj/marshal";
import {Injectable} from 'injection-js';
import { AsyncSubscription } from '@marcj/estdlib-rxjs';

@Entity('__lock')
export class LockItem {
    @IDField()
    @MongoIdField()
    _id?: string;

    constructor(
        @Index({unique: true})
        @Field()
        public readonly name: string,

        @Field()
        public readonly expire: number,

        @Field()
        public readonly inserted: number,
    ) {
    }
}

export class Lock {
    private holding = false;
    private safeGuardOnExitUnsubscribe?: Function;
    private timeoutTimer?: any;

    constructor(
        public readonly id: string,
        public readonly locks: Collection<LockItem>
    ) {
    }

    /**
     * @param timeout in seconds
     */
    public async acquire(timeout: number = 30) {
        if (this.holding) {
            throw new Error('Lock already acquired');
        }

        while (!await this.tryLock(timeout)) {
            await sleep(0.01);
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.release();
        }, timeout * 1000);

        //make 99% sure we delete the lock even when process dies.
        // this.safeGuardOnExitUnsubscribe = onProcessExit(async () => {
        //     await this.release();
        // });
    }

    public async prolong(seconds: number) {
        if (!this.holding) {
            throw new Error('Lock already expired, could not prolong.');
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.release();
        }, seconds * 1000);

        await this.locks.updateOne({
            name: this.id
        }, {
            $set: {
                //expire is used to automatically clear expired locks
                //in case the creator crashed without the ability to delete its acquired lock.
                expire: (Date.now() / 1000 + seconds)
            }
        });
    }

    public isLocked() {
        return this.holding;
    }

    public async tryLock(timeout: number) {
        const now = Date.now() / 1000;

        try {
            await this.locks.deleteMany({
                expire: {$lt: now}
            });

            await this.locks.insertOne({
                name: this.id,
                //expire is used to automatically clear expired locks
                //in case the creator crashed without the ability to delete its acquired lock.
                expire: (now + timeout),
                inserted: now
            });
            this.holding = true;
        } catch (error) {
            if (error.code === 11000) {
                //unique clash, means lock already acquired.
            }

            this.holding = false;
            return false;
        }

        return true;
    }

    public async release() {
        this.holding = false;

        if (this.safeGuardOnExitUnsubscribe) {
            this.safeGuardOnExitUnsubscribe();
        }

        await this.locks.deleteMany({
            name: this.id
        });
    }
}

@Injectable()
export class Locker {
    constructor(protected database: Database) {
    }

    public getLocks(): Collection<LockItem> {
        return this.database.getCollection(LockItem);
    }

    public async count(filter: Partial<LockItem> = {}): Promise<number> {
        return await this.database.getCollection(LockItem).countDocuments(filter);
    }

    public async acquireLock(id: string, timeout?: number): Promise<Lock> {
        const lock = new Lock(id, this.getLocks());
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
            await lock.release();
        });
    }

    public async tryLock(id: string,  timeout: number = 0.1): Promise<Lock | undefined> {
        const lock = new Lock(id, this.getLocks());

        if (await lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        const now = Date.now() / 1000;

        await this.getLocks().deleteMany({
            expire: {$lt: now}
        });

        return await this.getLocks().countDocuments({
            name: id
        }) > 0;
    }
}
