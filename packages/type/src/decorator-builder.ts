/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {ClassType} from '@deepkit/core';

export type DecoratorFn = (target: object, property?: string, parameterIndexOrDescriptor?: any) => void;

export type FluidDecorator<T> = {
    [name in keyof T]: T[name] extends (...args: infer K) => any ? (...args: K) => DecoratorFn & FluidDecorator<T>
        : DecoratorFn & FluidDecorator<T>
};

export function createFluidDecorator<API extends APIClass<any>>
(
    api: API,
    modifier: { name: string, args?: any }[],
    collapse: (modifier: { name: string, args?: any }[], target: object, property?: string, parameterIndexOrDescriptor?: any) => void,
    returnCollapse: boolean = false
): FluidDecorator<ExtractClass<API>> {
    const fn = function (target: object, property?: string, parameterIndexOrDescriptor?: any) {
        const res = collapse(modifier, target, property, parameterIndexOrDescriptor);
        if (returnCollapse) return res;
    };

    const methods: string[] = [];
    Object.defineProperty(fn, '_methods', {value: methods});

    let current = api;
    while (current.prototype) {
        let proto = current.prototype;
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (name === 'constructor') continue;
            if (name === 'onDecorator') continue;

            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            methods.push(name);
            if (descriptor && descriptor.get) {
                //its a magic shizzle
                Object.defineProperty(fn, name, {
                    configurable: true,
                    enumerable: false,
                    get: () => {
                        return createFluidDecorator(api, [...modifier, {name}], collapse, returnCollapse);
                    }
                });
            } else {
                //regular method
                Object.defineProperty(fn, name, {
                    configurable: true,
                    enumerable: false,
                    get: () => {
                        return (...args: any[]) => {
                            return createFluidDecorator(api, [...modifier, {name, args}], collapse, returnCollapse);
                        };
                    }
                });
            }
        }

        //resolve parent
        current = Object.getPrototypeOf(current);
    }

    return fn as any;
}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export function mergeDecorator<T extends any[]>(...args: T): Omit<UnionToIntersection<T[number]>, '_fetch'> {
    const res: any = {};
    for (const arg of args) {
        for (const method of arg._methods) {
            Object.defineProperty(res, method, {
                get() {
                    return arg[method];
                }
            });
        }
    }

    return res;
}

export interface ApiTypeInterface<T> {
    t: T,
    onDecorator?: (target: object, property?: string, parameterIndexOrDescriptor?: any) => void
}

export type APIClass<T> = ClassType<ApiTypeInterface<T>>;
export type ExtractClass<T> = T extends ClassType<infer K> ? K : never;
export type ExtractApiDataType<T> = T extends ClassType<infer K> ? K extends { t: infer P } ? P : never : (T extends { t: infer P } ? P : never);

export type ClassDecoratorResult<API extends APIClass<any>> =
    FluidDecorator<ExtractClass<API>>
    & { (target: object): void }
    & { _fetch: (target: object) => ExtractApiDataType<API> | undefined };

export function createClassDecoratorContext<API extends APIClass<any>, T = ExtractApiDataType<API>>(
    apiType: API
): ClassDecoratorResult<API> {
    const map = new Map<object, ApiTypeInterface<any>>();

    function collapse(modifier: { name: string, args?: any }[], target: object) {
        const api: ApiTypeInterface<any> = map.get(target) ?? new apiType;

        if (api.onDecorator) api.onDecorator(target);

        for (const fn of modifier) {
            if (fn.args) {
                (api as any)[fn.name].bind(api)(...fn.args);
            } else {
                //just call the getter
                (api as any)[fn.name];
            }
        }

        map.set(target, api);
    }

    const fn = createFluidDecorator(apiType, [], collapse);

    Object.defineProperty(fn, '_fetch', {
        configurable: true,
        enumerable: false,
        get: () => {
            return (target: object) => {
                const api = map.get(target);
                return api ? api.t : undefined;
            };
        }
    });

    return fn as any;
}

export type PropertyDecoratorResult<API extends APIClass<any>> =
    FluidDecorator<ExtractClass<API>>
    & { (target: object, property?: string, parameterIndexOrDescriptor?: any): void }
    & { _fetch: (target: object, property?: string, parameterIndexOrDescriptor?: any) => ExtractApiDataType<API> | undefined };

export function createPropertyDecoratorContext<API extends APIClass<any>, T = ExtractApiDataType<API>>(
    apiType: API
): PropertyDecoratorResult<API> {
    const targetMap = new Map<object, Map<any, ApiTypeInterface<any>>>();

    function collapse(modifier: { name: string, args?: any }[], target: object, property?: string, parameterIndexOrDescriptor?: any) {
        target = (target as any)['constructor']; //property decorators get the prototype instead of the class.
        let map = targetMap.get(target);
        if (!map) {
            map = new Map();
            targetMap.set(target, map);
        }
        const index = property + '$$' + parameterIndexOrDescriptor;
        const api: ApiTypeInterface<any> = map.get(index) ?? new apiType;

        if (api.onDecorator) api.onDecorator(target, property, parameterIndexOrDescriptor);

        for (const fn of modifier) {
            if (fn.args) {
                (api as any)[fn.name].bind(api)(...fn.args);
            } else {
                //just call the getter
                (api as any)[fn.name];
            }
        }

        map.set(index, api);
    }

    const fn = createFluidDecorator(apiType, [], collapse);

    Object.defineProperty(fn, '_fetch', {
        configurable: true,
        enumerable: false,
        get: () => {
            return (target: object, property?: string, parameterIndexOrDescriptor?: any) => {
                const map = targetMap.get(target);
                const index = property + '$$' + parameterIndexOrDescriptor;
                const api = map ? map.get(index) : undefined;
                return api ? api.t : undefined;
            };
        }
    });

    return fn as any;
}

export type FreeDecoratorFn<API> = {(): ExtractApiDataType<API>};

export type FreeFluidDecorator<API> = {
    [name in keyof ExtractClass<API>]: ExtractClass<API>[name] extends (...args: infer K) => any
        ? (...args: K) => FreeFluidDecorator<API>
        : FreeFluidDecorator<API>
} & FreeDecoratorFn<API>;

export type FreeDecoratorResult<API extends APIClass<any>> = FreeFluidDecorator<API>

export function createFreeDecoratorContext<API extends APIClass<any>, T = ExtractApiDataType<API>>(
    apiType: API
): FreeDecoratorResult<API> {
    function collapse(modifier: { name: string, args?: any }[]) {
        const api = new apiType;

        for (const fn of modifier) {
            if (fn.args) {
                (api as any)[fn.name].bind(api)(...fn.args);
            } else {
                //just call the getter
                (api as any)[fn.name];
            }
        }

        return api.t;
    }

    const fn = createFluidDecorator(apiType, [], collapse, true);

    return fn as any;
}
