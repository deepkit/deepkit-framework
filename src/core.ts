import {BehaviorSubject, TeardownLogic, Subject} from "rxjs";
import {tearDown} from "@marcj/estdlib-rxjs";
import {IdInterface} from "./contract";

export type Query<T> = {
    $eq?: T;
    $ne?: T;
    $or?: Array<FilterQuery<T>>;
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $mod?: number[];
    $in?: Array<T>;
    $nin?: Array<T>;
    $not?: FilterQuery<T>;
    $type?: any;
    $all?: Array<Partial<T>>;
    $size?: number;
    $nor?: Array<FilterQuery<T>>;
    $and?: Array<FilterQuery<T>>;
    $regex?: RegExp | string;
    $exists?: boolean;
    $options?: "i" | "g" | "m" | "u";
};

export type FilterQuery<T> = {
    [P in keyof T]?: Query<T[P]> | T[P];
} | Query<T>;


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
