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
import { createRpcMessage, RpcConnectionWriter, RpcKernel, RpcKernelBaseConnection, RpcKernelConnections, RpcMessage, RpcMessageBuilder, RpcMessageRouteType } from '@deepkit/rpc';
import {
    brokerBusPublish,
    brokerBusResponseHandleMessage,
    brokerBusSubscribe,
    brokerDelete,
    brokerEntityFields,
    brokerGet,
    brokerIncrement,
    brokerLock,
    brokerLockId,
    BrokerQueueMessageHandled,
    BrokerQueuePublish,
    BrokerQueueResponseHandleMessage,
    BrokerQueueSubscribe,
    brokerResponseIncrement,
    brokerResponseIsLock,
    brokerSet,
    BrokerType,
    QueueMessage,
    QueueMessageState
} from './model.js';
import cluster from 'cluster';
import { closeSync, openSync, renameSync, writeSync } from 'fs';
import { snapshotState } from './snaptshot.js';

export interface Queue {
    currentId: number;
    name: string;
    messages: QueueMessage[];
    consumers: { con: BrokerConnection, handling: QueueMessage[], maxMessagesInParallel: number }[];
}

export class BrokerConnection extends RpcKernelBaseConnection {
    protected subscribedChannels: string[] = [];
    protected locks = new Map<number, ProcessLock>();
    protected replies = new Map<number, ((message: RpcMessage) => void)>();

    constructor(
        transportWriter: RpcConnectionWriter,
        protected connections: RpcKernelConnections,
        protected state: BrokerState,
    ) {
        super(transportWriter, connections);
    }

    public close(): void {
        super.close();

        for (const c of this.subscribedChannels) {
            this.state.unsubscribe(c, this);
        }
        for (const lock of this.locks.values()) {
            lock.unlock();
        }
    }

    protected async sendEntityFields(name: string) {
        const fields = this.state.getEntityFields(name);
        const promises: Promise<void>[] = [];

        for (const connection of this.connections.connections) {
            if (connection === this) continue;
            promises.push(connection.sendMessage<brokerEntityFields>(BrokerType.EntityFields, { name, fields }).ackThenClose());
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
                    { name: body.name, fields: this.state.getEntityFields(body.name) }
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
                    { name: body.name, fields: this.state.getEntityFields(body.name) }
                );
                break;
            }
            case BrokerType.AllEntityFields: {
                const composite = response.composite(BrokerType.AllEntityFields);
                for (const name of this.state.entityFields.keys()) {
                    composite.add<brokerEntityFields>(BrokerType.EntityFields, { name, fields: this.state.getEntityFields(name) });
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
                this.state.queuePublish(body.c, body.v, body.delay, body.priority);
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
                this.state.queueMessageHandled(body.c, this, body.id, { error: body.error, success: body.success, delay: body.delay });
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
            case BrokerType.Set: {
                const body = message.parseBody<brokerSet>();
                this.state.set(body.n, body.v);
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
                this.state.delete(body.n);
                response.ack();
                break;
            }
            case BrokerType.Get: {
                const body = message.parseBody<brokerGet>();
                const v = this.state.get(body.n);
                response.replyBinary(BrokerType.ResponseGet, v);
                break;
            }
        }
    }
}

export class BrokerState {
    public setStore = new Map<string, Uint8Array>();
    public subscriptions = new Map<string, BrokerConnection[]>();
    public entityFields = new Map<string, Map<string, number>>();

    public queues = new Map<string, Queue>();

    public locker = new ProcessLocker();

    public enableSnapshot = false;
    public snapshotInterval = 15;
    public snapshotPath = './broker-snapshot.bson';
    public snapshotting = false;

    protected lastSnapshotTimeout?: any;

    protected snapshot() {
        if (cluster.isMaster) {
            this.snapshotting = true;
            cluster.fork();

            cluster.on('exit', (worker) => {
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
        let store = this.entityFields.get(name);
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
            { c: channel, v: v }, RpcMessageRouteType.server
        );

        for (const connection of subscriptions) {
            connection.writer.write(message);
        }
    }

    protected getQueue(queueName: string) {
        let queue = this.queues.get(queueName);
        if (!queue) {
            queue = { currentId: 0, name: queueName, messages: [], consumers: [] };
            this.queues.set(queueName, queue);
        }
        return queue;
    }

    public queueSubscribe(queueName: string, connection: BrokerConnection, maxParallel: number) {
        const queue = this.getQueue(queueName);
        queue.consumers.push({ con: connection, handling: [], maxMessagesInParallel: 1 });
    }

    public queueUnsubscribe(queueName: string, connection: BrokerConnection) {
        const queue = this.getQueue(queueName);
        const index = queue.consumers.findIndex(v => v.con === connection);
        if (index === -1) return;
        queue.consumers.splice(index, 1);
    }

    public queuePublish(queueName: string, v: Uint8Array, delay?: number, priority?: number) {
        const queue = this.getQueue(queueName);

        const m: QueueMessage = { id: queue.currentId++, state: QueueMessageState.pending, tries: 0, v, delay: delay || 0, priority };
        queue.messages.push(m);

        if (m.delay > Date.now()) {
            // todo: how to handle delay? many timeouts or one timeout?
            return;
        }

        for (const consumer of queue.consumers) {
            if (consumer.handling.length >= consumer.maxMessagesInParallel) continue;
            consumer.handling.push(m);
            m.tries++;
            m.state = QueueMessageState.inFlight;
            m.lastError = undefined;
            consumer.con.writer.write(createRpcMessage<BrokerQueueResponseHandleMessage>(
                0, BrokerType.QueueResponseHandleMessage,
                { c: queueName, v, id: m.id }, RpcMessageRouteType.server
            ));
        }

        //todo: handle queues messages and sending when new consumer connects
    }

    /**
     * When a queue message has been sent to a consumer and the consumer answers.
     */
    public queueMessageHandled(queueName: string, connection: BrokerConnection, id: number, answer: { error?: string, success: boolean, delay?: number }) {
        const queue = this.queues.get(queueName);
        if (!queue) return;
        const consumer = queue.consumers.find(v => v.con === connection);
        if (!consumer) return;
        const messageIdx = consumer.handling.findIndex(v => v.id === id);
        if (messageIdx === -1) return;
        const message = consumer.handling[messageIdx];
        consumer.handling.splice(messageIdx, 1);

        if (answer.error) {
            message.state = QueueMessageState.error;
        } else if (answer.success) {
            message.state = QueueMessageState.done;
        } else if (answer.delay) {
            message.delay = Date.now() + answer.delay;
        }

        //todo: handle delays and retries
    }

    public set(id: string, data: Uint8Array) {
        this.setStore.set(id, data);
    }

    public increment(id: string, v?: number): number {
        const buffer = this.setStore.get(id);
        const float64 = buffer ? new Float64Array(buffer.buffer, buffer.byteOffset) : new Float64Array(1);
        float64[0] += v || 1;
        if (!buffer) this.setStore.set(id, new Uint8Array(float64.buffer));
        return float64[0];
    }

    public get(id: string): Uint8Array | undefined {
        return this.setStore.get(id);
    }

    public delete(id: string) {
        this.setStore.delete(id);
    }
}

export class BrokerKernel extends RpcKernel {
    protected state: BrokerState = new BrokerState;

    createConnection(writer: RpcConnectionWriter): BrokerConnection {
        return new BrokerConnection(writer, this.connections, this.state);
    }
}
