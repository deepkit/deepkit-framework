export interface IdInterface {
    id: string;
    version: number;
}

export interface ChannelEntityBase {
    id: string;
    version: number;
}

export interface ChannelEntityAdd extends ChannelEntityBase {
    type: 'add';
    item: any;
}

export interface ChannelEntityRemove extends ChannelEntityBase {
    type: 'remove';
}

export interface ChannelEntityUpdate extends ChannelEntityBase {
    type: 'update';
    item: any;
}

export interface EntityPatches {
    [path: string]: any;
}

export interface ChannelEntityPatch extends ChannelEntityBase {
    type: 'patch';
    patch: EntityPatches;
    item: any;
}

export type ChannelEntity = ChannelEntityAdd | ChannelEntityRemove | ChannelEntityUpdate | ChannelEntityPatch;

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

export interface MessageTypeJson {
    type: 'type';
    id: number;
    returnType: 'json';
}

export interface MessageTypeCollection {
    type: 'type';
    id: number;
    returnType: 'collection';
    entityName: string;
}

export interface MessageTypeObservable {
    type: 'type';
    returnType: 'observable';
    id: number;
}

export type MessageType = MessageTypeJson | MessageTypeCollection | MessageTypeObservable;

export interface MessageNext {
    type: 'next';
    id: number;
    next: any;
    entityName?: string;
}

export interface MessageComplete {
    type: 'complete';
    id: number;
}

export interface MessageError {
    type: 'error';
    id: number;
    error: any;
}

export type MessageResult = MessageType | MessageNext | MessageComplete | MessageError;
