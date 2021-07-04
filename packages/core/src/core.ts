/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import dotProp from 'dot-prop';
import { eachPair } from './iterators';

/**
 * Makes sure the error once printed using console.log contains the actual class name.
 *
 * @example
 * ```
 * class MyApiError extends CustomerError {}
 *
 * throw MyApiError() // prints MyApiError instead of simply "Error".
 * ```
 *
 * @public
 */
export class CustomError extends Error {
    public name: string;
    public stack?: string;
    constructor(public message: string = '') {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * @public
 */
export interface ClassType<T = any> {
    new(...args: any[]): T;
}

/**
 * @public
 */
export type AbstractClassType<T = any> = abstract new (...args: any[]) => T;

export type ExtractClassType<T> = T extends ClassType<infer K> ? K : never;

declare const __forward: unique symbol;

/**
 * This type maintains the actual type, but erases the decoratorMetadata, which is requires in a circular reference for ECMAScript modules.
 * Basically fixes like "ReferenceError: Cannot access 'MyClass' before initialization"
 */
export type Forward<T> = T & { [__forward]?: true };

/**
 * Returns the class name either of the class definition or of the class of an instance.
 *
 * Note when code is minimized/uglified this output will change. You should disable in your compile the
 * className modification.
 *
 * @example
 * ```typescript
 * class User {}
 *
 * expect(getClassName(User)).toBe('User');
 * expect(getClassName(new User())).toBe('User');
 * ```
 *
 * @public
 */
export function getClassName<T>(classTypeOrInstance: ClassType<T> | Object): string {
    if (!classTypeOrInstance) return 'undefined';
    const proto = (classTypeOrInstance as any)['prototype'] ? (classTypeOrInstance as any)['prototype'] : classTypeOrInstance;
    return proto.constructor.name;
}

/**
 * Same as getClassName but appends the propertyName.
 * @public
 */
export function getClassPropertyName<T>(classType: ClassType<T> | Object, propertyName: string): string {
    const name = getClassName(classType);

    return `${name}::${propertyName}`;
}

/**
 * @public
 */
export function applyDefaults<T>(classType: ClassType<T>, target: { [k: string]: any }): T {
    const classInstance = new classType();

    for (const [i, v] of eachPair(target)) {
        (classInstance as any)[i] = v;
    }

    return classInstance;
}

/**
 * Tries to identify the object by normalised result of Object.toString(obj).
 */
export function typeOf(obj: any) {
    return ((({}).toString.call(obj).match(/\s([a-zA-Z]+)/) || [])[1] || '').toLowerCase();
}

/**
 * Returns true if the given obj is a plain object, and no class instance.
 *
 * isPlainObject(\{\}) === true
 * isPlainObject(new ClassXY) === false
 *
 * @public
 */
export function isPlainObject(obj: any): obj is object {
    return Boolean(obj && typeof obj === 'object' && obj.constructor instanceof obj.constructor);
}

/**
 * Returns the ClassType for a given instance.
 */
export function getClassTypeFromInstance<T>(target: T): ClassType<T> {
    if (!isClassInstance(target)) {
        throw new Error(`Value is not a class instance. Got ${stringifyValueWithType(target)}`);
    }

    return (target as any)['constructor'] as ClassType<T>;
}

/**
 * Returns true when target is a class instance.
 */
export function isClassInstance(target: any): boolean {
    return target !== undefined && target !== null
        && target['constructor']
        && Object.getPrototypeOf(target) === (target as any)['constructor'].prototype
        && !isPlainObject(target)
        && isObject(target);
}

/**
 * Returns a human readable string representation from the given value.
*/
export function stringifyValueWithType(value: any): string {
    if ('string' === typeof value) return `String(${value})`;
    if ('number' === typeof value) return `Number(${value})`;
    if ('boolean' === typeof value) return `Boolean(${value})`;
    if ('function' === typeof value) return `Function ${value.name}`;
    if (isPlainObject(value)) return `Object ${prettyPrintObject(value)}`;
    if (isObject(value)) return `${getClassName(getClassTypeFromInstance(value))} ${prettyPrintObject(value)}`;
    if (null === value) return `null`;
    return 'undefined';
}

/**
 * Changes the class of a given instance and returns the new object.
 *
 * @example
 * ```typescript
 *
 *  class Model1 {
 *    id: number = 0;
 *  }
 *
 *  class Model2 {
 *    id: number = 0;
 *  }
 *
 *  const model1 = new Model1();
 *  const model2 = changeClass(model1, Model2);
 *  model2 instanceof Model2; //true
 * ```
 */
export function changeClass<T>(value: any, newClass: ClassType<T>): T {
    return Object.assign(Object.create(newClass.prototype), value);
}

export function prettyPrintObject(object: object): string {
    let res: string[] = [];
    for (const i in object) {
        res.push(i + ': ' + stringifyValueWithType((object as any)[i]));
    }
    return '{' + res.join(',') + '}';
}

/**
 * Returns true if given obj is a function.
 *
 * @public
 */
export function isFunction(obj: any): obj is Function {
    if ('function' === typeof obj) {
        return !obj.toString().startsWith('class ');
    }

    return false;
}

/**
 * Returns true if given obj is a promise like object.
 *
 * Note: There's not way to check if it's actually a Promise using instanceof since
 * there are a lot of different implementations around.
 *
 * @public
 */
export function isPromise<T>(obj: any | Promise<T>): obj is Promise<T> {
    return obj !== null && typeof obj === "object" && typeof obj.then === "function"
        && typeof obj.catch === "function" && typeof obj.finally === "function";
}

/**
 * Returns true if given obj is a ES6 class (ES5 fake classes are not supported).
 *
 * @public
 */
export function isClass(obj: any): obj is ClassType {
    if ('function' === typeof obj) {
        return obj.toString().startsWith('class ') || obj.toString().startsWith('class{');
    }

    return false;
}

/**
 * Returns true for real objects: object literals ({}) or class instances (new MyClass).
 *
 * @public
 */
export function isObject(obj: any): obj is { [key: string]: any } {
    if (obj === null) {
        return false;
    }
    return (typeof obj === 'object' && !isArray(obj));
}

/**
 * @public
 */
export function isArray(obj: any): obj is any[] {
    return !!(obj && 'number' === typeof obj.length && 'function' === typeof obj.reduce);
}

/**
 * @public
 */
export function isNull(obj: any): obj is null {
    return null === obj;
}

/**
 * @public
 */
export function isUndefined(obj: any): obj is undefined {
    return undefined === obj;
}

/**
 * Checks if obj is not null and not undefined.
 *
 * @public
 */
export function isSet(obj: any): boolean {
    return !isNull(obj) && !isUndefined(obj);
}

/**
 * @public
 */
export function isNumber(obj: any): obj is number {
    return 'number' === typeOf(obj);
}

/**
 * @public
 */
export function isString(obj: any): obj is string {
    return 'string' === typeOf(obj);
}

/**
 * @public
 */
export function arrayHasItem<T>(array: T[], item: T): boolean {
    return -1 !== array.indexOf(item);
}

/**
 * @public
 */
export function indexOf<T>(array: T[], item: T): number {
    if (!array) {
        return -1;
    }

    return array.indexOf(item);
}

/**
 * @public
 */
export async function sleep(seconds: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Creates a shallow copy of given array.
 *
 * @public
 */
export function copy<T>(v: T[]): T[] {
    if (isArray(v)) {
        return v.slice(0);
    }

    return v;
}

/**
 * Checks whether given array or object is empty (no keys). If given object is falsy, returns false.
 *
 * @public
 */
export function empty<T>(value?: T[] | object | {}): boolean {
    if (!value) return true;

    if (isArray(value)) {
        return value.length === 0;
    } else {
        for (const i in value) if (value.hasOwnProperty(i)) return false;
        return true;
    }
}

/**
 * Returns the size of given array or object.
 *
 * @public
 */
export function size<T>(array: T[] | { [key: string]: T }): number {
    if (!array) {
        return 0;
    }

    if (isArray(array)) {
        return array.length;
    } else {
        return getObjectKeysSize(array);
    }
}

/**
 * Returns the first key of a given object.
 *
 * @public
 */
export function firstKey(v: { [key: string]: any } | object): string | undefined {
    return Object.keys(v)[0];
}

/**
 * Returns the last key of a given object.
 *
 * @public
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
 *
 * @public
 */
export function first<T>(v: { [key: string]: T } | T[]): T | undefined {
    if (isArray(v)) {
        return v[0];
    }

    const key = firstKey(v);
    if (key) {
        return v[key];
    }
    return;
}

/**
 * Returns the last value of given array or object.
 *
 * @public
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
    return;
}

/**
 * Clears the array so its empty. Returns the amount of removed items.
 *
 * @public
 */
export function arrayClear<T>(array: T[]): number {
    return array.splice(0, array.length).length;
}

/**
 * Removes on particular item by reference of an array.
 *
 * @public
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
 *
 * @public
 */
export function average(array: number[]): number {
    let sum = 0;
    for (const n of array) {
        sum += n;
    }

    return sum / array.length;
}

/**
 * @public
 */
export function prependObjectKeys(o: { [k: string]: any }, prependText: string): { [k: string]: any } {
    const converted: { [k: string]: any } = {};
    for (const i in o) {
        if (!o.hasOwnProperty(i)) continue;
        converted[prependText + i] = o[i];
    }
    return converted;
}

/**
 * @public
 */
export function appendObject(origin: { [k: string]: any }, extend: { [k: string]: any }, prependKeyName: string = '') {
    const no = prependObjectKeys(extend, prependKeyName);
    for (const [i, v] of eachPair(no)) {
        origin[i] = v;
    }
}

/**
 * A better alternative to "new Promise()" that supports error handling and maintains the stack trace for Error.stack.
 *
 * When you use `new Promise()` you need to wrap your code inside a try-catch to call `reject` on error.
 * asyncOperation() does this automatically.
 *
 * When you use `new Promise()` you will lose the stack trace when `reject(new Error())` is called.
 * asyncOperation() makes sure the error stack trace is the correct one.
 *
 * @example
 * ```typescript
 * await asyncOperation(async (resolve, reject) => {
 *     await doSomething(); //if this fails, reject() will automatically be called
 *     stream.on('data', (data) => {
 *         resolve(data); //at some point you MUST call resolve(data)
 *     });
 * });
 * ```
 *
 * @public
 */
export async function asyncOperation<T>(executor: (resolve: (value: T) => void, reject: (error: any) => void) => void | Promise<void>): Promise<T> {
    let error: any, async: any;
    try {
        async = await new Promise<T>(async (resolve, reject) => {
            try {
                await executor(resolve, reject);
            } catch (e) {
                reject(e);
            }
        })
    } catch (e) {
        error = e;
    }
    if (error) {
        mergeStack(error, createStack());
        throw error;
    }
    return async;
}

/**
 * @public
 */
export function mergePromiseStack<T>(promise: Promise<T>, stack?: string): Promise<T> {
    stack = stack || createStack();
    promise.then(() => {
    }, (error) => {
        mergeStack(error, stack || '');
    });
    return promise;
}

/**
 * @beta
 */
export function createStack(removeCallee: boolean = true): string {
    if (Error.stackTraceLimit === 10) Error.stackTraceLimit = 100
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

/**
 * @beta
 */
export function mergeStack(error: Error, stack: string) {
    if (error instanceof Error && error.stack) {
        error.stack += '\n' + stack;
    }
}

export function collectForMicrotask<T>(callback: (args: T[]) => void): (arg: T) => void {
    let items: T[] = [];
    let taskScheduled = false;

    return (arg: T) => {
        items.push(arg);
        if (!taskScheduled) {
            taskScheduled = true;
            queueMicrotask(() => {
                taskScheduled = false;
                callback(items);
                items.length = 0;
            });
        }
    };
}

/**
 * Returns the current time as seconds.
 *
 * @public
 */
export function time(): number {
    return Date.now() / 1000;
}

/**
 * @public
 */
export function getPathValue(bag: { [field: string]: any }, parameterPath: string, defaultValue?: any): any {
    if (isSet(bag[parameterPath])) {
        return bag[parameterPath];
    }

    const result = dotProp.get(bag, parameterPath);

    return isSet(result) ? result : defaultValue;
}

/**
 * @public
 */
export function setPathValue(bag: object, parameterPath: string, value: any) {
    dotProp.set(bag, parameterPath, value);
}

/**
 * @public
 */
export function deletePathValue(bag: object, parameterPath: string) {
    dotProp.delete(bag, parameterPath);
}

/**
 * Returns the human readable byte representation.
 *
 * @public
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

/**
 * Returns the number of properties on `obj`. This is 20x faster than Object.keys(obj).length.
 */
export function getObjectKeysSize(obj: object): number {
    let size = 0;
    for (let i in obj) if (obj.hasOwnProperty(i)) size++;
    return size;
}

export function isConstructable(fn: any): boolean {
    try {
        new new Proxy(fn, { construct: () => ({}) });
        return true;
    } catch (err) {
        return false;
    }
};

export function isPrototypeOfBase(prototype: ClassType | undefined, base: ClassType): boolean {
    if (!prototype) return false;
    if (prototype === base) return true;
    let currentProto = Object.getPrototypeOf(prototype);
    while (currentProto && currentProto !== Object.prototype) {
        if (currentProto === base) return true;
        currentProto = Object.getPrototypeOf(currentProto);
    }
    return false;
}

declare var v8debug: any;

export function inDebugMode() {
    return typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '));
}
