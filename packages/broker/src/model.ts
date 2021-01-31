/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from "@deepkit/type";

export enum BrokerType {
    //the first 100 are reserved
    Ack,
    Error,
    Chunk,

    Publish = 100,
    Subscribe,
    Unsubscribe,
    ResponseSubscribeMessage, //on each new messages published by others

    Set,
    Get,
    Increment,
    ResponseIncrement,
    Delete,
    ResponseGet,

    Lock, //110
    Unlock, //111
    IsLocked, //112
    TryLock, //113
    ResponseLock,
    ResponseLockFailed,
    ResponseIsLock,

    PublishEntityFields, //internal set of fields will be set. if changed, it will be broadcasted to each connected client
    UnsubscribeEntityFields, //when fields set changes, the new set will be broadcasted to each connected client
    AllEntityFields, //clients requests all available entity-fields

    EntityFields,
}

export const brokerDelete = t.schema({
    n: t.string,
});

export const brokerIncrement = t.schema({
    n: t.string,
    v: t.number.optional
});

export const brokerResponseIncrement = t.schema({
    v: t.number
});

export const brokerSet = t.schema({
    n: t.string,
    v: t.type(Uint8Array),
});

export const brokerResponseGet = t.schema({
    v: t.type(Uint8Array).optional,
});

export const brokerGet = t.schema({
    n: t.string,
});

export const brokerPublish = t.schema({
    c: t.string,
    v: t.type(Uint8Array),
});

export const brokerSubscribe = t.schema({
    c: t.string,
});

export const brokerResponseSubscribeMessage = t.schema({
    c: t.string,
    v: t.type(Uint8Array),
});

export const brokerLockId = t.schema({
    id: t.string,
});

export const brokerLock = t.schema({
    id: t.string,
    ttl: t.number,
    timeout: t.number.optional,
});

export const brokerResponseIsLock = t.schema({
    v: t.boolean
});

export const brokerEntityFields = t.schema({
    name: t.string,
    fields: t.array(t.string),
});
