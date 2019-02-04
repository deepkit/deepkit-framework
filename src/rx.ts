import {Observable, Subscription} from "rxjs";

export class AsyncSubscription {
    constructor(private cb: () => Promise<void>) {
    }

    async unsubscribe(): Promise<void> {
        await this.cb();
    }
}

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
