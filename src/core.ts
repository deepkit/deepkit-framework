import {SiftQuery} from "sift";
import {BehaviorSubject, TeardownLogic, Subject} from "rxjs";
import {tearDown} from "@marcj/estdlib-rxjs";
import {IdInterface} from "./contract";

export type FilterQuery<T> = SiftQuery<T[]>;

export class StreamBehaviorSubject<T> extends BehaviorSubject<T> {
    protected nextChange?: Subject<void>;

    protected teardowns: TeardownLogic[] = [];

    constructor(
        item: T,
        teardown?: TeardownLogic,
    ) {
        super(item);
        if (teardown) {
            this.teardowns.push(teardown);
        }
    }

    get nextStateChange() {
        if (!this.nextChange) {
            this.nextChange = new Subject<void>();
        }
        return this.nextChange.toPromise();
    }

    addTearDown(teardown: TeardownLogic) {
        this.teardowns.push(teardown);
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
        for (const teardown of this.teardowns) {
            tearDown(teardown);
        }
    }
}

export class EntitySubject<T extends IdInterface | undefined> extends StreamBehaviorSubject<T> {
}

export type JSONEntity<T> = {
    [P in keyof T]?: any;
};
