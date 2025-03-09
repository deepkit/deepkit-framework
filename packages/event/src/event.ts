/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, CustomError, isClass, isFunction, isObject } from '@deepkit/core';
import { injectedFunction, InjectorContext, InjectorModule } from '@deepkit/injector';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    PropertyDecoratorResult,
    ReflectionClass,
} from '@deepkit/type';

export type EventListenerCallbackAsync<E> = (event: E, ...args: any[]) => Promise<void> | void;
export type EventListenerCallbackSync<E> = (event: E, ...args: any[]) => undefined | void;
export type EventListenerCallback<T extends EventToken<any> | EventTokenSync<any>> = T extends EventTokenSync<any> ? EventListenerCallbackSync<T['event']> : EventListenerCallbackAsync<T['event']>;

export class EventError extends CustomError {
}

/**
 * Result of `EventToken.listen(callback)`.
 */
export interface EventListener {
    eventToken: EventToken<any>;
    callback: (event: any) => any;
    module?: InjectorModule,
    /**
     * The lower the order, the sooner the listener is called. Default is 0.
     */
    order: number;
}

export type EventOfEvent<E> = E extends SimpleDataEvent<infer D> ? (D | E) : (E | void);
export type EventOfEventToken<T> = T extends EventToken<infer E> | EventTokenSync<infer E> ? EventOfEvent<E> : void;

export type Dispatcher<T extends EventToken<any>> = (...args: DispatchArguments<T>) => EventDispatcherDispatchType<T>;

type ValueOrFactory<T> = T | (() => T);

/**
 * @reflection never
 */
export type DispatchArguments<T extends EventToken<any>> =
    T extends EventToken<infer E> | EventTokenSync<infer E>
        ? SimpleDataEvent<any> extends E
            ? E extends SimpleDataEvent<infer D>
                ? [event: ValueOrFactory<D | E>, injector?: InjectorContext]
                : BaseEvent extends E
                    ? [event?: ValueOrFactory<E>, injector?: InjectorContext]
                    : [event: ValueOrFactory<E>, injector?: InjectorContext]
            : BaseEvent extends E
                ? [event?: ValueOrFactory<E>, injector?: InjectorContext]
                : [event: ValueOrFactory<E>, injector?: InjectorContext]
        : [event: 'invalid-token', injector?: InjectorContext];


interface SimpleDataEvent<T> extends BaseEvent {
    data: T;
}

/**
 * Defines a new event token that is dispatched in an asynchronous way.
 * This token can be used to listen to events.
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
    ) {
    }

    listen(callback: EventListenerCallback<EventToken<T>>, order: number = 0, module?: InjectorModule): EventListener {
        return { eventToken: this, callback, order: order, module };
    }
}

/**
 * Defines a new event token that is dispatched in a synchronous way.
 * It's not possible to subscribe to this event token with async listeners.
 */
export class EventTokenSync<T extends BaseEvent = BaseEvent> extends EventToken<T> {
    public readonly sync: boolean = true;
}

export function isSyncEventToken(eventToken: any): eventToken is EventTokenSync<any> {
    return eventToken instanceof EventTokenSync;
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
export class DataEventToken<T> extends EventToken<SimpleDataEvent<T>> {

}

export class BaseEvent {
    metadata?: Record<string | symbol, any>;

    propagationStopped = false;

    stopPropagation() {
        this.propagationStopped = true;
    }

    isPropagationStopped() {
        return this.propagationStopped;
    }
}

export class DataEvent<T> extends BaseEvent implements SimpleDataEvent<T> {
    constructor(public data: T) {
        super();
    }
}

class EventStore {
    token?: EventToken<any>;
    order: number = 0;
}

class EventClassStore {
    listeners: { eventToken: EventToken<any>, methodName: string, order: number }[] = [];
}

class EventClassApi {
    t = new EventClassStore;

    addListener(eventToken: EventToken<any>, methodName: string, order: number) {
        this.t.listeners.push({ eventToken, methodName, order: order });
    }
}

export const eventClass: ClassDecoratorResult<typeof EventClassApi> = createClassDecoratorContext(EventClassApi);

class EventDispatcherApi {
    t = new EventStore;

    onDecorator(target: ClassType, property?: string) {
        if (!this.t.token) throw new Error('@eventDispatcher.listen(eventToken) is the correct syntax.');
        if (!property) throw new Error('@eventDispatcher.listen(eventToken) works only on class properties.');

        eventClass.addListener(this.t.token, property, this.t.order)(target);
    }

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called. Default is 0.
     */
    listen(eventToken: EventToken<any>, order: number = 0) {
        if (!eventToken) new Error('@eventDispatcher.listen() No event token given');
        this.t.token = eventToken;
        this.t.order = order;
    }
}

export const eventDispatcher: PropertyDecoratorResult<typeof EventDispatcherApi> = createPropertyDecoratorContext(EventDispatcherApi);

export type EventListenerContainerEntryCallback = {
    order: number,
    fn: EventListenerCallback<any>,
    builtFn?: Function,
    module?: InjectorModule,
};
export type EventListenerContainerEntryService = {
    module: InjectorModule,
    order: number,
    classType: ClassType,
    methodName: string
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
    (event: BaseEvent, scopedContext: InjectorContext): Promise<void> | void;
}

export type EventDispatcherUnsubscribe = () => void;

export type EventDispatcherDispatchType<T extends EventToken<any>> = T extends EventTokenSync<any> ? void : Promise<void>;

export interface EventDispatcherInterface {
    add(eventToken: EventToken<any>, listener: EventListenerContainerEntry): EventDispatcherUnsubscribe;

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called. Default is 0.
     */
    listen<T extends EventToken<any>>(eventToken: T, callback: EventListenerCallback<T>, order?: number): EventDispatcherUnsubscribe;

    hasListeners(eventToken: EventToken<any>): boolean;

    dispatch<T extends EventToken<any>>(eventToken: T, ...args: DispatchArguments<T>): EventDispatcherDispatchType<T>;

    getDispatcher<T extends EventToken<any>>(eventToken: T): (...args: DispatchArguments<T>) => EventDispatcherDispatchType<T>;
}

function resolveEvent<T>(eventToken: EventToken<any>, event?: EventOfEventToken<T>): BaseEvent {
    if (!event) return new BaseEvent();
    return eventToken instanceof DataEventToken
        ? (event as any) instanceof DataEvent
            ? event
            : new DataEvent(event)
        : event instanceof BaseEvent ? event : new DataEvent(event);
}

export interface EventListenerRegistered {
    listener: EventListenerContainerEntry;
    eventToken: EventToken<any>;
}

function noop() {
}

interface Context {
    listeners: EventListenerContainerEntry[],
    built: boolean,
    dispatcher: (event: BaseEvent, injector: InjectorContext) => any
}

/** @reflection never */
export class EventDispatcher implements EventDispatcherInterface {
    protected context = new Map<EventToken<any>, Context>();
    protected instances: any[] = [];
    protected registeredClassTypes = new Set<ClassType>();

    protected symbol = Symbol('eventDispatcher');

    constructor(
        public injector: InjectorContext = InjectorContext.forProviders([]),
    ) {
    }

    public registerListener(classType: ClassType, module: InjectorModule): EventListenerRegistered[] {
        if (this.registeredClassTypes.has(classType)) return [];
        this.registeredClassTypes.add(classType);
        const config = eventClass._fetch(classType);
        if (!config) return [];
        const result: EventListenerRegistered[] = [];
        for (const entry of config.listeners) {
            const listener = { module, classType: classType, methodName: entry.methodName, order: entry.order };
            this.add(entry.eventToken, listener);
            result.push({ eventToken: entry.eventToken, listener });
        }
        return result;
    }

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called. Default is 0.
     */
    listen<T extends EventToken<any>>(eventToken: T, callback: EventListenerCallback<T>, order: number = 0): EventDispatcherUnsubscribe {
        return this.add(eventToken, { fn: callback, order: order });
    }

    add(eventToken: EventToken<any>, listener: EventListenerContainerEntry): EventDispatcherUnsubscribe {
        const listeners = this.getListeners(eventToken);
        listeners.push(listener);

        this.scheduleDispatcherRebuild(eventToken);

        return () => {
            const index = listeners.findIndex(v => compareListenerEntry(v, listener));
            if (index !== -1) listeners.splice(index, 1);
            this.scheduleDispatcherRebuild(eventToken);
        };
    }

    protected getContext(eventToken: EventToken<any>): Context {
        let context = this.context.get(eventToken);
        if (!context) {
            context = { listeners: [], built: false, dispatcher: () => undefined };
            this.context.set(eventToken, context);
        }
        return context;
    }

    protected scheduleDispatcherRebuild(eventToken: EventToken<any>) {
        const context = this.getContext(eventToken);
        context.built = false;
        context.dispatcher = (event: BaseEvent, injector?: InjectorContext) => {
            const fn = buildStaticDispatcher(context, eventToken, this.injector);
            context.dispatcher = fn;
            context.built = true;
            return fn(event, injector || this.injector);
        };
    }

    getTokens(): EventToken<any>[] {
        return [...this.context.keys()];
    }

    hasListeners(eventToken: EventToken<any>): boolean {
        return this.context.has(eventToken);
    }

    getListeners(eventToken: EventToken<any>): EventListenerContainerEntry[] {
        return this.getContext(eventToken).listeners;
    }

    /**
     * Dispatches the given event to all listeners for the given event token.
     */
    dispatch<T extends EventToken<any>>(eventToken: T, ...args: DispatchArguments<T>): EventDispatcherDispatchType<T> {
        const context = this.getContext(eventToken);
        return context.dispatcher(args[0], args[1] || this.injector);
    }

    /**
     * Returns a dispatcher function for the given event token.
     * This is the most performant way to dispatch events, as it's pre-compiled
     * and if there are no listeners attached it's a noop.
     */
    getDispatcher<T extends EventToken<any>>(eventToken: T): Dispatcher<T> {
        const context = this.getContext(eventToken);
        return ((event: BaseEvent, injector: InjectorContext = this.injector) => {
            return context.dispatcher(event, injector);
        }) as any as Dispatcher<T>;
    }
}

function buildStaticDispatcher(
    context: Context,
    eventToken: EventToken<any>,
    injector: InjectorContext
): EventDispatcherFn {
    const compiler = new CompilerContext();
    const lines: string[] = [];

    const awaitKeyword = isSyncEventToken(eventToken) ? '' : 'await';
    const listeners = context.listeners;
    if (!listeners.length) return noop;

    listeners.sort((a, b) => {
        if (a.order > b.order) return +1;
        if (a.order < b.order) return -1;
        return 0;
    });

    compiler.set({
        eventToken,
        resolveEvent,
    });

    lines.push(`
        if ('function' === typeof event) event = event();
        event = resolveEvent(eventToken, event);
        `);

    for (const listener of listeners) {
        if (isEventListenerContainerEntryCallback(listener)) {
            const listenerInjector = listener.module ? injector.getInjector(listener.module) : injector.getRootInjector();
            try {
                const fn = injectedFunction(listener.fn, listenerInjector, 1);
                const fnVar = compiler.reserveVariable('fn', fn);
                lines.push(`
                        ${awaitKeyword} ${fnVar}(scopedContext.scope, event);
                        if (event.isPropagationStopped()) return;
                    `);
            } catch (error: any) {
                throw new Error(`Could not build listener ${listener.fn.name || 'anonymous function'} of event token ${eventToken.id}: ${error.message}`);
            }
        } else if (isEventListenerContainerEntryService(listener)) {
            const resolver = injector.resolve(listener.module, listener.classType);
            const resolverVar = compiler.reserveVariable('resolver', resolver);
            let call = `${resolverVar}(scopedContext.scope).${listener.methodName}(event)`;

            const method = ReflectionClass.from(listener.classType).getMethod(listener.methodName);

            if (method.getParameters().length > 1) {
                const listenerInjector = listener.module ? injector.getInjector(listener.module) : injector.getRootInjector();
                const fn = injectedFunction((event, classInstance, ...args: any[]) => {
                    return classInstance[listener.methodName](event, ...args);
                }, listenerInjector, 2, method.type, 1);

                call = `${compiler.reserveVariable('fn', fn)}(scopedContext.scope, event, ${resolverVar}(scopedContext.scope))`;
            }

            lines.push(`
                    ${awaitKeyword} ${call};
                    if (event.isPropagationStopped()) return;
                `);
        }
    }
    if (isSyncEventToken(eventToken)) {
        return compiler.build(lines.join('\n'), 'event', 'scopedContext') as EventDispatcherFn;
    }
    return compiler.buildAsync(lines.join('\n'), 'event', 'scopedContext') as EventDispatcherFn;
}

function buildDispatcher(eventToken: EventToken<any>, entries: EventListenerContainerEntry[], injector: InjectorContext) {
    if (entries.length === 0) {
        if (isSyncEventToken(eventToken)) {
            return (parent: EventDispatcherInterface, event: ValueOrFactory<BaseEvent>) => {
                parent.dispatch(eventToken, event);
            };
        }
        return async (parent: EventDispatcherInterface, event: ValueOrFactory<BaseEvent>) => {
            await parent.dispatch(eventToken, event);
        };
    }

    entries.sort((a, b) => {
        if (a.order > b.order) return +1;
        if (a.order < b.order) return -1;
        return 0;
    });

    const calls: Array<(event: BaseEvent) => any> = [];

    for (const listener of entries) {
        if (isEventListenerContainerEntryCallback(listener)) {
            let fn = listener.builtFn;
            if (!fn) {
                try {
                    const thisInjector = listener.module ? injector.getInjector(listener.module) : injector.getRootInjector();
                    fn = listener.builtFn = injectedFunction(listener.fn, thisInjector, 1);
                } catch (error: any) {
                    throw new Error(`Could not build listener ${listener.fn.name || 'anonymous function'} of event token ${eventToken.id}: ${error.message}`);
                }
            }

            calls.push((event) => fn(injector.scope, event));
        } else if (isEventListenerContainerEntryService(listener)) {
            calls.push((event) => injector.get(listener.classType, listener.module)[listener.methodName](event));
        }
    }

    if (isSyncEventToken(eventToken)) {
        return (event: ValueOrFactory<BaseEvent>) => {
            if ('function' === typeof event) event = event();
            event = resolveEvent(eventToken, event as any);
            for (const call of calls) {
                call(event);
                if (event.isPropagationStopped()) return;
            }
        };
    }

    return async (event: ValueOrFactory<BaseEvent>) => {
        if ('function' === typeof event) event = event();
        event = resolveEvent(eventToken, event as any);
        for (const call of calls) {
            await call(event);
            if (event.isPropagationStopped()) return;
        }
    };
}

export function eventWatcher(eventDispatcher: EventDispatcher, tokens: readonly EventToken<any>[]) {
    const dispatches: [eventTokenId: string, event: BaseEvent | any][] = [];
    const messages: string[] = [];

    function debugData(data: object): string {
        const lines: string[] = [];
        for (const i in data) {
            if (isObject((data as any)[i])) continue;
            lines.push(`${i}=${((data as any)[i])}`);
        }
        return lines.join(' ');
    }

    for (const token of tokens) {
        eventDispatcher.listen(token, (event) => {
            const data = event instanceof DataEvent ? event.data : event;
            dispatches.push([token.id, data]);
            const string = debugData(data);
            messages.push(`${token.id}${string ? ` ${string}` : ''}`);
        });
    }

    type EventTokenSimpleData<T> = T extends EventToken<infer E> | EventTokenSync<infer E> ? E extends SimpleDataEvent<infer D> ? D : E : never;

    return {
        dispatches,
        messages,
        clear() {
            dispatches.length = 0;
            messages.length = 0;
        },
        get<T extends EventToken>(token: T, filter?: (event: EventTokenSimpleData<T>) => boolean): EventTokenSimpleData<T> {
            for (const [id, event] of dispatches) {
                const data = event instanceof DataEvent ? event.data : event;
                if (id === token.id && (!filter || filter(data))) return data;
            }
            throw new Error(`No event dispatched for token ${token.id}`);
        },
    };
}
