import {JSONEntity} from "./core";

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

export interface ExchangeEntityRemoveMany {
    type: 'removeMany';
    ids: string[];
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

export type ExchangeEntity = ExchangeEntityAdd | ExchangeEntityRemove | ExchangeEntityUpdate | ExchangeEntityPatch | ExchangeEntityRemoveMany;

export interface ClientPushMessage {
    name: 'push-message/reply';
    replyId: number;
    data: any;
}

export interface ClientMessageId {
    id: number;
}

export interface ClientMessagePeerRegisterController {
    name: 'peerController/register';
    controllerName: string;
}

export interface ClientMessagePeerMessage {
    name: 'peerController/message';
    controllerName: string;
    replyId: string;
    data: ServerMessageResult;
}

export interface ClientMessagePeerUnRegisterController {
    name: 'peerController/unregister';
    controllerName: string;
}

export interface ClientMessageActionTypes {
    name: 'actionTypes';
    controller: string;
    action: string;
}

export interface ClientMessageAuthorize {
    name: 'authenticate';
    token: any;
}

export interface ClientMessageAction {
    name: 'action';
    controller: string;
    action: string;
    args: any[];
}

export interface ClientMessageEntityUnsubscribe {
    name: 'entity/unsubscribe';
    forId: number;
}

export interface ClientMessageSubjectUnsubscribe {
    name: 'subject/unsubscribe';
    forId: number;
}

export interface ClientMessageCollectionUnsubscribe {
    name: 'collection/unsubscribe';
    forId: number;
}

export interface ClientMessageObservableSubscribe {
    name: 'observable/subscribe';
    subscribeId: number;
}

export interface ClientMessageObservableUnsubscribe {
    name: 'observable/unsubscribe';
    subscribeId: number;
}

export type ClientMessageWithoutId = ClientPushMessage
    | ClientMessagePeerUnRegisterController
    | ClientMessagePeerRegisterController
    | ClientMessagePeerMessage
    | ClientMessageActionTypes
    | ClientMessageAuthorize
    | ClientMessageAction
    | ClientMessageEntityUnsubscribe
    | ClientMessageObservableSubscribe
    | ClientMessageObservableUnsubscribe
    | ClientMessageCollectionUnsubscribe
    | ClientMessageSubjectUnsubscribe;

export type ClientMessageAll = ClientMessageWithoutId & ClientMessageId;

export interface MessageEntityBase {
    entityName: string;
    id: string;
    version: number;
}

export interface ServerMessageEntityRemove extends MessageEntityBase {
    type: 'entity/remove';
}

export interface ServerMessageEntityRemoveMany {
    entityName: string;
    type: 'entity/removeMany';
    ids: string[];
}

export interface ServerMessageEntityUpdate extends MessageEntityBase {
    type: 'entity/update';
    data: any;
}

export interface ServerMessageEntityPatch extends MessageEntityBase {
    type: 'entity/patch';
    patch: EntityPatches;
}

export type ServerMessageEntity = ServerMessageEntityRemove | ServerMessageEntityRemoveMany | ServerMessageEntityUpdate | ServerMessageEntityPatch;

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

export interface CollectionStreamRemoveMany {
    type: 'removeMany';
    ids: string[];
}

export interface StreamFileSet {
    type: 'set';
    path: string;
    version: number;
    content: any;
}

export interface StreamFileAppend {
    type: 'append';
    path: string;
    version: number;
    content: any;
}

export interface StreamFileRemove {
    type: 'remove';
    path: string;
}

export type CollectionStream = CollectionStreamSet | CollectionStreamAdd | CollectionStreamRemove | CollectionStreamRemoveMany | CollectionStreamReady;

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

export interface ServerMessageTypeSubject {
    type: 'type';
    returnType: 'subject';
    id: number;
    entityName?: string;
    data: any;
}

export type ServerMessageType = ServerMessageTypeJson | ServerMessageTypeCollection | ServerMessageTypeObservable
    | ServerMessageTypeEntity<IdInterface> | ServerMessageTypeSubject;

export interface ServerMessageNextJson {
    type: 'next/json';
    id: number;
    next: any;
}

export interface ServerPushMessageMessage {
    type: 'push-message';
    replyId: number;
    next: any;
}

export interface ServerMessageNextObservable {
    type: 'next/observable';
    id: number;
    next: any;
    subscribeId: number;
}

export interface ServerMessageNextSubject {
    type: 'next/subject';
    id: number;
    next: any;
}

export interface ServerMessageAppendSubject {
    type: 'append/subject';
    id: number;
    append: any;
}

export interface ServerMessageNextCollection {
    type: 'next/collection';
    id: number;
    next: CollectionStream;
}

export type ServerMessageNext = ServerPushMessageMessage
    | ServerMessageNextJson
    | ServerMessageNextObservable
    | ServerMessageNextCollection
    | ServerMessageNextSubject
    | ServerMessageAppendSubject;

export interface ServerMessageAck {
    type: 'ack';
    id: number;
}

export interface ServerMessageCompleteGeneral {
    type: 'complete';
    id: number;
}

export interface ServerMessageCompleteObservable {
    type: 'complete/observable';
    id: number;
    subscribeId: number;
}

export type ServerMessageComplete = ServerMessageAck | ServerMessageCompleteGeneral | ServerMessageCompleteObservable;

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

export type ServerMessageActionTypeNames = 'Entity' | 'Object' | 'Any' | 'String' | 'Date' | 'Number' | 'Boolean' | 'undefined';

export type ServerMessageActionType = {
    partial: boolean,
    type: ServerMessageActionTypeNames;
    array: boolean;
    entityName?: string,
};

export interface ServerMessageActionTypes {
    type: 'actionTypes/result';
    id: number;
    parameters: ServerMessageActionType[];
    returnType: ServerMessageActionType;
}

export type ServerMessageResult = ServerMessageActionTypes | ServerMessageAuthorize | ServerMessageType
    | ServerMessageNext | ServerMessageComplete | ServerMessageError;

export interface ServerMessageChannel {
    type: 'channel';
    name: string;
    data: any;
}

export interface ServerMessagePeerChannelMessage {
    id: number;
    type: 'peerController/message';
    replyId: string;
    data: any;
}


export type ServerMessageAll = ServerMessageResult | ServerMessagePeerChannelMessage | ServerMessageChannel | ServerMessageEntity;
