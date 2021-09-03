/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    ClassType,
    collectForMicrotask,
    getClassName,
    getClassPropertyName,
    isArray,
    isPlainObject,
    isPrototypeOfBase,
    stringifyValueWithType,
    toFastProperties
} from '@deepkit/core';
import { isBehaviorSubject, isSubject } from '@deepkit/core-rxjs';
import {
    ClassSchema,
    createClassSchema,
    getClassSchema,
    getXToClassFunction,
    jitValidate,
    jsonSerializer,
    propertyDefinition,
    PropertySchema,
    t,
    ValidationFailedItem
} from '@deepkit/type';
import { isObservable, Observable, Subject, Subscription } from 'rxjs';
import { Collection, CollectionEvent, CollectionQueryModel, CollectionState, isCollection } from '../collection';
import { getActionParameters, getActions } from '../decorators';
import {
    ActionObservableTypes,
    EntitySubject,
    isEntitySubject,
    rpcActionObservableSubscribeId,
    rpcActionType,
    rpcResponseActionCollectionRemove,
    rpcResponseActionCollectionSort,
    rpcResponseActionObservable,
    rpcResponseActionObservableSubscriptionError,
    rpcResponseActionType,
    RpcTypes,
    ValidationError
} from '../model';
import { rpcEncodeError, RpcMessage } from '../protocol';
import { RpcMessageBuilder } from './kernel';
import { RpcControllerAccess, RpcKernelSecurity, SessionState } from './security';
import { InjectorContext, InjectorModule } from '@deepkit/injector';

export type ActionTypes = {
    parameters: PropertySchema[],
    parameterSchema: ClassSchema,
    parametersDeserialize: (value: any) => any,
    parametersValidate: (value: any, path?: string, errors?: ValidationFailedItem[]) => ValidationFailedItem[],

    //those might change in the actual action call
    resultProperty: PropertySchema,
    resultPropertyChanged: number,
    resultSchema: ClassSchema<{ v?: any }>,
    observableNextSchema: ClassSchema,
    collectionSchema?: ClassSchema<{ v: any[] }>,
};

export class RpcServerAction {
    protected cachedActionsTypes: { [id: string]: ActionTypes } = {};
    protected observableSubjects: {
        [id: number]: {
            subject: Subject<any>,
            completedByClient: boolean,
            subscription: Subscription
        }
    } = {};

    protected collections: {
        [id: number]: {
            collection: Collection<any>,
            unsubscribe: () => void
        }
    } = {};

    protected observables: {
        [id: number]: {
            observable: Observable<any>,
            classType: ClassType,
            method: string,
            types: ActionTypes,
            subscriptions: { [id: number]: { sub?: Subscription, active: boolean } },
        }
    } = {};

    constructor(
        protected controllers: Map<string, {controller: ClassType, module?: InjectorModule}>,
        protected injector: InjectorContext,
        protected security: RpcKernelSecurity,
        protected sessionState: SessionState,
    ) {
    }

    public async handleActionTypes(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody(rpcActionType);
        const types = await this.loadTypes(body.controller, body.method);

        response.reply(RpcTypes.ResponseActionType, rpcResponseActionType, {
            parameters: types.parameters.map(v => v.toJSONNonReference()),
            result: types.resultSchema.getProperty('v').toJSONNonReference(),
        });
    }

    public async onClose() {
        for (const collection of Object.values(this.collections)) {
            if (!collection.collection.closed) {
                collection.unsubscribe();
                collection.collection.unsubscribe();
            }
        }

        for (const observable of Object.values(this.observables)) {
            for (const sub of Object.values(observable.subscriptions)) {
                if (sub.sub && !sub.sub.closed) sub.sub.unsubscribe();
            }
        }

        for (const subject of Object.values(this.observableSubjects)) {
            if (!subject.subject.closed) subject.subject.complete();
        }
    }

    protected async hasControllerAccess(controllerAccess: RpcControllerAccess): Promise<boolean> {
        return await this.security.hasControllerAccess(this.sessionState.getSession(), controllerAccess);
    }

    protected async loadTypes(controller: string, method: string): Promise<ActionTypes> {
        const cacheId = controller + '!' + method;
        let types = this.cachedActionsTypes[cacheId];
        if (types) return types;

        const classType = this.controllers.get(controller);
        if (!classType) {
            throw new Error(`No controller registered for id ${controller}`);
        }
        const action = getActions(classType.controller).get(method);

        if (!action) {
            throw new Error(`Action unknown ${method}`);
        }

        const controllerAccess: RpcControllerAccess = {
            controllerName: controller, actionName: method, controllerClassType: classType.controller,
            actionGroups: action.groups, actionData: action.data
        };

        if (!await this.hasControllerAccess(controllerAccess)) {
            throw new Error(`Access denied to action ${method}`);
        }

        const parameters = getActionParameters(classType.controller, method);

        const argSchema = createClassSchema();
        for (let i = 0; i < parameters.length; i++) {
            argSchema.registerProperty(parameters[i]);
        }

        let resultProperty = getClassSchema(classType.controller).getMethod(method).clone();

        if (resultProperty.type === 'class' && resultProperty.classType) {
            const generic = resultProperty.templateArgs[0];

            if (generic) {
                resultProperty = generic.clone();
            } else {
                //if its Observable, Collection, EntitySubject, we simply assume any, because sending those types as resultProperty is definitely wrong
                //and result in weird errors when `undefined` is returned in the actual action (since from undefined we don't infer an actual type)
                if (isPrototypeOfBase(resultProperty.classType, Observable)
                    || isPrototypeOfBase(resultProperty.classType, Collection)
                    || isPrototypeOfBase(resultProperty.classType, Promise)
                    || isPrototypeOfBase(resultProperty.classType, EntitySubject)
                ) {
                    resultProperty.type = 'any';
                    resultProperty.typeSet = false; //to signal the user hasn't defined a type
                }
            }
        }

        resultProperty.name = 'v';
        resultProperty.isOptional = true;

        const observableNextSchema = rpcActionObservableSubscribeId.clone();
        observableNextSchema.registerProperty(resultProperty);

        const resultSchema = createClassSchema();
        resultSchema.registerProperty(resultProperty);

        types = this.cachedActionsTypes[cacheId] = {
            parameters: parameters,
            parameterSchema: t.schema({ args: argSchema }),
            resultSchema: resultSchema,
            resultProperty: resultProperty,
            resultPropertyChanged: 0,
            parametersDeserialize: getXToClassFunction(argSchema, jsonSerializer),
            parametersValidate: jitValidate(argSchema),
            observableNextSchema
        };
        toFastProperties(this.cachedActionsTypes);

        return types;
    }

    public async handle(message: RpcMessage, response: RpcMessageBuilder) {
        switch (message.type) {

            case RpcTypes.ActionObservableSubscribe: {
                const observable = this.observables[message.id];
                if (!observable) return response.error(new Error('No observable found'));
                const { types, classType, method } = observable;
                const body = message.parseBody(rpcActionObservableSubscribeId);
                if (observable.subscriptions[body.id]) return response.error(new Error('Subscription already created'));

                const sub: { active: boolean, sub?: Subscription } = { active: true };
                observable.subscriptions[body.id] = sub;

                sub.sub = observable.observable.subscribe((next) => {
                    const newProperty = createNewPropertySchemaIfNecessary(next, types.resultProperty);
                    if (newProperty) {
                        types.observableNextSchema = rpcActionObservableSubscribeId.clone();
                        types.observableNextSchema.registerProperty(newProperty);
                        types.resultProperty = newProperty;
                        types.resultPropertyChanged++;
                        if (types.resultPropertyChanged === 10) {
                            console.warn(`The emitted next value of the Observable of method ${getClassPropertyName(classType, method)} changed 10 times. You should add a @t.union() annotation to improve serialization performance.`);
                        }
                        response.reply(RpcTypes.ResponseActionReturnType, propertyDefinition, newProperty.toJSONNonReference());
                    }

                    if (!sub.active) return;
                    response.reply(RpcTypes.ResponseActionObservableNext, types.observableNextSchema, {
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

                break;
            }

            case RpcTypes.ActionCollectionUnsubscribe: {
                const collection = this.collections[message.id];
                if (!collection) return response.error(new Error('No collection found'));
                collection.unsubscribe();
                delete this.collections[message.id];
                break;
            }

            case RpcTypes.ActionCollectionModel: {
                const collection = this.collections[message.id];
                if (!collection) return response.error(new Error('No collection found'));
                const body = message.parseBody(getClassSchema(CollectionQueryModel));
                collection.collection.model.set(body);
                collection.collection.model.changed();
                break;
            }

            case RpcTypes.ActionObservableUnsubscribe: {
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
                break;
            }

            case RpcTypes.ActionObservableSubjectUnsubscribe: { //aka completed
                const subject = this.observableSubjects[message.id];
                if (!subject) return response.error(new Error('No observable found'));
                subject.completedByClient = true;
                subject.subject.complete();
                delete this.observableSubjects[message.id];
                break;
            }
        }
    }

    public async handleAction(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody(rpcActionType);

        const controller = this.controllers.get(body.controller);
        if (!controller) throw new Error(`No controller registered for id ${body.controller}`);

        const types = await this.loadTypes(body.controller, body.method);
        const value = message.parseBody(types.parameterSchema);

        const controllerClassType = this.injector.get(controller.controller, controller.module);
        if (!controllerClassType) {
            response.error(new Error(`No instance of ${getClassName(controller.controller)} found.`));
        }
        const converted = types.parametersDeserialize(value.args);
        const errors = types.parametersValidate(converted);

        if (errors.length) {
            return response.error(new ValidationError(errors));
        }

        try {
            let result = controllerClassType[body.method](...Object.values(value.args));
            const isPromise = result instanceof Promise;
            if (isPromise) {
                result = await result;
            }

            if (isEntitySubject(result)) {
                const newProperty = createNewPropertySchemaIfNecessary(result.value, types.resultProperty);
                if (newProperty) {
                    types.resultSchema = createClassSchema();
                    types.resultSchema.registerProperty(newProperty);
                    types.resultProperty = newProperty;
                    types.resultPropertyChanged++;
                    response.reply(RpcTypes.ResponseActionReturnType, propertyDefinition, newProperty.toJSONNonReference());
                }
                response.reply(RpcTypes.ResponseEntity, types.resultSchema, { v: result.value });
            } else if (isCollection(result)) {
                const collection = result;

                const newProperty = new PropertySchema('v');
                newProperty.setFromJSType(collection.classType);
                types.resultSchema = createClassSchema();
                types.resultSchema.registerProperty(newProperty);
                types.resultProperty = newProperty;

                types.collectionSchema = createClassSchema();
                const v = new PropertySchema('v');
                v.setType('array');
                v.templateArgs.push(newProperty);
                types.collectionSchema.registerProperty(v);

                types.resultPropertyChanged++;

                response.composite(RpcTypes.ResponseActionCollection)
                    .add(RpcTypes.ResponseActionReturnType, propertyDefinition, newProperty.toJSONNonReference())
                    .add(RpcTypes.ResponseActionCollectionModel, CollectionQueryModel, collection.model)
                    .add(RpcTypes.ResponseActionCollectionState, CollectionState, collection.state)
                    .add(RpcTypes.ResponseActionCollectionSet, types.collectionSchema, { v: collection.all() })
                    .send();

                let unsubscribed = false;

                //we queue many events up for the next microtask using collectForMicrotask, and then send
                //everything as one composite message.
                const eventsSub = collection.event.subscribe(collectForMicrotask((events: CollectionEvent<any>[]) => {
                    if (unsubscribed) return;
                    const composite = response.composite(RpcTypes.ResponseActionCollectionChange);

                    for (const event of events) {
                        if (event.type === 'add') {
                            //when the user has already a EntitySubject on one of those event.items,
                            //then we technically send it unnecessarily. However, we would have to introduce
                            //a new RpcType to send only the IDs, which is not yet implemented.
                            composite.add(RpcTypes.ResponseActionCollectionAdd, types.collectionSchema, { v: event.items, });
                        } else if (event.type === 'remove') {
                            composite.add(RpcTypes.ResponseActionCollectionRemove, rpcResponseActionCollectionRemove, { ids: event.ids, });
                        } else if (event.type === 'update') {
                            composite.add(RpcTypes.ResponseActionCollectionUpdate, types.collectionSchema, { v: event.items, });
                        } else if (event.type === 'set') {
                            composite.add(RpcTypes.ResponseActionCollectionSet, types.collectionSchema, { v: collection.all(), });
                        } else if (event.type === 'state') {
                            composite.add(RpcTypes.ResponseActionCollectionState, CollectionState, collection.state);
                        } else if (event.type === 'sort') {
                            composite.add(RpcTypes.ResponseActionCollectionSort, rpcResponseActionCollectionSort, { ids: event.ids, });
                        }
                    }
                    composite.send();
                }));

                collection.addTeardown(() => {
                    const c = this.collections[message.id];
                    if (c) c.unsubscribe();
                });

                this.collections[message.id] = {
                    collection,
                    unsubscribe: () => {
                        if (unsubscribed) return;
                        unsubscribed = true;
                        eventsSub.unsubscribe();
                        collection.unsubscribe();
                    }
                };

            } else if (isObservable(result)) {
                this.observables[message.id] = { observable: result, subscriptions: {}, types, classType: controller.controller, method: body.method };

                let type: ActionObservableTypes = ActionObservableTypes.observable;
                if (isSubject(result)) {
                    type = ActionObservableTypes.subject;

                    this.observableSubjects[message.id] = {
                        subject: result,
                        completedByClient: false,
                        subscription: result.subscribe((next) => {
                            if (types.resultProperty.type === 'class' && types.resultProperty.classType && next && !(next instanceof types.resultProperty.classType)) {
                                console.warn(
                                    `The subject in action ${getClassPropertyName(controllerClassType, body.method)} has a class type assigned of ${getClassName(types.resultProperty.classType)}` +
                                    ` but emitted something different of type ${stringifyValueWithType(next)}. Either annotate the method with t.union() or make sure it emits the correct type.`
                                );
                                return;
                            }
                            const newProperty = createNewPropertySchemaIfNecessary(next, types.resultProperty);
                            if (newProperty) {
                                types.observableNextSchema = rpcActionObservableSubscribeId.clone();
                                types.observableNextSchema.registerProperty(newProperty);
                                types.resultProperty = newProperty;
                                types.resultPropertyChanged++;
                                if (types.resultPropertyChanged === 10) {
                                    console.warn(`The emitted next value of the Observable of method ${getClassPropertyName(controllerClassType, body.method)} changed 10 times. You should add a @t.union() annotation to improve serialization performance.`);
                                }
                                response.reply(RpcTypes.ResponseActionReturnType, propertyDefinition, newProperty.toJSONNonReference());
                            }

                            response.reply(RpcTypes.ResponseActionObservableNext, types.observableNextSchema, {
                                id: message.id,
                                v: next
                            });
                        }, (error) => {
                            const extracted = rpcEncodeError(error);
                            response.reply(RpcTypes.ResponseActionObservableError, rpcResponseActionObservableSubscriptionError, { ...extracted, id: message.id });
                        }, () => {
                            const v = this.observableSubjects[message.id];
                            if (v && v.completedByClient) return; //we don't send ResponseActionObservableComplete when the client issued unsubscribe
                            response.reply(RpcTypes.ResponseActionObservableComplete, rpcActionObservableSubscribeId, {
                                id: message.id
                            });
                        })
                    };

                    if (isBehaviorSubject(result)) {
                        type = ActionObservableTypes.behaviorSubject;
                    }
                }

                response.reply(RpcTypes.ResponseActionObservable, rpcResponseActionObservable, { type });
            } else {
                const newProperty = createNewPropertySchemaIfNecessary(result, types.resultProperty, isPromise);
                if (newProperty) {
                    console.warn(`The result type of method ${getClassPropertyName(controllerClassType, body.method)} changed from ${types.resultProperty.toString()} to ${newProperty.toString()}. ` +
                    `You should add a @t annotation to improve serialization performance.`);

                    types.resultSchema = createClassSchema();
                    types.resultSchema.registerProperty(newProperty);
                    types.resultProperty = newProperty;
                    types.resultPropertyChanged++;
                    const composite = response.composite(RpcTypes.ResponseActionResult);
                    composite.add(RpcTypes.ResponseActionReturnType, propertyDefinition, newProperty.toJSONNonReference());
                    composite.add(RpcTypes.ResponseActionSimple, types.resultSchema, { v: result });
                    composite.send();
                } else {
                    response.reply(RpcTypes.ResponseActionSimple, types.resultSchema, { v: result });
                }
            }
        } catch (error) {
            response.error(error);
        }
    }
}

export function createNewPropertySchemaIfNecessary(result: any, property: PropertySchema, fromPromise: boolean = false): PropertySchema | undefined {
    if (isResultTypeDifferent(result, property)) {
        const newProperty = new PropertySchema('v');
        if (fromPromise) {
            newProperty.type = 'promise';
            newProperty.templateArgs[0] = new PropertySchema('t');
            newProperty.templateArgs[0].setFromJSValue(result);
        } else {
            newProperty.setFromJSValue(result);
        }
        return newProperty;
    }
    return undefined;
}

export function isResultTypeDifferent(result: any, property: PropertySchema): boolean {
    if (property.typeSet) return false;

    if (result === null || result === undefined) return false;

    if (property.type === 'number' && (typeof result !== 'number' && typeof result !== 'bigint')) return true;
    if (property.type === 'string' && (typeof result !== 'string')) return true;
    if (property.type === 'uuid' && (typeof result !== 'string')) return true;
    if (property.type === 'objectId' && (typeof result !== 'string')) return true;
    if (property.type === 'boolean' && (typeof result !== 'boolean')) return true;
    if (property.type === 'date' && !(result instanceof Date)) return true;
    if (property.type === 'arrayBuffer' && !(result instanceof ArrayBuffer)) return true;
    if (property.type === 'map' && !isPlainObject(result)) return true;
    if (property.type === 'array' && !isArray(result)) return true;

    if (property.type === 'promise' && !property.templateArgs[0]) {
        //no t.generic was set for promise, so we try to infer it from runtime type
        return true;
    }

    if (property.type === 'any' && !property.typeSet) {
        //type is inferred as Observable, Collection, EntitySubject, so we should try to infer
        //from the result now
        return true;
    }

    if (property.type === 'class') {
        //could be Promise, Observable, Collection, ...
        if (!(result instanceof property.getResolvedClassType())) return true;
    }

    return false;
}
