/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { toFastProperties } from '@deepkit/core';
import { ClassSchema, createClassSchema, getClassSchema, getXToClassFunction, jsonSerializer, PropertySchema, t } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, Subscriber } from 'rxjs';
import { Collection, CollectionState } from '../collection';
import { ActionObservableTypes, IdInterface, rpcAction, rpcActionObservableSubscribeId, rpcActionType, rpcResponseActionCollectionModel, rpcResponseActionCollectionRemove, rpcResponseActionObservable, rpcResponseActionObservableSubscriptionError, rpcResponseActionType, RpcTypes } from '../model';
import { rpcDecodeError, RpcMessage } from '../protocol';
import { RpcClient } from './client';
import { EntityState, EntitySubjectStore } from './entity-state';

type ControllerStateActionTypes = {
    parameters: string[],
    parameterSchema: ClassSchema,
    resultSchema: ClassSchema<{ v?: any }>,
    resultProperty: PropertySchema,
    resultDecoder: (value: any) => any,
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

export class RpcActionClient {
    protected entityState = new EntityState;

    constructor(protected client: RpcClient) {
    }

    public action<T>(controller: RpcControllerState, method: string, args: any[], recipient?: string) {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const types = controller.getState(method)?.types || await this.loadActionTypes(controller, method);
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

                const subject = this.client.sendMessage(RpcTypes.Action, types.parameterSchema, {
                    controller: controller.controller,
                    method: method,
                    args: argsObject
                }, { peerId: controller.peerId }).onReply((reply) => {
                    // console.log('answer', RpcTypes[reply.type]);

                    switch (reply.type) {
                        case RpcTypes.ResponseEntity:
                            resolve(this.entityState.createEntitySubject(types.resultProperty.getResolvedClassSchema(), types.resultSchema, reply));

                            break;

                        case RpcTypes.Entity:
                            this.entityState.handle(reply);
                            break;

                        case RpcTypes.ResponseActionSimple: {
                            subject.release();
                            const result = reply.parseBody(types.resultSchema);
                            resolve(result.v);
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
                                    }
                                });
                                resolve(observable);
                            } else if (body.type === ActionObservableTypes.subject) {
                                observableSubject = new Subject<any>();
                                observableSubject.subscribe().add(() => {
                                    subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                });
                                if (firstObservableNextCalled) {
                                    observableSubject.next(firstObservableNext);
                                    firstObservableNext = undefined;
                                }
                                resolve(observableSubject);
                            } else if (body.type === ActionObservableTypes.behaviorSubject) {
                                observableSubject = new BehaviorSubject<any>(firstObservableNext);
                                firstObservableNext = undefined;
                                observableSubject.subscribe().add(() => {
                                    subject.send(RpcTypes.ActionObservableSubjectUnsubscribe);
                                });
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
                            if (!types.collectionSchema) {
                                types.collectionSchema = createClassSchema();
                                const v = new PropertySchema('v');
                                v.setType('array');
                                v.templateArgs.push(types.resultSchema.getProperty('v'));
                                types.collectionSchema.registerProperty(v);
                            }

                            const classType = types.resultProperty.classType!;
                            collection = new Collection(classType);
                            collectionEntityStore = this.entityState.getStore(classType);

                            collection.addTeardown(() => {
                                subject.send(RpcTypes.ResponseActionCollectionUnsubscribe);
                            });

                            this.handleCollection(collectionEntityStore, types, collection, reply.getBodies());

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
                            console.log(`Unexpected type received ${reply.type}`);
                        }
                    };
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

                case RpcTypes.ResponseActionCollectionModel: {
                    collection.model = next.parseBody(rpcResponseActionCollectionModel).model;
                    break;
                }

                case RpcTypes.ResponseActionCollectionAdd: {
                    if (!types.collectionSchema) continue;
                    const incomingItems = next.parseBody(types.collectionSchema).v as IdInterface[];
                    const items: IdInterface[] = [];

                    for (const item of incomingItems) {
                        if (!entityStore.isRegistered(item.id)) entityStore.register(item);
                        const fork = entityStore.createFork(item.id);
                        collection.entitySubjects.set(item.id, fork);
                        items.push(fork.value);
                    }

                    collection.add(items);
                    break;
                }

                case RpcTypes.ResponseActionCollectionRemove: {
                    //todo, use entity-state
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
                    }

                    collection.set(items);
                    break;
                }

                case RpcTypes.ResponseActionCollectionState: {
                    const state = next.parseBody(getClassSchema(CollectionState));
                    collection.setState(state);
                    break;
                }
            }
        }
        collection.loaded();
    }

    public loadActionTypes(controller: RpcControllerState, method: string): ControllerStateActionTypes | Promise<ControllerStateActionTypes> {
        const state = controller.getState(method);
        if (state.types) return state.types;

        if (state.promise) {
            return state.promise;
        }

        state.promise = new Promise<ControllerStateActionTypes>(async (resolve, reject) => {
            try {
                const parsed = await this.client.sendMessage(RpcTypes.ActionType, rpcActionType, {
                    controller: controller.controller,
                    method: method,
                }, { peerId: controller.peerId }).firstThenClose(RpcTypes.ResponseActionType, rpcResponseActionType);

                const parameters: string[] = [];
                const argsSchema = createClassSchema();
                for (const property of parsed.parameters) {
                    argsSchema.registerProperty(PropertySchema.fromJSON(property));
                    parameters.push(property.name);
                }

                const resultSchema = createClassSchema();
                const resultProperty = PropertySchema.fromJSON(parsed.result);
                resultProperty.name = 'v';
                resultSchema.registerProperty(resultProperty);

                const observableNextSchema = rpcActionObservableSubscribeId.clone();
                observableNextSchema.registerProperty(resultProperty);

                state.types = {
                    parameters: parameters,
                    parameterSchema: rpcAction.extend({ args: t.type(argsSchema) }),
                    resultDecoder: getXToClassFunction(resultSchema, jsonSerializer),
                    resultProperty,
                    resultSchema,
                    observableNextSchema,
                };

                resolve(state.types);
            } catch (error) {
                reject(error);
            }
        });

        return state.promise;
    }

}
