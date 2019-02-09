import {Observable, Subscription, TeardownLogic} from "rxjs";

export class AsyncSubscription {
    constructor(private cb: () => Promise<void>) {
    }

    async unsubscribe(): Promise<void> {
        await this.cb();
    }
}

export function tearDown(teardown: TeardownLogic) {
    if ('function' === typeof teardown) {
        teardown();
    } else if ('object' === typeof teardown && teardown.unsubscribe) {
        teardown.unsubscribe();
    }
}

export class Subscriptions {
    protected subscription: Subscription[] = [];

    constructor(protected teardown?: () => void | Promise<void>) {

    }

    public subscribe<T>(observable: Observable<T>, callback: (next: T) => any) {
        this.subscription.push(observable.subscribe(callback));
        if (this.teardown) {
            this.teardown();
        }
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
