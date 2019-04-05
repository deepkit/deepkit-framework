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
    public readonly appendSubject = new Subject<T>();
    protected nextChange?: Subject<void>;

    protected nextOnAppend = false;
    protected unsubscribed = false;

    protected lastValue: T;

    protected teardowns: TeardownLogic[] = [];

    constructor(
        item: T,
        teardown?: TeardownLogic,
    ) {
        super(item);
        this.lastValue = item;
        if (teardown) {
            this.teardowns.push(teardown);
        }
    }

    public isUnsubscribed(): boolean {
        return this.unsubscribed;
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

    get value(): T {
        return this.lastValue;
    }

    /**
     * This method differs to BehaviorSubject in the way that this does not throw an error
     * when the subject is closed/unsubscribed.
     */
    getValue(): T {
        if (this.hasError) {
            throw this.thrownError;
        } else {
            return this.lastValue;
        }
    }

    next(value: T): void {
        super.next(value);
        this.lastValue = value;

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    activateNextOnAppend() {
        this.nextOnAppend = true;
    }

    append(value: T): void {
        this.appendSubject.next(value);

        if (this.nextOnAppend) {
            this.next(this.getValue() as any + value);
        }
    }

    async unsubscribe(): Promise<void> {
        if (this.unsubscribed) return;

        for (const teardown of this.teardowns) {
            await tearDown(teardown);
        }

        await super.unsubscribe();
        this.unsubscribed = true;
    }
}

export class EntitySubject<T extends IdInterface | undefined> extends StreamBehaviorSubject<T> {
}

export type JSONEntity<T> = {
    [P in keyof T]?: any;
};
