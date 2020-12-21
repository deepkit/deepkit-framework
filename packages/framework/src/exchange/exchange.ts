/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Subscription} from 'rxjs';
import {ClassSchema} from '@deepkit/type';
import {asyncOperation, ClassType, ParsedHost, parseHost, sleep} from '@deepkit/core';
import {decodeMessage, decodePayloadAsJson, encodeMessage, encodePayloadAsJSONArrayBuffer} from './exchange-prot';
import {AsyncSubscription} from '@deepkit/core-rxjs';
import WebSocket from 'ws';
import {inject, injectable} from '../injector/injector';
import {getBSONDecoder, getBSONSerializer} from '@deepkit/bson';
import {exchangeConfig} from './exchange.config';
import { BehaviorSubject } from 'rxjs';

type Callback<T> = (message: T) => void;

export class ExchangeLock {
    constructor(protected unlocker: () => void) {
    }

    unlock() {
        this.unlocker();
    }
}

@injectable()
export class Exchange {
    private subscriptions: { [channelName: string]: Callback<any>[] } = {};
    public socket?: WebSocket;
    private connectionPromise?: Promise<void>;

    protected messageId = 1;
    protected replyResolver: { [id: number]: Function } = {};

    protected rawSubscriber = new WeakMap<Function, boolean>();

    protected host: ParsedHost = parseHost(this.listen);

    protected usedEntityFieldsSubjects = new Map<string, BehaviorSubject<string[]>>();

    constructor(
        @inject(exchangeConfig.token('listen')) protected listen: string,
    ) {
    }

    public async disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    public async connect(): Promise<WebSocket> {
        while (this.connectionPromise) {
            await sleep(0.001);
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

        return asyncOperation<void>((resolve, reject) => {
            const url = this.host.getWebSocketUrl();
            this.socket = new WebSocket(url);
            this.socket.binaryType = 'arraybuffer';

            this.socket.onerror = (error: any) => {
                this.socket = undefined;
                reject(new Error(`Could not connect to ${url}: ${error.toString()}`));
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

        if (m.type === 'entity-fields') {
            const [entityName, fields] = m.arg;
            this.getUsedEntityFields(entityName).next(fields);
            this.send('ack-entity-fields', true).catch(console.error);
        }

        if (m.type === 'publish') {
            const [channelName] = m.arg;

            if (this.subscriptions[channelName]) {
                let decodedJson: any;
                for (const cb of this.subscriptions[channelName].slice(0)) {
                    if (this.rawSubscriber.get(cb) === true) {
                        cb(m.payload);
                    } else {
                        if (decodedJson === undefined) {
                            decodedJson = decodePayloadAsJson(m.payload);
                        }
                        cb(decodedJson);
                    }

                }
            }
        }
    }

    public async get<T>(
        key: string,
        dataType: ClassSchema<T> | ClassType<T>,
    ): Promise<T | undefined> {
        const reply = await this.sendAndWaitForReply('get', key);
        if (reply.payload && reply.payload.byteLength) {
            return getBSONDecoder(dataType)(Buffer.from(reply.payload));
        }
        return;
    }

    public async set<T>(
        key: string,
        dataType: ClassSchema<T> | ClassType<T>,
        data: T,
    ): Promise<any> {
        let payload: ArrayBuffer | undefined;
        if (dataType && data !== undefined) {
            payload = getBSONSerializer(dataType)(data);
        }
        await this.send('set', key, payload);
    }

    /**
     * @param key
     * @param increase positive or negative value.
     */
    public async increase(key: string, increase: number): Promise<any> {
        await this.send('increase', [key, increase]);
    }

    // public async getSubscribedEntityFields<T>(classType: ClassType<T>): Promise<string[]> {
    //     const a = await this.sendAndWaitForReply('get-entity-subscribe-fields', getEntityName(classType));
    //     return a.arg;
    // }

    public async del(key: string) {
        await this.send('del', key);
    }

    /**
     * This tells the LiveDatabase which field values you additionally need in a patch bus-message.
     */
    public async publishUsedEntityFields<T>(classSchema: ClassSchema, fields: string[]): Promise<AsyncSubscription> {
        const messageId = await this.send('used-entity-fields', [classSchema.getName(), fields]);

        await asyncOperation(async (resolve) => {
            this.replyResolver[messageId] = resolve;
        });

        return new AsyncSubscription(async () => {
            this.send('del-used-entity-fields', messageId).catch(console.error);
        });
    }

    public getUsedEntityFields(classSchema: ClassSchema | string) {
        const entityName = 'string' === typeof classSchema ? classSchema : classSchema.getName();
        let subject = this.usedEntityFieldsSubjects.get(entityName);
        if (subject) return subject;

        subject = new BehaviorSubject<string[]>([]);
        this.usedEntityFieldsSubjects.set(entityName, subject);

        return subject;
    }

    public publishEntity<T>(classSchema: ClassSchema<T>, message: any) {
        const channelName = 'deepkit/entity/' + classSchema.getName();
        this.publish(channelName, message);
    }

    public publishFile<T>(fileId: string, message: any) {
        const channelName = 'deepkit/file/' + fileId;
        this.publish(channelName, message);
    }

    public subscribeEntity<T>(classSchema: ClassSchema<T>, cb: Callback<any>): Subscription {
        const channelName = 'deepkit/entity/' + classSchema.getName();
        return this.subscribe(channelName, cb);
    }

    public subscribeFile<T>(fileId: string | number, cb: Callback<any>): Subscription {
        const channelName = 'deepkit/file/' + fileId;
        return this.subscribe(channelName, cb);
    }

    protected async send(type: string, arg: any, payload?: ArrayBuffer | Uint8Array): Promise<number> {
        const messageId = this.messageId++;
        const message = encodeMessage(messageId, type, arg, payload);
        (await this.connect()).send(message);
        return messageId;
    }

    protected async sendAndWaitForReply(type: string, arg: any, payload?: ArrayBuffer): Promise<{ arg: any, payload: ArrayBuffer | undefined }> {
        const messageId = this.messageId++;

        return asyncOperation(async (resolve) => {
            this.replyResolver[messageId] = resolve;
            (await this.connect()).send(encodeMessage(messageId, type, arg, payload));
        });
    }

    /**
     * If ttl is given, the channel keeps that last value in memory for ttl seconds and immediately emits it
     * for new subscribers.
     */
    public async publishBinary(channelName: string, message: ArrayBuffer, ttl: number = 0) {
        return await this.send('publish', [channelName, ttl], message);
    }

    /**
     * If ttl is given, the channel keeps that last value in memory for ttl seconds and immediately emits it
     * for new subscribers.
     */
    public publish(channelName: string, message: object, ttl: number = 0) {
        this.send('publish', [channelName, ttl], encodePayloadAsJSONArrayBuffer(message)).catch(console.error);
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

    public subscribe(channelName: string, callback: Callback<any>, rawMessage: boolean = false): Subscription {
        this.rawSubscriber.set(callback, rawMessage);

        if (!this.subscriptions[channelName]) {
            this.subscriptions[channelName] = [];
            this.subscriptions[channelName].push(callback);
            this.send('subscribe', channelName).catch(console.error);
        } else {
            this.subscriptions[channelName].push(callback);
        }

        return new Subscription(() => {
            const index = this.subscriptions[channelName].indexOf(callback);
            this.rawSubscriber.delete(callback);

            if (-1 !== index) {
                this.subscriptions[channelName].splice(index, 1);
            }

            if (this.subscriptions[channelName].length === 0) {
                delete this.subscriptions[channelName];
                this.send('unsubscribe', channelName).catch(console.error);
            }
        });
    }
}
