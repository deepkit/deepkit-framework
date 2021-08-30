import { Subject, Subscriber, Subscription, SubscriptionLike } from 'rxjs';
import { first } from 'rxjs/operators';

/**
 * Emits values like BehaviorSubject, but with initially empty value.
 *
 * Executes the given `loader` when the first subscriber subscribes.
 * The loader then loads async data and passes the data via `next` to this
 * subject and with that to all its subscribers.
 */
export class LiveSubject<T> extends Subject<T> {
    value?: T;
    protected loaderCalled: boolean = false;

    constructor(protected loader: (subject: LiveSubject<T>) => void) {
        super();
    }

    hasValue(): boolean {
        return this.value !== undefined;
    }

    get valueArrival(): Promise<T> {
        if (this.value) return Promise.resolve(this.value);
        return this.pipe(first()).toPromise();
    }

    /**
     * Reloads data from the loader.
     */
    reload(): void {
        this.loaderCalled = true;
        this.loader(this);
    }

    _subscribe(subscriber: Subscriber<T>): Subscription {
        const subscription = super._subscribe(subscriber);
        if (this.hasValue() && subscription && !(<SubscriptionLike>subscription).closed) {
            subscriber.next(this.value);
        }
        if (!this.loaderCalled && !this.hasValue()) {
            this.loaderCalled = true;
            this.loader(this);
        }
        return subscription;
    }

    next(v: T) {
        super.next(this.value = v);
    }
}
