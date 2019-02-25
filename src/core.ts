import {eachPair, eachKey} from "./iterators";
import * as dotProp from 'dot-prop';

/**
 * Makes sure the error once printed using console.log contains the actual class name.
 *
 * class MyApiError extends CustomerError {}
 *
 * throw MyApiError() // prints MyApiError instead of simply "Error".
 */
export class CustomError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export interface ClassType<T> {
    new (...args: any[]): T;
}

export function getClassName<T>(classType: ClassType<T> | Object): string {
    return classType['name'] || (classType.constructor ? classType.constructor.name : '');
}

export function getClassPropertyName<T>(classType: ClassType<T> | Object, propertyName: string): string {
    const name = getClassName(classType);

    return `${name}::${propertyName}`;
}

export function applyDefaults<T>(classType: ClassType<T>, target: {[k: string]: any}): T {
    const classInstance = new classType();

    for (const [i, v] of eachPair(target)) {
        (classInstance as any)[i] = v;
    }

    return classInstance;
}

function typeOf(obj: any) {
    return ((({}).toString.call(obj).match(/\s([a-zA-Z]+)/) || [])[1] || '').toLowerCase();
}

/**
 * Returns true if the given obj is a plain object, and no class instance.
 *
 * isPlainObject({}) === true
 * isPlainObject(new ClassXY) === false
 */
export function isPlainObject(obj: any): obj is object {
    return Boolean(obj && typeof obj === 'object' && obj.constructor === Object);
}

/**
 * Returns true if given obj is a function.
 */
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

/**
 * Checks if obj is not null and not undefined.
 */
export function isSet(obj: any): boolean {
    return !isNull(obj) && !isUndefined(obj);
}

export function isNumber(obj: any): obj is number {
    return 'number' === typeOf(obj);
}

export function isString(obj: any): obj is string {
    return 'string' === typeOf(obj);
}

export function arrayHasItem<T>(array: T[], item: T): boolean {
    return -1 !== array.indexOf(item);
}

export function indexOf<T>(array: T[], item: T): number {
    if (!array) {
        return -1;
    }

    return array.indexOf(item);
}

export async function sleep(seconds: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Creates a shallow copy of given array.
 */
export function copy<T>(v: T[]): T[] {
    if (isArray(v)) {
        return v.slice(0);
    }

    return v;
}

/**
 * Checks whether given array or object is empty (no keys)
 */
export function empty<T>(array: T[] | { [key: string]: T }): boolean {
    if (!array) {
        return true;
    }

    if (isArray(array)) {
        return array.length === 0;
    } else {
        return Object.keys(array).length === 0;
    }
}

/**
 * Returns the size of given array or object.
 */
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

/**
 * Returns the first key of a given object.
 */
export function firstKey(v: { [key: string]: any } | object): string | undefined {
    return Object.keys(v)[0];
}

/**
 * Returns the last key of a given object.
 */
export function lastKey(v: { [key: string]: any } | object): string | undefined {
    const keys = Object.keys(v);
    if (keys.length) {
        return;
    }
    return keys[keys.length - 1];
}

/**
 * Returns the first value of given array or object.
 */
export function first<T>(v: { [key: string]: T } | T[]): T | undefined {
    if (isArray(v)) {
        return v[0];
    }

    const key = firstKey(v);
    if (key) {
        return v[key];
    }
}

/**
 * Returns the last value of given array or object.
 */
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

/**
 * Clears the array so its empty. Returns the amount of removed items.
 */
export function arrayClear<T>(array: T[]): number {
    return array.splice(0, array.length).length;
}

/**
 * Removes on particular item by reference of an array.
 */
export function arrayRemoveItem<T>(array: T[], item: T): boolean {
    const index = array.indexOf(item);
    if (-1 !== index) {
        array.splice(index, 1);
        return true;
    }

    return false;
}

/**
 * Returns the average of a number array.
 */
export function average(array: number[]): number {
    let sum = 0;
    for (const n of array) {
        sum += n;
    }

    return sum / array.length;
}


export function prependObjectKeys(o: { [k: string]: any }, prependText: string): { [k: string]: any } {
    const converted: { [k: string]: any } = {};
    for (const i in o) {
        if (!o.hasOwnProperty(i)) continue;
        converted[prependText + i] = o[i];
    }
    return converted;
}

export function appendObject(origin: { [k: string]: any }, extend: { [k: string]: any }, prependKeyName: string = '') {
    const no = prependObjectKeys(extend, prependKeyName);
    for (const [i, v] of eachPair(no)) {
        origin[i] = v;
    }
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

/**
 * Returns the current time as seconds.
 */
export function time(): number {
    return Date.now() / 1000;
}

export function getPathValue(bag: { [field: string]: any }, parameterPath: string, defaultValue?: any): any {
    if (isSet(bag[parameterPath])) {
        return bag[parameterPath];
    }

    const result = dotProp.get(bag, parameterPath);

    return isSet(result) ? result : defaultValue;
}

export function setPathValue(bag: object, parameterPath: string, value: any) {
    dotProp.set(bag, parameterPath, value);
}

/**
 * Returns the human readable byte representation.
 */
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
