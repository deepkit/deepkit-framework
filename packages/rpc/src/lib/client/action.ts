/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation, ClassType, toFastProperties } from '@deepkit/core';
import { BehaviorSubject, Observable, Subject, Subscriber } from 'rxjs';
import { skip } from 'rxjs/operators';
import { Collection, CollectionQueryModelInterface, CollectionState } from '../collection.js';
import {
    ActionObservableTypes,
    IdInterface,
    rpcActionObservableNext,
    rpcActionObservableSubscribeId,
    rpcActionType,
    rpcResponseActionCollectionRemove,
    rpcResponseActionCollectionSort,
    rpcResponseActionObservable,
    rpcResponseActionObservableSubscriptionError,
    rpcResponseActionType,
    RpcTypes,
    WrappedV
} from '../model.js';
import { rpcDecodeError, RpcMessage } from '../protocol.js';
import { ClientProgress } from '../writer.js';
import type { WritableClient } from './client.js';
import { EntityState, EntitySubjectStore } from './entity-state.js';
import { assertType, deserializeType, ReflectionKind, Type, TypeObjectLiteral, typeOf } from '@deepkit/type';
import { ProgressTracker, ProgressTrackerState } from '../../core-rxjs';

interface ResponseActionObservableError extends rpcActionObservableSubscribeId, WrappedV {
}

type ControllerStateActionTypes = {
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
        public controller: string
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

// function setReturnType(types: ControllerStateActionTypes, serializedTypes: SerializedTypes) {
//     const method = deserializeType(serializedTypes);
//     assertType(method, ReflectionKind.method);
//
//     if (method.return.kind === ReflectionKind.class) {
//         types.classType = method.return.classType;
//     } else if (method.return.kind === ReflectionKind.promise && method.return.type.kind === ReflectionKind.class) {
//         types.classType = method.return.type.classType;
//     }
// }

export class RpcActionClient {
    public entityState = new EntityState;

    constructor(protected client: WritableClient) {
    }

    public action<T>(controller: RpcControllerState, method: string, args: any[], options: { timeout?: number, dontWaitForConnection?: true, typeReuseDisabled?: boolean } = {}) {
        const progress = ClientProgress.getNext();

        return asyncOperation<any>(async (resolve, reject) => {
            try {
                const types = controller.getState(method)?.types || await this.loadActionTypes(controller, method, options);
                // console.log('client types', types.parameterSchema.getProperty('args').getResolvedClassSchema().toString(), )

                // const argsObject: any = {};
                // for (let i = 0; i < args.length; i++) {
                //     argsObject[types.parameters[i]] = args[i];
                // }

                let observable: Observable<any> | undefined;
                let observableSubject: Subject<any> | undefined;

                //necessary for BehaviorSubject, since we get ObservableNext before the Observable type call
                let firstObservableNextCalled = false;
                let firstObservableNext: any;

                let collection: Collection<any> | undefined;
                let collectionEntityStore: EntitySubjectStore<any> | undefined;

                let subscriberId = 0;
                const subscribers: { [id: number]: Subscriber<any> } = {};

                ClientProgress.nextProgress = progress;

                const subject = this.client.sendMessage(RpcTypes.Action, {
                    controller: controller.controller,
                    method: method,
                    args
                }, types.callSchema, {
                    peerId: controller.peerId,
                    dontWaitForConnection: options.dontWaitForConnection,
                    timeout: options.timeout,
                }).onReply((reply) => {
                    try {
                        // console.log('client: answer', RpcTypes[reply.type], reply.composite);

                        switch (reply.type) {
                            case RpcTypes.ResponseEntity: {
                                if (!types.classType) throw new Error('No classType returned by the rpc action');
                                resolve(this.entityState.createEntitySubject(types.classType, types.resultSchema, reply));
                                break;
                            }

                            case RpcTypes.ResponseActionSimple: {
                                subject.release();
                                try {
                                    const result = reply.parseBody<WrappedV>(types.resultSchema);
                                    resolve(result.v);
                                } catch (error: any) {
                                    console.log('parse error, got', reply.parseBody<WrappedV>());
                                    throw error;
                                }
                                break;
                            }

                            case RpcTypes.ResponseActionObservableError: {
                                const body = reply.parseBody<rpcResponseActionObservableSubscriptionError>();
                                const error = rpcDecodeError(body);
                                if (observable) {
                                    if (!subscribers[body.id]) return; //we silently ignore this
                                    subscribers[body.id].error(error);
                                } else if (observableSubject) {
                                    observableSubject.error(error);
                                }
                                break;
                            }

                            case RpcTypes.ResponseActionObservableComplete: {
                                const body = reply.parseBody<rpcActionObservableSubscribeId>();

                                if (observable) {
                                    if (!subscribers[body.id]) return; //we silently ignore this
                                    subscribers[body.id].complete();
                                } else if (observableSubject) {
                                    observableSubject.complete();
                                }
                                break;
                            }

                            case RpcTypes.ResponseActionObservableNext: {
                                if (!types.observableNextSchema) throw new Error('No observableNextSchema set');

                                const body = reply.parseBody<rpcActionObservableNext>(types.observableNextSchema);

                                if (observable) {
                                    if (!subscribers[body.id]) return; //we silently ignore this
                                    subscribers[body.id].next(body.v);
                                } else if (observableSubject) {
                                    observableSubject.next(body.v);
                                } else {
                                    firstObservableNext = body.v;
                                    firstObservableNextCalled = true;
                                }

                                break;
                            }

                            case RpcTypes.ResponseActionBehaviorSubject: {
                                if (!types.observableNextSchema) throw new Error('No observableNextSchema set');

                                const body = reply.parseBody<WrappedV>(types.observableNextSchema);
                                observableSubject = new BehaviorSubject(body.v);
                                resolve(observableSubject);
                                break;
                            }

                            case RpcTypes.ResponseActionObservable: {
                                if (observable) console.error('Already got ActionResponseObservable');
                                const body = reply.parseBody<rpcResponseActionObservable>();

                                //this observable can be subscribed multiple times now
                                // each time we need to call the server again, since its not a Subject
                                if (body.type === ActionObservableTypes.observable) {
                                    observable = new Observable((observer) => {
                                        const id = subscriberId++;
                                        subscribers[id] = observer;
                                        subject.send<rpcActionObservableSubscribeId>(RpcTypes.ActionObservableSubscribe, { id });

                                        return {
                                            unsubscribe: () => {
                                                delete subscribers[id];
                                                subject.send<rpcActionObservableSubscribeId>(RpcTypes.ActionObservableUnsubscribe, { id });
                                            }
                                        };
                                    });
                                    (observable as any).disconnect = () => {
                                        for (const sub of Object.values(subscribers)) {
                                            sub.complete();
                                        }
                                        subject.send(RpcTypes.ActionObservableDisconnect);
                                    };
                                    resolve(observable);
                                } else if (body.type === ActionObservableTypes.subject) {
                                    observableSubject = new Subject<any>();
                                    //we have to monkey patch unsubscribe, because they is no other way to hook into that
                                    // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
                                    observableSubject.unsubscribe = () => {
                                        Subject.prototype.unsubscribe.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };

                                    observableSubject.complete = () => {
                                        Subject.prototype.complete.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };

                                    if (firstObservableNextCalled) {
                                        observableSubject.next(firstObservableNext);
                                        firstObservableNext = undefined;
                                    }
                                    resolve(observableSubject);
                                } else if (body.type === ActionObservableTypes.behaviorSubject || body.type === ActionObservableTypes.progressTracker) {
                                    const classType = body.type === ActionObservableTypes.progressTracker ? ProgressTracker : BehaviorSubject;
                                    observableSubject = new classType(firstObservableNext);
                                    firstObservableNext = undefined;

                                    //we have to monkey patch unsubscribe, because there is no other way to hook into that
                                    // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
                                    observableSubject.unsubscribe = () => {
                                        Subject.prototype.unsubscribe.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };

                                    observableSubject.complete = () => {
                                        Subject.prototype.complete.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };

                                    if (observableSubject instanceof ProgressTracker) {
                                        //whenever the client changes something, it's synced back to the server.
                                        //this is important to handle the stop signal.
                                        const oldChanged = observableSubject.changed;
                                        observableSubject.changed = function (this: ProgressTracker) {
                                            subject.send(RpcTypes.ActionObservableProgressNext, this.value, typeOf<ProgressTrackerState[]>());
                                            return oldChanged.apply(this);
                                        };
                                    }

                                    resolve(observableSubject);
                                }

                                break;
                            }

                            case RpcTypes.ResponseActionCollectionChange: {
                                if (!collection) throw new Error('No collection loaded yet');
                                if (!types.collectionSchema) throw new Error('no collectionSchema loaded yet');
                                if (!collectionEntityStore) throw new Error('no collectionEntityStore loaded yet');

                                this.handleCollection(collectionEntityStore, types, collection, reply.getBodies());

                                break;
                            }

                            case RpcTypes.ResponseActionCollection: {
                                const bodies = reply.getBodies();

                                if (!types.classType) throw new Error('No classType returned by the rpc action');
                                if (!types.collectionQueryModel) throw new Error('No collectionQueryModel returned by the rpc action');
                                collection = new Collection(types.classType);
                                collectionEntityStore = this.entityState.getStore(types.classType);

                                collection.model.change.subscribe(() => {
                                    subject.send(RpcTypes.ActionCollectionModel, collection!.model, types.collectionQueryModel);
                                });

                                collection.addTeardown(() => {
                                    subject.send(RpcTypes.ActionCollectionUnsubscribe);
                                });

                                this.handleCollection(collectionEntityStore, types, collection, bodies);

                                resolve(collection);
                                break;
                            }

                            case RpcTypes.Error: {
                                subject.release();
                                const error = reply.getError();
                                // console.debug('Client received error', error);
                                reject(error);
                                break;
                            }

                            default: {
                                console.log(`Unexpected type received ${reply.type} ${RpcTypes[reply.type]}`);
                            }
                        }
                    } catch (error) {
                        console.warn('reply error', reply.id, RpcTypes[reply.type], error);
                        reject(`Reply failed for ${controller.controller}.${method}: ${error}`);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    protected handleCollection(entityStore: EntitySubjectStore<any>, types: ControllerStateActionTypes, collection: Collection<any>, messages: RpcMessage[]) {
        for (const next of messages) {
            switch (next.type) {
                case RpcTypes.ResponseActionCollectionState: {
                    const state = next.parseBody<CollectionState>();
                    collection.setState(state);
                    break;
                }

                case RpcTypes.ResponseActionCollectionSort: {
                    const body = next.parseBody<rpcResponseActionCollectionSort>();
                    collection.setSort(body.ids);
                    break;
                }

                case RpcTypes.ResponseActionCollectionModel: {
                    if (!types.collectionQueryModel) throw new Error('No collectionQueryModel set');
                    collection.model.set(next.parseBody(types.collectionQueryModel));
                    break;
                }

                case RpcTypes.ResponseActionCollectionUpdate:
                case RpcTypes.ResponseActionCollectionAdd: {
                    if (!types.collectionSchema) continue;
                    const incomingItems = next.parseBody<WrappedV>(types.collectionSchema).v as IdInterface[];
                    const items: IdInterface[] = [];

                    for (const item of incomingItems) {
                        if (!entityStore.isRegistered(item.id)) entityStore.register(item);
                        if (next.type === RpcTypes.ResponseActionCollectionUpdate) {
                            entityStore.onSet(item.id, item);
                        }

                        let fork = collection.entitySubjects.get(item.id);
                        if (!fork) {
                            fork = entityStore.createFork(item.id);
                            collection.entitySubjects.set(item.id, fork);
                        }
                        items.push(fork.value);

                        //fork is automatically unsubscribed once removed from the collection
                        fork.pipe(skip(1)).subscribe(i => {
                            if (fork!.deleted) return; //we get deleted already
                            collection.deepChange.next(i);
                            collection.loaded();
                        });
                    }

                    if (next.type === RpcTypes.ResponseActionCollectionAdd) {
                        collection.add(items);
                    } else if (next.type === RpcTypes.ResponseActionCollectionUpdate) {
                        collection.update(items);
                    }
                    break;
                }

                case RpcTypes.ResponseActionCollectionRemove: {
                    const ids = next.parseBody<rpcResponseActionCollectionRemove>().ids;
                    collection.remove(ids); //this unsubscribes its EntitySubject as well
                    break;
                }

                case RpcTypes.ResponseActionCollectionSet: {
                    if (!types.collectionSchema) continue;
                    const incomingItems = next.parseBody<WrappedV>(types.collectionSchema).v as IdInterface[];
                    const items: IdInterface[] = [];
                    for (const item of incomingItems) {
                        if (!entityStore.isRegistered(item.id)) entityStore.register(item);
                        const fork = entityStore.createFork(item.id);
                        collection.entitySubjects.set(item.id, fork);
                        items.push(fork.value);

                        //fork is automatically unsubscribed once removed from the collection
                        fork.pipe(skip(1)).subscribe(i => {
                            if (fork.deleted) return; //we get deleted already
                            collection.deepChange.next(i);
                            collection.loaded();
                        });
                    }

                    collection.set(items);
                    break;
                }
            }
        }
        collection.loaded();
    }

    public async loadActionTypes(controller: RpcControllerState, method: string, options: {
        timeout?: number,
        dontWaitForConnection?: true,
        typeReuseDisabled?: boolean
    } = {}): Promise<ControllerStateActionTypes> {
        const state = controller.getState(method);
        if (state.types) return state.types;

        const typeReuseDisabled = options ? options.typeReuseDisabled === true : false;

        if (state.promise) {
            return state.promise;
        }

        state.promise = asyncOperation<ControllerStateActionTypes>(async (resolve, reject) => {
            try {
                const a = this.client.sendMessage<rpcActionType>(RpcTypes.ActionType, {
                    controller: controller.controller,
                    method: method,
                    disableTypeReuse: typeReuseDisabled
                }, undefined, {
                    peerId: controller.peerId,
                    dontWaitForConnection: options.dontWaitForConnection,
                    timeout: options.timeout,
                });

                const parsed = await a.firstThenClose<rpcResponseActionType>(RpcTypes.ResponseActionType, typeOf<rpcResponseActionType>());

                const returnType = deserializeType(parsed.type, { disableReuse: typeReuseDisabled });

                let observableNextSchema: TypeObjectLiteral | undefined;
                let collectionSchema: Type | undefined;
                let collectionQueryModel: Type | undefined;
                let unwrappedReturnType = returnType;
                if (unwrappedReturnType.kind === ReflectionKind.promise) unwrappedReturnType = unwrappedReturnType.type;
                const classType: ClassType | undefined = unwrappedReturnType.kind === ReflectionKind.class ? unwrappedReturnType.classType : undefined;

                const parameters: Type = deserializeType(parsed.parameters);
                assertType(parameters, ReflectionKind.tuple);

                if (parsed.mode === 'observable') {
                    observableNextSchema = {
                        kind: ReflectionKind.objectLiteral,
                        types: [
                            { kind: ReflectionKind.propertySignature, name: 'id', type: { kind: ReflectionKind.number } },
                            { kind: ReflectionKind.propertySignature, name: 'v', type: unwrappedReturnType },
                        ]
                    } as TypeObjectLiteral;
                } else if (parsed.mode === 'entitySubject') {
                } else if (parsed.mode === 'collection') {
                    collectionQueryModel = typeOf<CollectionQueryModelInterface<unknown>>([unwrappedReturnType]) as TypeObjectLiteral;
                    collectionSchema = {
                        kind: ReflectionKind.objectLiteral,
                        types: [{
                            kind: ReflectionKind.propertySignature,
                            name: 'v',
                            parent: Object as any,
                            optional: true,
                            type: { kind: ReflectionKind.array, type: unwrappedReturnType }
                        }]
                    };
                }

                state.types = {
                    classType,
                    collectionQueryModel,
                    collectionSchema,
                    callSchema: {
                        kind: ReflectionKind.objectLiteral,
                        types: [
                            { kind: ReflectionKind.propertySignature, name: 'controller', type: { kind: ReflectionKind.string } },
                            { kind: ReflectionKind.propertySignature, name: 'method', type: { kind: ReflectionKind.string } },
                            { kind: ReflectionKind.propertySignature, name: 'args', type: parameters },
                        ]
                    } as TypeObjectLiteral,
                    resultSchema: {
                        kind: ReflectionKind.objectLiteral,
                        types: [
                            { kind: ReflectionKind.propertySignature, name: 'v', type: unwrappedReturnType },
                        ]
                    } as TypeObjectLiteral,
                    observableNextSchema,
                };

                resolve(state.types);
            } catch (error) {
                reject(error);
            }
        });

        try {
            return await state.promise;
        } catch (error) {
            state.promise = undefined;
            throw error;
        }
    }

}
