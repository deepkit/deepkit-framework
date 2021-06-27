/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CustomError, isObject } from '@deepkit/core';
import { tearDown } from '@deepkit/core-rxjs';
import { arrayBufferTo, Entity, propertyDefinition, t } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, TeardownLogic } from 'rxjs';
import { skip } from 'rxjs/operators';

export type IdType = string | number;

export interface IdInterface {
    id: IdType;
}

export interface IdVersionInterface extends IdInterface {
    version: number;
}

export class ConnectionWriter {
    write(buffer: Uint8Array) {

    }
}

export class StreamBehaviorSubject<T> extends BehaviorSubject<T> {
    public readonly appendSubject = new Subject<T>();
    protected nextChange?: Subject<void>;

    protected nextOnAppend = false;
    protected unsubscribed = false;

    protected teardowns: TeardownLogic[] = [];

    constructor(
        item: T,
        teardown?: TeardownLogic,
    ) {
        super(item);
        if (teardown) {
            this.teardowns.push(teardown);
        }
    }

    public isUnsubscribed(): boolean {
        return this.unsubscribed;
    }

    get nextStateChange() {
        if (!this.nextChange) {
            this.nextChange = new Subject<void>();
        }
        return this.nextChange.toPromise();
    }

    addTearDown(teardown: TeardownLogic) {
        if (this.unsubscribed) {
            tearDown(teardown);
            return;
        }

        this.teardowns.push(teardown);
    }

    /**
     * This method differs to BehaviorSubject in the way that this does not throw an error
     * when the subject is closed/unsubscribed.
     */
    getValue(): T {
        if (this.hasError) {
            throw this.thrownError;
        } else {
            return (this as any)._value;
        }
    }

    next(value: T): void {
        super.next(value);

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    activateNextOnAppend() {
        this.nextOnAppend = true;
    }

    toUTF8() {
        const subject = new StreamBehaviorSubject(this.value instanceof Uint8Array ? arrayBufferTo(this.value, 'utf8') : '');
        const sub1 = this.pipe(skip(1)).subscribe(v => {
            subject.next(v instanceof Uint8Array ? arrayBufferTo(v, 'utf8') : '');
        });
        const sub2 = this.appendSubject.subscribe(v => {
            subject.append(v instanceof Uint8Array ? arrayBufferTo(v, 'utf8') : '');
        });

        subject.nextOnAppend = this.nextOnAppend;
        // const that = this;
        // Object.defineProperty(subject, 'nextStateChange', {
        //     get() {
        //         console.log('utf8 nextStateChange');
        //         return that.nextStateChange;
        //     }
        // });

        subject.addTearDown(() => {
            sub1.unsubscribe();
            sub2.unsubscribe();
            this.unsubscribe();
        });

        return subject;
    }

    append(value: T): void {
        this.appendSubject.next(value);

        if (this.nextOnAppend) {
            if (value instanceof Uint8Array) {
                if (this.value instanceof Uint8Array) {
                    this.next(Buffer.concat([this.value as any, value as any]) as any);
                } else {
                    this.next(value as any);
                }
            } else {
                this.next((this.getValue() as any + value) as any as T);
            }
        } else {
            if ('string' === typeof value) {
                if (!(this as any)._value) ((this as any)._value as any) = '';
                ((this as any)._value as any) = ((this as any)._value as any) + value;
            }
        }
    }

    unsubscribe(): void {
        if (this.unsubscribed) return;
        this.unsubscribed = true;

        for (const teardown of this.teardowns) {
            tearDown(teardown);
        }

        super.unsubscribe();
    }
}

const IsEntitySubject = Symbol.for('deepkit/entitySubject');

export function isEntitySubject(v: any): v is EntitySubject<any> {
    return !!v && isObject(v) && v.hasOwnProperty(IsEntitySubject);
}


export class EntitySubject<T extends IdInterface> extends StreamBehaviorSubject<T> {
    /**
     * Patches are in class format.
     */
    public readonly patches = new Subject<EntityPatch>();
    public readonly delete = new Subject<boolean>();

    [IsEntitySubject] = true;

    public deleted: boolean = false;

    get id(): string | number {
        return this.value.id;
    }

    get onDeletion(): Observable<void> {
        return new Observable((observer) => {
            if (this.deleted) {
                observer.next();
                return;
            }

            const sub = this.delete.subscribe(() => {
                observer.next();
                sub.unsubscribe();
            });

            return {
                unsubscribe(): void {
                    sub.unsubscribe();
                }
            };
        });
    }

    next(value: T | undefined): void {
        if (value === undefined) {
            this.deleted = true;
            this.delete.next(true);
            super.next(this.value);
            return;
        }

        super.next(value);
    }
}

export class ControllerDefinition<T> {
    constructor(
        public path: string,
        public entities: ClassType[] = []
    ) {
    }
}

export function ControllerSymbol<T>(path: string, entities: ClassType[] = []): ControllerDefinition<T> {
    return new ControllerDefinition<T>(path, entities);
}

@Entity('@error:json')
export class JSONError {
    constructor(@t.any.name('json') public readonly json: any) {
    }
}


export class ValidationErrorItem {
    constructor(
        @t.name('path') public readonly path: string,
        @t.name('code') public readonly code: string,
        @t.name('message') public readonly message: string,
    ) {
    }

    toString() {
        return `${this.path}(${this.code}): ${this.message}`;
    }
}

@Entity('@error:validation')
export class ValidationError extends CustomError {
    constructor(
        @t.array(ValidationErrorItem).name('errors') public readonly errors: ValidationErrorItem[]
    ) {
        super(errors.map(v => `${v.path}(${v.code}): ${v.message}`).join(','));
    }

    static from(errors: { path: string, message: string, code?: string }[]) {
        return new ValidationError(errors.map(v => new ValidationErrorItem(v.path, v.message, v.code || '')));
    }
}

@Entity('@error:parameter')
export class ValidationParameterError {
    constructor(
        @t.name('controller') public readonly controller: string,
        @t.name('action') public readonly action: string,
        @t.name('arg') public readonly arg: number,
        @t.array(ValidationErrorItem).name('errors') public readonly errors: ValidationErrorItem[]
    ) {
    }

    get message(): string {
        return this.errors.map(v => `${v.path}: ${v.message} (${v.code})`).join(',');
    }
}

export enum RpcTypes {
    Ack,
    Error,

    //A batched chunk. Used when a single message exceeds a certain size. It's split up in multiple packages, allowing to track progress,
    //cancel, and safe memory. Allows to send shorter messages between to not block the connection. Both ways.
    Chunk,
    ChunkAck,

    Ping,
    Pong,

    //client -> server
    Authenticate,
    ActionType,
    Action, //T is the parameter type [t.string, t.number, ...] (typed arrays not supported yet)

    PeerRegister,
    PeerDeregister,

    //server -> client
    ClientId,
    ClientIdResponse,
    AuthenticateResponse,
    ResponseActionType,
    ResponseActionReturnType,
    ResponseActionSimple, //direct response that can be simple deserialized.
    ResponseActionResult, //composite message, first optional ResponseActionType, second ResponseAction*

    ActionObservableSubscribe,
    ActionObservableUnsubscribe,
    ActionObservableSubjectUnsubscribe,

    ResponseActionObservable,
    ResponseActionBehaviorSubject,
    ResponseActionObservableNext,
    ResponseActionObservableComplete,
    ResponseActionObservableError,

    ActionCollectionUnsubscribe, //when client unsubscribed collection
    ActionCollectionModel, //when client updated model
    ResponseActionCollection,
    ResponseActionCollectionModel,
    ResponseActionCollectionSort,
    ResponseActionCollectionState,

    ResponseActionCollectionChange,
    ResponseActionCollectionSet,
    ResponseActionCollectionAdd,
    ResponseActionCollectionRemove,
    ResponseActionCollectionUpdate,

    ResponseEntity, //single entity sent

    Entity, //change feed as composite, containing all Entity*
    EntityPatch,
    EntityRemove,
}

export const rpcClientId = t.schema({
    id: t.type(Uint8Array)
});

export const rpcChunk = t.schema({
    id: t.number, //chunk id
    total: t.number, //size in bytes
    v: t.type(Uint8Array),
});

export const rpcActionObservableSubscribeId = t.schema({
    id: t.number,
});

export const rpcError = t.schema({
    classType: t.string,
    message: t.string,
    stack: t.string,
    properties: t.map(t.any).optional,
});

export const rpcResponseActionObservableSubscriptionError = rpcError.extend({ id: t.number });

export enum ActionObservableTypes {
    observable,
    subject,
    behaviorSubject,
}

export const rpcSort = t.schema({
    field: t.string,
    direction: t.union('asc', 'desc'),
});

export const rpcResponseActionObservable = t.schema({
    type: t.enum(ActionObservableTypes)
});

export const rpcAuthenticate = t.schema({
    token: t.any,
});

export const rpcResponseAuthenticate = t.schema({
    username: t.string,
});

export const rpcAction = t.schema({
    controller: t.string,
    method: t.string,
});

export const rpcActionType = t.schema({
    controller: t.string,
    method: t.string,
});

export const rpcResponseActionType = t.schema({
    parameters: t.array(propertyDefinition),
    result: t.type(propertyDefinition),
});

export const rpcPeerRegister = t.schema({
    id: t.string,
});

export const rpcPeerDeregister = t.schema({
    id: t.string,
});


export const rpcResponseActionCollectionRemove = t.schema({
    ids: t.array(t.union(t.string, t.number)),
});

export const rpcResponseActionCollectionSort = t.schema({
    ids: t.array(t.union(t.string, t.number)),
});

export const rpcEntityRemove = t.schema({
    entityName: t.string,
    ids: t.array(t.union(t.string, t.number)),
});

export interface EntityPatch {
    $set?: { [path: string]: any },
    $unset?: { [path: string]: number }
    $inc?: { [path: string]: number }
}

export const rpcEntityPatch = t.schema({
    entityName: t.string,
    id: t.union(t.string, t.number),
    version: t.number,
    patch: t.type({
        $set: t.map(t.any).optional,
        $unset: t.map(t.number).optional,
        $inc: t.map(t.number).optional,
    })
});

export class AuthenticationError extends Error {
    constructor(message: string = 'Authentication failed') {
        super(message);
    }
}
