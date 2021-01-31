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
import { createRpcMessage, RpcKernelBaseConnection, RpcConnectionWriter, RpcMessage, RpcMessageRouteType, RpcMessageBuilder, RpcKernelConnections, RpcKernel } from '@deepkit/rpc';
import { brokerDelete, brokerEntityFields, brokerGet, brokerIncrement, brokerLock, brokerLockId, brokerPublish, brokerResponseGet, brokerResponseIncrement, brokerResponseIsLock, brokerResponseSubscribeMessage, brokerSet, brokerSubscribe, BrokerType } from './model';

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
            promises.push(connection.sendMessage(BrokerType.EntityFields, brokerEntityFields, { name, fields }).ackThenClose());
        }

        await Promise.all(promises);
    }

    async onMessage(message: RpcMessage, response: RpcMessageBuilder): Promise<void> {
        switch (message.type) {
            case BrokerType.PublishEntityFields: {
                const body = message.parseBody(brokerEntityFields);
                const changed = this.state.publishEntityFields(body.name, body.fields);
                if (changed) {
                    await this.sendEntityFields(body.name);
                }
                response.reply(
                    BrokerType.EntityFields, brokerEntityFields,
                    { name: body.name, fields: this.state.getEntityFields(body.name) }
                );
                break;
            }
            case BrokerType.UnsubscribeEntityFields: {
                const body = message.parseBody(brokerEntityFields);
                const changed = this.state.unsubscribeEntityFields(body.name, body.fields);
                if (changed) {
                    await this.sendEntityFields(body.name);
                }
                response.reply(
                    BrokerType.EntityFields, brokerEntityFields,
                    { name: body.name, fields: this.state.getEntityFields(body.name) }
                );
                break;
            }
            case BrokerType.AllEntityFields: {
                const composite = response.composite(BrokerType.AllEntityFields);
                for (const name of this.state.entityFields.keys()) {
                    composite.add(BrokerType.EntityFields, brokerEntityFields, { name, fields: this.state.getEntityFields(name) });
                }
                composite.send();
                break;
            }
            case BrokerType.Lock: {
                const body = message.parseBody(brokerLock);
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
                const body = message.parseBody(brokerLockId);
                response.reply(BrokerType.ResponseIsLock, brokerResponseIsLock, { v: this.state.isLocked(body.id) });
                break;
            }
            case BrokerType.TryLock: {
                const body = message.parseBody(brokerLock);
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
            case BrokerType.Subscribe: {
                const body = message.parseBody(brokerSubscribe);
                this.state.subscribe(body.c, this);
                this.subscribedChannels.push(body.c);
                response.ack();
                break;
            }
            case BrokerType.Unsubscribe: {
                const body = message.parseBody(brokerSubscribe);
                this.state.unsubscribe(body.c, this);
                arrayRemoveItem(this.subscribedChannels, body.c);
                response.ack();
                break;
            }
            case BrokerType.Publish: {
                const body = message.parseBody(brokerPublish);
                this.state.publish(body.c, body.v);
                response.ack();
                break;
            }
            case BrokerType.Set: {
                const body = message.parseBody(brokerSet);
                this.state.set(body.n, body.v);
                response.ack();
                break;
            }
            case BrokerType.Increment: {
                const body = message.parseBody(brokerIncrement);
                const newValue = this.state.increment(body.n, body.v);
                response.reply(BrokerType.ResponseIncrement, brokerResponseIncrement, { v: newValue });
                break;
            }
            case BrokerType.Delete: {
                const body = message.parseBody(brokerDelete);
                this.state.delete(body.n);
                response.ack();
                break;
            }
            case BrokerType.Get: {
                const body = message.parseBody(brokerGet);
                response.reply(BrokerType.ResponseGet, this.state.get(body.n));
                break;
            }
        }
    }
}

export class BrokerState {
    public setStore = new Map<string, Uint8Array>();
    public subscriptions = new Map<string, BrokerConnection[]>();
    public entityFields = new Map<string, Map<string, number>>();

    public locker = new ProcessLocker();

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
        const message = createRpcMessage(
            0, BrokerType.ResponseSubscribeMessage,
            brokerResponseSubscribeMessage, { c: channel, v: v }, RpcMessageRouteType.server
        );

        for (const connection of subscriptions) {
            connection.writer.write(message);
        }
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
    protected connections = new RpcKernelConnections();

    createConnection(writer: RpcConnectionWriter): BrokerConnection {
        return new BrokerConnection(writer, this.connections, this.state);
    }
}
