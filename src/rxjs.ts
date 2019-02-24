import {Observable, Subscription, Subscriber} from "rxjs";
import {createStack, mergePromiseStack, mergeStack} from "@marcj/estdlib";

export class AsyncSubscription {
    constructor(private cb: () => Promise<void>) {
    }

    async unsubscribe(): Promise<void> {
        await this.cb();
    }
}

/**
 * RXJS subscription collection, to easily collection multiple subscriptions and unsubscribe all at once.
 */
export class Subscriptions {
    protected subscription: Subscription[] = [];

    public subscribe<T>(observable: Observable<T>, callback: (next: T) => any) {
        this.subscription.push(observable.subscribe(callback));
    }

    public set add(v: Subscription) {
        this.subscription.push(v);
    }

    public unsubscribe() {
        for (const sub of this.subscription) {
            sub.unsubscribe();
        }

        this.subscription = [];
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

export function awaitFirst<T>(o: Observable<T>): Promise<T> {
    const stack = createStack();
    return new Promise((resolve, reject) => {

        o.subscribe((data: any) => {
            resolve(data);
        }, (error: any) => {
            mergeStack(error, stack);
            reject(error);
        }, () => {
            resolve();
        });
    });
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
