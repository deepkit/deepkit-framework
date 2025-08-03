/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * @internal
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

/**
 * @internal
 */
export interface brokerDelete {
    n: string;
}

/**
 * @internal
 */
export interface brokerIncrement {
    n: string,
    v?: number
}

/**
 * @internal
 */
export interface brokerResponseIncrement {
    v: number;
}

/**
 * @internal
 */
export interface brokerSet {
    n: string,
    v: Uint8Array,
    ttl: number,
}

/**
 * @internal
 */
export interface brokerInvalidateCache {
    n: string,
}

/**
 * @internal
 */
export interface brokerSetCache {
    n: string,
    v: Uint8Array,
    ttl: number;
    tags?: string[];
}

/**
 * @internal
 */
export interface brokerInvalidateCacheMessage {
    key: string;
    ttl: number;
}

/**
 * @internal
 */
export interface brokerResponseGet {
    v?: Uint8Array,
}

/**
 * @internal
 */
export interface brokerResponseGetCache {
    v?: Uint8Array,
    ttl?: number,
}

/**
 * @internal
 */
export type brokerResponseGetCacheMeta = {
    ttl: number,
} | { missing: true };

/**
 * @internal
 */
export interface brokerGet {
    n: string;
}

/**
 * @internal
 */
export interface brokerGetCache {
    n: string;
}

/**
 * @internal
 */
export interface brokerBusPublish {
    c: string,
    v: Uint8Array,
}

/**
 * @internal
 */
export interface brokerBusSubscribe {
    c: string;
}

/**
 * @internal
 */
export interface brokerBusResponseHandleMessage {
    c: string,
    v: Uint8Array,
}

/**
 * @internal
 */
export interface BrokerQueuePublish {
    process: QueueMessageProcessing;
    deduplicationInterval?: number;
    hash?: string | number;
    delay?: number;
    priority?: number;
    c: string;
    v: Uint8Array;
}

/**
 * @internal
 */
export interface BrokerQueueSubscribe {
    c: string;
    maxParallel: number;
}

/**
 * @internal
 */
export interface BrokerQueueUnsubscribe {
    c: string;
}

/**
 * @internal
 */
export interface BrokerQueueResponseHandleMessage {
    c: string;
    id: number;
    v: Uint8Array;
}

/**
 * @internal
 */
// consumer handled the message and sends back the result
export interface BrokerQueueMessageHandled {
    c: string;
    id: number;
    success: boolean;
    error?: string;
    delay?: number;
}

/**
 * @internal
 */
export interface brokerLockId {
    id: string;
}

/**
 * @internal
 */
export interface brokerLock {
    id: string,
    ttl: number,
    timeout?: number,
}

/**
 * @internal
 */
export interface brokerResponseIsLock {
    v: boolean;
}

/**
 * @internal
 */
export interface brokerEntityFields {
    name: string,
    fields: string[],
}

/**
 * @internal
 */
export enum SnapshotEntryType {
    queue,
}

/**
 * @internal
 */
export type SnapshotEntry = {
    type: SnapshotEntryType.queue,
    currentId: number;
    name: string;
    amount: number;
}

/**
 * @internal
 */
export enum QueueMessageState {
    pending,
    inFlight,
    done,
    error,
}

/**
 * @internal
 */
export interface QueueMessage {
    id: number;
    state: QueueMessageState;
    hash?: string | number;
    process: QueueMessageProcessing;
    // absolute time
    ttl?: number;
    delay: number;
    priority?: number;
    lastError?: string;
    tries: number;
    v: Uint8Array;
}

/**
 * @internal
 */
export enum QueueMessageProcessing {
    exactlyOnce,
    atLeastOnce,
    // atMostOnce,
}
