import {JSONEntity} from "./core";
import {CollectionPaginationEvent, CollectionSort, FilterParameters} from "./collection";
import {PropertySchemaSerialized} from "@marcj/marshal";

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

//from client to peer
export interface ClientMessagePeerMessage {
    name: 'peerController/message';
    controllerName: string;
    clientId: string;
    data: ServerMessageResult;
}

export interface ClientMessagePeerEndMessage {
    name: 'peerUser/end';
}

export interface ClientMessagePeerUnRegisterController {
    name: 'peerController/unregister';
    controllerName: string;
}

export interface ClientMessageActionTypes {
    name: 'actionTypes';
    controller: string;
    action: string;
    timeout: number;
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
    timeout: number;
}

export interface ClientPeerMessageAction {
    name: 'peerMessage';
    controller: string;
    message: any;
    timeout: number;
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

export interface ClientMessageCollectionPagination {
    name: 'collection/pagination';
    forId: number;
    page: number;
    itemsPerPage: number;
    parameters: FilterParameters;
    sort: {field: string, direction: 'asc' | 'desc'}[];
}

export interface ClientMessageObservableSubscribe {
    name: 'observable/subscribe';
    forId: number;
    subscribeId: number;
}

export interface ClientMessageObservableUnsubscribe {
    name: 'observable/unsubscribe';
    forId: number;
    subscribeId: number;
}

export type ClientMessageWithoutId = ClientPushMessage
    | ClientMessagePeerUnRegisterController
    | ClientMessagePeerRegisterController
    | ClientMessageCollectionPagination
    | ClientMessagePeerMessage
    | ClientMessagePeerEndMessage
    | ClientMessageActionTypes
    | ClientMessageAuthorize
    | ClientMessageAction
    | ClientMessageEntityUnsubscribe
    | ClientMessageObservableSubscribe
    | ClientMessageObservableUnsubscribe
    | ClientMessageCollectionUnsubscribe
    | ClientMessageSubjectUnsubscribe
    | ClientPeerMessageAction;

export type ClientMessageAll = (ClientMessageWithoutId & ClientMessageId);

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

export interface CollectionStreamSort {
    type: 'sort';
    ids: string[];
}

export interface CollectionStreamAdd {
    type: 'add';
    item: IdInterface;
}

export interface CollectionStreamBatchStart {
    type: 'batch/start';
}

export interface CollectionStreamBatchEnd {
    type: 'batch/end';
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
}

export interface StreamFileAppend {
    type: 'append';
    path: string;
    version: number;
    content: any;
    size: number;
}

export interface StreamFileRemove {
    type: 'remove';
    path: string;
}

export interface CollectionStreamPagination {
    type: 'pagination';
    event: CollectionPaginationEvent;
}

export type CollectionStream =
    CollectionStreamBatchStart
    | CollectionStreamBatchEnd
    | CollectionStreamPagination
    | CollectionStreamSet
    | CollectionStreamSort
    | CollectionStreamAdd
    | CollectionStreamRemove
    | CollectionStreamRemoveMany
    | CollectionStreamReady;

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
    pagination: {
        active: boolean,
        itemsPerPage: number,
        page: number,
        total: number,
        sort: CollectionSort[],
        parameters: FilterParameters,
    };
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
    encoding: PropertySchemaSerialized;
    data: any;
}

export type ServerMessageType = ServerMessageTypeJson | ServerMessageTypeCollection | ServerMessageTypeObservable
    | ServerMessageTypeEntity<IdInterface> | ServerMessageTypeSubject;

export interface ServerMessageNextJson {
    type: 'next/json';
    id: number;
    encoding: PropertySchemaSerialized;
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
    encoding: PropertySchemaSerialized;
    next: any;
    subscribeId: number;
}

export interface ServerMessageNextSubject {
    type: 'next/subject';
    id: number;
    encoding: PropertySchemaSerialized;
    next: any;
}

export interface ServerMessageAppendSubject {
    type: 'append/subject';
    id: number;
    encoding: PropertySchemaSerialized;
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
    stack: any;
    entityName: string | '@error:default';
    code?: string;
}

export interface ServerMessageErrorObservable {
    type: 'error/observable';
    id: number;
    error: any;
    stack: any;
    entityName: string | '@error:default';
    subscribeId: number;
}

export type ServerMessageError = ServerMessageErrorGeneral | ServerMessageErrorObservable;

export interface ServerMessageAuthorize {
    type: 'authenticate/result';
    id: number;
    result: boolean;
}

export type ServerMessageActionTypeNames = 'Entity' | 'Object' | 'Any' | 'Plain' | 'String' | 'Date' | 'Number' | 'Boolean' | 'undefined';

export interface ServerMessageActionTypes {
    type: 'actionTypes/result';
    id: number;
    parameters: PropertySchemaSerialized[];
}

export type ServerMessageResult = ServerMessageActionTypes | ServerMessageAuthorize | ServerMessageType
    | ServerMessageNext | ServerMessageComplete | ServerMessageError;

export interface ServerMessageChannel {
    type: 'channel';
    name: string;
    data: any;
}

/**
 * A peer message, from server to client wrapping a message sent from
 * the peer controller.
 */
export interface ServerMessagePeerChannelMessage {
    id: number;
    type: 'peerController/message';
    clientId: string;
    data: ClientMessageAll;
}


export type ServerMessageAll = ServerMessageResult | ServerMessagePeerChannelMessage | ServerMessageChannel | ServerMessageEntity;
