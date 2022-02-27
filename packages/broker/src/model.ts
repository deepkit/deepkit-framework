/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

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

export interface brokerDelete {
    n: string;
}

export interface brokerIncrement {
    n: string,
    v?: number
}

export interface brokerResponseIncrement {
    v: number;
}

export interface brokerSet {
    n: string,
    v: Uint8Array,
}

export interface brokerResponseGet {
    v?: Uint8Array,
}

export interface brokerGet {
    n: string;
}

export interface brokerPublish {
    c: string,
    v: Uint8Array,
}

export interface brokerSubscribe {
    c: string;
}

export interface brokerResponseSubscribeMessage {
    c: string,
    v: Uint8Array,
}

export interface brokerLockId {
    id: string;
}

export interface brokerLock {
    id: string,
    ttl: number,
    timeout?: number,
}

export interface brokerResponseIsLock {
    v: boolean;
}

export interface brokerEntityFields {
    name: string,
    fields: string[],
}
