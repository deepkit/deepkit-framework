/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem } from './array.js';

type AsyncSubscriber<T> = (event: T) => Promise<void> | void;
type Subscriber<T> = (event: T) => Promise<void> | void;

export type AsyncEventSubscription = { unsubscribe: () => void };
export type EventSubscription = { unsubscribe: () => void };

let asyncId = 0;

export class EmitterEvent {
    public readonly id = asyncId++;
    public stopped = false;
    public propagationStopped = false;

    /**
     * Stop propagating the event to subsequent event listeners.
     */
    stopPropagation() {
        this.propagationStopped = true;
    }

    /**
     * Signal the emitter that you want to abort.
     * Subsequent event listeners will still be called.
     */
    stop() {
        this.stopped = true;
    }
}

export class EventEmitter<T extends EmitterEvent> {
    protected subscribers: Subscriber<T>[] = [];

    constructor(protected parent?: EventEmitter<any>) {
    }

    public subscribe(callback: Subscriber<T>): EventSubscription {
        this.subscribers.push(callback);

        return {
            unsubscribe: () => {
                arrayRemoveItem(this.subscribers, callback);
            }
        };
    }

    public emit(event: T): void {
        if (this.parent) this.parent.emit(event);
        if (event.propagationStopped) return;

        for (const subscriber of this.subscribers) {
            subscriber(event);
            if (event.propagationStopped) return;
        }
    }

    public hasSubscriptions(): boolean {
        return this.subscribers.length > 0;
    }
}

export class AsyncEventEmitter<T extends EmitterEvent> {
    protected subscribers: AsyncSubscriber<T>[] = [];

    constructor(protected parent?: AsyncEventEmitter<any>) {
    }

    public subscribe(callback: AsyncSubscriber<T>): AsyncEventSubscription {
        this.subscribers.push(callback);

        return {
            unsubscribe: () => {
                arrayRemoveItem(this.subscribers, callback);
            }
        };
    }

    public async emit(event: T): Promise<void> {
        if (this.parent) await this.parent.emit(event);
        if (event.propagationStopped) return;

        for (const subscriber of this.subscribers) {
            await subscriber(event);
            if (event.propagationStopped) return;
        }
    }

    public hasSubscriptions(): boolean {
        return this.subscribers.length > 0;
    }
}
