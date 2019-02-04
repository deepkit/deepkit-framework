import {v4} from 'uuid';
import * as dotProp from 'dot-prop';
import {Observable, Subscription} from "rxjs";
import {Collection} from "./collection";
import {eachKey, eachPair} from "./iterator";

export class CustomError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export function arrayHasItem<T>(array: T[], item: T): boolean {
    return -1 !== array.indexOf(item);
}

export function indexOf<T>(array: T[] | Collection<any>, item: T): number {
    if (!array) {
        return -1;
    }

    if (array instanceof Collection) {
        array = array.all();
    }

    return array.indexOf(item);
}

export function copy<T, K = T[] | { [key: string]: T }>(v: K): K {
    if (isArray(v)) {
        return v.slice(0) as any;
    }

    return v;
}

export function empty<T>(array: T[] | { [key: string]: T } | Collection<any>): boolean {
    if (!array) {
        return true;
    }

    if (array instanceof Collection) {
        array = array.all();
    }

    if (isArray(array)) {
        return array.length === 0;
    } else {
        return Object.keys(array).length === 0;
    }
}

export function size<T>(array: T[] | { [key: string]: T }): number {
    if (!array) {
        return 0;
    }

    if (isArray(array)) {
        return array.length;
    } else {
        return Object.keys(array).length;
    }
}

export function firstKey(v: { [key: string]: any } | object): string | undefined {
    return Object.keys(v)[0];
}

export function lastKey(v: { [key: string]: any } | object): string | undefined {
    const keys = Object.keys(v);
    if (keys.length) {
        return;
    }
    return keys[keys.length - 1];
}

export function first<T>(v: { [key: string]: T } | T[]): T | undefined {
    if (isArray(v)) {
        return v[0];
    }

    const key = firstKey(v);
    if (key) {
        return v[key];
    }
}

export function last<T>(v: { [key: string]: T } | T[]): T | undefined {
    if (isArray(v)) {
        if (v.length > 0) {
            return v[v.length - 1];
        }
        return;
    }

    const key = firstKey(v);
    if (key) {
        return v[key];
    }
}

export function arrayRemoveItem<T>(array: T[], item: T): boolean {
    const index = array.indexOf(item);
    if (-1 !== index) {
        array.splice(index, 1);
        return true;
    }

    return false;
}


export function prependObjectKeys(o: { [k: string]: any }, prependText: string): { [k: string]: any } {
    const converted: { [k: string]: any } = {};
    for (const i in o) {
        if (!o.hasOwnProperty(i)) continue;
        converted[prependText + i] = o[i];
    }
    return converted;
}

export function appendObject(origin: {[k: string]: any}, extend: {[k: string]: any}, prependKeyName: string = '') {
    const no = prependObjectKeys(extend, prependKeyName);
    for (const [i, v] of eachPair(no)) {
        origin[i] = v;
    }
}

/**
 * Makes sure that execute() is called one after another, not parallel.
 */
export class Lock {
    protected lock?: Promise<any>;

    public async execute<T>(cb: () => Promise<T | undefined>): Promise<T | undefined> {
        while (this.lock) {
            await this.lock;
        }

        return this.lock = new Promise<T | undefined>(async (resolve, reject) => {
            try {
                const result = await cb();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                delete this.lock;
            }
        });
    }
}

export function sleep(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}


export function subscriptionToPromise<T>(subscription: Subscription): Promise<void> {
    return new Promise((resolve, reject) => {
        subscription.add(() => {
            resolve();
        });
    });
}

export function awaitFirst<T>(o: Observable<T>): Promise<T> {
    const stack = createStack();
    return new Promise((resolve, reject) => {

        o.subscribe((data) => {
            resolve(data);
        }, (error) => {
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
        o.subscribe((data) => {
            if (next) {
                next(data);
            }
            last = data;
        }, (error) => {
            mergeStack(error, stack);
            reject(error);
        }, () => {
            resolve(last);
        });
    });
}

export function promiseToObservable<T>(o: () => Promise<T>): Observable<T> {
    const stack = createStack();
    return new Observable((observer) => {
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

export function mergePromiseStack<T>(promise: Promise<T>, stack?: string): Promise<T> {
    stack = stack || createStack();
    promise.then(() => {
    }, (error) => {
        mergeStack(error, stack || '');
    });
    return promise;
}

export function createStack(removeCallee: boolean = true): string {
    let stack = new Error().stack || '';

    /*
    at createStack (/file/path)
    at promiseToObservable (/file/path)
    at userLandCode1 (/file/path)
    at userLandCode2 (/file/path)
     */

    //remove "at createStack"
    stack = stack.slice(stack.indexOf('   at ') + 6);
    stack = stack.slice(stack.indexOf('   at ') - 1);

    if (removeCallee) {
        //remove callee
        stack = stack.slice(stack.indexOf('   at ') + 6);
        stack = stack.slice(stack.indexOf('   at ') - 1);
    }

    return stack;
}

export function mergeStack(error: Error, stack: string) {
    if (error instanceof Error && error.stack) {
        error.stack += '\n' + stack;
    }
}

export function average(array: Array<number>) {
    let sum = 0;
    for (const n of array) {
        sum += n;
    }

    return sum / array.length;
}

/**
 * time as seconds, with more precision behind the dot.
 * @returns {number}
 */
export function time(): number {
    return Date.now() / 1000;
}

/**
 * This functions returns a stack that is filled as long as the gate is not activated.
 * Once activated all recorded calls go to given callback and subsequent calls go directly to given callback.
 */
export function BufferedGate<T>(callback: (arg: T) => any) {
    const q: T[] = [];
    let activated = false;

    const throttled = ThrottleTime(async () => {
        if (q.length === 0) return;

        for (const t of q) {
            const result = callback(t);
            if (result instanceof Promise) {
                await result;
            }
        }
        //empty the queue
        q.splice(0, q.length);
    });

    return {
        activate: () => {
            activated = true;
            throttled();
        },
        call: (i: T) => {
            q.push(i);

            if (activated) {
                throttled();
            }
        }
    };
}

export function BufferTime<T>(call: (arg: T[]) => void, cps = 5): (arg: T) => void {
    let last = Date.now();
    let first = true;
    let dirty = false;
    let lastArgs: T[] = [];

    function tick() {
        const now = Date.now();

        if (first || now - last > 1000 / cps) {
            call(lastArgs);
            dirty = false;
            last = Date.now();
            lastArgs = [];
        }

        first = false;

        if (dirty) {
            requestAnimationFrame(tick);
        }
    }

    return (arg: T) => {
        dirty = true;
        lastArgs.push(arg);
        requestAnimationFrame(tick);
    };
}


/**
 * Makes sure that given `call` is not more frequently called than cps/seconds. cps=5 means 5 times per seconds max.
 *
 * @example const throttled = ThrottleTime(async () => { console.log('do it') }); throttled(); throttled(); ...
 *
 */
export function ThrottleTime(call: Function, cps = 5): (...args: any[]) => void {
    let last = Date.now();
    let dirty = false;
    let lastArgs: any[][] = [];
    let execution = false;

    function tick() {
        const now = Date.now();

        if (!execution && now - last > 1000 / cps) {
            execution = true;
            call(...lastArgs);
            dirty = false;
            last = Date.now();
            execution = false;
        }

        if (dirty) {
            requestAnimationFrame(tick);
        }
    }

    return (...args) => {
        dirty = true;
        lastArgs = args;
        tick();
    };
}

export function typeOf(obj: any) {
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

export function isFunction(obj: any): obj is Function {
    return 'function' === typeOf(obj);
}

export function isObject(obj: any): obj is object {
    if (obj === null) {
        return false;
    }
    return ((typeof obj === 'function') || (typeof obj === 'object' && !isArray(obj)));
}

export function isArray(obj: any): obj is any[] {
    return Array.isArray(obj);
}

export function isNull(obj: any): obj is null {
    return null === obj;
}

export function isUndefined(obj: any): obj is undefined {
    return undefined === obj;
}

export function isSet(obj: any): boolean {
    return !isNull(obj) && !isUndefined(obj);
}

export function isNumber(obj: any): obj is number {
    return 'number' === typeOf(obj);
}

export function isString(obj: any): obj is string {
    return 'string' === typeOf(obj);
}

export function getPathValue(bag: { [field: string]: any }, parameterPath: string, defaultValue?: any): string {
    if (isSet(bag[parameterPath])) {
        return bag[parameterPath];
    }

    const result = dotProp.get(bag, parameterPath);

    return isSet(result) ? result : defaultValue;
}


export function setPathValue(bag: object, parameterPath: string, value: any) {
    dotProp.set(bag, parameterPath, value);
}


export function humanBytes(bytes: number, si: boolean = false): string {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);

    return bytes.toFixed(2) + ' ' + units[u];
}

export function getEnumLabel(enumType: { [field: string]: any }, id: any) {
    for (const i of eachKey(enumType)) {
        if (id === enumType[i]) {
            return i;
        }
    }
}
