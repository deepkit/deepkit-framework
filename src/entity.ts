import {BehaviorSubject, TeardownLogic, Subject} from "rxjs";
import {tearDown} from "./rx";

export class EntitySubject<T> extends BehaviorSubject<T> {
    protected nextChange?: Subject<void>;

    constructor(
        item: T,
        protected teardown?: TeardownLogic,
    ) {
        super(item);
    }

    get nextStateChange() {
        if (!this.nextChange) {
            this.nextChange = new Subject<void>();
        }
        return this.nextChange.toPromise();
    }

    next(value: T): void {
        super.next(value);

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    unsubscribe(): void {
        super.unsubscribe();
        tearDown(this.teardown);
    }
}

export type JSONEntity<T> = {
    [P in keyof T]?: any;
};
