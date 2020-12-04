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

import {ClassType, isClass, isFunction} from '@deepkit/core';
import {Context, InjectorContext} from './injector/injector';
import {createClassDecoratorContext, createPropertyDecoratorContext} from '@deepkit/type';


export type EventListenerCallback<T> = (event: T) => void | Promise<void>;

export interface EventListener<T> {
    eventToken: EventToken<any>;
    callback: EventListenerCallback<T>;
    priority: number;
}

export type EventOfEventToken<T> = T extends EventToken<infer E> ? E : unknown;

export class EventToken<T extends BaseEvent> {
    /**
     * This is only for easy event-type retrievable.
     * e.g. `onHttpRequest(event: typeof onHttpRequest.event) {`
     */
    public readonly event!: T;

    constructor(
        public readonly id: string,
        event: ClassType<T>,
    ) {
    }

    listen(callback: (event: T) => void, priority: number = 0): EventListener<T> {
        return {eventToken: this, callback, priority};
    }
}

export class BaseEvent {
    protected stopped = false;

    stopPropagation() {
        this.stopped = true;
    }

    isStopped() {
        return this.stopped;
    }
}

class EventStore {
    token?: EventToken<any>;
    priority: number = 0;
}

class EventClassStore {
    listeners: { eventToken: EventToken<any>, methodName: string, priority: number }[] = [];
}

export const eventClass = createClassDecoratorContext(
    class {
        t = new EventClassStore;

        addListener(eventToken: EventToken<any>, methodName: string, priority: number) {
            this.t.listeners.push({eventToken, methodName, priority});
        }
    }
);

export const eventDispatcher = createPropertyDecoratorContext(
    class {
        t = new EventStore;

        onDecorator(target: ClassType, property?: string) {
            if (!this.t.token) throw new Error('@eventDispatcher.listen(eventToken) is the correct syntax.');
            if (!property) throw new Error('@eventDispatcher.listen(eventToken) works only on class properties.');

            eventClass.addListener(this.t.token, property, this.t.priority)(target);
        }

        listen(eventToken: EventToken<any>, priority: number = 0) {
            if (!eventToken) new Error('@eventDispatcher.listen() No event token given');
            this.t.token = eventToken;
            this.t.priority = priority;
        }
    }
);


export type EventListenerContainerEntryCallback = { priority: number, fn: EventListenerCallback<any> };
export type EventListenerContainerEntryService = { context?: Context, priority: number, classType: ClassType, methodName: string };
export type EventListenerContainerEntry = EventListenerContainerEntryCallback | EventListenerContainerEntryService;

function isEventListenerContainerEntryCallback(obj: any): obj is EventListenerContainerEntryCallback {
    return obj && isFunction(obj.fn);
}

function isEventListenerContainerEntryService(obj: any): obj is EventListenerContainerEntryService {
    return obj && isClass(obj.classType);
}

export class EventDispatcher {
    protected listenerMap = new Map<EventToken<any>, EventListenerContainerEntry[]>();
    protected needsSort: boolean = false;

    constructor(
        protected scopedContext: InjectorContext,
    ) {
    }

    for(scopedContext: InjectorContext) {
        const ed = new EventDispatcher(scopedContext);
        ed.listenerMap = this.listenerMap;
        ed.needsSort = this.needsSort;
        return ed;
    }

    public registerListener(listener: ClassType, context?: Context) {
        const config = eventClass._fetch(listener);
        if (!config) return;
        for (const entry of config.listeners) {
            this.add(entry.eventToken, {context, classType: listener, methodName: entry.methodName, priority: entry.priority});
        }
    }

    public registerCallback<E extends BaseEvent>(eventToken: EventToken<E>, callback: (event: E) => Promise<void> | void, priority: number = 0) {
        this.add(eventToken, {fn: callback, priority: priority});
    }

    public add(eventToken: EventToken<any>, listener: EventListenerContainerEntry) {
        this.getListeners(eventToken).push(listener);
        this.needsSort = true;
    }

    protected getListeners(eventToken: EventToken<any>): EventListenerContainerEntry[] {
        let listeners = this.listenerMap.get(eventToken);
        if (!listeners) {
            listeners = [];
            this.listenerMap.set(eventToken, listeners);
        }

        return listeners;
    }

    protected sort() {
        if (!this.needsSort) return;

        for (const listeners of this.listenerMap.values()) {
            listeners.sort((a, b) => {
                if (a.priority > b.priority) return +1;
                if (a.priority < b.priority) return -1;
                return 0;
            });
        }

        this.needsSort = false;
    }

    public dispatch<T extends EventToken<any>>(eventToken: T, event: EventOfEventToken<T>): Promise<void> {
        return this.getCaller(eventToken)(event);
    }

    public getCaller<T extends EventToken<any>>(eventToken: T): (event: EventOfEventToken<T>) => Promise<void> {
        this.sort();
        const listeners = this.getListeners(eventToken);

        return async (event) => {
            for (const listener of listeners) {
                if (isEventListenerContainerEntryCallback(listener)) {
                    await listener.fn(event);
                } else if (isEventListenerContainerEntryService(listener)) {
                    await this.scopedContext.get(listener.classType)[listener.methodName](event);
                }
                if (event.isStopped()) {
                    return;
                }
            }
        };
    }
}
