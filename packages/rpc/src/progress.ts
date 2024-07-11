/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BehaviorSubject, Subject, Subscriber, Subscription, SubscriptionLike } from 'rxjs';

export class SingleProgress extends Subject<SingleProgress> {
    public done = false;

    public total = 0;
    public current = 0;
    public stats = 0;

    protected lastTime = 0;

    protected triggerFinished?: Function;
    finished = new Promise((resolve) => {
        this.triggerFinished = resolve;
    });

    constructor() {
        super();
    }

    /**
     * Acts like a BehaviorSubject.
     */
    _subscribe(subscriber: Subscriber<SingleProgress>): Subscription {
        //Subject does not expose protected _subscribe anymore, so we have to use prototype directly
        const subscription = (Subject as any).prototype._subscribe.apply(this, [subscriber]);
        if (subscription && !(<SubscriptionLike>subscription).closed) {
            subscriber.next(this);
        }
        return subscription;
    }

    public setStart(total: number) {
        this.total = total;
        this.lastTime = Date.now();
    }


    public setBatch(size: number) {
        this.current += size;
        this.lastTime = Date.now();
    }

    get progress(): number {
        if (this.done) return 1;
        if (this.total === 0) return 0;
        return this.current / this.total;
    }

    set(total: number, current: number) {
        if (this.done) return;
        this.total = total;
        this.current = current;
        this.done = total === current;
        this.stats++;
        this.next(this);
        if (this.done) {
            this.complete();
            if (this.triggerFinished) this.triggerFinished();
        }
    }
}

export class Progress extends BehaviorSubject<number> {
    public readonly upload = new SingleProgress;
    public readonly download = new SingleProgress;

    constructor() {
        super(0);
    }
}

export class ClientProgress {
    static nextProgress?: Progress;

    /**
     * Returns the current stack and sets a new one.
     */
    static getNext(): Progress | undefined {
        if (ClientProgress.nextProgress) {
            const old = ClientProgress.nextProgress;
            ClientProgress.nextProgress = undefined;
            return old;
        }
        return undefined;
    }

    /**
     * Sets up a new Progress object for the next API request to be made.
     * Only the very next API call will be tracked.
     *
     * @example
     * ```typescript
     *
     * ClientProgress.track();
     * await api.myMethod();
     *
     * ```
     */
    static track(): Progress {
        const progress = new Progress;
        ClientProgress.nextProgress = progress;
        return progress;
    }
}
