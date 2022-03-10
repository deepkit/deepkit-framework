/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BSONDeserializer, BSONSerializer, deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer } from '@deepkit/bson';
import { arrayRemoveItem, asyncOperation, ClassType } from '@deepkit/core';
import { AsyncSubscription } from '@deepkit/core-rxjs';
import { createRpcMessage, RpcBaseClient, RpcDirectClientAdapter, RpcMessage, RpcMessageRouteType } from '@deepkit/rpc';
import { BrokerKernel } from './kernel';
import {
    brokerDelete,
    brokerEntityFields,
    brokerGet,
    brokerIncrement,
    brokerLock,
    brokerLockId,
    brokerPublish,
    brokerResponseIncrement,
    brokerResponseIsLock,
    brokerResponseSubscribeMessage,
    brokerSet,
    brokerSubscribe,
    BrokerType
} from './model';
import { ReceiveType, ReflectionClass, ReflectionKind, resolveReceiveType, Type, TypePropertySignature } from '@deepkit/type';

export class BrokerChannel<T> {
    protected listener: number = 0;
    protected callbacks: ((next: Uint8Array) => void)[] = [];
    protected wrapped: boolean = false;

    protected decoder: (bson: Uint8Array) => any;

    constructor(
        public channel: string,
        protected type: Type,
        protected client: BrokerClient,
    ) {
        const standaloneType = type.kind === ReflectionKind.objectLiteral || (type.kind === ReflectionKind.class && type.types.length);
        if (!standaloneType) {
            this.type = {
                kind: ReflectionKind.objectLiteral,
                types: [{
                    kind: ReflectionKind.propertySignature,
                    name: 'v',
                    type: type,
                } as TypePropertySignature]
            };
            this.wrapped = true;
        }
        this.decoder = getBSONDeserializer(undefined, this.type);
    }

    public async publish(data: T) {
        const serializer = getBSONSerializer(undefined, this.type);

        const v = this.wrapped ? serializer({ v: data }) : serializer(data);
        await this.client.sendMessage<brokerPublish>(BrokerType.Publish, { c: this.channel, v: v })
            .ackThenClose();

        return undefined;
    }

    next(data: Uint8Array) {
        for (const callback of this.callbacks) {
            callback(data);
        }
    }

    async subscribe(callback: (next: T) => void): Promise<AsyncSubscription> {
        const parsedCallback = (next: Uint8Array) => {
            try {
                const parsed = this.decoder(next);
                callback(this.wrapped ? parsed.v : parsed);
            } catch (error: any) {
                console.log('message', Buffer.from(next).toString('utf8'), deserializeBSONWithoutOptimiser(next));
                console.error(`Could not parse channel message ${this.channel}: ${error}`);
            }
        };

        this.listener++;
        this.callbacks.push(parsedCallback);

        if (this.listener === 1) {
            await this.client.sendMessage<brokerSubscribe>(BrokerType.Subscribe, { c: this.channel })
                .ackThenClose();
        }

        return new AsyncSubscription(async () => {
            this.listener--;
            arrayRemoveItem(this.callbacks, parsedCallback);
            if (this.listener === 0) {
                await this.client.sendMessage<brokerSubscribe>(BrokerType.Unsubscribe, { c: this.channel })
                    .ackThenClose();
            }
        });
    }
}

export class BrokerKeyValue<T> {
    protected serializer: BSONSerializer;
    protected decoder: BSONDeserializer<T>;

    constructor(
        protected key: string,
        protected type: Type,
        protected client: BrokerClient,
    ) {
        this.serializer = getBSONSerializer(undefined, type);
        this.decoder = getBSONDeserializer(undefined, type);
    }

    public async set(data: T): Promise<undefined> {
        await this.client.sendMessage<brokerSet>(BrokerType.Set, { n: this.key, v: this.serializer(data) }).ackThenClose();
        return undefined;
    }

    public async get(): Promise<T> {
        const v = await this.getOrUndefined();
        if (v !== undefined) return v;
        throw new Error(`No value for key ${this.key} found`);
    }

    public async delete(): Promise<boolean> {
        await this.client.sendMessage<brokerDelete>(BrokerType.Delete, { n: this.key }).ackThenClose();
        return true;
    }

    public async getOrUndefined(): Promise<T | undefined> {
        const first: RpcMessage = await this.client.sendMessage<brokerGet>(BrokerType.Get, { n: this.key }).firstThenClose(BrokerType.ResponseGet);
        if (first.buffer && first.buffer.byteLength > first.bodyOffset) {
            return this.decoder(first.buffer, first.bodyOffset);
        }
        return undefined;
    }
}

export class BrokerClient extends RpcBaseClient {
    protected activeChannels = new Map<string, BrokerChannel<any>>();
    protected knownEntityFields = new Map<string, string[]>();
    protected publishedEntityFields = new Map<string, Map<string, number>>();

    /**
     * On first getEntityFields() call we check if entityFieldsReceived is true. If not
     * we connect and load all available entity-fields from the server and start
     * streaming all changes to the entity-fields directly to our entityFields map.
     */
    protected entityFieldsReceived = false;
    protected entityFieldsPromise?: Promise<void>;

    public async getEntityFields(classSchema: ClassType | string): Promise<string[]> {
        const entityName = 'string' === typeof classSchema ? classSchema : ReflectionClass.from(classSchema).getName();

        if (!this.entityFieldsReceived) {
            this.entityFieldsReceived = true;
            this.entityFieldsPromise = asyncOperation(async (resolve) => {
                const subject = this.sendMessage(BrokerType.AllEntityFields);
                const answer = await subject.waitNextMessage();
                subject.release();

                if (answer.type === BrokerType.AllEntityFields) {
                    for (const body of answer.getBodies()) {
                        const fields = body.parseBody<brokerEntityFields>();
                        this.knownEntityFields.set(fields.name, fields.fields);
                    }
                }
                this.entityFieldsPromise = undefined;
                resolve();
            });
        }
        if (this.entityFieldsPromise) {
            await this.entityFieldsPromise;
        }

        return this.knownEntityFields.get(entityName) || [];
    }

    protected onMessage(message: RpcMessage) {
        if (message.routeType === RpcMessageRouteType.server) {
            if (message.type === BrokerType.EntityFields) {
                const fields = message.parseBody<brokerEntityFields>();
                this.knownEntityFields.set(fields.name, fields.fields);
                this.transporter.send(createRpcMessage(message.id, BrokerType.Ack, undefined, RpcMessageRouteType.server));
            } else if (message.type === BrokerType.ResponseSubscribeMessage) {
                const body = message.parseBody<brokerResponseSubscribeMessage>();
                const channel = this.activeChannels.get(body.c);
                if (!channel) return;
                channel.next(body.v);
            }
        } else {
            super.onMessage(message);
        }
    }

    public async publishEntityFields<T>(classSchema: ClassType | string, fields: string[]): Promise<AsyncSubscription> {
        const entityName = 'string' === typeof classSchema ? classSchema : ReflectionClass.from(classSchema).getName();
        let store = this.publishedEntityFields.get(entityName);
        if (!store) {
            store = new Map;
            this.publishedEntityFields.set(entityName, store);
        }

        let changed = false;
        const newFields: string[] = [];

        for (const field of fields) {
            const v = store.get(field);
            if (v === undefined) {
                changed = true;
                newFields.push(field);
            }
            ;
            store.set(field, v === undefined ? 1 : v + 1);
        }

        if (changed) {
            const response = await this.sendMessage<brokerEntityFields>(
                BrokerType.PublishEntityFields,
                { name: entityName, fields: newFields }
            ).firstThenClose<brokerEntityFields>(BrokerType.EntityFields);
            this.knownEntityFields.set(response.name, response.fields);
        }

        return new AsyncSubscription(async () => {
            if (!store) return;
            const unsubscribed: string[] = [];

            for (const field of fields) {
                let v = store.get(field);
                if (v === undefined) throw new Error(`Someone deleted our field ${field}`);
                v--;
                if (v === 0) {
                    store.delete(field);
                    unsubscribed.push(field);
                    //we can't remove it from knownEntityFields, because we don't know whether another
                    //its still used by another client.
                } else {
                    store.set(field, v);
                }
            }
            if (unsubscribed.length) {
                const response = await this.sendMessage<brokerEntityFields>(
                    BrokerType.UnsubscribeEntityFields,
                    { name: entityName, fields: unsubscribed }
                ).firstThenClose<brokerEntityFields>(BrokerType.EntityFields);

                this.knownEntityFields.set(response.name, response.fields);
            }
        });
    }

    /**
     * Tries to lock an id on the broker. If the id is already locked, it returns immediately undefined without locking anything
     *
     * ttl (time to life) defines how long the given lock is allowed to stay active. Per default each lock is automatically unlocked
     * after 30 seconds. If you haven't released the lock until then, another lock acquisition is allowed to receive it anyways.
     * ttl of 0 disables ttl and keeps the lock alive until you manually unlock it (or the process dies).
     */
    public async tryLock(id: string, ttl: number = 30): Promise<AsyncSubscription | undefined> {
        const subject = this.sendMessage<brokerLock>(BrokerType.TryLock, { id, ttl });
        const message = await subject.waitNextMessage();
        if (message.type === BrokerType.ResponseLockFailed) {
            subject.release();
            return undefined;
        }

        if (message.type === BrokerType.ResponseLock) {
            return new AsyncSubscription(async () => {
                await subject.send(BrokerType.Unlock).ackThenClose();
            });
        }

        throw new Error(`Invalid message returned. Expected Lock, but got ${message.type}`);
    }

    /**
     * Locks an id on the broker. If the id is already locked, it waits until it is released. If timeout is specified,
     * the lock acquisition should take maximum `timeout` seconds. 0 means it waits without limit.
     *
     * ttl (time to life) defines how long the given lock is allowed to stay active. Per default each lock is automatically unlocked
     * after 30 seconds. If you haven't released the lock until then, another lock acquisition is allowed to receive it anyways.
     * ttl of 0 disables ttl and keeps the lock alive until you manually unlock it (or the process dies).
     */
    public async lock(id: string, ttl: number = 30, timeout: number = 0): Promise<AsyncSubscription> {
        const subject = this.sendMessage<brokerLock>(BrokerType.Lock, { id, ttl, timeout });
        await subject.waitNext(BrokerType.ResponseLock); //or throw error

        return new AsyncSubscription(async () => {
            await subject.send(BrokerType.Unlock).ackThenClose();
            subject.release();
        });
    }

    public async isLocked(id: string): Promise<boolean> {
        const subject = this.sendMessage<brokerLockId>(BrokerType.IsLocked, { id });
        const lock = await subject.firstThenClose<brokerResponseIsLock>(BrokerType.ResponseIsLock);
        return lock.v;
    }

    public channel<T>(channel: string, type?: ReceiveType<T>): BrokerChannel<T> {
        let brokerChannel = this.activeChannels.get(channel);
        if (!brokerChannel) {
            brokerChannel = new BrokerChannel(channel, resolveReceiveType(type), this);
            this.activeChannels.set(channel, brokerChannel);
        }

        return brokerChannel;
    }

    public async getRawOrUndefined<T>(id: string): Promise<Uint8Array | undefined> {
        const first: RpcMessage = await this.sendMessage<brokerGet>(BrokerType.Get, { n: id }).firstThenClose(BrokerType.ResponseGet);
        if (first.buffer && first.buffer.byteLength > first.bodyOffset) {
            return first.buffer.slice(first.bodyOffset);
        }

        return undefined;
    }

    public async getRaw<T>(id: string): Promise<Uint8Array> {
        const v = await this.getRawOrUndefined(id);
        if (v === undefined) throw new Error(`Key ${id} is undefined`);
        return v;
    }

    public async setRaw<T>(id: string, data: Uint8Array): Promise<undefined> {
        await this.sendMessage<brokerSet>(BrokerType.Set, { n: id, v: data })
            .ackThenClose();

        return undefined;
    }

    public key<T>(key: string, type?: ReceiveType<T>) {
        return new BrokerKeyValue(key, resolveReceiveType(type), this);
    }

    public async getIncrement<T>(id: string): Promise<number> {
        const v = await this.getRaw(id);
        const view = new DataView(v.buffer, v.byteOffset, v.byteLength);
        return view.getFloat64(0, true);
    }

    public async increment<T>(id: string, value?: number): Promise<number> {
        const response = await this.sendMessage<brokerIncrement>(BrokerType.Increment, { n: id, v: value })
            .waitNext<brokerResponseIncrement>(BrokerType.ResponseIncrement);

        return response.v;
    }

    public async delete<T>(id: string): Promise<undefined> {
        await this.sendMessage<brokerDelete>(BrokerType.Delete, { n: id })
            .ackThenClose();

        return undefined;
    }
}


export class BrokerDirectClient extends BrokerClient {
    constructor(rpcKernel: BrokerKernel) {
        super(new RpcDirectClientAdapter(rpcKernel));
    }
}
