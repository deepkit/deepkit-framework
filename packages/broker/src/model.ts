/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export const enum BrokerType {
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
    ResponseGet,
    Increment,
    ResponseIncrement,
    Delete,

    InvalidateCache,
    SetCache,
    GetCache,
    ResponseGetCache,
    GetCacheMeta,
    ResponseGetCacheMeta,
    DeleteCache,

    Lock, //110
    Unlock, //111
    IsLocked, //112
    TryLock, //113
    ResponseLock,
    ResponseLockFailed,
    ResponseIsLock,

    EnableInvalidationCacheMessages,
    ResponseInvalidationCache,

    QueuePublish,
    QueueSubscribe,
    QueueUnsubscribe,
    QueueResponseHandleMessage,
    QueueMessageHandled,

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

export interface brokerInvalidateCache {
    n: string,
}

export interface brokerSetCache {
    n: string,
    v: Uint8Array,
    ttl: number;
    tags?: string[];
}

export interface brokerInvalidateCacheMessage {
    key: string;
    ttl: number;
}

export interface brokerResponseGetCache {
    v?: Uint8Array,
    ttl?: number,
}

export type brokerResponseGetCacheMeta = {
    ttl: number,
} | { missing: true };

export interface brokerGet {
    n: string;
}

export interface brokerGetCache {
    n: string;
}

export interface brokerBusPublish {
    c: string,
    v: Uint8Array,
}

export interface brokerBusSubscribe {
    c: string;
}

export interface brokerBusResponseHandleMessage {
    c: string,
    v: Uint8Array,
}

export interface BrokerQueuePublish {
    process: QueueMessageProcessing;
    deduplicationInterval: number;
    delay?: number;
    priority?: number;
    c: string;
    v: Uint8Array;
}

export interface BrokerQueueSubscribe {
    c: string;
    maxParallel: number;
}

export interface BrokerQueueUnsubscribe {
    c: string;
}

export interface BrokerQueueResponseHandleMessage {
    c: string;
    id: number;
    v: Uint8Array;
}

// consumer handled the message and sends back the result
export interface BrokerQueueMessageHandled {
    c: string;
    id: number;
    success: boolean;
    error?: string;
    delay?: number;
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

export enum SnapshotEntryType {
    queue,
}

export type SnapshotEntry = {
    type: SnapshotEntryType.queue,
    currentId: number;
    name: string;
    amount: number;
}

export enum QueueMessageState {
    pending,
    inFlight,
    done,
    error,
}

export interface QueueMessage {
    id: number;
    state: QueueMessageState;
    process: QueueMessageProcessing;
    // absolute time
    ttl: number;
    delay: number;
    priority?: number;
    lastError?: string;
    tries: number;
    v: Uint8Array;
}

export enum QueueMessageProcessing {
    exactlyOnce,
    atLeastOnce,
    // atMostOnce,
}
