/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BehaviorSubject, isObservable, Observable, Subject, Subscriber, Subscription, TeardownLogic } from 'rxjs';
import { arrayRemoveItem, createStack, isFunction, mergePromiseStack, mergeStack } from '@deepkit/core';
import { first, skip } from 'rxjs/operators';

export class AsyncSubscription {
    protected unsubscribed = false;

    constructor(private cb: () => Promise<void>) {
    }

    async unsubscribe(): Promise<void> {
        if (this.unsubscribed) return;

        this.unsubscribed = true;

        await this.cb();
    }
}

export function isSubject(v: any): v is Subject<any> {
    return v && isFunction(v.unsubscribe) && isObservable(v);
}

export function isBehaviorSubject(v: any): v is BehaviorSubject<any> {
    return v && isFunction(v.getValue) && isSubject(v);
}

/**
 * RXJS subscription collection, to easily collect multiple subscriptions and unsubscribe all at once.
 * Added subscriptions are automatically removed when they get unsubscribed.
 *
 * @example
 * ```typescript
 * const subs = new Subscriptions();
 *
 * subs.add = new Subscription(() => {});
 * subs.add = observeable.subscribe((next) => {});
 *
 * subs.unsubscribe();
 * ```
 */
export class Subscriptions {
    public readonly list: Subscription[] = [];

    constructor(protected teardown?: () => void | Promise<void>) {
    }

    public set add(v: Subscription) {
        this.list.push(v);

        v.add(() => {
            arrayRemoveItem(this.list, v);
        });
    }

    public unsubscribe() {
        //it's important to work on a array copy, since unsubscribe() modifies directly this.list
        for (const sub of this.list.slice(0)) {
            sub.unsubscribe();
        }

        if (this.teardown) {
            this.teardown();
        }

        this.list.splice(0, this.list.length);
    }
}

export function subscriptionToPromise<T>(subscription: Subscription): Promise<void> {
    return new Promise((resolve) => {
        const sub = subscription.add(() => {
            resolve();
            sub.unsubscribe();
        });
    });
}

export function nextValue<T>(o: Observable<T>): Promise<T> {
    if (isFunction((o as any).getValue)) { //BehaviorSubject
        return o.pipe(skip(1)).pipe(first()).toPromise();
    }

    return o.pipe(first()).toPromise();
}

export function observableToPromise<T>(o: Observable<T>, next?: (data: T) => void): Promise<T> {
    const stack = createStack();
    return new Promise((resolve, reject) => {
        let last: T;
        o.subscribe((data: any) => {
            if (next) {
                next(data);
            }
            last = data;
        }, (error: any) => {
            mergeStack(error, stack);
            reject(error);
        }, () => {
            resolve(last);
        });
    });
}

export function promiseToObservable<T>(o: () => Promise<T>): Observable<T> {
    const stack = createStack();
    return new Observable((observer: Subscriber<T>) => {
        try {
            mergePromiseStack(o(), stack).then((data) => {
                observer.next(data);
                observer.complete();
            }, (error) => {
                observer.error(error);
            });
        } catch (error) {
            observer.error(error);
        }

    });
}

export async function tearDown(teardown: TeardownLogic) {
    if ('function' === typeof teardown) {
        await teardown();
    } else if ('object' === typeof teardown && teardown.unsubscribe) {
        await teardown.unsubscribe();
    }
}
