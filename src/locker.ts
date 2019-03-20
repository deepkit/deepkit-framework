import {Collection} from 'typeorm';
import {Database} from "@marcj/marshal-mongo";
import {sleep} from "@marcj/estdlib";
import {Entity, Field, Index, IDField, MongoIdField} from "@marcj/marshal";

@Entity('__lock')
export class Lock {
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

export class MongoLock {
    private holding = false;
    private safeGuardOnExitUnsubscribe?: Function;
    private timeoutTimer?: any;

    constructor(
        private id: string,
        private locks: Collection<Lock>
    ) {
    }

    /**
     * @param timeout in seconds
     */
    public async acquire(timeout: number = 30) {
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
                //so we add here a buffer of 1sec, so in worst case (when process crashes) further locks need to wait a bit
                expire: (Date.now() / 1000 + seconds) + 1
            }
        });
    }

    public isLocked() {
        return this.holding;
    }

    private async tryLock(timeout: number) {
        const now = Date.now() / 1000;

        try {
            await this.locks.deleteMany({
                expire: {$lt: now}
            });

            await this.locks.insertOne({
                name: this.id,
                //expire is used to automatically clear expired locks
                //in case the creator crashed without the ability to delete its acquired lock.
                //so we add here a buffer of 1sec, so in worst case (when process crashes) further locks need to wait a bit
                expire: (now + timeout) + 1,
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

export class Locker {
    constructor(protected database: Database) {
    }

    public getLocks() {
        return this.database.getCollection(Lock);
    }

    public async count(filter: Partial<Lock> = {}): Promise<number> {
        return await this.database.getCollection(Lock).count(filter);
    }

    public async acquireLock(id: string, timeout?: number): Promise<MongoLock> {
        const lock = new MongoLock(id, this.getLocks());
        await lock.acquire(timeout);

        return lock;
    }
}
