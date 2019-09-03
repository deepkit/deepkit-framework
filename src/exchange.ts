import {createClient, RedisClient} from 'redis';
import {Subscription} from "rxjs";
import {getEntityName} from "@marcj/marshal";
import {ExchangeEntity, StreamFileResult} from '@marcj/glut-core';
import {ClassType, eachPair} from '@marcj/estdlib';
import {AsyncSubscription} from '@marcj/estdlib-rxjs';
import {Injectable} from "injection-js";

type Callback<T> = (message: T) => void;

@Injectable()
export class Exchange {
    private redis: RedisClient;
    private subscriberRedis?: RedisClient;

    private subscriptions: { [channelName: string]: Callback<any>[] } = {};
    private subscribedChannelMessages = false;

    constructor(
        protected host: string = 'localhost',
        protected port: number = 6379,
        protected prefix: string = ''
    ) {
        this.redis = createClient({
            host: host,
            port: port,
        });
    }

    public async disconnect() {
        await this.command(this.redis, 'quit');

        if (this.subscriberRedis) {
            await this.command(this.subscriberRedis, 'quit');
        }
    }

    public async flush() {
        return new Promise((resolve, reject) => this.redis.flushall((err) => err ? reject(err) : resolve()));
    }

    public getSubscriberConnection(): RedisClient {
        if (!this.subscriberRedis) {
            this.subscriberRedis = this.redis.duplicate();
        }
        return this.subscriberRedis;
    }

    public async command<T extends RedisClient, K extends keyof RedisClient>(redis: T, command: K, ...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            (redis as any)[command](...args, (error: any, v: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(v);
                }
            });
        });
    }

    public async getSubscribedEntityFields<T>(classType: ClassType<T>): Promise<string[]> {
        const key = this.prefix + '/entity-field-subscription/' + getEntityName(classType);
        const fields: string[] = [];

        return new Promise<string[]>((resolve, reject) => {
            try {
                this.redis.hgetall(key, (err, keys: { [field: string]: any }) => {
                    if (err) {
                        reject(err);
                    } else {
                        for (const [i, v] of eachPair(keys)) {
                            if (parseInt(v, 10) > 0) {
                                fields.push(i);
                            }
                        }
                        resolve(fields);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public async del(key: string) {
        return new Promise((resolve, reject) => {
            this.redis.del(key, (err) => {
                if (err) reject(err); else resolve();
            });
        });
    }

    public async clearEntityFields<T>(classType: ClassType<T>) {
        return this.del(this.prefix + '/entity-field-subscription/' + getEntityName(classType));
    }

    /**
     * This tells the ExchangeDatabase which field values you additionally need in a patch-message.
     */
    public async subscribeEntityFields<T>(classType: ClassType<T>, fields: string[]): Promise<AsyncSubscription> {
        const key = this.prefix + '/entity-field-subscription/' + getEntityName(classType);

        const promises: Promise<void>[] = [];
        for (const field of fields) {
            promises.push(new Promise((resolve, reject) => {
                this.redis.hincrby(key, field, 1, (err) => {
                    if (err) reject(err); else resolve();
                });
            }));
        }

        await Promise.all(promises);

        return new AsyncSubscription(async () => {
            const promises: Promise<void>[] = [];
            for (const field of fields) {
                promises.push(new Promise((resolve, reject) => {
                    this.redis.hincrby(key, field, -1, (err) => {
                        if (err) reject(err); else resolve();
                    });
                }));
            }
            await Promise.all(promises);
        });
    }

    public publishEntity<T>(classType: ClassType<T>, message: ExchangeEntity) {
        const channelName = this.prefix + '/entity/' + getEntityName(classType);
        this.publish(channelName, message);
    }

    public publishFile<T>(fileId: string, message: StreamFileResult) {
        const channelName = this.prefix + '/file/' + fileId;
        this.publish(channelName, message);
    }

    public async subscribeEntity<T>(classType: ClassType<T>, cb: Callback<ExchangeEntity>): Promise<Subscription> {
        const channelName = this.prefix + '/entity/' + getEntityName(classType);
        return this.subscribe(channelName, cb);
    }

    public async subscribeFile<T>(fileId: string, cb: Callback<StreamFileResult>): Promise<Subscription> {
        const channelName = this.prefix + '/file/' + fileId;
        return this.subscribe(channelName, cb);
    }

    public publish(channelName: string, message: any) {
        this.redis.publish(channelName, JSON.stringify(message), (error) => {
            if (error) {
                console.error(`Error publishing to '${channelName}'`, error);
            }
        });
    }

    protected subscribeToMessages() {
        if (this.subscribedChannelMessages) {
            return;
        }

        this.subscribedChannelMessages = true;

        this.getSubscriberConnection().on('message', (messageChannel: string, message: string) => {
            if (message === '{}') {
                //todo only when debug is on
                console.warn('Exchange got empty message for ' + messageChannel);
                return;
            }

            const data = JSON.parse(message);

            if (this.subscriptions[messageChannel]) {
                //it's important to work with an array copy, otherwise unsubscribing from withing a callback results in a wrong iteration
                for (const cb of this.subscriptions[messageChannel].slice(0)) {
                    cb(data);
                }
            } else {
                console.warn('Exchange got message without active subscriptions for ' + messageChannel, message);
            }
        });
    }

    // public controller<T>(controllerName: string, controller: T) {
    //     return this.subscribe(controllerName, async (message: { id: string, action: string, args: any[] }) => {
    //         const replyChannelName = controllerName + '/reply/' + message.id;
    //
    //         try {
    //             let result = (controller as any)[message.action](...message.args);
    //
    //             if (result && result.then) {
    //                 result = await result;
    //             }
    //
    //             this.publish(replyChannelName, {id: message.id, type: 'complete', data: result});
    //         } catch (error) {
    //             this.publish(replyChannelName, {id: message.id, type: 'error', data: error});
    //         }
    //     });
    // }
    //
    // public controllerAction(controllerName: string, action: string, ...args: any[]): Promise<any> {
    //     const id = uuid();
    //
    //     return new Promise((resolve, reject) => {
    //         const sub = this.subscribe(controllerName + '/reply/' + id, (message: { type: 'error' | 'complete', data: any }) => {
    //             sub.unsubscribe();
    //
    //             if (message.type === 'error') {
    //                 reject(message.data);
    //             }
    //
    //             if (message.type === 'complete') {
    //                 resolve(message.data);
    //             }
    //         });
    //
    //         this.publish(name, {id: id, action: action, args: args});
    //     });
    // }

    public async subscribe(channelName: string, callback: Callback<any>): Promise<Subscription> {
        this.subscribeToMessages();

        if (!this.subscriptions[channelName]) {
            this.subscriptions[channelName] = [];
            this.subscriptions[channelName].push(callback);
            await this.command(this.getSubscriberConnection(), 'subscribe', channelName);
        } else {
            this.subscriptions[channelName].push(callback);
        }

        return new Subscription(() => {
            const index = this.subscriptions[channelName].indexOf(callback);

            if (-1 !== index) {
                this.subscriptions[channelName].splice(index, 1);
            }

            if (this.subscriptions[channelName].length === 0) {
                delete this.subscriptions[channelName];
                this.getSubscriberConnection().unsubscribe(channelName);
            }
        });
    }
}
