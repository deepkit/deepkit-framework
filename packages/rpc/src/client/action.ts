/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation, toFastProperties } from '@deepkit/core';
import { ClassSchema, createClassSchema, getClassSchema, propertyDefinition, PropertySchema, PropertySchemaSerialized } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, Subscriber } from 'rxjs';
import { skip } from 'rxjs/operators';
import { Collection, CollectionQueryModel, CollectionState } from '../collection';
import {
    ActionObservableTypes,
    IdInterface,
    rpcAction,
    rpcActionObservableSubscribeId,
    rpcActionType,
    rpcResponseActionCollectionRemove,
    rpcResponseActionCollectionSort,
    rpcResponseActionObservable,
    rpcResponseActionObservableSubscriptionError,
    rpcResponseActionType,
    RpcTypes
} from '../model';
import { rpcDecodeError, RpcMessage } from '../protocol';
import { ClientProgress } from '../writer';
import type { WritableClient } from './client';
import { EntityState, EntitySubjectStore } from './entity-state';

type ControllerStateActionTypes = {
    parameters: string[],
    parameterSchema: ClassSchema,
    resultSchema: ClassSchema<{ v?: any }>,
    resultProperty: PropertySchema,
    observableNextSchema: ClassSchema<{ id: number, v: any }>
    collectionSchema?: ClassSchema<{ v: any[] }>
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

function setReturnType(types: ControllerStateActionTypes, prop: PropertySchemaSerialized) {
    const resultProperty = PropertySchema.fromJSON(prop);
    resultProperty.name = 'v';
    const resultSchema = createClassSchema();
    resultSchema.registerProperty(resultProperty);
    types.resultProperty = resultProperty;
    types.resultSchema = resultSchema;

    types.collectionSchema = createClassSchema();
    const v = new PropertySchema('v');
    v.setType('array');
    v.templateArgs.push(resultProperty);
    types.collectionSchema.registerProperty(v);

    const observableNextSchema = rpcActionObservableSubscribeId.clone();
    observableNextSchema.registerProperty(resultProperty);
    types.observableNextSchema = observableNextSchema;
}

export class RpcActionClient {
    public entityState = new EntityState;

    constructor(protected client: WritableClient) {
    }

    public action<T>(controller: RpcControllerState, method: string, args: any[], options: { timeout?: number, dontWaitForConnection?: true } = {}) {
        return asyncOperation<any>(async (resolve, reject) => {
            try {
                const progress = ClientProgress.getNext();
                const types = controller.getState(method)?.types || await this.loadActionTypes(controller, method, options);
                // console.log('client types', types.parameterSchema.getProperty('args').getResolvedClassSchema().toString(), )

                const argsObject: any = {};

                for (let i = 0; i < args.length; i++) {
                    argsObject[types.parameters[i]] = args[i];
                }

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

                const subject = this.client.sendMessage(RpcTypes.Action, types.parameterSchema, {
                    controller: controller.controller,
                    method: method,
                    args: argsObject
                }, {
                    peerId: controller.peerId,
                    dontWaitForConnection: options.dontWaitForConnection,
                    timeout: options.timeout,
                }).onReply((reply) => {
                    try {
                        // console.log('client: answer', RpcTypes[reply.type], reply.composite);

                        if (reply.type === RpcTypes.ResponseActionResult) {
                            const bodies = reply.getBodies();
                            if (bodies.length === 2) {
                                //we got returnType
                                if (bodies[0].type !== RpcTypes.ResponseActionReturnType) return reject(new Error('RpcTypes.ResponseActionResult should contain as first body RpcTypes.ResponseActionReturnType'));
                                setReturnType(types, bodies[0].parseBody(propertyDefinition));
                                reply = bodies[1];
                            } else {
                                reply = bodies[0];
                            }
                        }

                        switch (reply.type) {
                            case RpcTypes.ResponseEntity: {
                                resolve(this.entityState.createEntitySubject(types.resultProperty.getResolvedClassSchema(), types.resultSchema, reply));
                                break;
                            }

                            case RpcTypes.ResponseActionSimple: {
                                subject.release();
                                const result = reply.parseBody(types.resultSchema);
                                resolve(result.v);
                                break;
                            }

                            case RpcTypes.ResponseActionReturnType: {
                                setReturnType(types, reply.parseBody(propertyDefinition));
                                break;
                            }

                            case RpcTypes.ResponseActionObservableError: {
                                const body = reply.parseBody(rpcResponseActionObservableSubscriptionError);
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
                                const body = reply.parseBody(rpcActionObservableSubscribeId);

                                if (observable) {
                                    if (!subscribers[body.id]) return; //we silently ignore this
                                    subscribers[body.id].complete();
                                } else if (observableSubject) {
                                    observableSubject.complete();
                                }
                                break;
                            }

                            case RpcTypes.ResponseActionObservableNext: {
                                const body = reply.parseBody(types.observableNextSchema);

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
                                const body = reply.parseBody(types.observableNextSchema);
                                observableSubject = new BehaviorSubject(body.v);
                                resolve(observableSubject);
                                break;
                            }

                            case RpcTypes.ResponseActionObservable: {
                                if (observable) console.error('Already got ActionResponseObservable');
                                const body = reply.parseBody(rpcResponseActionObservable);

                                //this observable can be subscribed multiple times now
                                // each time we need to call the server again, since its not a Subject
                                if (body.type === ActionObservableTypes.observable) {
                                    observable = new Observable((observer) => {
                                        const id = subscriberId++;
                                        subscribers[id] = observer;
                                        subject.send(RpcTypes.ActionObservableSubscribe, rpcActionObservableSubscribeId, { id });

                                        return {
                                            unsubscribe: () => {
                                                delete subscribers[id];
                                                subject.send(RpcTypes.ActionObservableUnsubscribe, rpcActionObservableSubscribeId, { id });
                                            }
                                        };
                                    });
                                    resolve(observable);
                                } else if (body.type === ActionObservableTypes.subject) {
                                    observableSubject = new Subject<any>();
                                    //we have to monkey patch unsubscribe, because they is no other way to hook into that
                                    // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
                                    observableSubject.unsubscribe = () => {
                                        Subject.prototype.unsubscribe.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };

                                    if (firstObservableNextCalled) {
                                        observableSubject.next(firstObservableNext);
                                        firstObservableNext = undefined;
                                    }
                                    resolve(observableSubject);
                                } else if (body.type === ActionObservableTypes.behaviorSubject) {
                                    observableSubject = new BehaviorSubject<any>(firstObservableNext);
                                    firstObservableNext = undefined;

                                    //we have to monkey patch unsubscribe, because they is no other way to hook into that
                                    // note: subject.subscribe().add(T), T is not called when subject.unsubscribe() is called.
                                    observableSubject.unsubscribe = () => {
                                        Subject.prototype.unsubscribe.call(observableSubject);
                                        subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                    };
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

                                if (bodies[0].type === RpcTypes.ResponseActionReturnType) {
                                    setReturnType(types, bodies[0].parseBody(propertyDefinition));
                                }

                                const classType = types.resultProperty.getResolvedClassType();
                                collection = new Collection(classType);
                                collectionEntityStore = this.entityState.getStore(classType);

                                collection.model.change.subscribe(() => {
                                    subject.send(RpcTypes.ActionCollectionModel, getClassSchema(CollectionQueryModel), collection!.model);
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
                        reject(error);
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
                    const state = next.parseBody(getClassSchema(CollectionState));
                    collection.setState(state);
                    break;
                }

                case RpcTypes.ResponseActionCollectionSort: {
                    const body = next.parseBody(rpcResponseActionCollectionSort);
                    collection.setSort(body.ids);
                    break;
                }

                case RpcTypes.ResponseActionCollectionModel: {
                    collection.model.set(next.parseBody(getClassSchema(CollectionQueryModel)));
                    break;
                }

                case RpcTypes.ResponseActionCollectionUpdate:
                case RpcTypes.ResponseActionCollectionAdd: {
                    if (!types.collectionSchema) continue;
                    const incomingItems = next.parseBody(types.collectionSchema).v as IdInterface[];
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
                    const ids = next.parseBody(rpcResponseActionCollectionRemove).ids;
                    collection.remove(ids); //this unsubscribes its EntitySubject as well
                    break;
                }

                case RpcTypes.ResponseActionCollectionSet: {
                    if (!types.collectionSchema) continue;
                    const incomingItems = next.parseBody(types.collectionSchema).v as IdInterface[];
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

    public async loadActionTypes(controller: RpcControllerState, method: string, options: { timeout?: number, dontWaitForConnection?: true } = {}): Promise<ControllerStateActionTypes> {
        const state = controller.getState(method);
        if (state.types) return state.types;

        if (state.promise) {
            return state.promise;
        }

        state.promise = asyncOperation<ControllerStateActionTypes>(async (resolve, reject) => {
            try {
                const parsed = await this.client.sendMessage(RpcTypes.ActionType, rpcActionType, {
                    controller: controller.controller,
                    method: method,
                }, {
                    peerId: controller.peerId,
                    dontWaitForConnection: options.dontWaitForConnection,
                    timeout: options.timeout,
                }).firstThenClose(RpcTypes.ResponseActionType, rpcResponseActionType);

                const parameters: string[] = [];
                const argsSchema = createClassSchema();
                for (const propertyJson of parsed.parameters) {
                    const property = PropertySchema.fromJSON(propertyJson);
                    argsSchema.registerProperty(property);
                    parameters.push(propertyJson.name);
                }

                const resultProperty = PropertySchema.fromJSON(parsed.result);
                resultProperty.name = 'v';
                const resultSchema = createClassSchema();
                resultSchema.registerProperty(resultProperty);

                const observableNextSchema = rpcActionObservableSubscribeId.clone();
                observableNextSchema.registerProperty(resultProperty);

                const collectionSchema = createClassSchema();
                const v = new PropertySchema('v');
                v.setType('array');
                v.templateArgs.push(resultProperty);
                collectionSchema.registerProperty(v);

                state.types = {
                    parameters: parameters,
                    parameterSchema: rpcAction.extend({ args: argsSchema }),
                    resultProperty,
                    resultSchema,
                    observableNextSchema,
                    collectionSchema,
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
