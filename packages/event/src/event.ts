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
import { Context, InjectorContext } from '@deepkit/injector';
import { createClassDecoratorContext, createPropertyDecoratorContext } from '@deepkit/type';

export type EventListenerCallback<T> = (event: T) => void | Promise<void>;

export interface EventListener<T> {
    eventToken: EventToken<any>;
    callback: EventListenerCallback<T>;
    order: number;
}

export type EventOfEventToken<T> = T extends EventToken<infer E> ? E : unknown;

export class EventToken<T extends BaseEvent> {
    /**
     * This is only to get easy the event-type. In reality this property is undefined.
     * e.g. `onHttpRequest(event: typeof onHttpRequest.event) {`
     */
    public readonly event!: T;

    constructor(
        public readonly id: string,
        event: ClassType<T>,
    ) {
    }

    listen(callback: (event: T) => void, order: number = 0): EventListener<T> {
        return { eventToken: this, callback, order: order };
    }
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

export const eventClass = createClassDecoratorContext(
    class {
        t = new EventClassStore;

        addListener(eventToken: EventToken<any>, methodName: string, order: number) {
            this.t.listeners.push({ eventToken, methodName, order: order });
        }
    }
);

export const eventDispatcher = createPropertyDecoratorContext(
    class {
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
);


export type EventListenerContainerEntryCallback = { order: number, fn: EventListenerCallback<any> };
export type EventListenerContainerEntryService = { context?: Context, order: number, classType: ClassType, methodName: string };
export type EventListenerContainerEntry = EventListenerContainerEntryCallback | EventListenerContainerEntryService;

export function isEventListenerContainerEntryCallback(obj: any): obj is EventListenerContainerEntryCallback {
    return obj && isFunction(obj.fn);
}

export function isEventListenerContainerEntryService(obj: any): obj is EventListenerContainerEntryService {
    return obj && isClass(obj.classType);
}

interface EventDispatcherFn {
    (instances: any[], scopedContext: InjectorContext, eventToken: EventToken<any>, event: BaseEvent): Promise<void>;
}

export class EventDispatcher {
    protected listenerMap = new Map<EventToken<any>, EventListenerContainerEntry[]>();
    protected instances: any[] = [];
    protected registeredClassTypes = new Set<ClassType>();

    constructor(
        public scopedContext: InjectorContext = InjectorContext.forProviders([]),
    ) {
    }

    public registerListener(listener: ClassType, context?: Context) {
        if (this.registeredClassTypes.has(listener)) return;
        this.registeredClassTypes.add(listener);
        const config = eventClass._fetch(listener);
        if (!config) return;
        for (const entry of config.listeners) {
            this.add(entry.eventToken, { context, classType: listener, methodName: entry.methodName, order: entry.order });
        }
    }

    public registerCallback<E extends BaseEvent>(eventToken: EventToken<E>, callback: (event: E) => Promise<void> | void, order: number = 0) {
        this.add(eventToken, { fn: callback, order: order });
    }

    public add(eventToken: EventToken<any>, listener: EventListenerContainerEntry) {
        this.getListeners(eventToken).push(listener);
        (eventToken as any)[this.symbol] = this.buildFor(eventToken);
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
                    const fnVar = compiler.reserveVariable('fn', listener.fn);
                    lines.push(`
                        r = await ${fnVar}(event);
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
        `, 'instances', 'scopedContext', 'eventToken', 'event') as EventDispatcherFn;
    }

    protected symbol = Symbol('eventDispatcher');

    protected buildFor(eventToken: EventToken<any>) {
        const compiler = new CompilerContext();
        const lines: string[] = [];
        for (const listener of this.listenerMap.get(eventToken) || []) {
            if (isEventListenerContainerEntryCallback(listener)) {
                const fnVar = compiler.reserveVariable('fn', listener.fn);
                lines.push(`
                    r = await ${fnVar}(event);
                    if (event.isStopped()) return;
                `);
            } else if (isEventListenerContainerEntryService(listener)) {
                const classTypeVar = compiler.reserveVariable('classType', listener.classType);
                lines.push(`
                    await scopedContext.get(${classTypeVar}).${listener.methodName}(event);
                `);
            }
        }
        return compiler.buildAsync(lines.join('\n'), 'scopedContext', 'event');
    }

    public dispatch<T extends EventToken<any>>(eventToken: T, event: EventOfEventToken<T>): Promise<void> {
        let fn = (eventToken as any)[this.symbol];
        //no fn means for this token does no listener exist
        return fn ? fn(this.scopedContext, event) : undefined;
    }
}
