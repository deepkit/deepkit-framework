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

import { ClassType, getClassName, getClassPropertyName, isPrototypeOfBase, toFastProperties } from '@deepkit/core';
import { ClassSchema, createClassSchema, getClassSchema, getXToClassFunction, jitValidate, jsonSerializer, PropertySchema, t, ValidationFailedItem } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { Collection } from '../collection';
import { getActionParameters, getActions } from '../decorators';
import { ActionObservableTypes, rpcActionObservableSubscribeId, rpcActionType, RpcInjector, rpcResponseActionCollection, rpcResponseActionObservable, rpcResponseActionObservableSubscriptionError, rpcResponseActionType, RpcTypes, ValidationError } from '../model';
import { rpcEncodeError, RpcMessage } from '../protocol';
import { RpcResponse } from './kernel';

export type ActionTypes = {
    parameters: PropertySchema[],
    parameterSchema: ClassSchema,
    resultSchema: ClassSchema,
    parametersDeserialize: (value: any) => any,
    parametersValidate: (value: any, path?: string, errors?: ValidationFailedItem[]) => ValidationFailedItem[],
    observableNextSchema: ClassSchema,
    collectionSchema?: ClassSchema,
};

export class RpcServerAction {
    protected cachedActionsTypes: { [id: string]: ActionTypes } = {};
    protected observableSubjects: {
        [id: number]: {
            subscription: Subscription
        }
    } = {};

    protected observables: {
        [id: number]: {
            observable: Observable<any>,
            subscriptions: { [id: number]: { sub?: Subscription, active: boolean } },
            observableNextSchema: ClassSchema<{ id: number, v: any }>,
        }
    } = {};

    constructor(
        protected controllers: Map<string, ClassType>,
        protected injector: RpcInjector,
    ) {
    }

    public async handleActionTypes(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcActionType);
        const types = this.loadTypes(body.controller, body.method);

        response.reply(RpcTypes.ResponseActionType, rpcResponseActionType, {
            parameters: types.parameters.map(v => v.toJSON()),
            result: types.resultSchema.getProperty('v').toJSON(),
        });
    }

    protected loadTypes(controller: string, method: string) {
        const cacheId = controller + '!' + method;
        let types = this.cachedActionsTypes[cacheId];
        if (types) return types;

        const classType = this.controllers.get(controller);
        if (!classType) {
            throw new Error(`No controller registered for id ${controller}`);
        }

        //todo: implement again
        // const access = await this.security.hasAccess(this.sessionStack.getSessionOrUndefined(), classType, message.method);
        // if (!access) {
        //     throw new Error(`Access denied to action ` + action);
        // }

        const actions = getActions(classType);

        if (!actions.has(method)) {
            throw new Error(`Action unknown ${method}`);
        }

        const parameters = getActionParameters(classType, method);

        const argSchema = createClassSchema();
        for (let i = 0; i < parameters.length; i++) {
            argSchema.registerProperty(parameters[i]);
        }

        const resultSchema = createClassSchema();
        let resultProperty = getClassSchema(classType).getMethod(method).clone();

        let observableNextSchema: ClassSchema | undefined;
        if (resultProperty.classType && (isPrototypeOfBase(resultProperty.classType, Observable) || isPrototypeOfBase(resultProperty.classType, Collection))) {
            const generic = resultProperty.templateArgs[0];

            if (!generic) {
                //we need to change that to any
                const className = getClassName(resultProperty.classType);
                throw new Error(`Your method ${getClassPropertyName(classType, method)} returns ${className} and you have not specified a generic type using @t.generic() decorator. ` +
                    `Please define the generic type of your ${className}<T>, e.g. @t.generic(T), where T is your actual type. Any is now used, which is much slower to serialize and produces no class instances.` +
                    `\nExample:` +
                    `\n   @t.generic(t.string)` +
                    `\n   ${method}(): ${className}<string> {}` +
                    `\n   @t.generic(MyModel)` +
                    `\n   ${method}(): ${className}<MyModel> {}`
                );
            }
            resultProperty = generic.clone();
        }

        resultProperty.name = 'v';

        observableNextSchema = rpcActionObservableSubscribeId.clone();
        observableNextSchema.registerProperty(resultProperty);

        resultSchema.registerProperty(resultProperty);

        types = this.cachedActionsTypes[cacheId] = {
            parameters: parameters,
            parameterSchema: t.schema({ args: argSchema }),
            resultSchema: resultSchema,
            parametersDeserialize: getXToClassFunction(argSchema, jsonSerializer),
            parametersValidate: jitValidate(argSchema),
            observableNextSchema
        }
        toFastProperties(this.cachedActionsTypes);

        return types;
    }

    public async handle(message: RpcMessage, response: RpcResponse) {
        if (message.type === RpcTypes.ActionObservableSubscribe) {
            const observable = this.observables[message.id];
            if (!observable) return response.error(new Error('No observable found'));
            const body = message.parseBody(rpcActionObservableSubscribeId);
            if (observable.subscriptions[body.id]) return response.error(new Error('Subscription already created'));

            const sub: { active: boolean, sub?: Subscription } = { active: true };
            observable.subscriptions[body.id] = sub;

            sub.sub = observable.observable.subscribe((next) => {
                if (!sub.active) return;
                response.reply(RpcTypes.ResponseActionObservableNext, observable.observableNextSchema, {
                    id: body.id,
                    v: next
                });
            }, (error) => {
                const extracted = rpcEncodeError(error);
                response.reply(RpcTypes.ResponseActionObservableError, rpcResponseActionObservableSubscriptionError, { ...extracted, id: body.id });
            }, () => {
                response.reply(RpcTypes.ResponseActionObservableComplete, rpcActionObservableSubscribeId, {
                    id: body.id
                });
            });
        }

        if (message.type === RpcTypes.ActionObservableUnsubscribe) {
            const observable = this.observables[message.id];
            if (!observable) return response.error(new Error('No observable found'));
            const body = message.parseBody(rpcActionObservableSubscribeId);
            const sub = observable.subscriptions[body.id];
            if (!sub) return response.error(new Error('No subscription found'));
            sub.active = false;
            if (sub.sub) {
                sub.sub.unsubscribe();
            }
            delete observable.subscriptions[body.id];
        }

        if (message.type === RpcTypes.ActionObservableSubjectUnsubscribe) {
            const subject = this.observableSubjects[message.id];
            if (!subject) return response.error(new Error('No observable found'));
            subject.subscription.unsubscribe();
        }
    }

    public async handleAction(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcActionType);

        const classType = this.controllers.get(body.controller);
        if (!classType) throw new Error(`No controller registered for id ${body.controller}`);

        const types = this.loadTypes(body.controller, body.method);
        const value = message.parseBody(types.parameterSchema);

        const controller = this.injector.get(classType);
        const converted = types.parametersDeserialize(value.args);
        const errors = types.parametersValidate(converted);

        if (errors.length) {
            return response.error(new ValidationError(errors));
        }

        try {
            const result = await controller[body.method](...Object.values(converted));

            //todo: handle collection, observable, EntitySubject.
            if (result instanceof Collection) {
                const collection = result;

                //send it's a collection
                //send its items, T (which can be sent again)
                //send its parameters, T (which can be sent again)
                //----
                // event: addEntity, item: T
                // event: removeEntity, id: (number | string)[]
                // event: sort, id[]: number | string

                if (!types.collectionSchema) {
                    types.collectionSchema = createClassSchema();
                    const v = new PropertySchema('v');
                    v.setType('array');
                    v.templateArgs.push(types.resultSchema.getProperty('v'));
                    types.collectionSchema.registerProperty(v);
                }

                response.replyComposite([
                    {
                        type: RpcTypes.ResponseActionCollection, 
                        schema: rpcResponseActionCollection, 
                        body: {
                            active: collection.pagination.isActive(),
                            itemsPerPage: collection.pagination.getItemsPerPage(),
                            page: collection.pagination.getPage(),
                            total: collection.pagination.getTotal(),
                            sort: collection.pagination.getSort(),
                            parameters: collection.pagination.getParameters(),
                        }
                    },
                    {
                        type: RpcTypes.ResponseActionCollectionSet, 
                        schema: types.collectionSchema, 
                        body: {
                            v: collection.all(),
                        }
                    }
                ]);
                // response.reply(RpcTypes.ResponseActionCollection, rpcResponseActionCollection, {
                //     active: collection.pagination.isActive(),
                //     itemsPerPage: collection.pagination.getItemsPerPage(),
                //     page: collection.pagination.getPage(),
                //     total: collection.pagination.getTotal(),
                //     sort: collection.pagination.getSort(),
                //     parameters: collection.pagination.getParameters(),
                // });
            } else if (result instanceof Observable) {
                this.observables[message.id] = { observable: result, subscriptions: {}, observableNextSchema: types.observableNextSchema };

                let type: ActionObservableTypes = ActionObservableTypes.observable;
                if (result instanceof Subject) {
                    type = ActionObservableTypes.subject;

                    this.observableSubjects[message.id] = {
                        subscription: result.subscribe((next) => {
                            response.reply(RpcTypes.ResponseActionObservableNext, types.observableNextSchema, {
                                id: message.id,
                                v: next
                            });
                        }, (error) => {
                            const extracted = rpcEncodeError(error);
                            response.reply(RpcTypes.ResponseActionObservableError, rpcResponseActionObservableSubscriptionError, { ...extracted, id: message.id });
                        }, () => {
                            response.reply(RpcTypes.ResponseActionObservableComplete, rpcActionObservableSubscribeId, {
                                id: message.id
                            });
                        })
                    };

                    if (result instanceof BehaviorSubject) {
                        type = ActionObservableTypes.behaviorSubject;
                    }
                }

                response.reply(RpcTypes.ResponseActionObservable, rpcResponseActionObservable, { type });
            } else {
                response.reply(RpcTypes.ResponseActionSimple, types.resultSchema, { v: result });
            }
        } catch (error) {
            response.error(error);
        }
    }
}
