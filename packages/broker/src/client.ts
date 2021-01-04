import { getBSONDecoder, getBSONSerializer } from "@deepkit/bson";
import { arrayRemoveItem, asyncOperation, ClassType } from "@deepkit/core";
import { AsyncSubscription } from "@deepkit/core-rxjs";
import { ClientTransportAdapter, createRpcMessage, RpcBaseClient, RpcMessage, RpcMessageRouteType, TransportConnectionHooks } from "@deepkit/rpc";
import { ClassSchema } from "@deepkit/type";
import { BrokerKernel } from "./kernel";
import { brokerDelete, brokerEntityFields, brokerGet, brokerIncrement, brokerLock, brokerPublish, brokerResponseGet, brokerResponseIsLock, brokerResponseSubscribeMessage, brokerSet, brokerSubscribe, BrokerType } from "./model";

export class BrokerClient extends RpcBaseClient {
    protected channelSubscriptions = new Map<string, { listener: number, callbacks: ((next: Uint8Array) => void)[] }>();
    protected entityFields = new Map<string, string[]>();
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
                        this.entityFields.set(fields.name, fields.fields);
                    }
                }
                this.entityFieldsPromise = undefined;
                resolve();
            });
        }
        if (this.entityFieldsPromise) {
            await this.entityFieldsPromise;
        }

        return this.entityFields.get(entityName) || [];
    }

    protected onMessage(message: RpcMessage) {
        if (message.routeType === RpcMessageRouteType.server) {
            if (message.type === BrokerType.EntityFields) {
                const fields = message.parseBody(brokerEntityFields);
                this.entityFields.set(fields.name, fields.fields);
                this.transporter.send(createRpcMessage(message.id, BrokerType.Ack, undefined, undefined, RpcMessageRouteType.server));
            } else if (message.type === BrokerType.ResponseSubscribeMessage) {
                const body = message.parseBody(brokerResponseSubscribeMessage);
                const subs = this.channelSubscriptions.get(body.c);
                if (!subs) return;
                for (const callback of subs.callbacks) {
                    callback(body.v);
                }
            }
        } else {
            super.onMessage(message);
        }
    }

    public async publish<T>(channel: string, schema: ClassSchema<T> | ClassType<T>, data: T) {
        await this.sendMessage(BrokerType.Publish, brokerPublish, { c: channel, v: getBSONSerializer(schema)(data) })
            .ackThenClose();

        return undefined;
    }

    public async publishEntityFields<T>(classSchema: ClassSchema | string, fields: string[]): Promise<AsyncSubscription> {
        const entityName = 'string' === typeof classSchema ? classSchema : classSchema.getName();
        let store = this.publishedEntityFields.get(entityName);
        if (!store) {
            store = new Map;
            this.publishedEntityFields.set(entityName, store);
        }

        let changed = false;

        for (const field of fields) {
            const v = store.get(field);
            if (v === undefined) changed = true;
            store.set(field, v === undefined ? 1 : v + 1);
        }

        if (changed) {
            const response = await this.sendMessage(
                BrokerType.PublishEntityFields, brokerEntityFields,
                { name: entityName, fields: Array.from(store.keys()) }
            ).firstThenClose(BrokerType.EntityFields, brokerEntityFields);
            this.entityFields.set(response.name, response.fields);
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
                    //we can't remove it from knownFields, because we don't know whether another
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
                this.entityFields.set(response.name, response.fields);
            }
        });
    }

    public async tryLock(id: string): Promise<AsyncSubscription | undefined> {
        const subject = this.sendMessage(BrokerType.TryLock, brokerLock, { id });
        const message = await subject.waitNextMessage();
        if (message.type === BrokerType.ResponseLockFailed) {
            return undefined;
        }

        if (message.type === BrokerType.ResponseLock) {
            return new AsyncSubscription(async () => {
                await subject.send(BrokerType.Unlock).ackThenClose();
            });
        }

        throw new Error(`Invalid message returned. Expected Lock, but got ${message.type}`);
    }

    public async lock(id: string): Promise<AsyncSubscription> {
        const subject = this.sendMessage(BrokerType.Lock, brokerLock, { id });
        await subject.waitNext(BrokerType.ResponseLock);

        return new AsyncSubscription(async () => {
            await subject.send(BrokerType.Unlock).ackThenClose();
        });
    }

    public async isLocked(id: string): Promise<boolean> {
        const subject = this.sendMessage(BrokerType.IsLocked, brokerLock, { id });
        const lock = await subject.firstThenClose(BrokerType.ResponseIsLock, brokerResponseIsLock);
        return lock.v;
    }

    public async subscribe<T>(channel: string, schema: ClassSchema<T> | ClassType<T>, callback: (next: T) => void): Promise<AsyncSubscription> {
        let subs = this.channelSubscriptions.get(channel);
        const decoder = getBSONDecoder(schema);

        const parsedCallback = (next: Uint8Array) => callback(decoder(next));

        if (!subs) {
            subs = { listener: 1, callbacks: [parsedCallback] };
            this.channelSubscriptions.set(channel, subs);
        } else {
            subs.listener++;
            subs.callbacks.push(parsedCallback);
        }

        if (subs.listener === 1) {
            await this.sendMessage(BrokerType.Subscribe, brokerSubscribe, { c: channel })
                .ackThenClose();
        }

        return new AsyncSubscription(async () => {
            if (!subs) return;
            subs.listener--;
            arrayRemoveItem(subs.callbacks, parsedCallback);
            if (subs.listener === 0) {
                this.channelSubscriptions.delete(channel);
                await this.sendMessage(BrokerType.Unsubscribe, brokerSubscribe, { c: channel })
                    .ackThenClose();
            }
        });
    }

    public async getOrUndefined<T>(id: string, schema: ClassSchema<T> | ClassType<T>): Promise<T | undefined> {
        const buffer = await this.getRawOrUndefined(id);
        return buffer ? getBSONDecoder(schema)(buffer) : undefined;
    }

    public async getRawOrUndefined<T>(id: string): Promise<Uint8Array | undefined> {
        const response = await this.sendMessage(BrokerType.Get, brokerGet, { n: id })
            .firstThenClose(BrokerType.ResponseGet, brokerResponseGet);

        return response.v;
    }

    public async getRaw<T>(id: string): Promise<Uint8Array> {
        const v = await this.getRawOrUndefined(id);
        if (v === undefined) throw new Error(`Key ${id} is undefined`);
        return v;
    }

    public async set<T>(id: string, schema: ClassSchema<T> | ClassType<T>, data: T): Promise<undefined> {
        await this.sendMessage(BrokerType.Set, brokerSet, { n: id, v: getBSONSerializer(schema)(data) })
            .ackThenClose();

        return undefined;
    }

    public async getIncrement<T>(id: string): Promise<number> {
        const v = await this.getRaw(id);
        const float64 = new Float64Array(v.buffer, v.byteOffset, 1);
        return float64[0];
    }

    public async increment<T>(id: string, value?: number): Promise<undefined> {
        await this.sendMessage(BrokerType.Increment, brokerIncrement, { n: id, v: value })
            .ackThenClose();

        return undefined;
    }

    public async delete<T>(id: string): Promise<undefined> {
        await this.sendMessage(BrokerType.Delete, brokerDelete, { n: id })
            .ackThenClose();

        return undefined;
    }
}


export class BrokerDirectClient extends BrokerClient {
    constructor(rpcKernel: BrokerKernel) {
        super(new BrokerDirectClientAdapter(rpcKernel));
    }
}

export class BrokerDirectClientAdapter implements ClientTransportAdapter {
    constructor(public rpcKernel: BrokerKernel) {
    }

    public async connect(connection: TransportConnectionHooks) {
        const kernelConnection = this.rpcKernel.createConnection({ write: (buffer) => connection.onMessage(buffer) });

        connection.onConnected({
            disconnect() {
                kernelConnection.close();
            },
            send(message) {
                queueMicrotask(() => {
                    kernelConnection.handleMessage(message);
                });
            }
        });
    }
}
