/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ClassType, isClass } from '@deepkit/core';

export interface ProviderBase {
    /**
     * Per default all instances are singleton (scoped to its scope). Enabling transient makes the
     * Injector create always a new instance for every consumer.
     */
    transient?: true;
}

export interface ValueProvider<T> extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType`, but can be `any`).
     */
    provide: symbol | string | ClassType<T>;

    /**
     * The value to inject.
     */
    useValue: T;
}

export interface ClassProvider<T> extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType`, but can be `any`).
     */
    provide: ClassType<T>;

    /**
     * Class to instantiate for the `token`.
     */
    useClass?: ClassType<T>;
}

export interface ExistingProvider<T> extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType`, but can be `any`).
     */
    provide: symbol | string | ClassType<T>;

    /**
     * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
     */
    useExisting: ClassType<T>;
}

export interface FactoryProvider<T> extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType`, but can be `any`).
     */
    provide: symbol | string | ClassType<T>;

    /**
     * A function to invoke to create a value for this `token`. The function is invoked with
     * resolved values of `token`s in the `deps` field.
     */
    useFactory: (...args: any[]) => T;

    /**
     * A list of `token`s which need to be resolved by the injector. The list of values is then
     * used as arguments to the `useFactory` function.
     */
    deps?: any[];
}

export type Provider<T = any> = ClassType | ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T>;

export type ProviderProvide<T = any> = ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T>;

export class Tag<T> {
    _!: () => T;

    constructor(
        public provider: NormalizedProvider<T>,
    ) {
    }

    static provide<P extends ClassType<T> | ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T>, T extends ReturnType<InstanceType<B>['_']>, B extends ClassType<Tag<any>>>(this: B, provider: P): InstanceType<B> {
        if (isClass(provider)) {
            return new (this as ClassType<any>)({ provide: provider });
        }

        return new (this as ClassType<any>)(provider);
    }
}

export interface ProviderScope {
    scope?: 'module' | 'rpc' | 'http' | 'cli' | string;
}

export type NormalizedProvider<T = any> = ProviderProvide<T> & ProviderScope;

export type ProviderWithScope<T = any> = ClassType | (ProviderProvide<T> & ProviderScope) | Tag<any>;

export function isScopedProvider(obj: any): obj is ProviderProvide & ProviderScope {
    return obj.provide && obj.hasOwnProperty('scope');
}

export function isValueProvider(obj: any): obj is ValueProvider<any> {
    return obj.provide && obj.hasOwnProperty('useValue');
}

export function isClassProvider(obj: any): obj is ClassProvider<any> {
    return obj.provide && !isValueProvider(obj) && !isExistingProvider(obj) && !isFactoryProvider(obj);
}

export function isExistingProvider(obj: any): obj is ExistingProvider<any> {
    return obj.provide && obj.hasOwnProperty('useExisting');
}

export function isFactoryProvider(obj: any): obj is FactoryProvider<any> {
    return obj.provide && obj.hasOwnProperty('useFactory');
}

export function isInjectionProvider(obj: any): obj is Provider<any> {
    return isValueProvider(obj) || isClassProvider(obj) || isExistingProvider(obj) || isFactoryProvider(obj);
}

export function getProviders(
    providers: ProviderWithScope[],
    requestScope: 'module' | 'session' | 'request' | string,
) {
    const result: Provider<any>[] = [];

    function normalize(provider: ProviderWithScope<any>): Provider<any> {
        if (isClass(provider)) {
            return provider;
        }

        if (provider instanceof Tag) {
            return provider.provider;
        }

        return provider;
    }

    for (const provider of providers) {
        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        const scope = isScopedProvider(provider) ? provider.scope : 'module';
        if (scope === requestScope) {
            result.push(normalize(provider));
        }
    }

    return result;
}
