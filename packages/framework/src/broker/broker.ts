/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrokerChannel, BrokerClient, BrokerKernel } from '@deepkit/broker';
import { ClassType } from '@deepkit/core';
import { IdInterface, RpcDirectClientAdapter } from '@deepkit/rpc';
import { ClassSchema, FieldDecoratorResult, getClassSchema, t } from '@deepkit/type';
import { inject, injectable } from '@deepkit/injector';
import { brokerConfig } from './broker.config';
import { NetTcpRpcClientAdapter, NetTcpRpcServer, TcpRpcClientAdapter, TcpRpcServer } from '@deepkit/rpc-tcp';


export enum EntityChannelMessageType {
    remove,
    patch,
    add,
}

interface EntityChannelMessageAdd<T> {
    type: EntityChannelMessageType.add,
    id: string | number,
    item: T,
}

const entityChannelMessageAdd = t.schema({
    type: t.literal(EntityChannelMessageType.add).discriminant,
    id: t.union(t.string, t.number),
}, { name: 'EntityChannelMessageAdd' });

interface EntityChannelMessageRemove<T> {
    type: EntityChannelMessageType.remove,
    ids: (string | number)[],
}

const entityChannelMessageRemove = t.schema({
    type: t.literal(EntityChannelMessageType.remove).discriminant,
    ids: t.array(t.union(t.string, t.number, t.uuid, t.mongoId)),
}, { name: 'EntityChannelMessageRemove' });

export interface EntityPatches {
    $set?: { [path: string]: any };
    $unset?: { [path: string]: number };
    $inc?: { [path: string]: number };
}

const entityPatch: ClassSchema<EntityPatches> = t.schema({
    $set: t.map(t.any).optional,
    $unset: t.map(t.number).optional,
    $inc: t.map(t.number).optional,
});

interface EntityChannelMessagePatch<T> {
    type: EntityChannelMessageType.patch,
    id: string | number,
    version: number,
    item: Partial<T>,
    patch: EntityPatches,
}

const entityChannelMessagePatch = t.schema({
    type: t.literal(EntityChannelMessageType.patch).discriminant,
    id: t.union(t.string, t.number),
    version: t.number,
    patch: t.type(entityPatch)
}, { name: 'EntityChannelMessagePatch' });

type EntityChannelMessage<T extends IdInterface> = EntityChannelMessageAdd<T>
    | EntityChannelMessageRemove<T>
    | EntityChannelMessagePatch<T>;

export class EntityBrokerChannel<T extends IdInterface> extends BrokerChannel<EntityChannelMessage<T>> {
    publishAdd(item: T) {
        return this.publish({ type: EntityChannelMessageType.add, id: item.id, item });
    }

    publishRemove(ids: (string | number)[]) {
        return this.publish({ type: EntityChannelMessageType.remove, ids });
    }

    publishPatch(id: string | number, version: number, patch: EntityPatches, item: Partial<T>) {
        return this.publish({ type: EntityChannelMessageType.patch, id, version, patch, item });
    }
}

export class BaseBroker extends BrokerClient {
    protected getEntityChannelMessageSchema<T>(schema: ClassSchema<T>): FieldDecoratorResult<any> {
        const jit = schema.jit;
        if (!jit.entityChannelMessage) {
            jit.entityChannelMessage = t.union(
                entityChannelMessageRemove,
                entityChannelMessagePatch.extend({ item: t.partial(schema) }),
                entityChannelMessageAdd.extend({ item: schema })
            );
        }
        return jit.entityChannelMessage;
    }

    public entityChannel<T extends IdInterface>(schemaOrType: ClassSchema<T> | ClassType<T>): EntityBrokerChannel<T> {
        const schema = getClassSchema(schemaOrType);
        const channelName = 'dk/e/' + schema.getName();
        let channel = this.activeChannels.get(channelName);
        if (channel) return channel as EntityBrokerChannel<T>;

        const decorator = this.getEntityChannelMessageSchema(schema);
        channel = new EntityBrokerChannel(channelName, decorator, this);
        this.activeChannels.set(channel.channel, channel);

        return channel as EntityBrokerChannel<T>;
    }
}

export class Broker extends BaseBroker {
    constructor(
        @inject(brokerConfig.token('host')) protected url: string) {
        super(new TcpRpcClientAdapter(url));
    }
}

export class NetBroker extends BaseBroker {
    constructor(
        @inject(brokerConfig.token('host')) protected url: string) {
        super(new NetTcpRpcClientAdapter(url));
    }
}

export class DirectBroker extends BaseBroker {
    constructor(rpcKernel: BrokerKernel) {
        super(new RpcDirectClientAdapter(rpcKernel));
    }
}

@injectable()
export class BrokerServer extends TcpRpcServer {
    protected kernel: BrokerKernel = new BrokerKernel;

    constructor(@inject(brokerConfig.token('listen')) listen: string) {
        super(new BrokerKernel, listen);
    }
}

@injectable()
export class NetBrokerServer extends NetTcpRpcServer {
    protected kernel: BrokerKernel = new BrokerKernel;

    constructor(@inject(brokerConfig.token('listen')) listen: string) {
        super(new BrokerKernel, listen);
    }
}
