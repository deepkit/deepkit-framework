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
import { ClassSchema, createClassSchema, getXToClassFunction, jsonSerializer, PropertySchema, t } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, Subscriber } from 'rxjs';
import { rpcDecodeError } from '../protocol';
import { ActionObservableTypes, rpcAction, rpcActionObservableSubscribeId, rpcActionType, rpcActionTypeResponse, rpcResponseActionObservable, rpcResponseActionObservableSubscriptionError, RpcTypes } from '../model';
import { RpcClient } from './client';

type ControllerStateActionTypes = {
    parameters: string[],
    parameterSchema: ClassSchema,
    resultSchema: ClassSchema<{ v: any }>,
    resultProperty: PropertySchema,
    resultDecoder: (value: any) => any,
    observableNextSchema: ClassSchema<{ id: number, v: any }>
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

function decodeValue(types: ControllerStateActionTypes, result: { v: any }): any {
    const type = types.resultProperty.type;

    if (type === 'string' || type === 'number' || type === 'boolean') {
        return result.v;
    } else {
        //everything else needs full jsonSerialize
        return types.resultDecoder(result).v;
    }
}

export class RpcActionClient {
    constructor(protected client: RpcClient) {
    }

    public action<T>(controller: RpcControllerState, method: string, args: any[], recipient?: string) {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const types = controller.getState(method)?.types || await this.loadActionTypes(controller, method);

                const argsObject: any = {};

                for (let i = 0; i < args.length; i++) {
                    argsObject[types.parameters[i]] = args[i];
                }

                let observable: Observable<any> | undefined;
                let observableSubject: Subject<any> | undefined;

                //necessary for BehaviorSubject, since we get ObservableNext before the Observable type call
                let firstObservableNextCalled = false;
                let firstObservableNext: any; 

                let subscriberId = 0;
                const subscribers: { [id: number]: Subscriber<any> } = {};

                const subject = this.client.sendMessage(RpcTypes.Action, types.parameterSchema, {
                    controller: controller.controller,
                    method: method,
                    args: argsObject
                }, { peerId: controller.peerId }).onReply((next) => {
                    // console.log('answer', RpcTypes[next.type]);

                    switch (next.type) {
                        case RpcTypes.ActionResponseSimple: {
                            subject.release();
                            const result = next.parseBody(types.resultSchema);
                            resolve(decodeValue(types, result));
                            break;
                        }

                        case RpcTypes.ActionResponseObservableError: {
                            const body = next.parseBody(rpcResponseActionObservableSubscriptionError);
                            const error = rpcDecodeError(body);
                            if (observable) {
                                if (!subscribers[body.id]) return; //we silently ignore this
                                subscribers[body.id].error(error);
                            } else if (observableSubject) {
                                observableSubject.error(error);
                            }
                            break;
                        }

                        case RpcTypes.ActionResponseObservableComplete: {
                            const body = next.parseBody(rpcActionObservableSubscribeId);

                            if (observable) {
                                if (!subscribers[body.id]) return; //we silently ignore this
                                subscribers[body.id].complete();
                            } else if (observableSubject) {
                                observableSubject.complete();
                            }
                            break;
                        }

                        case RpcTypes.ActionResponseObservableNext: {
                            const body = next.parseBody(types.observableNextSchema);
                            const value = decodeValue(types, body);

                            if (observable) {
                                if (!subscribers[body.id]) return; //we silently ignore this
                                subscribers[body.id].next(value);
                            } else if (observableSubject) {
                                observableSubject.next(value);
                            } else {
                                firstObservableNext = value;
                                firstObservableNextCalled = true;
                            }

                            break;
                        }

                        case RpcTypes.ActionResponseBehaviorSubject: {
                            const body = next.parseBody(types.observableNextSchema);
                            const value = decodeValue(types, body);
                            observableSubject = new BehaviorSubject(value);
                            resolve(observableSubject);
                            break;
                        }

                        case RpcTypes.ActionResponseObservable: {
                            if (observable) console.error('Already got ActionResponseObservable');
                            const body = next.parseBody(rpcResponseActionObservable);

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

                        case RpcTypes.Error: {
                            subject.release();
                            const error = next.getError();
                            console.debug('Client received error', error);
                            reject(error);
                            break;
                        }

                        default: {
                            console.log(`Unexpected type received ${next.type}`);
                        }
                    };
                });
            } catch (error) {
                reject(error);
            }
        });
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
                }, { peerId: controller.peerId }).firstThenClose(RpcTypes.ActionTypeResponse, rpcActionTypeResponse);

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
