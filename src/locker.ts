import {Injectable} from 'injection-js';
import {createClient, RedisClient} from "redis";
import * as Redlock from 'redlock';
import {Lock} from 'redlock';
import {Subscription} from 'rxjs';
import {AsyncSubscription} from '@marcj/estdlib-rxjs';

export {Lock} from 'redlock';

@Injectable()
export class Locker {
    private redis: RedisClient;
    private redlock: Redlock;

    constructor(
        protected host: string = 'localhost',
        protected port: number = 6379
    ) {
        this.redis = createClient({
            host: host,
            port: port,
        });

        this.redlock = new Redlock([this.redis], {
            retryCount: 10000,
            retryDelay: 100,
            //max wait-time is 0.1s * 10000 = 1000.0 sec = 16min.
        });
    }

    public async disconnect() {
        await new Promise((resolve, reject) => this.redis.quit((err) => err ? reject(err) : resolve()));
    }

    public async acquireLock(id: string, timeoutInSeconds?: number): Promise<Lock> {
        return this.redlock.acquire(id, (timeoutInSeconds || 0.1) * 1000);
    }

    public async acquireLockWithAutoExtending(id: string, timeoutInSeconds?: number): Promise<AsyncSubscription> {
        const timeoutInMS = (timeoutInSeconds || 0.25) * 1000;
        const lock = await this.redlock.acquire(id, timeoutInMS);

        let lastTimeout: any;

        const extend = async () => {
            await lock.extend((timeoutInSeconds || 0.25) * 1000);
            lastTimeout = setTimeout(extend, (timeoutInMS) * 0.5);
        };

        lastTimeout = setTimeout(extend, (timeoutInMS) * 0.5);

        return new AsyncSubscription(async () => {
            clearTimeout(lastTimeout);
            await lock.unlock();
        });
    }

    public async tryLock(id: string, timeoutInSeconds?: number): Promise<Lock | undefined> {
        const redlockTryer = new Redlock([this.redis], {
            retryCount: 1,
            retryDelay: 1,
        });

        try {
            return await redlockTryer.acquire(id, (timeoutInSeconds || 0.1) * 1000);
        } catch (error) {
            return undefined;
        }
    }

    public async isLocked(id: string): Promise<boolean> {
        const redlockTryer = new Redlock([this.redis], {
            retryCount: 1,
            retryDelay: 1,
        });

        try {
            const lock = await redlockTryer.acquire(id, 10);
            await lock.unlock();
            return false;
        } catch (error) {
            return true;
        }
    }
}
