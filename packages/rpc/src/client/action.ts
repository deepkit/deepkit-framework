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
 * @reflection never
 */
import { ClassType, toFastProperties } from '@deepkit/core';
import { Observable, Subject, Subscriber } from 'rxjs';
import { Collection } from '../collection.js';
import { ActionMode } from '../model.js';
import { EntityState, EntitySubjectStore } from './entity-state.js';
import { Type, TypeObjectLiteral } from '@deepkit/type';
import { RpcMessageSubject } from './message-subject.js';
import { ClientProgress, Progress } from '../progress.js';
import { ContextDispatcher, getBodyOffset, isContextFlag, isTypeFlag, MessageFlag, writeAction } from '../protocol.js';
import { WritableClient } from './client.js';
import { createParameterSerializer, createReturnDeserializer } from '../action.js';
import { AutoBuffer } from '@deepkit/bson';

type ControllerStateActionTypes = {
    mode: ActionMode;
    callSchema: TypeObjectLiteral, //with args, method, and controller as property
    resultSchema: TypeObjectLiteral, //with v as property
    observableNextSchema?: Type, //with v as property
    collectionSchema?: Type, //with v as property
    collectionQueryModel?: Type,
    classType?: ClassType, //if method returns an classType, this is set here
};

type ControllerStateActionState = {
    promise?: Promise<ControllerStateActionTypes>,
    types?: ControllerStateActionTypes
};

export class RpcControllerState {
    protected state: { [method: string]: ControllerStateActionState } = {};
    public peerId?: string;

    constructor(
        public controller: string,
    ) {

    }

    getState(method: string): ControllerStateActionState {
        let state = this.state[method];
        if (state) return state;
        state = this.state[method] = {};
        toFastProperties(this.state);
        return state;
    }
}

interface ActionState {
    action: string;
    progress?: Progress;
    finalizer: FinalizationRegistry<any>;
    entityState?: EntityState,
    observableRef?: WeakRef<Observable<any>>;
    observableSubjectRef?: WeakRef<Subject<any>>;

    //necessary for BehaviorSubject, since we get ObservableNext before the Observable type call
    firstObservableNextCalled?: true;
    firstObservableNext?: any;

    collectionRef?: WeakRef<Collection<any>> | undefined;
    collectionEntityStore?: EntitySubjectStore<any>
    types: ControllerStateActionTypes;

    subscriberId?: number;
    subscribers?: { [id: number]: Subscriber<any> };

    resolve?: (v: any) => void;
    reject?: (error: any) => void;
}

// function handleCollection(entityStore: EntitySubjectStore<any>, types: ControllerStateActionTypes, collection: Collection<any>, messages: RpcMessage[]) {
//     for (const next of messages) {
//         switch (next.type) {
//             case RpcAction.ResponseActionCollectionState: {
//                 const state = next.parseBody<CollectionState>();
//                 collection.setState(state);
//                 break;
//             }
//
//             case RpcAction.ResponseActionCollectionSort: {
//                 const body = next.parseBody<rpcResponseActionCollectionSort>();
//                 collection.setSort(body.ids);
//                 break;
//             }
//
//             case RpcAction.ResponseActionCollectionModel: {
//                 if (!types.collectionQueryModel) throw new RpcError('No collectionQueryModel set');
//                 collection.model.set(next.parseBody(types.collectionQueryModel));
//                 break;
//             }
//
//             case RpcAction.ResponseActionCollectionUpdate:
//             case RpcAction.ResponseActionCollectionAdd: {
//                 if (!types.collectionSchema) continue;
//                 const incomingItems = next.parseBody<WrappedV>(types.collectionSchema).v as IdInterface[];
//                 const items: IdInterface[] = [];
//
//                 for (const item of incomingItems) {
//                     if (!entityStore.isRegistered(item.id)) entityStore.register(item);
//                     if (next.type === RpcAction.ResponseActionCollectionUpdate) {
//                         entityStore.onSet(item.id, item);
//                     }
//
//                     let fork = collection.entitySubjects.get(item.id);
//                     if (!fork) {
//                         fork = entityStore.createFork(item.id);
//                         collection.entitySubjects.set(item.id, fork);
//                     }
//                     items.push(fork.value);
//
//                     //fork is automatically unsubscribed once removed from the collection
//                     fork.pipe(skip(1)).subscribe(i => {
//                         if (fork!.deleted) return; //we get deleted already
//                         collection.deepChange.next(i);
//                         collection.loaded();
//                     });
//                 }
//
//                 if (next.type === RpcAction.ResponseActionCollectionAdd) {
//                     collection.add(items);
//                 } else if (next.type === RpcAction.ResponseActionCollectionUpdate) {
//                     collection.update(items);
//                 }
//                 break;
//             }
//
//             case RpcAction.ResponseActionCollectionRemove: {
//                 const ids = next.parseBody<rpcResponseActionCollectionRemove>().ids;
//                 collection.remove(ids); //this unsubscribes its EntitySubject as well
//                 break;
//             }
//
//             case RpcAction.ResponseActionCollectionSet: {
//                 if (!types.collectionSchema) continue;
//                 const incomingItems = next.parseBody<WrappedV>(types.collectionSchema).v as IdInterface[];
//                 const items: IdInterface[] = [];
//                 for (const item of incomingItems) {
//                     if (!entityStore.isRegistered(item.id)) entityStore.register(item);
//                     const fork = entityStore.createFork(item.id);
//                     collection.entitySubjects.set(item.id, fork);
//                     items.push(fork.value);
//
//                     //fork is automatically unsubscribed once removed from the collection
//                     fork.pipe(skip(1)).subscribe(i => {
//                         if (fork.deleted) return; //we get deleted already
//                         collection.deepChange.next(i);
//                         collection.loaded();
//                     });
//                 }
//
//                 collection.set(items);
//                 break;
//             }
//         }
//     }
//     collection.loaded();
// }


function rejectAction(state: ActionState, error: any) {
    if (!state.reject) return;
    state.reject(error);

    // important to free Promise
    state.reject = undefined;
    state.resolve = undefined;
}

function resolveAction(state: ActionState, result: any) {
    if (!state.resolve) return;
    state.resolve(result);

    // important to free Promise
    state.reject = undefined;
    state.resolve = undefined;
}

function actionProtocolError(message: Uint8Array, subject: RpcMessageSubject, state: ActionState) {
    subject.release();
    // const error = message.getError();
    const error = '';
    if (state.subscribers) {
        for (const sub of Object.values(state.subscribers)) {
            sub.error(error);
        }
    }
    rejectAction(state, error);
}

// function actionProtocolFull(reply: Uint8Array, subject: RpcMessageSubject, state: ActionState) {
//     switch (reply.type) {
//         case RpcAction.ResponseActionSimple: {
//             try {
//                 const result = reply.parseBody<WrappedV>(state.types.resultSchema);
//                 resolveAction(state, result.v);
//             } catch (error: any) {
//                 console.log('parse error, got', reply.parseBody<WrappedV>());
//                 throw error;
//             }
//             subject.release();
//             break;
//         }
//
//
//         case RpcAction.ResponseEntity: {
//             if (!state.types.classType || !state.entityState) throw new RpcError('No classType returned by the rpc action');
//             resolveAction(state, state.entityState.createEntitySubject(state.types.classType, state.types.resultSchema, reply));
//             break;
//         }
//
//         case RpcAction.ResponseActionCollectionChange: {
//             if (!state.collectionRef) throw new RpcError('No collection loaded yet');
//             if (!state.types.collectionSchema) throw new RpcError('no collectionSchema loaded yet');
//             if (!state.collectionEntityStore) throw new RpcError('no collectionEntityStore loaded yet');
//
//             const collection = state.collectionRef.deref();
//             if (state.collectionEntityStore && collection) {
//                 handleCollection(state.collectionEntityStore, state.types, collection, reply.getBodies());
//             }
//
//             break;
//         }
//
//         case RpcAction.ResponseActionCollection: {
//             if (!state.types.classType) throw new RpcError('No classType returned by the rpc action');
//             if (!state.types.collectionQueryModel) throw new RpcError('No collectionQueryModel returned by the rpc action');
//             if (!state.entityState) throw new RpcError('No entityState set');
//             const collection = new Collection(state.types.classType);
//             state.collectionRef = new WeakRef(collection);
//             state.collectionEntityStore = state.entityState.getStore(state.types.classType);
//
//             collection.model.change.subscribe(() => {
//                 subject.send(RpcAction.ActionCollectionModel, collection!.model, state.types.collectionQueryModel);
//             });
//
//             collection.addTeardown(() => {
//                 subject.send(RpcAction.ActionCollectionUnsubscribe);
//                 subject.release();
//             });
//
//             handleCollection(state.collectionEntityStore, state.types, collection, reply.getBodies());
//
//             resolveAction(state, collection);
//             break;
//         }
//
//         case RpcAction.ResponseActionObservableError: {
//             const body = reply.parseBody<rpcResponseActionObservableSubscriptionError>();
//             const error = rpcDecodeError(body);
//             if (state.observableRef) {
//                 if (!state.subscribers?.[body.id]) return; //we silently ignore this
//                 state.subscribers![body.id].error(error);
//             } else if (state.observableSubjectRef) {
//                 state.observableSubjectRef.deref()?.error(error);
//                 subject.release();
//             }
//             break;
//         }
//
//         case RpcAction.ResponseActionObservableComplete: {
//             const body = reply.parseBody<rpcActionObservableSubscribeId>();
//
//             if (state.observableRef) {
//                 if (!state.subscribers?.[body.id]) return; //we silently ignore this
//                 state.subscribers[body.id].complete();
//             } else if (state.observableSubjectRef) {
//                 state.observableSubjectRef.deref()?.complete();
//                 subject.release();
//             }
//             break;
//         }
//
//         case RpcAction.ResponseActionObservableNext: {
//             if (!state.types.observableNextSchema) throw new RpcError('No observableNextSchema set');
//
//             const body = reply.parseBody<rpcActionObservableNext>(state.types.observableNextSchema);
//
//             if (state.observableRef) {
//                 if (!state.subscribers?.[body.id]) return; //we silently ignore this
//                 state.subscribers[body.id].next(body.v);
//             } else if (state.observableSubjectRef) {
//                 const s = state.observableSubjectRef.deref();
//                 if (s && !s.closed) s.next(body.v);
//             } else {
//                 state.firstObservableNext = body.v;
//                 state.firstObservableNextCalled = true;
//             }
//
//             break;
//         }
//
//         case RpcAction.ResponseActionObservable: {
//             if (state.observableRef) break;
//             const body = reply.parseBody<rpcResponseActionObservable>();
//
//             // this observable can be subscribed multiple times now
//             // each time we need to call the server again, since it's not a Subject
//             if (body.type === ActionObservableTypes.observable) {
//                 state.subscriberId = 0;
//                 state.subscribers = {};
//                 const observable = new Observable((observer) => {
//                     const id = state.subscriberId!++;
//                     state.subscribers![id] = observer;
//                     subject.send<rpcActionObservableSubscribeId>(RpcAction.ActionObservableSubscribe, { id });
//
//                     return {
//                         unsubscribe: () => {
//                             delete state.subscribers![id];
//                             subject.send<rpcActionObservableSubscribeId>(RpcAction.ActionObservableUnsubscribe, { id });
//                         },
//                     };
//                 });
//                 state.observableRef = new WeakRef(observable);
//                 state.finalizer.register(observable, () => {
//                     subject.send(RpcAction.ActionObservableDisconnect);
//                     subject.release();
//                 });
//                 resolveAction(state, observable);
//             } else if (body.type === ActionObservableTypes.subject) {
//                 const observableSubject = new Subject();
//                 let freed = false;
//                 state.observableSubjectRef = new WeakRef(observableSubject);
//
//                 // we have to monkey patch unsubscribe, because there is no other way to hook into that
//                 // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
//                 observableSubject.unsubscribe = function() {
//                     Subject.prototype.unsubscribe.call(this);
//                     if (!freed) {
//                         freed = true;
//                         subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                         state.finalizer.unregister(this);
//                         subject.release();
//                     }
//                 };
//
//                 observableSubject.complete = function() {
//                     Subject.prototype.complete.call(this);
//                     if (!freed) {
//                         freed = true;
//                         subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                         state.finalizer.unregister(this);
//                         subject.release();
//                     }
//                 };
//
//                 if (state.firstObservableNextCalled) {
//                     observableSubject.next(state.firstObservableNext);
//                     state.firstObservableNext = undefined;
//                 }
//
//                 state.finalizer.register(observableSubject, () => {
//                     subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                     freed = true;
//                     subject.release();
//                 });
//                 resolveAction(state, observableSubject);
//             } else if (body.type === ActionObservableTypes.behaviorSubject || body.type === ActionObservableTypes.progressTracker) {
//                 const classType = body.type === ActionObservableTypes.progressTracker ? ProgressTracker : BehaviorSubject;
//                 const observableSubject = new classType(state.firstObservableNext);
//                 state.observableSubjectRef = new WeakRef(observableSubject);
//                 state.firstObservableNext = undefined;
//                 let freed = false;
//
//                 // we have to monkey patch unsubscribe, because there is no other way to hook into that
//                 // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
//                 observableSubject.unsubscribe = function() {
//                     Subject.prototype.unsubscribe.call(this);
//                     if (!freed) {
//                         freed = true;
//                         subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                         state.finalizer.unregister(this);
//                     }
//                 };
//
//                 observableSubject.complete = function() {
//                     Subject.prototype.complete.call(this);
//                     if (!freed) {
//                         freed = true;
//                         subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                         state.finalizer.unregister(this);
//                     }
//                 };
//
//                 if (observableSubject instanceof ProgressTracker) {
//                     // whenever the client changes something, it's synced back to the server.
//                     // this is important to handle the stop signal.
//                     const oldChanged = observableSubject.changed;
//                     observableSubject.changed = function(this: ProgressTracker) {
//                         subject.send(RpcAction.ActionObservableProgressNext, this.value, typeOf<ProgressTrackerState[]>());
//                         return oldChanged.apply(this);
//                     };
//                 }
//
//                 state.finalizer.register(observableSubject, () => {
//                     subject.send(RpcAction.ActionObservableSubjectUnsubscribe);
//                     subject.release();
//                 });
//                 resolveAction(state, observableSubject);
//             }
//
//             break;
//         }
//         case RpcAction.Error: {
//             actionProtocolError(reply, subject, state);
//             break;
//         }
//         default: {
//             console.log(`Unexpected type received ${reply.type} ${RpcAction[reply.type]}`);
//         }
//     }
// }

// function actionProtocol(reply: RpcMessage, subject: RpcMessageSubject, state: ActionState) {
//     try {
//         actionProtocolFull(reply, subject, state);
//     } catch (error) {
//         console.warn('reply error', reply.contextId, RpcAction[reply.type], error);
//         rejectAction(state, `Reply failed for ${state.action}: ${error}`);
//     }
// }

export class RpcActionClient {
    public entityState = new EntityState;

    private finalizer = new FinalizationRegistry<() => void>((heldValue) => {
        heldValue();
    });

    protected cache: { [action: string]: any } = {};

    constructor(
        protected client: WritableClient,
        protected context: ContextDispatcher,
    ) {
    }

    disconnect() {
        this.cache = {};
    }

    public action(controller: RpcControllerState, method: string, args: any[], options: {
        timeout?: number,
        dontWaitForConnection?: true,
        typeReuseDisabled?: boolean
    } = {}) {
        const progress = ClientProgress.getNext();

        // TODO: this whole is too slow
        return new Promise<any>(async (resolve, reject) => {
            // forwarded caught progress to client sendMessage
            ClientProgress.nextProgress = progress;

            const cacheKey = controller.controller + '.' + method;
            let executor = this.cache[cacheKey];
            if (!executor) {
                let schemaMapping = this.client.getSchemaMapping();
                if (!schemaMapping) schemaMapping = await this.client.loadSchemaMapping();
                const action = schemaMapping[controller.controller]?.[method];
                const serializer = createParameterSerializer(action);
                const actionId = action.action;
                const autoBuffer = new AutoBuffer();
                autoBuffer.prepend = 3;
                const call = (contextId: number, args: any[]) => {
                    const buffer = autoBuffer._buffer;
                    autoBuffer.apply(serializer, args);
                    buffer[0] = MessageFlag.RouteClient | MessageFlag.ContextNew | MessageFlag.TypeAction;
                    writeAction(buffer, actionId);
                    return autoBuffer.buffer;
                };

                const deserialize = createReturnDeserializer(action.type);

                this.cache[cacheKey] = executor = {
                    call,
                    deserialize,
                };
            }

            // todo how to detect disconnects (to close the observable etc)
            const contextId = this.context.create((message) => {
                // todo: implement full protocol
                // console.log('reply', debugMessage(message));
                if (isContextFlag(message[0], MessageFlag.ContextEnd)) {
                    this.context.release(contextId);
                }
                if (isTypeFlag(message[0], MessageFlag.TypeAck)) {
                    resolve(undefined);
                    return;
                }
                if (isTypeFlag(message[0], MessageFlag.TypeResult)) {
                    const offset = getBodyOffset(message);
                    const value = executor.deserialize(message, offset);
                    resolve(value);
                    // resolve(undefined);
                    return;
                }
            });

            this.client.write(executor.call(contextId, args));
            // const message = new Uint8Array(32);
            // message[0] = MessageFlag.TypeAction | MessageFlag.ContextNew;
            // writeAction(message, actionId);
            // setContextFlag(message, MessageFlag.ContextNew);
            // this.client.write(message);
        });
    }
}
