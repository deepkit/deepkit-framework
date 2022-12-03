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
import { BrokerConfig } from './broker.config';
import { RpcTcpClientAdapter, RpcTcpServer } from '@deepkit/rpc-tcp';
import { MongoId, ReflectionClass, Type, typeOf, UUID } from '@deepkit/type';

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

interface EntityChannelMessageRemove {
    type: EntityChannelMessageType.remove,
    ids: (string | number | UUID | MongoId)[],
}

export interface EntityPatches {
    $set?: { [path: string]: any };
    $unset?: { [path: string]: number };
    $inc?: { [path: string]: number };
}

interface EntityChannelMessagePatch<T> {
    type: EntityChannelMessageType.patch,
    id: string | number,
    version: number,
    item: Partial<T>,
    patch: EntityPatches,
}

type EntityChannelMessage<T extends IdInterface> = EntityChannelMessageAdd<T>
    | EntityChannelMessageRemove
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
    protected getEntityChannelMessageType<T>(schema: ReflectionClass<T>): Type {
        const jit = schema.getJitContainer();
        if (!jit.entityChannelMessage) {
            jit.entityChannelMessage = typeOf<EntityChannelMessage<never>>([schema.type]);
        }
        return jit.entityChannelMessage;
    }

    public entityChannel<T extends IdInterface>(schemaOrType: ClassType<T>): EntityBrokerChannel<T> {
        const schema = ReflectionClass.from(schemaOrType);
        const channelName = 'dk/e/' + schema.getName();
        let channel = this.activeChannels.get(channelName);
        if (channel) return channel as EntityBrokerChannel<T>;

        const type = this.getEntityChannelMessageType(schema);
        channel = new EntityBrokerChannel(channelName, type, this);
        this.activeChannels.set(channel.channel, channel);

        return channel as EntityBrokerChannel<T>;
    }
}

export class Broker extends BaseBroker {
    constructor(protected host: BrokerConfig['host']) {
        super(new RpcTcpClientAdapter(host));
    }
}

export class DirectBroker extends BaseBroker {
    constructor(rpcKernel: BrokerKernel) {
        super(new RpcDirectClientAdapter(rpcKernel));
    }
}

export class BrokerServer extends RpcTcpServer {
    protected kernel: BrokerKernel = new BrokerKernel;

    constructor(protected listen: BrokerConfig['listen']) {
        super(new BrokerKernel, listen);
    }
}
