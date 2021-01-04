import { arrayRemoveItem, ProcessLock, ProcessLocker } from '@deepkit/core';
import { createRpcMessage, RpcKernelBaseConnection, RpcKernelConnectionWriter, RpcMessage, RpcMessageRouteType, RpcResponse, RpcKernelConnections } from '@deepkit/rpc';
import { brokerDelete, brokerEntityFields, brokerGet, brokerIncrement, brokerLock, brokerPublish, brokerResponseGet, brokerResponseIsLock, brokerResponseSubscribeMessage, brokerSet, brokerSubscribe, BrokerType } from './model';

export class BrokerConnection extends RpcKernelBaseConnection {
    protected subscribedChannels: string[] = [];
    protected locks = new Map<number, ProcessLock>();
    protected replies = new Map<number, ((message: RpcMessage) => void)>();

    constructor(
        public writer: RpcKernelConnectionWriter,
        protected connections: RpcKernelConnections,
        protected state: BrokerState,
    ) {
        super(writer, connections);
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

    async onMessage(message: RpcMessage, response: RpcResponse): Promise<void> {
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
                for (const [name, fields] of this.state.entityFields.entries()) {
                    composite.add(BrokerType.EntityFields, brokerEntityFields, { name, fields: this.state.getEntityFields(name) });
                }
                composite.send();
                break;
            }
            case BrokerType.Lock: {
                const body = message.parseBody(brokerLock);
                this.state.lock(body.id).then(lock => {
                    this.locks.set(message.id, lock);
                    response.reply(BrokerType.ResponseLock);
                });
                break;
            }
            case BrokerType.Unlock: {
                const lock = this.locks.get(message.id);
                if (lock) lock.unlock();
                response.ack();
                break;
            }
            case BrokerType.IsLocked: {
                const body = message.parseBody(brokerLock);
                response.reply(BrokerType.ResponseIsLock, brokerResponseIsLock, { v: this.state.isLocked(body.id) });
                break;
            }
            case BrokerType.TryLock: {
                const body = message.parseBody(brokerLock);
                this.state.tryLock(body.id).then(lock => {
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
                this.state.increment(body.n, body.v);
                response.ack();
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
                response.reply(BrokerType.ResponseGet, brokerResponseGet, { v: this.state.get(body.n) })
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

    public lock(id: string): Promise<ProcessLock> {
        return this.locker.acquireLock(id);
    }

    public tryLock(id: string): Promise<ProcessLock | undefined> {
        return this.locker.tryLock(id);
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

    public increment(id: string, v?: number) {
        const buffer = this.setStore.get(id);
        const float64 = buffer ? new Float64Array(buffer.buffer, buffer.byteOffset) : new Float64Array(1);
        if (!buffer) this.setStore.set(id, new Uint8Array(float64.buffer));

        float64[0] += v || 1;
    }

    public get(id: string): Uint8Array | undefined {
        return this.setStore.get(id);
    }

    public delete(id: string) {
        this.setStore.delete(id);
    }
}

export class BrokerKernel {
    protected state: BrokerState = new BrokerState;
    protected connections = new RpcKernelConnections();

    createConnection(writer: RpcKernelConnectionWriter): BrokerConnection {
        return new BrokerConnection(writer, this.connections, this.state);
    }
}