/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {arrayRemoveItem} from './core';

type AsyncSubscriber<T> = (event: T) => Promise<void> | void;

export type AsyncEventSubscription = { unsubscribe: () => void };

let asyncId = 0;

export class AsyncEmitterEvent {
    public readonly id = asyncId++;
    public stopped = false;

    stop() {
        this.stopped = true;
    }
}

export class AsyncEventEmitter<T extends AsyncEmitterEvent> {
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
        if (event.stopped) return;

        for (const subscriber of this.subscribers) {
            await subscriber(event);
            if (event.stopped) return;
        }
    }

    public hasSubscriptions(): boolean {
        return this.subscribers.length > 0;
    }
}
