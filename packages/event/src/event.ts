/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ClassType, CompilerContext, CustomError, isClass, isFunction } from '@deepkit/core';
import { injectedFunction } from '@deepkit/injector';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import {
    ClassDecoratorResult,
    PropertyDecoratorResult,
    ReflectionClass,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
} from '@deepkit/type';

export type EventListenerCallback<T> = (event: T, ...args: any[]) => void | Promise<void>;

export class EventError extends CustomError {}

export interface EventListener<T> {
    eventToken: EventToken<any>;
    callback: EventListenerCallback<T>;
    module?: InjectorModule;
    order: number;
}

export type EventOfEventToken<T> =
    T extends EventToken<infer E> ? (E extends DataEvent<infer D> ? D | E : E) : BaseEvent;

interface SimpleDataEvent<T> extends BaseEvent {
    data: T;
}

/**
 * Defines a new event token. This token can be used to listen to events.
 * Per default this has no event data, so use DataEventToken for that.
 *
 * @example
 * ```typescript
 * const userAdded = new EventToken('user.added');
 *
 * eventDispatcher.listen(userAdded, (event) => {
 *    console.log('user added', event);
 * });
 *
 * eventDispatcher.dispatch(userAdded);
 * ```
 */
export class EventToken<T extends BaseEvent = BaseEvent> {
    /**
     * This is only to get easy the event-type. In reality this property is undefined.
     * e.g. `onHttpRequest(event: typeof onHttpRequest.event) {`
     */
    public readonly event!: T;

    constructor(
        public readonly id: string,
        event?: ClassType<T>,
    ) {}

    listen(callback: (event: T, ...args: any[]) => void, order: number = 0, module?: InjectorModule): EventListener<T> {
        return { eventToken: this, callback, order: order, module };
    }
}

/**
 * @example
 * ```typescript
 * const userAdded = new DataEventToken<User>('user.added');
 *
 * eventDispatcher.listen(userAdded, (event) => {
 *    console.log('user added', event.data); //event.data is from type User
 * });
 *
 * eventDispatcher.dispatch(userAdded, new User);
 * ```
 */
export class DataEventToken<T> extends EventToken<SimpleDataEvent<T>> {}

export class BaseEvent {
    propagationStopped = false;

    stopPropagation() {
        this.propagationStopped = true;
    }

    isPropagationStopped() {
        return this.propagationStopped;
    }
}

export class DataEvent<T> extends BaseEvent {
    constructor(public data: T) {
        super();
    }
}

class EventStore {
    token?: EventToken<any>;
    order: number = 0;
}

class EventClassStore {
    listeners: {
        eventToken: EventToken<any>;
        methodName: string;
        order: number;
    }[] = [];
}

class EventClassApi {
    t = new EventClassStore();

    addListener(eventToken: EventToken<any>, methodName: string, order: number) {
        this.t.listeners.push({ eventToken, methodName, order: order });
    }
}

export const eventClass: ClassDecoratorResult<typeof EventClassApi> = createClassDecoratorContext(EventClassApi);

class EventDispatcherApi {
    t = new EventStore();

    onDecorator(target: ClassType, property?: string) {
        if (!this.t.token) throw new Error('@eventDispatcher.listen(eventToken) is the correct syntax.');
        if (!property) throw new Error('@eventDispatcher.listen(eventToken) works only on class properties.');

        eventClass.addListener(this.t.token, property, this.t.order)(target);
    }

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called.
     */
    listen(eventToken: EventToken<any>, order: number = 0) {
        if (!eventToken) new Error('@eventDispatcher.listen() No event token given');
        this.t.token = eventToken;
        this.t.order = order;
    }
}

export const eventDispatcher: PropertyDecoratorResult<typeof EventDispatcherApi> =
    createPropertyDecoratorContext(EventDispatcherApi);

export type EventListenerContainerEntryCallback = {
    order: number;
    fn: EventListenerCallback<any>;
    builtFn?: Function;
    module?: InjectorModule;
};
export type EventListenerContainerEntryService = {
    module: InjectorModule;
    order: number;
    classType: ClassType;
    methodName: string;
};
export type EventListenerContainerEntry = EventListenerContainerEntryCallback | EventListenerContainerEntryService;

export function isEventListenerContainerEntryCallback(obj: any): obj is EventListenerContainerEntryCallback {
    return obj && isFunction(obj.fn);
}

export function isEventListenerContainerEntryService(obj: any): obj is EventListenerContainerEntryService {
    return obj && isClass(obj.classType);
}

function compareListenerEntry(a: EventListenerContainerEntry, b: EventListenerContainerEntry): boolean {
    if (isEventListenerContainerEntryCallback(a)) {
        if (!isEventListenerContainerEntryCallback(b)) return false;
        return a.fn == b.fn;
    } else if (isEventListenerContainerEntryService(a)) {
        if (!isEventListenerContainerEntryService(b)) return false;
        return a.module == b.module && a.classType == b.classType && a.methodName == b.methodName;
    }
    return false;
}

interface EventDispatcherFn {
    (scopedContext: InjectorContext, event: BaseEvent): Promise<void>;
}

export type EventDispatcherUnsubscribe = () => void;

export interface EventDispatcherInterface {
    add(eventToken: EventToken<any>, listener: EventListenerContainerEntry): EventDispatcherUnsubscribe;

    listen<T extends EventToken<any>, DEPS extends any[]>(
        eventToken: T,
        callback: EventListenerCallback<T['event']>,
        order?: number,
    ): EventDispatcherUnsubscribe;

    hasListeners(eventToken: EventToken<any>): boolean;

    dispatch<T extends EventToken<any>>(
        eventToken: T,
        event?: EventOfEventToken<T>,
        injector?: InjectorContext,
    ): Promise<void>;

    fork(): EventDispatcherInterface;
}

function resolveEvent<T>(eventToken: EventToken<any>, event?: EventOfEventToken<T>) {
    if (!event) return new BaseEvent();
    return eventToken instanceof DataEventToken
        ? (event as any) instanceof DataEvent
            ? event
            : new DataEvent(event)
        : event;
}

export interface EventListenerRegistered {
    listener: EventListenerContainerEntry;
    eventToken: EventToken<any>;
}

export class EventDispatcher implements EventDispatcherInterface {
    protected listenerMap = new Map<EventToken<any>, EventListenerContainerEntry[]>();
    protected instances: any[] = [];
    protected registeredClassTypes = new Set<ClassType>();

    protected symbol = Symbol('eventDispatcher');

    constructor(public injector: InjectorContext = InjectorContext.forProviders([])) {}

    public registerListener(classType: ClassType, module: InjectorModule): EventListenerRegistered[] {
        if (this.registeredClassTypes.has(classType)) return [];
        this.registeredClassTypes.add(classType);
        const config = eventClass._fetch(classType);
        if (!config) return [];
        const result: EventListenerRegistered[] = [];
        for (const entry of config.listeners) {
            const listener = {
                module,
                classType: classType,
                methodName: entry.methodName,
                order: entry.order,
            };
            this.add(entry.eventToken, listener);
            result.push({ eventToken: entry.eventToken, listener });
        }
        return result;
    }

    listen<T extends EventToken<any>, DEPS extends any[]>(
        eventToken: T,
        callback: EventListenerCallback<T['event']>,
        order: number = 0,
    ): EventDispatcherUnsubscribe {
        return this.add(eventToken, { fn: callback, order: order });
    }

    public add(eventToken: EventToken<any>, listener: EventListenerContainerEntry): EventDispatcherUnsubscribe {
        if ((eventToken as any)[this.symbol])
            throw new EventError(
                `EventDispatcher already built for token ${eventToken.id}. Use eventDispatcher.fork() for late event binding.`,
            );
        const listeners = this.getListeners(eventToken);
        listeners.push(listener);

        return () => {
            if ((eventToken as any)[this.symbol])
                throw new EventError(
                    `EventDispatcher already built for token ${eventToken.id}. Use eventDispatcher.fork() for late event binding.`,
                );
            const index = listeners.findIndex(v => compareListenerEntry(v, listener));
            if (index !== -1) listeners.splice(index, 1);
        };
    }

    public getTokens(): EventToken<any>[] {
        return [...this.listenerMap.keys()];
    }

    public hasListeners(eventToken: EventToken<any>): boolean {
        return this.listenerMap.has(eventToken);
    }

    public getListeners(eventToken: EventToken<any>): EventListenerContainerEntry[] {
        let listeners = this.listenerMap.get(eventToken);
        if (!listeners) {
            listeners = [];
            this.listenerMap.set(eventToken, listeners);
        }

        return listeners;
    }

    protected buildFor(eventToken: EventToken<any>): EventDispatcherFn | undefined {
        const compiler = new CompilerContext();
        const lines: string[] = [];

        const listeners = this.listenerMap.get(eventToken) || [];
        if (!listeners.length) return;

        listeners.sort((a, b) => {
            if (a.order > b.order) return +1;
            if (a.order < b.order) return -1;
            return 0;
        });

        for (const listener of listeners) {
            if (isEventListenerContainerEntryCallback(listener)) {
                const injector = listener.module
                    ? this.injector.getInjector(listener.module)
                    : this.injector.getRootInjector();
                try {
                    const fn = injectedFunction(listener.fn, injector, 1);
                    const fnVar = compiler.reserveVariable('fn', fn);
                    lines.push(`
                        await ${fnVar}(scopedContext.scope, event);
                        if (event.isPropagationStopped()) return;
                    `);
                } catch (error: any) {
                    throw new Error(
                        `Could not build listener ${listener.fn.name || 'anonymous function'} of event token ${eventToken.id}: ${error.message}`,
                    );
                }
            } else if (isEventListenerContainerEntryService(listener)) {
                const injector = listener.module
                    ? this.injector.getInjector(listener.module)
                    : this.injector.getRootInjector();
                const classTypeVar = compiler.reserveVariable('classType', listener.classType);
                const moduleVar = compiler.reserveVariable('module', listener.module);

                const method = ReflectionClass.from(listener.classType).getMethod(listener.methodName);
                let call = `scopedContext.get(${classTypeVar}, ${moduleVar}).${listener.methodName}(event)`;

                if (method.getParameters().length > 1) {
                    const fn = injectedFunction(
                        (event, classInstance, ...args: any[]) => {
                            return classInstance[listener.methodName](event, ...args);
                        },
                        injector,
                        2,
                        method.type,
                        1,
                    );
                    call = `${compiler.reserveVariable('fn', fn)}(scopedContext.scope, event, scopedContext.get(${classTypeVar}, ${moduleVar}))`;
                }

                lines.push(`
                    await ${call};
                    if (event.isPropagationStopped()) return;
                `);
            }
        }
        return compiler.buildAsync(lines.join('\n'), 'scopedContext', 'event') as EventDispatcherFn;
    }

    public async dispatch<T extends EventToken<any>>(
        eventToken: T,
        event?: EventOfEventToken<T>,
        injector?: InjectorContext,
    ): Promise<void> {
        let build = (eventToken as any)[this.symbol];
        if (!build) {
            build = (eventToken as any)[this.symbol] = {
                fn: this.buildFor(eventToken),
            };
        }

        //no fn means for this token has no listeners
        if (!build.fn) return;

        return build.fn(injector || this.injector, resolveEvent(eventToken, event));
    }

    /**
     * A forked EventDispatcher does not use JIT compilation and thus is slightly slower in executing listeners,
     * but cheap in creating event dispatchers.
     */
    fork(): EventDispatcherInterface {
        return new ForkedEventDispatcher(this, this.injector);
    }
}

/**
 * A forked EventDispatcher does not use JIT compilation and thus is slightly slower in executing listeners,
 * but cheap in creating event dispatchers.
 */
export class ForkedEventDispatcher implements EventDispatcherInterface {
    protected listenerMap = new Map<EventToken<any>, { entries: EventListenerContainerEntry[]; sorted: boolean }>();

    constructor(
        protected parent: EventDispatcherInterface,
        protected injector: InjectorContext,
    ) {}

    async dispatch<T extends EventToken<any>>(
        eventToken: T,
        eventIn?: EventOfEventToken<T>,
        injector?: InjectorContext,
    ): Promise<void> {
        await this.parent.dispatch(eventToken, eventIn, injector);
        const event = resolveEvent(eventToken, eventIn);

        const listeners = this.listenerMap.get(eventToken);
        if (!listeners) return;

        if (!listeners.sorted) {
            listeners.entries.sort((a, b) => {
                if (a.order > b.order) return +1;
                if (a.order < b.order) return -1;
                return 0;
            });
            listeners.sorted = true;
        }
        const scopedContext = injector || this.injector;

        for (const listener of listeners.entries) {
            if (isEventListenerContainerEntryCallback(listener)) {
                if (!listener.builtFn) {
                    try {
                        const injector = listener.module
                            ? this.injector.getInjector(listener.module)
                            : this.injector.getRootInjector();
                        listener.builtFn = injectedFunction(listener.fn, injector, 1);
                    } catch (error: any) {
                        throw new Error(
                            `Could not build listener ${listener.fn.name || 'anonymous function'} of event token ${eventToken.id}: ${error.message}`,
                        );
                    }
                }

                await listener.builtFn(scopedContext.scope, event);
            } else if (isEventListenerContainerEntryService(listener)) {
                await scopedContext.get(listener.classType, listener.module)[listener.methodName](event);
            }
        }
    }

    public getListeners(eventToken: EventToken<any>): {
        entries: EventListenerContainerEntry[];
        sorted: boolean;
    } {
        let listeners = this.listenerMap.get(eventToken);
        if (!listeners) {
            listeners = { entries: [], sorted: true };
            this.listenerMap.set(eventToken, listeners);
        }
        return listeners;
    }

    add(eventToken: EventToken<any>, listener: EventListenerContainerEntry): EventDispatcherUnsubscribe {
        const listeners = this.getListeners(eventToken);
        listeners.sorted = false;
        listeners.entries.push(listener);
        return () => {
            const index = listeners.entries.findIndex(v => compareListenerEntry(v, listener));
            if (index !== -1) listeners.entries.splice(index, 1);
        };
    }

    listen<T extends EventToken<any>, DEPS extends any[]>(
        eventToken: T,
        callback: EventListenerCallback<T['event']>,
        order: number = 0,
    ): EventDispatcherUnsubscribe {
        return this.add(eventToken, { fn: callback, order: order });
    }

    hasListeners(eventToken: EventToken<any>): boolean {
        if (this.listenerMap.has(eventToken)) return true;
        return this.parent.hasListeners(eventToken);
    }

    fork(): EventDispatcherInterface {
        return new ForkedEventDispatcher(this, this.injector);
    }
}
