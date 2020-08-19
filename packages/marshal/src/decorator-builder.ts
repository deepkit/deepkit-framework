import {ClassType} from '@super-hornet/core';

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
): FluidDecorator<ExtractClass<API>> {
    const fn = function (target: object, property?: string, parameterIndexOrDescriptor?: any) {
        collapse(modifier, target, property, parameterIndexOrDescriptor);
    };

    const proto = api.prototype;
    const methods: string[] = [];
    Object.defineProperty(fn, '_methods', {value: methods});

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
                    return createFluidDecorator(api, [...modifier, {name}], collapse);
                }
            });
        } else {
            //regular method
            Object.defineProperty(fn, name, {
                configurable: true,
                enumerable: false,
                get: () => {
                    return (...args: any[]) => {
                        return createFluidDecorator(api, [...modifier, {name, args}], collapse);
                    };
                }
            });
        }
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
export type ExtractApiDataType<T> = T extends ClassType<infer K> ? K extends { t: infer P } ? P : never : never;

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
        const index = property ?? parameterIndexOrDescriptor;
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
                const index = property ?? parameterIndexOrDescriptor;
                const api = map ? map.get(index) : undefined;
                return api ? api.t : undefined;
            };
        }
    });

    return fn as any;
}
