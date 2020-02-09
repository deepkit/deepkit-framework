import {Subscription} from "rxjs";
import {getEntityName} from "@marcj/marshal";
import {ExchangeEntity, StreamFileResult} from '@marcj/glut-core';
import {ClassType, sleep} from '@marcj/estdlib';
import {Injectable} from "injection-js";
import {decodeMessage, decodePayloadAsJson, encodeMessage, encodePayloadAsJSONArrayBuffer} from './exchange-prot';
import {AsyncSubscription} from "@marcj/estdlib-rxjs";
import * as WebSocket from "ws";

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
        protected path: string = '/tmp/glut-exchange.sock',
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

        if (this.socket) {
            return this.socket;
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
        this.socket = undefined;

        return new Promise<void>((resolve, reject) => {
            this.socket = new WebSocket('ws+unix://' + this.path);
            this.socket.binaryType = 'arraybuffer';

            this.socket.onerror = (error: any) => {
                this.socket = undefined;
                console.error(error);
                reject(new Error(`Could not connect to ${this.path}.`));
            };

            this.socket.onclose = () => {
                this.socket = undefined;
                // console.error(new Error(`Exchange connection lost to ${this.host + ':' + this.port}`));
                // console.warn('Process is dying, because we can not recover from a disconnected exchange. The whole app state is invalid now.');
                // process.exit(500);
            };

            this.socket.onmessage = (event: { data: WebSocket.Data; type: string; target: WebSocket }) => {
                this.onMessage(event.data as ArrayBuffer);
            };

            this.socket.onopen = async () => {
                resolve();
            };
        });
    }

    protected onMessage(message: ArrayBuffer) {
        const m = decodeMessage(message);

        if (this.replyResolver[m.id]) {
            this.replyResolver[m.id]({arg: m.arg, payload: m.payload.byteLength ? m.payload : undefined});
            delete this.replyResolver[m.id];
        }

        if (m.type === 'publish') {
            if (this.subscriptions[m.arg]) {
                const data = decodePayloadAsJson(m.payload);
                for (const cb of this.subscriptions[m.arg].slice(0)) {
                    cb(data);
                }
            }
        }
    }

    public async get(key: string): Promise<ArrayBuffer | undefined> {
        const reply = await this.sendAndWaitForReply('get', key);
        return reply.payload;
    }

    /**
     * @param key
     * @param payload you have to call JSON.stringify if its a JSON value.
     */
    public async set(key: string, payload: any): Promise<any> {
        await this.send('set', key, payload);
    }

    /**
     * @param key
     * @param increase positive or negative value.
     */
    public async increase(key: string, increase: number): Promise<any> {
        await this.send('increase', [key, increase]);
    }

    public async getSubscribedEntityFields<T>(classType: ClassType<T>): Promise<string[]> {
        const a = await this.sendAndWaitForReply('get-entity-subscribe-fields', getEntityName(classType));
        return a.arg;
    }

    public async del(key: string) {
        await this.send('del', key);
    }

    // /**
    //  * This tells the ExchangeDatabase which field values you additionally need in a patch-message.
    //  */
    public async subscribeEntityFields<T>(classType: ClassType<T>, fields: string[]): Promise<AsyncSubscription> {
        const messageId = await this.send('entity-subscribe-fields', [getEntityName(classType), fields]);

        return new AsyncSubscription(async () => {
            this.send('del-entity-subscribe-fields', String(messageId));
        });
    }

    public async publishEntity<T>(classType: ClassType<T>, message: ExchangeEntity) {
        const channelName = 'entity/' + getEntityName(classType);
        await this.publish(channelName, message);
    }

    public async publishFile<T>(fileId: string, message: StreamFileResult) {
        const channelName = 'file/' + fileId;
        await this.publish(channelName, message);
    }

    public subscribeEntity<T>(classType: ClassType<T>, cb: Callback<ExchangeEntity>): Subscription {
        const channelName = 'entity/' + getEntityName(classType);
        return this.subscribe(channelName, cb);
    }

    public subscribeFile<T>(fileId: string, cb: Callback<StreamFileResult>): Subscription {
        const channelName = 'file/' + fileId;
        return this.subscribe(channelName, cb);
    }

    protected async send(type: string, arg: any, payload?: ArrayBuffer): Promise<number> {
        const messageId = this.messageId++;
        const message = encodeMessage(messageId, type, arg, payload);
        (await this.connect()).send(message);
        return messageId;
    }

    protected async sendAndWaitForReply(type: string, arg: any, payload?: ArrayBuffer): Promise<{arg: any, payload: ArrayBuffer | undefined}> {
        const messageId = this.messageId++;

        return new Promise(async (resolve) => {
            this.replyResolver[messageId] = resolve;
            (await this.connect()).send(encodeMessage(messageId, type, arg, payload));
        });
    }

    public async publish(channelName: string, message: object) {
        this.send('publish', channelName, encodePayloadAsJSONArrayBuffer(message));
    }

    public async lock(name: string, ttl: number = 0, timeout = 0): Promise<ExchangeLock> {
        const {arg} = await this.sendAndWaitForReply('lock', [name, ttl, timeout]);
        if (arg) {
            return new ExchangeLock(() => {
                this.send('unlock', name);
            });
        } else {
            throw new Error('Unable to lock ' + name);
        }
    }

    public async isLocked(name: string): Promise<boolean> {
        return (await this.sendAndWaitForReply('isLocked', name)).arg;
    }

    public async version(): Promise<number> {
        return (await this.sendAndWaitForReply('version', '')).arg;
    }

    public subscribe(channelName: string, callback: Callback<any>): Subscription {
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
