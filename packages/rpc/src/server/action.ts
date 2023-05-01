/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, collectForMicrotask, getClassName, isPrototypeOfBase, toFastProperties } from '@deepkit/core';
import { isBehaviorSubject, isSubject, ProgressTracker, ProgressTrackerState } from '@deepkit/core-rxjs';
import {
    assertType,
    findMember,
    getValidatorFunction,
    Guard,
    parametersToTuple,
    ReflectionClass,
    ReflectionKind,
    serializeType,
    Type,
    TypeObjectLiteral,
    typeOf,
    TypeTuple,
    ValidationError,
    ValidationErrorItem
} from '@deepkit/type';
import { isObservable, Observable, Subject, Subscription } from 'rxjs';
import { Collection, CollectionEvent, CollectionQueryModel, CollectionQueryModelInterface, CollectionState } from '../collection.js';
import { getActions } from '../decorators.js';
import {
    ActionMode,
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
} from '../model.js';
import { rpcEncodeError, RpcMessage } from '../protocol.js';
import { RpcMessageBuilder } from './kernel.js';
import { RpcControllerAccess, RpcKernelSecurity, SessionState } from './security.js';
import { InjectorContext, InjectorModule } from '@deepkit/injector';

export type ActionTypes = {
    actionCallSchema: TypeObjectLiteral, //with args as property
    parametersValidate: Guard<any>,

    parameters: TypeTuple,
    mode: ActionMode;
    type: Type; //the type T of Collection<T>, EntitySubject<T>, Observable<T>, or return type of the function if mode=arbitrary

    resultSchema: TypeObjectLiteral, //with v as property
    observableNextSchema?: TypeObjectLiteral, //with v as property
    collectionSchema?: Type, //with v as array property
    collectionQueryModel?: Type,
};

function getV(container: TypeObjectLiteral): Type {
    const found = findMember('v', container.types);
    if (!found) throw new Error('v not found');
    assertType(found, ReflectionKind.propertySignature);
    return found.type;
}

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
            subscriptions: { [id: number]: { sub?: Subscription, active: boolean, complete: () => void } },
        }
    } = {};

    constructor(
        protected controllers: Map<string, { controller: ClassType, module?: InjectorModule }>,
        protected injector: InjectorContext,
        protected security: RpcKernelSecurity,
        protected sessionState: SessionState,
    ) {
    }

    public async handleActionTypes(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody<rpcActionType>();
        const types = await this.loadTypes(body.controller, body.method);

        response.reply<rpcResponseActionType>(RpcTypes.ResponseActionType, {
            mode: types.mode,
            type: serializeType(types.type),
            parameters: serializeType(types.parameters),
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

    protected async loadTypes(controller: string, methodName: string): Promise<ActionTypes> {
        const cacheId = controller + '!' + methodName;
        let types = this.cachedActionsTypes[cacheId];
        if (types) return types;

        const classType = this.controllers.get(controller);
        if (!classType) {
            throw new Error(`No controller registered for id ${controller}`);
        }
        const action = getActions(classType.controller).get(methodName);

        if (!action) {
            throw new Error(`Action unknown ${methodName}`);
        }

        const controllerAccess: RpcControllerAccess = {
            controllerName: controller, actionName: methodName, controllerClassType: classType.controller,
            actionGroups: action.groups, actionData: action.data
        };

        if (!await this.hasControllerAccess(controllerAccess)) {
            throw new Error(`Access denied to action ${methodName}`);
        }

        const methodReflection = ReflectionClass.from(classType.controller).getMethod(methodName);
        const method = methodReflection.type;
        assertType(method, ReflectionKind.method);

        let mode: ActionMode = 'arbitrary';
        const parameters: TypeTuple = parametersToTuple(methodReflection.getParameters().map(v => v.parameter));

        const actionCallSchema: TypeObjectLiteral = {
            kind: ReflectionKind.objectLiteral,
            types: [
                { kind: ReflectionKind.propertySignature, name: 'args', parent: Object as any, type: parameters, }
            ]
        };

        let nextSchema: Type | undefined = undefined;
        let unwrappedReturnType = methodReflection.getReturnType();
        if (unwrappedReturnType.kind === ReflectionKind.promise) {
            unwrappedReturnType = unwrappedReturnType.type;
        }

        let type: Type = unwrappedReturnType;
        let collectionSchema: Type | undefined;
        let collectionQueryModel: Type | undefined;

        if (unwrappedReturnType.kind === ReflectionKind.class) {
            if (isPrototypeOfBase(unwrappedReturnType.classType, Collection)) {
                mode = 'collection';
                type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
                collectionSchema = {
                    kind: ReflectionKind.objectLiteral,
                    types: [{
                        kind: ReflectionKind.propertySignature,
                        name: 'v',
                        parent: Object as any,
                        optional: true,
                        type: { kind: ReflectionKind.array, type: type }
                    }]
                };

                collectionQueryModel = typeOf<CollectionQueryModelInterface<unknown>>([type]) as TypeObjectLiteral;
            } else if (isPrototypeOfBase(unwrappedReturnType.classType, EntitySubject)) {
                mode = 'entitySubject';
                type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
            } else if (isPrototypeOfBase(unwrappedReturnType.classType, ProgressTracker)) {
                mode = 'observable';
                type = typeOf<ProgressTrackerState[]>();
                nextSchema = {
                    kind: ReflectionKind.objectLiteral,
                    types: [{
                        kind: ReflectionKind.propertySignature,
                        name: 'id',
                        parent: Object as any,
                        type: { kind: ReflectionKind.number },
                    }, {
                        kind: ReflectionKind.propertySignature,
                        name: 'v',
                        parent: Object as any,
                        optional: true,
                        type: type,
                    }]
                };
            } else if (isPrototypeOfBase(unwrappedReturnType.classType, Observable)) {
                mode = 'observable';
                type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
                nextSchema = {
                    kind: ReflectionKind.objectLiteral,
                    types: [{
                        kind: ReflectionKind.propertySignature,
                        name: 'id',
                        parent: Object as any,
                        type: { kind: ReflectionKind.number },
                    }, {
                        kind: ReflectionKind.propertySignature,
                        name: 'v',
                        parent: Object as any,
                        optional: true,
                        type: type,
                    }]
                };
            }
        }

        const resultSchema: TypeObjectLiteral = {
            kind: ReflectionKind.objectLiteral,
            types: [{
                kind: ReflectionKind.propertySignature,
                name: 'v',
                parent: Object as any,
                optional: true,
                type: type,
            }]
        };

        types = this.cachedActionsTypes[cacheId] = {
            parameters,
            actionCallSchema,
            resultSchema,
            mode,
            type,
            parametersValidate: getValidatorFunction(undefined, parameters),
            observableNextSchema: nextSchema,
            collectionSchema,
            collectionQueryModel,
        };
        if (!types.type) {
            throw new Error(`No type detected for action ${controller}.${methodName}`);
        }
        toFastProperties(this.cachedActionsTypes);

        return types;
    }

    public async handle(message: RpcMessage, response: RpcMessageBuilder) {
        switch (message.type) {

            case RpcTypes.ActionObservableSubscribe: {
                const observable = this.observables[message.id];
                if (!observable) return response.error(new Error('No observable found'));
                const { types, classType, method } = observable;
                const body = message.parseBody<rpcActionObservableSubscribeId>();
                if (observable.subscriptions[body.id]) return response.error(new Error('Subscription already created'));
                if (!types.observableNextSchema) return response.error(new Error('No observable type detected'));

                const sub: { active: boolean, sub?: Subscription, complete: () => void } = {
                    active: true,
                    complete: () => {
                        sub.active = false;
                        if (sub.sub) sub.sub.unsubscribe();
                        response.reply<rpcActionObservableSubscribeId>(RpcTypes.ResponseActionObservableComplete, {
                            id: body.id
                        });
                    }
                };
                observable.subscriptions[body.id] = sub;

                sub.sub = observable.observable.subscribe((next) => {
                    if (!sub.active) return;
                    response.reply(RpcTypes.ResponseActionObservableNext, {
                        id: body.id,
                        v: next
                    }, types.observableNextSchema);
                }, (error) => {
                    const extracted = rpcEncodeError(this.security.transformError(error));
                    response.reply<rpcResponseActionObservableSubscriptionError>(RpcTypes.ResponseActionObservableError, { ...extracted, id: body.id });
                }, () => {
                    response.reply<rpcActionObservableSubscribeId>(RpcTypes.ResponseActionObservableComplete, {
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
                const body = message.parseBody<CollectionQueryModel<any>>(); //todo, add correct type argument
                collection.collection.model.set(body);
                collection.collection.model.changed();
                break;
            }

            case RpcTypes.ActionObservableUnsubscribe: {
                const observable = this.observables[message.id];
                if (!observable) return response.error(new Error('No observable to unsubscribe found'));
                const body = message.parseBody<rpcActionObservableSubscribeId>();
                const sub = observable.subscriptions[body.id];
                if (!sub) return response.error(new Error('No subscription found'));
                sub.active = false;
                if (sub.sub) {
                    sub.sub.unsubscribe();
                }
                delete observable.subscriptions[body.id];
                break;
            }

            case RpcTypes.ActionObservableDisconnect: {
                const observable = this.observables[message.id];
                if (!observable) return response.error(new Error('No observable to disconnect found'));
                for (const sub of Object.values(observable.subscriptions)) {
                    sub.complete(); //we send all active subscriptions it was completed
                }
                delete this.observables[message.id];
                break;
            }

            case RpcTypes.ActionObservableSubjectUnsubscribe: { //aka completed
                const subject = this.observableSubjects[message.id];
                if (!subject) return response.error(new Error('No subject to unsubscribe found'));
                subject.completedByClient = true;
                subject.subject.complete();
                delete this.observableSubjects[message.id];
                break;
            }

            case RpcTypes.ActionObservableProgressNext: { //ProgressTracker changes from client (e.g. stop signal)
                const observable = this.observables[message.id];
                if (!observable || !(observable.observable instanceof ProgressTracker)) return response.error(new Error('No observable ProgressTracker to sync found'));
                observable.observable.next(message.parseBody<ProgressTrackerState[]>());
                break;
            }
        }
    }

    public async handleAction(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody<rpcActionType>();

        const controller = this.controllers.get(body.controller);
        if (!controller) throw new Error(`No controller registered for id ${body.controller}`);

        const types = await this.loadTypes(body.controller, body.method);
        let value: { args: any[] } = { args: [] };

        try {
            value = message.parseBody(types.actionCallSchema);
        } catch (error: any) {
            if (error instanceof ValidationError) {
                //remove `.args` from path
                error = ValidationError.from(error.errors.map(v => ({ ...v, path: v.path.replace('args.', '') })));
            }
            return response.error(error);
        }

        const controllerClassType = this.injector.get(controller.controller, controller.module);
        if (!controllerClassType) {
            response.error(new Error(`No instance of ${getClassName(controller.controller)} found.`));
        }
        // const converted = types.parametersDeserialize(value.args);
        const errors: ValidationErrorItem[] = [];
        types.parametersValidate(value.args, { errors });

        if (errors.length) {
            return response.error(new ValidationError(errors));
        }

        try {
            const result = await controllerClassType[body.method](...value.args);

            if (isEntitySubject(result)) {
                response.reply(RpcTypes.ResponseEntity, { v: result.value }, types.resultSchema);
            } else if (result instanceof Collection) {
                const collection = result;
                if (!types.collectionSchema) throw new Error('No collectionSchema set');
                if (!types.collectionQueryModel) throw new Error('No collectionQueryModel set');

                response.composite(RpcTypes.ResponseActionCollection)
                    .add(RpcTypes.ResponseActionCollectionModel, collection.model, types.collectionQueryModel)
                    .add<CollectionState>(RpcTypes.ResponseActionCollectionState, collection.state)
                    .add(RpcTypes.ResponseActionCollectionSet, { v: collection.all() }, types.collectionSchema)
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
                            composite.add(RpcTypes.ResponseActionCollectionAdd, { v: event.items }, types.collectionSchema);
                        } else if (event.type === 'remove') {
                            composite.add<rpcResponseActionCollectionRemove>(RpcTypes.ResponseActionCollectionRemove, { ids: event.ids, });
                        } else if (event.type === 'update') {
                            composite.add(RpcTypes.ResponseActionCollectionUpdate, { v: event.items }, types.collectionSchema);
                        } else if (event.type === 'set') {
                            composite.add(RpcTypes.ResponseActionCollectionSet, { v: collection.all() }, types.collectionSchema);
                        } else if (event.type === 'state') {
                            composite.add<CollectionState>(RpcTypes.ResponseActionCollectionState, collection.state);
                        } else if (event.type === 'sort') {
                            composite.add<rpcResponseActionCollectionSort>(RpcTypes.ResponseActionCollectionSort, { ids: event.ids, });
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

                    if (isBehaviorSubject(result)) {
                        type = ActionObservableTypes.behaviorSubject;
                        if (result instanceof ProgressTracker) {
                            type = ActionObservableTypes.progressTracker;
                        }
                    }

                    this.observableSubjects[message.id] = {
                        subject: result,
                        completedByClient: false,
                        subscription: result.subscribe((next) => {
                            response.reply(RpcTypes.ResponseActionObservableNext, {
                                id: message.id,
                                v: next
                            }, types.observableNextSchema);
                        }, (error) => {
                            const extracted = rpcEncodeError(this.security.transformError(error));
                            response.reply<rpcResponseActionObservableSubscriptionError>(RpcTypes.ResponseActionObservableError, { ...extracted, id: message.id });
                        }, () => {
                            const v = this.observableSubjects[message.id];
                            if (v && v.completedByClient) return; //we don't send ResponseActionObservableComplete when the client issued unsubscribe
                            response.reply<rpcActionObservableSubscribeId>(RpcTypes.ResponseActionObservableComplete, {
                                id: message.id
                            });
                        })
                    };
                }

                response.reply<rpcResponseActionObservable>(RpcTypes.ResponseActionObservable, { type });
            } else {
                response.reply(RpcTypes.ResponseActionSimple, { v: result }, types.resultSchema);
            }
        } catch (error: any) {
            response.error(this.security.transformError(error));
        }
    }
}
