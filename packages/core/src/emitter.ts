import {arrayRemoveItem} from './core';

type AsyncSubscriber<T> = (event: T) => Promise<void> | void;

export type AsyncEventSubscription = { unsubscribe: () => void };

let asyncId = 0;

export class AsyncEmitterEvent {
    public readonly id = asyncId++;
    public stopped = false;

    stopPropagation() {
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
