import {BehaviorSubject, Observable, Subject, TeardownLogic} from "rxjs";
import {tearDown} from "@super-hornet/core-rxjs";
import {IdInterface} from "./contract";
import {ClassType, CustomError} from '@super-hornet/core';
import {Buffer} from 'buffer';
import {
    arrayBufferTo,
    classToPlain,
    Entity,
    t,
    getClassSchema, getClassSchemaByName, getKnownClassSchemasNames, hasClassSchemaByName,
    plainToClass,
} from "@super-hornet/marshal";
import {skip} from "rxjs/operators";

@Entity('@error:json')
export class JSONError {
    constructor(@t.any.name('json') public readonly json: any) {
    }
}


export class ValidationErrorItem {
    constructor(
        @t.name('path') public readonly path: string,
        @t.name('message') public readonly message: string,
        @t.name('code') public readonly code: string,
    ) {
    }
}

@Entity('@error:validation')
export class ValidationError extends CustomError {
    constructor(
        @t.array(ValidationErrorItem).name('errors') public readonly errors: ValidationErrorItem[]
    ) {
        super('Validation error');
    }

    static from(errors: { path: string, message: string, code?: string }[]) {
        return new ValidationError(errors.map(v => new ValidationErrorItem(v.path, v.message, v.code || '')));
    }

    get message(): string {
        return this.errors.map(v => `${v.path}: ${v.message} (${v.code})`).join(',');
    }
}

@Entity('@error:parameter')
export class ValidationParameterError {
    constructor(
        @t.name('controller') public readonly controller: string,
        @t.name('action') public readonly action: string,
        @t.name('arg') public readonly arg: number,
        @t.array(ValidationErrorItem).name('errors') public readonly errors: ValidationErrorItem[]
    ) {
    }

    get message(): string {
        return this.errors.map(v => `${v.path}: ${v.message} (${v.code})`).join(',');
    }
}

export function getSerializedErrorPair(error: any): [string, any, any] {
    if (error instanceof Error) {
        return ['@error:default', error.message, error.stack];
    } else {
        const entityName = getClassSchema(error['constructor'] as ClassType<typeof error>).name;
        if (entityName) {
            return [entityName, classToPlain(error['constructor'] as ClassType<typeof error>, error), error ? error.stack : undefined];
        }
    }

    return ['@error:default', error, undefined];
}

export function getUnserializedError(entityName: string, error: any, stack: any, info: string = ''): any {
    if (!entityName || entityName === '@error:default') {
        const errorObject = new Error(error);
        if (stack) {
            // console.log('error stack', errorObject.stack);
            // console.log('server stack', stack);

            errorObject.stack = errorObject.stack + `\n    at ORIGIN (${info})\n` + stack.substr(stack.indexOf('\n    at'));
            // console.log('result', errorObject.stack);
        }
        return errorObject;
    }

    if (!hasClassSchemaByName(entityName)) {
        throw new Error(`Marshal entity ${entityName} not known. (known: ${getKnownClassSchemasNames().join(',')})`);
    }
    return plainToClass(getClassSchemaByName(entityName).classType, error);
}

// export type Query<T> = {
//     $eq?: T;
//     $ne?: T;
//     $or?: Array<FilterQuery<T>>;
//     $gt?: T;
//     $gte?: T;
//     $lt?: T;
//     $lte?: T;
//     $mod?: number[];
//     $in?: Array<T>;
//     $nin?: Array<T>;
//     $not?: FilterQuery<T>;
//     $type?: any;
//     $all?: Array<Partial<T>>;
//     $size?: number;
//     $nor?: Array<FilterQuery<T>>;
//     $and?: Array<FilterQuery<T>>;
//     $regex?: RegExp | string;
//     $exists?: boolean;
//     $options?: "i" | "g" | "m" | "u";
//     $elemMatch?: ExternalQuery<T[]>;
//     $where?: string | WhereFn<T[]>;

// };
//
// export type FilterQuery<T> = {
//     [P in keyof T]?: Query<T[P]> | T[P];
// } | Query<T>;

type RegExpForString<T> = T extends string ? (RegExp | T): T;
type MongoAltQuery<T> =
    T extends Array<infer U> ? (T | RegExpForString<U>):
        RegExpForString<T>;

export type QuerySelector<T> = {
    // Comparison
    $eq?: T;
    $gt?: T;
    $gte?: T;
    $in?: T[];
    $lt?: T;
    $lte?: T;
    $ne?: T;
    $nin?: T[];
    // Logical
    $not?: T extends string ? (QuerySelector<T> | RegExp) : QuerySelector<T>;
    // Element
    /**
     * When `true`, `$exists` matches the documents that contain the field,
     * including documents where the field value is null.
     */
    $exists?: boolean;
    $type?: any;
    // Evaluation
    $expr?: any;
    $jsonSchema?: any;
    $mod?: T extends number ? [number, number] : never;
    $regex?: T extends string ? (RegExp | string) : never;
    $options?: T extends string ? string : never;
    // Geospatial
    // TODO: define better types for geo queries
    $geoIntersects?: { $geometry: object };
    $geoWithin?: object;
    $near?: object;
    $nearSphere?: object;
    $maxDistance?: number;
    // Array
    // TODO: define better types for $all and $elemMatch
    $all?: T extends Array<infer U> ? any[] : never;
    $elemMatch?: T extends Array<infer U> ? object : never;
    $size?: T extends Array<infer U> ? number : never;
    // Bitwise
    $bitsAllClear?: any;
    $bitsAllSet?: any;
    $bitsAnyClear?: any;
    $bitsAnySet?: any;

    //special super-hornet types
    $parameter?: string;
};

export type RootQuerySelector<T> = {
    /** https://docs.mongodb.com/manual/reference/operator/query/and/#op._S_and */
    $and?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/nor/#op._S_nor */
    $nor?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/or/#op._S_or */
    $or?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/text */
    $text?: {
        $search: string;
        $language?: string;
        $caseSensitive?: boolean;
        $diacraticSensitive?: boolean;
    };
    /** https://docs.mongodb.com/manual/reference/operator/query/where/#op._S_where */
    $where?: string | Function;
    /** https://docs.mongodb.com/manual/reference/operator/query/comment/#op._S_comment */
    $comment?: string;
    // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
    // this will mark all unrecognized properties as any (including nested queries)
    [key: string]: any;
};

export type ObjectQuerySelector<T> = T extends object ? {[key in keyof T]?: QuerySelector<T[key]> } : QuerySelector<T>;

export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

export type FilterQuery<T> = {
    [P in keyof T]?: Condition<T[P]>;
} &
    RootQuerySelector<T>;


export class StreamBehaviorSubject<T> extends BehaviorSubject<T> {
    public readonly appendSubject = new Subject<T>();
    protected nextChange?: Subject<void>;

    protected nextOnAppend = false;
    protected unsubscribed = false;

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
        if (this.unsubscribed) {
            tearDown(teardown);
            return;
        }

        this.teardowns.push(teardown);
    }

    /**
     * This method differs to BehaviorSubject in the way that this does not throw an error
     * when the subject is closed/unsubscribed.
     */
    getValue(): T {
        if (this.hasError) {
            throw this.thrownError;
        } else {
            return (this as any)._value;
        }
    }

    next(value: T): void {
        super.next(value);

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    activateNextOnAppend() {
        this.nextOnAppend = true;
    }

    toUTF8() {
        const subject = new StreamBehaviorSubject(this.value instanceof Uint8Array ? arrayBufferTo(this.value, 'utf8') : '');
        const sub1 = this.pipe(skip(1)).subscribe(v => {
            subject.next(v instanceof Uint8Array ? arrayBufferTo(v, 'utf8') : '');
        });
        const sub2 = this.appendSubject.subscribe(v => {
            subject.append(v instanceof Uint8Array ? arrayBufferTo(v, 'utf8') : '');
        });

        subject.nextOnAppend = this.nextOnAppend;
        // const that = this;
        // Object.defineProperty(subject, 'nextStateChange', {
        //     get() {
        //         console.log('utf8 nextStateChange');
        //         return that.nextStateChange;
        //     }
        // });

        subject.addTearDown(() => {
            sub1.unsubscribe();
            sub2.unsubscribe();
            this.unsubscribe();
        });

        return subject;
    }

    append(value: T): void {
        this.appendSubject.next(value);

        if (this.nextOnAppend) {
            if (value instanceof Uint8Array) {
                if (this.value instanceof Uint8Array) {
                    this.next(Buffer.concat([this.value as any, value as any]) as any);
                } else {
                    this.next(value as any);
                }
            } else {
                this.next((this.getValue() as any + value) as any as T);
            }
        } else {
            if ('string' === typeof value) {
                if (!(this as any)._value) ((this as any)._value as any) = '';
                ((this as any)._value as any) = ((this as any)._value as any) + value;
            }
        }
    }

    async unsubscribe(): Promise<void> {
        if (this.unsubscribed) return;
        this.unsubscribed = true;

        for (const teardown of this.teardowns) {
            await tearDown(teardown);
        }

        await super.unsubscribe();
    }
}

export class EntitySubject<T extends IdInterface> extends StreamBehaviorSubject<T> {
    /**
     * Patches are in class format.
     */
    public readonly patches = new Subject<{ [path: string]: any }>();
    public readonly delete = new Subject<boolean>();

    public deleted: boolean = false;

    get id(): string {
        return this.value.id;
    }

    get onDeletion(): Observable<void> {
        return new Observable((observer) => {
            if (this.deleted) {
                observer.next();
                return;
            }

            const sub = this.delete.subscribe(() => {
                observer.next();
                sub.unsubscribe();
            });

            return {
                unsubscribe(): void {
                    sub.unsubscribe();
                }
            };
        });
    }

    next(value: T | undefined): void {
        if (value === undefined) {
            this.deleted = true;
            this.delete.next(true);
            super.next(this.value);
            return;
        }

        super.next(value);
    }
}

export type JSONEntity<T> = {
    [P in keyof T]?: any;
};
