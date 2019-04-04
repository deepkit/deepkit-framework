import {Injectable} from 'injection-js';
import {createClient, RedisClient} from "redis";
import * as Redlock from 'redlock';
import {Lock} from 'redlock';

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

    public async acquireLock(id: string, timeout?: number): Promise<Lock> {
        return this.redlock.acquire(id, (timeout || 0.1) * 1000);
    }
}
