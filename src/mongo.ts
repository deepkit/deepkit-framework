import {Collection, Db, MongoClient} from 'mongodb';
import {sleep} from "@kamille/core";
import {Injectable} from "injection-js";

export class MongoLock {
    private holding = false;
    private safeGuardOnExitUnsubscribe?: Function;
    private timeoutTimer?: any;

    constructor(
        private id: string,
        private locks: Collection
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

        // //make 99% sure we delete the lock even when process dies.
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
            expire: Date.now() / 1000 + seconds
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
                expire: now + timeout,
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
export class Mongo {
    protected connection?: MongoClient;
    protected host = 'localhost:7802';

    constructor(public dbName: string, host?: string) {
        if (host) {
            this.host = host;
        }
    }

    public async collection(collectionName: string): Promise<Collection> {
        return (await this.database()).collection(collectionName);
    }

    public async database(): Promise<Db> {
        return (await this.connect()).db(this.dbName);
    }

    public async acquireLock(id: string, timeout?: number): Promise<MongoLock> {
        const lock = new MongoLock(id, await this.collection('__locks'));
        await lock.acquire(timeout);

        return lock;
    }

    public async disconnect() {
        if (this.connection) {
            await this.connection.close();
            delete this.connection;
        }
    }

    public async connect(): Promise<MongoClient> {
        if (!this.connection) {

            this.connection = await MongoClient.connect('mongodb://' + this.host + '/' + this.dbName, {
                reconnectTries: Number.MAX_VALUE,
                reconnectInterval: 1000
            });

        }

        return this.connection;
    }
}
