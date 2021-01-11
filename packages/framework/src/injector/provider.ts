/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { ClassType, isClass } from '@deepkit/core';
import { isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider } from './injector';

export interface ProviderBase {
    /**
     * Per default all instances are singleton (scoped to its scope). Enabling transient makes the
     * Injector create always a new instance for every consumer.
     */
    transient?: true;
}

export interface ValueProvider extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * The value to inject.
     */
    useValue: any;
}

export interface ClassProvider extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType` or `InjectionToken`, but can be `any`).
     */
    provide: any;

    /**
     * Class to instantiate for the `token`.
     */
    useClass?: ClassType;
}

export interface ExistingProvider extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
     */
    useExisting: any;
}

export interface FactoryProvider extends ProviderBase {
    /**
     * An injection token. (Typically an instance of `ClassType` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * A function to invoke to create a value for this `token`. The function is invoked with
     * resolved values of `token`s in the `deps` field.
     */
    useFactory: Function;
    /**
     * A list of `token`s which need to be resolved by the injector. The list of values is then
     * used as arguments to the `useFactory` function.
     */
    deps?: any[];
}

export declare type Provider = ClassType | ValueProvider | ClassProvider | ExistingProvider | FactoryProvider;

export declare type ProviderProvide = ValueProvider | ClassProvider | ExistingProvider | FactoryProvider;

export interface ProviderScope {
    scope?: 'module' | 'rpc' | 'http' | 'cli' | string;
}

export type ProviderWithScope = ClassType | (ProviderProvide & ProviderScope);

export function isInjectionProvider(obj: any): obj is Provider {
    return isValueProvider(obj) || isClassProvider(obj) || isExistingProvider(obj) || isFactoryProvider(obj);
}

export function getProviders(
    providers: ProviderWithScope[],
    requestScope: 'module' | 'session' | 'request' | string,
) {
    const result: Provider[] = [];

    function normalize(provider: ProviderWithScope): Provider {
        if (isClass(provider)) {
            return provider;
        }

        return provider;
    }

    for (const provider of providers) {
        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        const scope = provider.scope || 'module';
        if (scope === requestScope) {
            result.push(normalize(provider));
        }
    }

    return result;
}
