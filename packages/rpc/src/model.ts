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

import { ClassType, CustomError } from '@deepkit/core';
import { tearDown } from '@deepkit/core-rxjs';
import { arrayBufferTo, Entity, getClassSchema, getClassSchemaByName, getKnownClassSchemasNames, hasClassSchemaByName, jsonSerializer, propertyDefinition, t } from '@deepkit/type';
import { BehaviorSubject, Observable, Subject, TeardownLogic } from 'rxjs';
import { skip } from 'rxjs/operators';

export interface IdInterface {
    id: string | number;
    version: number;
}

export class ConnectionWriter {
    write(buffer: any) {

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

    async unsubscribe(): Promise<void> {
        if (this.unsubscribed) return;
        this.unsubscribed = true;

        for (const teardown of this.teardowns) {
            await tearDown(teardown);
        }

        await super.unsubscribe();
    }
}

export class EntitySubject<T extends IdInterface> extends StreamBehaviorSubject<T> {
    /**
     * Patches are in class format.
     */
    public readonly patches = new Subject<{ [path: string]: any }>();
    public readonly delete = new Subject<boolean>();

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

export interface RpcInjector {
    get(token: any): any;
}

export class SimpleInjector implements RpcInjector {
    protected instances = new Map<any, any>();

    get(token: ClassType) {
        let instance = this.instances.get(token);
        if (instance) return instance;
        instance = new token;
        this.instances.set(token, instance);
        return instance;
    }
}


@Entity('@error:json')
export class JSONError {
    constructor(@t.any.name('json') public readonly json: any) {
    }
}


export class ValidationErrorItem {
    constructor(
        @t.name('path') public readonly path: string,
        @t.name('message') public readonly message: string,
        @t.name('code') public readonly code: string,
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
        super('Validation error: ' + errors.map(v => `${v.path}: ${v.message} (${v.code})`).join(','));
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

/*
Types:

Both:
    //A batch package. Used when a single message exceeds a certain size. It's split up in multiple messages and send with slight delay, allowing to track progress,
    //cancel. Allows to send shorter messages between to not block the connection.
    Package
    Ping
    Ack
    Error

Client->Server
    ActionType
    Action<T> //T is the parameter type [t.string, t.number, ...] (typed arrays not supported yet)

    ControllerRegister<>
    PeerRegister<>
    PeerUnregister<>

    Authenticate<> //used a token to authenticate the current connection

    Subscribe //subscribe to an received Observable<>
    Unsubscribe //unsubscribe to a created subscription via Subscribe<>

    CollectionUnsubscribe //unsubscribe an received Collection<>
    CollectionParameters //changes the parameters of an received Collection<>

    EntityUnsubscribe //unsubscribe an received Entity<T>

Server->Client
    ActionTypeResponse
    ActionResponse<T> //T is the return type

    Observable<T>
    ObservableComplete<T>
    ObservableError<T>
    Collection<T>

    CollectionItemAdded<T> //batch or a single
    CollectionItemRemoved<> //batch or a single
    CollectionSet<T> //complete set of all items at once

    Entity<T> //when a single entity item has been received

    EntityRemoved<> //when an sent Entity<> has been removed
    EntityPatched<T> //when a sent Entity<> has been patched
*/
export enum RpcTypes {
    //A batch package. Used when a single message exceeds a certain size. It's split up in multiple messages and send with slight delay, allowing to track progress,
    //cancel. Allows to send shorter messages between to not block the connection.
    //both ways
    Package,
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
    Ack,
    Error,
    AuthenticateResponse,
    ActionTypeResponse,
    ActionResponseSimple, //direct response that can be simple deserialized.

    ActionObservableSubscribe,
    ActionObservableUnsubscribe,
    ActionObservableSubjectUnsubscribe,
    ActionResponseObservable,
    ActionResponseBehaviorSubject,
    ActionResponseObservableNext,
    ActionResponseObservableComplete,
    ActionResponseObservableError,


    ActionResponseCollection,
    ActionResponseCollectionSet,
    ActionResponseCollectionAdd,
    ActionResponseCollectionRemove,

    EntityPatch,
    EntityRemove,
}

export const rpcClientId = t.schema({
    id: t.type(Uint8Array)
});

export const rpcActionObservableSubscribeId = t.schema({
    id: t.number,
});

export const rpcError = t.schema({
    classType: t.string,
    message: t.string,
    properties: t.map(t.any).optional,
});

export const rpcResponseActionObservableSubscriptionError = rpcError.extend({id: t.number});

export enum ActionObservableTypes {
    observable,
    subject,
    behaviorSubject,
}

export const rpcResponseActionObservable = t.schema({
    type: t.enum(ActionObservableTypes)
});

export const rpcAuthenticate = t.schema({
    token: t.string,
});

export const rpcAction = t.schema({
    controller: t.string,
    method: t.string,
});

export const rpcActionType = t.schema({
    controller: t.string,
    method: t.string,
});

export const rpcActionTypeResponse = t.schema({
    parameters: t.array(propertyDefinition),
    result: t.type(propertyDefinition),
});

export const rpcPeerRegister = t.schema({
    id: t.string,
});

export const rpcPeerDeregister = t.schema({
    id: t.string,
});