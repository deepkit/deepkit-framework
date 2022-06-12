/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, isClass, isFunction } from '@deepkit/core';
import { injectedFunction } from '@deepkit/injector';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, PropertyDecoratorResult } from '@deepkit/type';

export type EventListenerCallback<T> = (event: T, ...args: any[]) => void | Promise<void>;

export interface EventListener<T> {
    eventToken: EventToken<any>;
    callback: EventListenerCallback<T>;
    module?: InjectorModule,
    order: number;
}

export type EventOfEventToken<T> = T extends EventToken<infer E> ? E extends DataEvent<infer D> ? D | E : E : BaseEvent;

interface SimpleDataEvent<T> extends BaseEvent {
    data: T;
}

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

    listen(callback: (event: T, ...args: any[]) => void, order: number = 0, module?: InjectorModule): EventListener<T> {
        return { eventToken: this, callback, order: order, module };
    }
}

export class DataEventToken<T> extends EventToken<SimpleDataEvent<T>> {

}

export class BaseEvent {
    stopped = false;

    stopPropagation() {
        this.stopped = true;
    }

    isStopped() {
        return this.stopped;
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
     * order: The lower the order, the sooner the listener is called.
     */
    listen(eventToken: EventToken<any>, order: number = 0) {
        if (!eventToken) new Error('@eventDispatcher.listen() No event token given');
        this.t.token = eventToken;
        this.t.order = order;
    }
}

export const eventDispatcher: PropertyDecoratorResult<typeof EventDispatcherApi> = createPropertyDecoratorContext(EventDispatcherApi);

export type EventListenerContainerEntryCallback = { order: number, fn: EventListenerCallback<any>, module?: InjectorModule, };
export type EventListenerContainerEntryService = { module: InjectorModule, order: number, classType: ClassType, methodName: string };
export type EventListenerContainerEntry = EventListenerContainerEntryCallback | EventListenerContainerEntryService;

export function isEventListenerContainerEntryCallback(obj: any): obj is EventListenerContainerEntryCallback {
    return obj && isFunction(obj.fn);
}

export function isEventListenerContainerEntryService(obj: any): obj is EventListenerContainerEntryService {
    return obj && isClass(obj.classType);
}

interface EventDispatcherFn {
    (scopedContext: InjectorContext, event: BaseEvent): Promise<void>;
}

export class EventDispatcher {
    protected listenerMap = new Map<EventToken<any>, EventListenerContainerEntry[]>();
    protected instances: any[] = [];
    protected registeredClassTypes = new Set<ClassType>();

    protected symbol = Symbol('eventDispatcher');

    constructor(
        public injector: InjectorContext = InjectorContext.forProviders([]),
    ) {
    }

    public registerListener(listener: ClassType, module: InjectorModule) {
        if (this.registeredClassTypes.has(listener)) return;
        this.registeredClassTypes.add(listener);
        const config = eventClass._fetch(listener);
        if (!config) return;
        for (const entry of config.listeners) {
            this.add(entry.eventToken, { module, classType: listener, methodName: entry.methodName, order: entry.order });
        }
    }

    listen<T extends EventToken<any>, DEPS extends any[]>(eventToken: T, callback: EventListenerCallback<T['event']>, order: number = 0): void {
        this.add(eventToken, { fn: callback, order: order });
    }

    public add(eventToken: EventToken<any>, listener: EventListenerContainerEntry) {
        this.getListeners(eventToken).push(listener);
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

    protected build(): EventDispatcherFn {
        const compiler = new CompilerContext();

        const code: string[] = [];

        for (const [eventToken, listeners] of this.listenerMap.entries()) {
            listeners.sort((a, b) => {
                if (a.order > b.order) return +1;
                if (a.order < b.order) return -1;
                return 0;
            });

            const lines: string[] = [];

            for (const listener of listeners) {
                if (isEventListenerContainerEntryCallback(listener)) {
                    const injector = listener.module ? this.injector.getInjector(listener.module) : this.injector.getRootInjector();
                    const fn = injectedFunction(listener.fn, injector, 1);
                    const fnVar = compiler.reserveVariable('fn', fn);
                    lines.push(`
                        await ${fnVar}(scopedContext.scope, event);
                        if (event.isStopped()) return;
                    `);
                } else if (isEventListenerContainerEntryService(listener)) {
                    const classTypeVar = compiler.reserveVariable('classType', listener.classType);
                    lines.push(`
                        await scopedContext.get(${classTypeVar}).${listener.methodName}(event);
                    `);
                }
            }

            const eventTokenVar = compiler.reserveVariable('eventToken', eventToken);
            code.push(`
            //${eventToken.id}
            case: ${eventTokenVar}: {
                ${lines.join('\n')}
                return;
            }
            `);
        }

        return compiler.buildAsync(`
        switch (eventToken) {
            ${code.join('\n')}
        }
        `, 'scopedContext', 'event') as EventDispatcherFn;
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
                const injector = listener.module ? this.injector.getInjector(listener.module) : this.injector.getRootInjector();
                try {
                    const fn = injectedFunction(listener.fn, injector, 1);
                    const fnVar = compiler.reserveVariable('fn', fn);
                    lines.push(`
                        await ${fnVar}(scopedContext.scope, event);
                        if (event.isStopped()) return;
                    `);
                } catch (error: any) {
                    throw error;
                    // throw new Error(`Could not build listener ${listener.fn.name || 'anonymous function'} of event token ${eventToken.id}: ${error.message}`);
                }
            } else if (isEventListenerContainerEntryService(listener)) {
                const classTypeVar = compiler.reserveVariable('classType', listener.classType);
                const moduleVar = compiler.reserveVariable('module', listener.module);
                lines.push(`
                    await scopedContext.get(${classTypeVar}, ${moduleVar}).${listener.methodName}(event);
                `);
            }
        }
        return compiler.buildAsync(lines.join('\n'), 'scopedContext', 'event') as EventDispatcherFn;
    }

    public async dispatch<T extends EventToken<any>>(eventToken: T, event?: EventOfEventToken<T>, injector?: InjectorContext): Promise<void> {
        let build = (eventToken as any)[this.symbol];
        if (!build) {
            build = (eventToken as any)[this.symbol]= { fn: this.buildFor(eventToken) };
        }

        //no fn means for this token has no listeners
        const e = eventToken instanceof DataEventToken && (event as any) instanceof DataEvent ? event : new DataEvent(event);
        return build.fn ? build.fn(injector || this.injector, e) : undefined;
    }
}
