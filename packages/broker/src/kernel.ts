/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, ProcessLock, ProcessLocker } from '@deepkit/core';
import {
    createRpcMessage,
    RpcKernel,
    RpcKernelBaseConnection,
    RpcKernelConnections,
    RpcMessage,
    RpcMessageBuilder,
    RpcMessageRouteType,
    TransportConnection,
} from '@deepkit/rpc';
import { Logger } from '@deepkit/logger';
import {
    brokerBusPublish,
    brokerBusResponseHandleMessage,
    brokerBusSubscribe,
    brokerDelete,
    brokerEntityFields,
    brokerGet,
    brokerGetCache,
    brokerIncrement,
    brokerInvalidateCacheMessage,
    brokerLock,
    brokerLockId,
    BrokerQueueMessageHandled,
    BrokerQueuePublish,
    BrokerQueueResponseHandleMessage,
    BrokerQueueSubscribe,
    brokerResponseGet,
    brokerResponseGetCache,
    brokerResponseGetCacheMeta,
    brokerResponseIncrement,
    brokerResponseIsLock,
    brokerSet,
    brokerSetCache,
    BrokerType,
    QueueMessage,
    QueueMessageProcessing,
    QueueMessageState,
} from './model.js';
import cluster from 'cluster';
import { closeSync, openSync, renameSync, writeSync } from 'fs';
import { snapshotState } from './snapshot.js';
import { handleMessageDeduplication } from './utils.js';

export interface Queue {
    currentId: number;
    name: string;
    deduplicateMessageHashes: Set<string | number>;
    messages: QueueMessage[];
    consumers: { con: BrokerConnection, handling: Map<number, QueueMessage>, maxMessagesInParallel: number }[];
}

export class BrokerConnection extends RpcKernelBaseConnection {
    protected subscribedChannels: string[] = [];
    protected locks = new Map<number, ProcessLock>();

    constructor(
        logger: Logger,
        transportConnection: TransportConnection,
        protected connections: RpcKernelConnections,
        protected state: BrokerState,
    ) {
        super(logger, transportConnection, connections);
    }

    public close(): void {
        super.close();

        for (const c of this.subscribedChannels) {
            this.state.unsubscribe(c, this);
        }
        arrayRemoveItem(this.state.invalidationCacheMessageConnections, this);

        for (const lock of this.locks.values()) {
            lock.unlock();
        }
    }

    protected async sendEntityFields(name: string) {
        const fields = this.state.getEntityFields(name);
        const promises: Promise<void>[] = [];

        for (const connection of this.connections.connections) {
            if ((connection as any) === this) continue;
            promises.push(connection.sendMessage<brokerEntityFields>(BrokerType.EntityFields, {
                name,
                fields,
            }).ackThenClose());
        }

        await Promise.all(promises);
    }

    async onMessage(message: RpcMessage, response: RpcMessageBuilder): Promise<void> {
        switch (message.type) {
            case BrokerType.PublishEntityFields: {
                const body = message.parseBody<brokerEntityFields>();
                const changed = this.state.publishEntityFields(body.name, body.fields);
                if (changed) {
                    await this.sendEntityFields(body.name);
                }
                response.reply<brokerEntityFields>(
                    BrokerType.EntityFields,
                    { name: body.name, fields: this.state.getEntityFields(body.name) },
                );
                break;
            }
            case BrokerType.UnsubscribeEntityFields: {
                const body = message.parseBody<brokerEntityFields>();
                const changed = this.state.unsubscribeEntityFields(body.name, body.fields);
                if (changed) {
                    await this.sendEntityFields(body.name);
                }
                response.reply<brokerEntityFields>(
                    BrokerType.EntityFields,
                    { name: body.name, fields: this.state.getEntityFields(body.name) },
                );
                break;
            }
            case BrokerType.AllEntityFields: {
                const composite = response.composite(BrokerType.AllEntityFields);
                for (const name of this.state.entityFields.keys()) {
                    composite.add<brokerEntityFields>(BrokerType.EntityFields, {
                        name,
                        fields: this.state.getEntityFields(name),
                    });
                }
                composite.send();
                break;
            }
            case BrokerType.Lock: {
                const body = message.parseBody<brokerLock>();
                this.state.lock(body.id, body.ttl, body.timeout).then(lock => {
                    this.locks.set(message.id, lock);
                    response.reply(BrokerType.ResponseLock);
                }, (error) => {
                    response.error(error);
                });
                break;
            }
            case BrokerType.Unlock: {
                const lock = this.locks.get(message.id);
                if (lock) {
                    this.locks.delete(message.id);
                    lock.unlock();
                    response.ack();
                } else {
                    response.error(new Error('Unknown lock for message id ' + message.id));
                }
                break;
            }
            case BrokerType.IsLocked: {
                const body = message.parseBody<brokerLockId>();
                response.reply<brokerResponseIsLock>(BrokerType.ResponseIsLock, { v: this.state.isLocked(body.id) });
                break;
            }
            case BrokerType.TryLock: {
                const body = message.parseBody<brokerLock>();
                this.state.tryLock(body.id, body.ttl).then(lock => {
                    if (lock) {
                        this.locks.set(message.id, lock);
                        response.reply(BrokerType.ResponseLock);
                    } else {
                        response.reply(BrokerType.ResponseLockFailed);
                    }
                });
                break;
            }
            case BrokerType.QueuePublish: {
                const body = message.parseBody<BrokerQueuePublish>();
                this.state.queuePublish(body);
                response.ack();
                break;
            }
            case BrokerType.QueueSubscribe: {
                const body = message.parseBody<BrokerQueueSubscribe>();
                this.state.queueSubscribe(body.c, this, body.maxParallel);
                response.ack();
                break;
            }
            case BrokerType.QueueUnsubscribe: {
                const body = message.parseBody<BrokerQueueSubscribe>();
                this.state.queueUnsubscribe(body.c, this);
                response.ack();
                break;
            }
            case BrokerType.QueueMessageHandled: {
                const body = message.parseBody<BrokerQueueMessageHandled>();
                this.state.queueMessageHandled(body.c, this, body.id, {
                    error: body.error,
                    success: body.success,
                    delay: body.delay,
                });
                response.ack();
                break;
            }
            case BrokerType.Subscribe: {
                const body = message.parseBody<brokerBusSubscribe>();
                this.state.subscribe(body.c, this);
                this.subscribedChannels.push(body.c);
                response.ack();
                break;
            }
            case BrokerType.Unsubscribe: {
                const body = message.parseBody<brokerBusSubscribe>();
                this.state.unsubscribe(body.c, this);
                arrayRemoveItem(this.subscribedChannels, body.c);
                response.ack();
                break;
            }
            case BrokerType.Publish: {
                const body = message.parseBody<brokerBusPublish>();
                this.state.publish(body.c, body.v);
                response.ack();
                break;
            }
            case BrokerType.SetCache: {
                const body = message.parseBody<brokerSetCache>();
                this.state.setCache(body.n, body.v, body.ttl);
                response.ack();
                break;
            }
            case BrokerType.Set: {
                const body = message.parseBody<brokerSet>();
                this.state.setKey(body.n, body.v, body.ttl);
                response.ack();
                break;
            }
            case BrokerType.Increment: {
                const body = message.parseBody<brokerIncrement>();
                const newValue = this.state.increment(body.n, body.v);
                response.reply<brokerResponseIncrement>(BrokerType.ResponseIncrement, { v: newValue });
                break;
            }
            case BrokerType.Delete: {
                const body = message.parseBody<brokerDelete>();
                this.state.deleteKey(body.n);
                response.ack();
                break;
            }
            case BrokerType.InvalidateCache: {
                const body = message.parseBody<brokerDelete>();
                const entry = this.state.getCache(body.n);
                if (entry && this.state.invalidationCacheMessageConnections.length) {
                    this.state.deleteCache(body.n);
                    const message = createRpcMessage<brokerInvalidateCacheMessage>(
                        0, BrokerType.ResponseInvalidationCache,
                        { key: body.n, ttl: entry.ttl },
                        RpcMessageRouteType.server,
                    );

                    for (const connection of this.state.invalidationCacheMessageConnections) {
                        connection.write(message);
                    }
                }
                response.ack();
                break;
            }
            case BrokerType.DeleteCache: {
                const body = message.parseBody<brokerDelete>();
                this.state.deleteCache(body.n);
                response.ack();
                break;
            }
            case BrokerType.GetCache: {
                const body = message.parseBody<brokerGetCache>();
                const v = this.state.getCache(body.n);
                response.reply<brokerResponseGetCache>(BrokerType.ResponseGetCache, v || {});
                break;
            }
            case BrokerType.GetCacheMeta: {
                const body = message.parseBody<brokerGetCache>();
                const v = this.state.getCache(body.n);
                response.reply<brokerResponseGetCacheMeta>(BrokerType.ResponseGetCacheMeta, v ? { ttl: v.ttl } : { missing: true });
                break;
            }
            case BrokerType.Get: {
                const body = message.parseBody<brokerGet>();
                const v = this.state.getKey(body.n);
                response.reply<brokerResponseGet>(BrokerType.ResponseGet, { v });
                break;
            }
            case BrokerType.EnableInvalidationCacheMessages: {
                this.state.invalidationCacheMessageConnections.push(this);
                response.ack();
                break;
            }
        }
    }
}

export class BrokerState {
    /**
     * Simple key/value store.
     */
    public keyStore = new Map<string, Uint8Array>();

    /**
     * Cache store.
     */
    public cacheStore = new Map<string, { data: Uint8Array, ttl: number }>();

    public subscriptions = new Map<string, BrokerConnection[]>();
    public entityFields = new Map<string, Map<string, number>>();

    public queues = new Map<string, Queue>();

    public locker = new ProcessLocker();

    public enableSnapshot = false;
    public snapshotInterval = 15;
    public snapshotPath = './broker-snapshot.bson';
    public snapshotting = false;

    /**
     * All connections in this list are notified about cache invalidations.
     */
    public invalidationCacheMessageConnections: BrokerConnection[] = [];

    protected lastSnapshotTimeout?: any;

    protected snapshot() {
        if (cluster.isMaster) {
            this.snapshotting = true;
            cluster.fork();

            cluster.on('exit', (worker: any) => {
                this.snapshotting = false;
            });
            return;
        }

        //we are in the worker now

        const snapshotTempPath = this.snapshotPath + '.tmp';
        //open file for writing, create if not exists, truncate if exists
        const file = openSync(snapshotTempPath, 'w+');
        snapshotState(this, (v) => writeSync(file, v));
        closeSync(file);

        //rename temp file to final file
        renameSync(snapshotTempPath, this.snapshotPath);
    }

    public getEntityFields(name: string): string[] {
        return Array.from(this.entityFields.get(name)?.keys() || []);
    }

    public publishEntityFields(name: string, fields: string[]): boolean {
        let store = this.entityFields.get(name);
        if (!store) {
            store = new Map();
            this.entityFields.set(name, store);
        }
        let changed = false;
        for (const field of fields) {
            const v = store.get(field);
            if (v === undefined) {
                store.set(field, 1);
                changed = true;
            } else {
                store.set(field, v + 1);
            }
        }
        return changed;
    }

    public unsubscribeEntityFields(name: string, fields: string[]) {
        const store = this.entityFields.get(name);
        if (!store) return;
        let changed = false;
        for (const field of fields) {
            let v = store.get(field);
            if (v === undefined) continue;
            v--;
            if (v === 0) {
                store.delete(field);
                changed = true;
                continue;
            }
            store.set(field, v);
        }
        return changed;
    }

    public lock(id: string, ttl: number, timeout: number = 0): Promise<ProcessLock> {
        return this.locker.acquireLock(id, ttl, timeout);
    }

    public tryLock(id: string, ttl: number = 0): Promise<ProcessLock | undefined> {
        return this.locker.tryLock(id, ttl);
    }

    public isLocked(id: string): boolean {
        return this.locker.isLocked(id);
    }

    public unsubscribe(channel: string, connection: BrokerConnection) {
        const subscriptions = this.subscriptions.get(channel);
        if (!subscriptions) return;
        arrayRemoveItem(subscriptions, connection);
    }

    public subscribe(channel: string, connection: BrokerConnection) {
        let subscriptions = this.subscriptions.get(channel);
        if (!subscriptions) {
            subscriptions = [];
            this.subscriptions.set(channel, subscriptions);
        }
        subscriptions.push(connection);
    }

    public publish(channel: string, v: Uint8Array) {
        const subscriptions = this.subscriptions.get(channel);
        if (!subscriptions) return;
        const message = createRpcMessage<brokerBusResponseHandleMessage>(
            0, BrokerType.ResponseSubscribeMessage,
            { c: channel, v: v }, RpcMessageRouteType.server,
        );

        for (const connection of subscriptions) {
            connection.write(message);
        }
    }

    protected getQueue(queueName: string) {
        let queue = this.queues.get(queueName);
        if (!queue) {
            queue = { currentId: 0, name: queueName, deduplicateMessageHashes: new Set(), messages: [], consumers: [] };
            this.queues.set(queueName, queue);
        }
        return queue;
    }

    public queueSubscribe(queueName: string, connection: BrokerConnection, maxParallel: number) {
        const queue = this.getQueue(queueName);
        queue.consumers.push({ con: connection, handling: new Map(), maxMessagesInParallel: 1 });
    }

    public queueUnsubscribe(queueName: string, connection: BrokerConnection) {
        const queue = this.getQueue(queueName);
        const index = queue.consumers.findIndex(v => v.con === connection);
        if (index === -1) return;
        queue.consumers.splice(index, 1);
    }

    public queuePublish(body: BrokerQueuePublish) {
        const queue = this.getQueue(body.c);

        const m: QueueMessage = {
            id: queue.currentId++,
            process: body.process,
            hash: body.hash,
            state: QueueMessageState.pending,
            tries: 0,
            v: body.v,
            delay: body.delay || 0,
            priority: body.priority,
        };

        if (body.process === QueueMessageProcessing.exactlyOnce) {
            if (!body.deduplicationInterval) {
                throw new Error('Missing message deduplication interval');
            }
            if (!body.hash) {
                throw new Error('Missing message hash');
            }
            if (handleMessageDeduplication(body.hash, queue, body.v, body.deduplicationInterval)) return;
            m.ttl = Date.now() + body.deduplicationInterval;
        }

        if (m.delay > Date.now()) {
            // todo: how to handle delay? many timeouts or one timeout?
            return;
        }

        for (const consumer of queue.consumers) {
            if (consumer.handling.size >= consumer.maxMessagesInParallel) continue;
            consumer.handling.set(m.id, m);
            m.tries++;
            m.state = QueueMessageState.inFlight;
            m.lastError = undefined;
            consumer.con.write(createRpcMessage<BrokerQueueResponseHandleMessage>(
                0, BrokerType.QueueResponseHandleMessage,
                { c: body.c, v: body.v, id: m.id }, RpcMessageRouteType.server,
            ));
        }

        //todo: handle queues messages and sending when new consumer connects
    }

    /**
     * When a queue message has been sent to a consumer and the consumer answers.
     */
    public queueMessageHandled(queueName: string, connection: BrokerConnection, id: number, answer: {
        error?: string,
        success: boolean,
        delay?: number
    }) {
        const queue = this.queues.get(queueName);
        if (!queue) return;
        const consumer = queue.consumers.find(v => v.con === connection);
        if (!consumer) return;
        const message = consumer.handling.get(id);
        if (!message) return;
        consumer.handling.delete(id);

        if (answer.error) {
            message.state = QueueMessageState.error;
        } else if (answer.success) {
            message.state = QueueMessageState.done;
        } else if (answer.delay) {
            message.delay = Date.now() + answer.delay;
        }

        //todo: handle delays and retries
    }

    public setCache(id: string, data: Uint8Array, ttl: number) {
        this.cacheStore.set(id, { data, ttl });
    }

    public getCache(id: string): { data: Uint8Array, ttl: number } | undefined {
        return this.cacheStore.get(id);
    }

    public deleteCache(id: string) {
        this.cacheStore.delete(id);
    }

    public increment(id: string, v?: number): number {
        const buffer = this.keyStore.get(id);
        const float64 = buffer ? new Float64Array(buffer.buffer, buffer.byteOffset) : new Float64Array(1);
        float64[0] += v || 0;
        if (!buffer) this.keyStore.set(id, new Uint8Array(float64.buffer));
        return float64[0];
    }

    public setKey(id: string, data: Uint8Array, ttl: number) {
        this.keyStore.set(id, data);
        if (ttl > 0) {
            setTimeout(() => {
                this.keyStore.delete(id);
            }, ttl);
        }
    }

    public getKey(id: string): Uint8Array | undefined {
        return this.keyStore.get(id);
    }

    public deleteKey(id: string) {
        this.keyStore.delete(id);
    }
}

export class BrokerKernel extends RpcKernel {
    protected state: BrokerState = new BrokerState;

    createConnection(transport: TransportConnection): BrokerConnection {
        return new BrokerConnection(this.logger, transport, this.connections, this.state);
    }
}
