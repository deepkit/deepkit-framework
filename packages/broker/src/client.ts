/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BSONDecoder, BSONSerializer, getBSONDecoder, getBSONSerializer } from '@deepkit/bson';
import { arrayRemoveItem, asyncOperation, ClassType } from '@deepkit/core';
import { AsyncSubscription } from '@deepkit/core-rxjs';
import { createRpcMessage, RpcBaseClient, RpcDirectClientAdapter, RpcMessage, RpcMessageRouteType } from '@deepkit/rpc';
import { ClassSchema, FieldDecoratorResult, getClassSchema, isFieldDecorator, PropertySchema, t } from '@deepkit/type';
import { BrokerKernel } from './kernel';
import { brokerDelete, brokerEntityFields, brokerGet, brokerIncrement, brokerLock, brokerLockId, brokerPublish, brokerResponseIncrement, brokerResponseIsLock, brokerResponseSubscribeMessage, brokerSet, brokerSubscribe, BrokerType } from './model';

export class BrokerChannel<T> {
    protected listener: number = 0;
    protected callbacks: ((next: Uint8Array) => void)[] = [];
    protected wrapped: boolean = false;
    protected schema: ClassSchema;

    protected decoder: (bson: Uint8Array) => any;

    constructor(
        public channel: string,
        protected decoratorOrSchema: FieldDecoratorResult<T> | ClassSchema<T> | ClassType<T>,
        protected client: BrokerClient,
    ) {
        const extracted = this.getPubSubMessageSchema(decoratorOrSchema);
        this.wrapped = extracted.wrapped;
        this.schema = extracted.schema;
        this.decoder = getBSONDecoder(this.schema);
    }

    protected getPubSubMessageSchema<T>(decoratorOrSchema: FieldDecoratorResult<T> | ClassSchema<T> | ClassType<T>): { schema: ClassSchema, wrapped: boolean } {
        if (isFieldDecorator(decoratorOrSchema)) {
            const propertySchema: PropertySchema = (decoratorOrSchema as any)._lastPropertySchema ||= decoratorOrSchema.buildPropertySchema('v');
            const schema = propertySchema.type === 'class' ? propertySchema.getResolvedClassSchema() : t.schema({ v: decoratorOrSchema });
            const wrapped = propertySchema.type !== 'class';

            return { schema, wrapped }
        }
        return { schema: getClassSchema(decoratorOrSchema), wrapped: false };
    }

    public async publish(data: T) {
        const serializer = getBSONSerializer(this.schema);

        const v = this.wrapped ? serializer({ v: data }) : serializer(data);
        await this.client.sendMessage(BrokerType.Publish, brokerPublish, { c: this.channel, v: v })
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
            const parsed = this.decoder(next);
            callback(this.wrapped ? parsed.v : parsed);
        };

        this.listener++;
        this.callbacks.push(parsedCallback);

        if (this.listener === 1) {
            await this.client.sendMessage(BrokerType.Subscribe, brokerSubscribe, { c: this.channel })
                .ackThenClose();
        }

        return new AsyncSubscription(async () => {
            this.listener--;
            arrayRemoveItem(this.callbacks, parsedCallback);
            if (this.listener === 0) {
                await this.client.sendMessage(BrokerType.Unsubscribe, brokerSubscribe, { c: this.channel })
                    .ackThenClose();
            }
        });
    }
}

export class BrokerKeyValue<T> {
    protected serializer: BSONSerializer;
    protected decoder: BSONDecoder<T>;

    constructor(
        protected key: string,
        protected schema: ClassSchema<T>,
        protected client: BrokerClient,
    ) {
        this.serializer = getBSONSerializer(schema);
        this.decoder = getBSONDecoder(schema);
    }

    public async set(data: T): Promise<undefined> {
        await this.client.sendMessage(BrokerType.Set, brokerSet, { n: this.key, v: this.serializer(data) }).ackThenClose();
        return undefined;
    }

    public async get(): Promise<T> {
        const v = await this.getOrUndefined();
        if (v !== undefined) return v;
        throw new Error(`No value for key ${this.key} found`);
    }

    public async delete(): Promise<boolean> {
        await this.client.sendMessage(BrokerType.Delete, brokerGet, { n: this.key }).ackThenClose();
        return true;
    }

    public async getOrUndefined(): Promise<T | undefined> {
        const first: RpcMessage = await this.client.sendMessage(BrokerType.Get, brokerGet, { n: this.key }).firstThenClose(BrokerType.ResponseGet);
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

    public async getEntityFields(classSchema: ClassSchema | string): Promise<string[]> {
        const entityName = 'string' === typeof classSchema ? classSchema : classSchema.getName();

        if (!this.entityFieldsReceived) {
            this.entityFieldsReceived = true;
            this.entityFieldsPromise = asyncOperation(async (resolve) => {
                const subject = this.sendMessage(BrokerType.AllEntityFields)
                const answer = await subject.waitNextMessage();
                subject.release();

                if (answer.type === BrokerType.AllEntityFields) {
                    for (const body of answer.getBodies()) {
                        const fields = body.parseBody(brokerEntityFields);
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
                const fields = message.parseBody(brokerEntityFields);
                this.knownEntityFields.set(fields.name, fields.fields);
                this.transporter.send(createRpcMessage(message.id, BrokerType.Ack, undefined, undefined, RpcMessageRouteType.server));
            } else if (message.type === BrokerType.ResponseSubscribeMessage) {
                const body = message.parseBody(brokerResponseSubscribeMessage);
                const channel = this.activeChannels.get(body.c);
                if (!channel) return;
                channel.next(body.v);
            }
        } else {
            super.onMessage(message);
        }
    }

    public async publishEntityFields<T>(classSchema: ClassSchema | string, fields: string[]): Promise<AsyncSubscription> {
        const entityName = 'string' === typeof classSchema ? classSchema : classSchema.getName();
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
            };
            store.set(field, v === undefined ? 1 : v + 1);
        }

        if (changed) {
            const response = await this.sendMessage(
                BrokerType.PublishEntityFields, brokerEntityFields,
                { name: entityName, fields: newFields }
            ).firstThenClose(BrokerType.EntityFields, brokerEntityFields);
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
                const response = await this.sendMessage(
                    BrokerType.UnsubscribeEntityFields, brokerEntityFields,
                    { name: entityName, fields: unsubscribed }
                ).firstThenClose(BrokerType.EntityFields, brokerEntityFields);

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
        const subject = this.sendMessage(BrokerType.TryLock, brokerLock, { id, ttl });
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
        const subject = this.sendMessage(BrokerType.Lock, brokerLock, { id, ttl, timeout });
        await subject.waitNext(BrokerType.ResponseLock); //or throw error

        return new AsyncSubscription(async () => {
            await subject.send(BrokerType.Unlock).ackThenClose();
            subject.release();
        });
    }

    public async isLocked(id: string): Promise<boolean> {
        const subject = this.sendMessage(BrokerType.IsLocked, brokerLockId, { id });
        const lock = await subject.firstThenClose(BrokerType.ResponseIsLock, brokerResponseIsLock);
        return lock.v;
    }

    public channel<T>(channel: string, decoratorOrSchema: FieldDecoratorResult<T> | ClassSchema<T> | ClassType<T>): BrokerChannel<T> {
        let brokerChannel = this.activeChannels.get(channel);
        if (!brokerChannel) {
            brokerChannel = new BrokerChannel(channel, decoratorOrSchema, this);
            this.activeChannels.set(channel, brokerChannel);
        }

        return brokerChannel;
    }

    public async getRawOrUndefined<T>(id: string): Promise<Uint8Array | undefined> {
        const first: RpcMessage = await this.sendMessage(BrokerType.Get, brokerGet, { n: id }).firstThenClose(BrokerType.ResponseGet);
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
        await this.sendMessage(BrokerType.Set, brokerSet, { n: id, v: data })
            .ackThenClose();

        return undefined;
    }

    public key<T>(key: string, schema: ClassSchema<T> | ClassType<T>) {
        return new BrokerKeyValue(key, getClassSchema(schema), this);
    }

    public async getIncrement<T>(id: string): Promise<number> {
        const v = await this.getRaw(id);
        const view = new DataView(v.buffer, v.byteOffset, v.byteLength);
        return view.getFloat64(0, true);
    }

    public async increment<T>(id: string, value?: number): Promise<number> {
        const response = await this.sendMessage(BrokerType.Increment, brokerIncrement, { n: id, v: value })
            .waitNext(BrokerType.ResponseIncrement, brokerResponseIncrement);

        return response.v;
    }

    public async delete<T>(id: string): Promise<undefined> {
        await this.sendMessage(BrokerType.Delete, brokerDelete, { n: id })
            .ackThenClose();

        return undefined;
    }
}


export class BrokerDirectClient extends BrokerClient {
    constructor(rpcKernel: BrokerKernel) {
        super(new RpcDirectClientAdapter(rpcKernel));
    }
}
