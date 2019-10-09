import {Subscription} from "rxjs";
import {getEntityName} from "@marcj/marshal";
import {ExchangeEntity, StreamFileResult} from '@marcj/glut-core';
import {ClassType, sleep} from '@marcj/estdlib';
import {Injectable} from "injection-js";
import {decodeMessage, encodeMessage, uintToString} from './exchange-prot';

type Callback<T> = (message: T) => void;

export class ExchangeLock {
    constructor(protected unlocker: () => void) {
    }

    unlock() {
        this.unlocker();
    }
}

@Injectable()
export class Exchange {
    private subscriptions: { [channelName: string]: Callback<any>[] } = {};
    public socket?: WebSocket;
    private connectionPromise?: Promise<void>;

    protected messageId = 1;
    protected replyResolver: { [id: number]: Function } = {};

    constructor(
        protected host: string = 'localhost',
        protected port: number = 8561,
    ) {
    }

    public async disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    public async connect(): Promise<WebSocket> {
        while (this.connectionPromise) {
            await sleep(0.01);
            await this.connectionPromise;
        }

        this.connectionPromise = this.doConnect();

        try {
            await this.connectionPromise;
        } finally {
            delete this.connectionPromise;
        }

        if (!this.socket) {
            throw new Error('Exchange not connected.');
        }

        return this.socket;
    }

    protected async doConnect(): Promise<void> {
        if (this.socket) return;

        return new Promise<void>((resolve, reject) => {
            this.socket = new WebSocket('ws://' + this.host + ':' + this.port);

            this.socket.onerror = () => {
                console.log('onerror');
                this.socket = undefined;
                reject(new Error('Error websocket'));
            };

            this.socket.onclose = () => {
                console.log('onclose');
                this.socket = undefined;
            };

            this.socket.onmessage = (event: MessageEvent) => {
                this.onMessage(event.data);
            };

            this.socket.onopen = async () => {
                resolve();
            };
        });
    }

    protected onMessage(message: ArrayBuffer) {
        const m = decodeMessage(message);
        // console.log('client message', m);

        if (this.replyResolver[m.id]) {
            this.replyResolver[m.id](m.arg);
            delete this.replyResolver[m.id];
        }

        if (m.type === 'publish') {
            if (this.subscriptions[m.arg]) {
                const data = JSON.parse(uintToString(m.payload));
                for (const cb of this.subscriptions[m.arg].slice(0)) {
                    cb(data);
                }
            }
        }
    }

    // todo, redo that
    // public async getSubscribedEntityFields<T>(classType: ClassType<T>): Promise<string[]> {
    //     const key = 'entity-field-subscription/' + getEntityName(classType);
    //     const fields: string[] = [];
    //
    //     return new Promise<string[]>((resolve, reject) => {
    //         try {
    //             this.redis.hgetall(key, (err, keys: { [field: string]: any }) => {
    //                 if (err) {
    //                     reject(err);
    //                 } else {
    //                     for (const [i, v] of eachPair(keys)) {
    //                         if (parseInt(v, 10) > 0) {
    //                             fields.push(i);
    //                         }
    //                     }
    //                     resolve(fields);
    //                 }
    //             });
    //         } catch (error) {
    //             reject(error);
    //         }
    //     });
    // }
    //
    // public async del(key: string) {
    //     return new Promise((resolve, reject) => {
    //         this.redis.del(key, (err) => {
    //             if (err) reject(err); else resolve();
    //         });
    //     });
    // }

    // public async clearEntityFields<T>(classType: ClassType<T>) {
    //     return this.del(this.prefix + '/entity-field-subscription/' + getEntityName(classType));
    // }

    // /**
    //  * This tells the ExchangeDatabase which field values you additionally need in a patch-message.
    //  */
    // public async subscribeEntityFields<T>(classType: ClassType<T>, fields: string[]): Promise<AsyncSubscription> {
    //     const key = this.prefix + '/entity-field-subscription/' + getEntityName(classType);
    //
    //     const promises: Promise<void>[] = [];
    //     for (const field of fields) {
    //         promises.push(new Promise((resolve, reject) => {
    //             this.redis.hincrby(key, field, 1, (err) => {
    //                 if (err) reject(err); else resolve();
    //             });
    //         }));
    //     }
    //
    //     await Promise.all(promises);
    //
    //     return new AsyncSubscription(async () => {
    //         const promises: Promise<void>[] = [];
    //         for (const field of fields) {
    //             promises.push(new Promise((resolve, reject) => {
    //                 this.redis.hincrby(key, field, -1, (err) => {
    //                     if (err) reject(err); else resolve();
    //                 });
    //             }));
    //         }
    //         await Promise.all(promises);
    //     });
    // }

    public async publishEntity<T>(classType: ClassType<T>, message: ExchangeEntity) {
        const channelName = 'entity/' + getEntityName(classType);
        await this.publish(channelName, message);
    }

    public async publishFile<T>(fileId: string, message: StreamFileResult) {
        const channelName = 'file/' + fileId;
        await this.publish(channelName, message);
    }

    public async subscribeEntity<T>(classType: ClassType<T>, cb: Callback<ExchangeEntity>): Promise<Subscription> {
        const channelName = 'entity/' + getEntityName(classType);
        return this.subscribe(channelName, cb);
    }

    public async subscribeFile<T>(fileId: string, cb: Callback<StreamFileResult>): Promise<Subscription> {
        const channelName = 'file/' + fileId;
        return this.subscribe(channelName, cb);
    }

    protected async send(type: string, arg: string, payload?: string | ArrayBuffer | Uint8Array | object): Promise<void> {
        const messageId = this.messageId++;
        (await this.connect()).send(encodeMessage(messageId, type, arg, payload));
    }

    protected async sendAndWaitForReply(type: string, arg: string, payload?: string | ArrayBuffer | Uint8Array | object): Promise<any> {
        const messageId = this.messageId++;

        return new Promise(async (resolve) => {
            this.replyResolver[messageId] = resolve;
            (await this.connect()).send(encodeMessage(messageId, type, arg, payload));
        });
    }

    public async publish(channelName: string, message: any) {
        this.send('publish', channelName, message);
    }

    public async lock(name: string): Promise<ExchangeLock> {
        await this.sendAndWaitForReply('lock', name);
        return new ExchangeLock(() => {
            this.send('unlock', name);
        });
    }

    public async isLocked(name: string): Promise<boolean> {
        return await this.sendAndWaitForReply('isLocked', name);
    }

    public async subscribe(channelName: string, callback: Callback<any>): Promise<Subscription> {
        if (!this.subscriptions[channelName]) {
            this.subscriptions[channelName] = [];
            this.subscriptions[channelName].push(callback);
            this.send('subscribe', channelName);
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
                this.send('unsubscribe', channelName);
            }
        });
    }
}
