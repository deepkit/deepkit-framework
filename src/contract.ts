import {JSONEntity} from "./entity";

export interface IdInterface {
    id: string;
    version: number;
}


export interface EntityPatches {
    [path: string]: any;
}

export interface ExchangeEntityBase {
    id: string;
    version: number;
}

export interface ExchangeEntityAdd extends ExchangeEntityBase {
    type: 'add';
    item: any;
}

export interface ExchangeEntityRemove extends ExchangeEntityBase {
    type: 'remove';
}

export interface ExchangeEntityUpdate extends ExchangeEntityBase {
    type: 'update';
    item: any;
}

export interface ExchangeEntityPatch extends ExchangeEntityBase {
    type: 'patch';
    patch: EntityPatches;
    item: any;
}

export type ExchangeEntity = ExchangeEntityAdd | ExchangeEntityRemove | ExchangeEntityUpdate | ExchangeEntityPatch;

export interface ClientMessageId {
    id: number;
}

export interface ClientMessageAuthorize {
    name: 'authenticate';
    token: any;
}

export interface ClientMessageAction {
    name: 'action';
    controller: string,
    action: string,
    args: any[],
}

export interface ClientMessageEntityComplete {
    name: 'entity/complete';
}

export interface ClientMessageObservableSubscribe {
    name: 'observable/subscribe';
    subscribeId: number;
}

export interface ClientMessageObservableUnsubscribe {
    name: 'observable/unsubscribe';
    subscribeId: number;
}

export type ClientMessageWithoutId = ClientMessageAuthorize | ClientMessageAction | ClientMessageEntityComplete | ClientMessageObservableSubscribe | ClientMessageObservableUnsubscribe;

export type ClientMessageAll = ClientMessageWithoutId & ClientMessageId;

export interface MessageEntityBase {
    entityName: string;
    id: string;
    version: number;
}

export interface ServerMessageEntityRemove extends MessageEntityBase {
    type: 'entity/remove';
}

export interface ServerMessageEntityUpdate extends MessageEntityBase {
    type: 'entity/update';
    item: any;
}

export interface ServerMessageEntityPatch extends MessageEntityBase {
    type: 'entity/patch';
    patch: EntityPatches;
}

export type ServerMessageEntity = ServerMessageEntityRemove | ServerMessageEntityUpdate | ServerMessageEntityPatch;

export interface CollectionStreamSet {
    type: 'set';
    items: IdInterface[];
    total: number;
}

export interface CollectionStreamAdd {
    type: 'add';
    item: IdInterface;
}

export interface CollectionStreamReady {
    type: 'ready';
}

export interface CollectionStreamRemove {
    type: 'remove';
    id: string;
}

export interface FindOneResult {
    type: 'item';
    item?: IdInterface;
}

export interface CountUpdateResult {
    type: 'count';
    index: number;
    count: number;
}

export interface StreamFileSet {
    type: 'set';
    path: string;
    meta?: { [k: string]: any };
    content: any;
}

export interface StreamFileAppend {
    type: 'append';
    path: string;
    meta?: { [k: string]: any };
    content: any;
}

export interface StreamFileRemove {
    type: 'remove';
    path: string;
    meta?: { [k: string]: any };
}

export type CollectionStream = CollectionStreamSet | CollectionStreamAdd | CollectionStreamRemove | CollectionStreamReady;

export type CountResult = CountUpdateResult;

export type StreamFileResult = StreamFileSet | StreamFileAppend | StreamFileRemove;

export interface ServerMessageTypeJson {
    type: 'type';
    id: number;
    returnType: 'json';
}

export interface ServerMessageTypeCollection {
    type: 'type';
    id: number;
    returnType: 'collection';
    entityName: string;
}

export interface ServerMessageTypeObservable {
    type: 'type';
    returnType: 'observable';
    id: number;
}

export interface ServerMessageTypeEntity<T extends IdInterface> {
    type: 'type';
    returnType: 'entity';
    id: number;
    entityName?: string;
    item?: JSONEntity<T>;
}

export type ServerMessageType = ServerMessageTypeJson | ServerMessageTypeCollection | ServerMessageTypeObservable | ServerMessageTypeEntity<IdInterface>;

export interface ServerMessageNextJson {
    type: 'next/json';
    id: number;
    next: any;
    entityName?: string;
}

export interface ServerMessageNextObservable {
    type: 'next/observable';
    id: number;
    next: any;
    subscribeId: number;
    entityName?: string;
}

export interface ServerMessageNextCollection {
    type: 'next/collection';
    id: number;
    next: CollectionStream;
}

export type ServerMessageNext = ServerMessageNextJson | ServerMessageNextObservable | ServerMessageNextCollection;

export interface ServerMessageCompleteGeneral {
    type: 'complete';
    id: number;
}

export interface ServerMessageCompleteObservable {
    type: 'complete/observable';
    id: number;
    subscribeId: number;
}

export type ServerMessageComplete = ServerMessageCompleteGeneral | ServerMessageCompleteObservable;

export interface ServerMessageErrorGeneral {
    type: 'error';
    id: number;
    error: any;
}

export interface ServerMessageErrorObservable {
    type: 'error/observable';
    id: number;
    error: any;
    subscribeId: number;
}

export type ServerMessageError = ServerMessageErrorGeneral | ServerMessageErrorObservable;

export interface ServerMessageAuthorize {
    type: 'authenticate/result';
    id: number;
    result: boolean;
}

export type ServerMessageResult = ServerMessageAuthorize | ServerMessageType | ServerMessageNext | ServerMessageComplete | ServerMessageError;

export interface ServerMessageChannel {
    type: 'channel';
    name: string;
    data: any;
}

export type ServerMessageAll = ServerMessageResult | ServerMessageChannel | ServerMessageEntity;
