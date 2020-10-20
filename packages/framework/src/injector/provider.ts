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
import {ClassType} from '@deepkit/core';

/**
 * @whatItDoes Configures the {@link Injector} to return an instance of `Type` when `Type' is used
 * as token.
 * @howToUse
 * ```
 * @Injectable()
 * class MyService {}
 *
 * const provider: TypeProvider = MyService;
 * ```
 *
 * @description
 *
 * Create an instance by invoking the `new` operator and supplying additional arguments.
 * This form is a short form of `TypeProvider`;
 *
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/provider_spec.ts region='TypeProvider'}
 *
 * @stable
 */
export interface TypeProvider extends ClassType {
}
/**
 * @whatItDoes Configures the {@link Injector} to return a value for a token.
 * @howToUse
 * ```
 * const provider: ValueProvider = {provide: 'someToken', useValue: 'someValue'};
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/provider_spec.ts region='ValueProvider'}
 *
 * @stable
 */
export interface ValueProvider {
    /**
     * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * The value to inject.
     */
    useValue: any;
    /**
     * If true, then injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     *
     * ### Example
     *
     * {@example core/di/ts/provider_spec.ts region='MultiProviderAspect'}
     */
    multi?: boolean;
}
/**
 * @whatItDoes Configures the {@link Injector} to return an instance of `useClass` for a token.
 * @howToUse
 * ```
 * @Injectable()
 * class MyService {}
 *
 * const provider: ClassProvider = {provide: 'someToken', useClass: MyService};
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/provider_spec.ts region='ClassProvider'}
 *
 * Note that following two providers are not equal:
 * {@example core/di/ts/provider_spec.ts region='ClassProviderDifference'}
 *
 * @stable
 */
export interface ClassProvider {
    /**
     * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * Class to instantiate for the `token`.
     */
    useClass: ClassType;
    /**
     * If true, then injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     *
     * ### Example
     *
     * {@example core/di/ts/provider_spec.ts region='MultiProviderAspect'}
     */
    multi?: boolean;
}
/**
 * @whatItDoes Configures the {@link Injector} to return a value of another `useExisting` token.
 * @howToUse
 * ```
 * const provider: ExistingProvider = {provide: 'someToken', useExisting: 'someOtherToken'};
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/provider_spec.ts region='ExistingProvider'}
 *
 * @stable
 */
export interface ExistingProvider {
    /**
     * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
     */
    provide: any;
    /**
     * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
     */
    useExisting: any;
    /**
     * If true, then injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     *
     * ### Example
     *
     * {@example core/di/ts/provider_spec.ts region='MultiProviderAspect'}
     */
    multi?: boolean;
}
/**
 * @whatItDoes Configures the {@link Injector} to return a value by invoking a `useFactory`
 * function.
 * @howToUse
 * ```
 * function serviceFactory() { ... }
 *
 * const provider: FactoryProvider = {provide: 'someToken', useFactory: serviceFactory, deps: []};
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/provider_spec.ts region='FactoryProvider'}
 *
 * Dependencies can also be marked as optional:
 * {@example core/di/ts/provider_spec.ts region='FactoryProviderOptionalDeps'}
 *
 * @stable
 */
export interface FactoryProvider {
    /**
     * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
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
    /**
     * If true, then injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     *
     * ### Example
     *
     * {@example core/di/ts/provider_spec.ts region='MultiProviderAspect'}
     */
    multi?: boolean;
}
/**
 * @whatItDoes Describes how the {@link Injector} should be configured.
 * @howToUse
 * See {@link TypeProvider}, {@link ValueProvider}, {@link ClassProvider}, {@link ExistingProvider},
 * {@link FactoryProvider}.
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * @stable
 */
export declare type Provider = TypeProvider | ValueProvider | ClassProvider | ExistingProvider | FactoryProvider;

export declare type ProviderProvide = ValueProvider | ClassProvider | ExistingProvider | FactoryProvider;
