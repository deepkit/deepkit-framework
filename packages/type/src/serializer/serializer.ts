/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, DeepkitError, Ref, arg, fn, toFastProperties } from '@deepkit/core';

import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeObjectLiteral,
    copyAndSetParent,
    getTypeJitContainer,
    getTypeObjectLiteralFromTypeClass,
} from '../reflection/type.js';
import { ValidationErrorItem } from '../validator.js';
// Initialize the default serializer with handlers
import { registerDefaultHandlers, registerTypeGuards } from './handlers.js';
import { NamingStrategy, defaultNamingStrategy } from './naming.js';
import { HandlerRegistry } from './registry.js';
import { BuildOptions, JsonBuildContext, SerializationOptions } from './state.js';
import { registerUnionHandler } from './union.js';
import { registerValidationHook } from './validation.js';

export type SerializeFunction<T = any, R = any> = (data: T, options?: SerializationOptions) => R;

export type Guard<T> = (data: any, state?: { errors?: ValidationErrorItem[] }) => data is T;

/**
 * Main serializer class that coordinates type handlers for serialization,
 * deserialization, and type guards.
 *
 * Uses fn() from jit2 for CSP-compliant code generation with tiered execution.
 *
 * @example
 * ```typescript
 * const serializer = new Serializer('json');
 *
 * interface User {
 *     name: string;
 *     age: number;
 * }
 *
 * const serialize = serializer.buildSerializer<User>(typeOf<User>());
 * const result = serialize({ name: 'John', age: 30 });
 * ```
 */
export class Serializer {
    /** Registry for serialization handlers */
    readonly serializeRegistry = new HandlerRegistry<JsonBuildContext>('serialize');

    /** Registry for deserialization handlers */
    readonly deserializeRegistry = new HandlerRegistry<JsonBuildContext>('deserialize');

    /** Registry for type guards (unified: fast, strict, and error-collecting all use this) */
    readonly typeGuards = new HandlerRegistry<JsonBuildContext>();

    /** Caches and building sets for each type guard mode */
    private readonly typeGuardCaches = {
        fast: { cache: new Map<Type, (data: unknown) => boolean>(), building: new Set<Type>() },
        strict: { cache: new Map<Type, (data: unknown) => boolean>(), building: new Set<Type>() },
        weak: { cache: new Map<Type, (data: unknown) => boolean>(), building: new Set<Type>() },
    };

    constructor(public name: string = 'json') {
        this.registerSerializers();
        this.registerTypeGuards();
    }

    /**
     * Whether to set explicit undefined for missing optional properties.
     * Can be overridden in subclasses.
     */
    public setExplicitUndefined(type: Type, state: JsonBuildContext): boolean {
        return true;
    }

    /**
     * Register default serializers. Override in subclasses to customize.
     */
    protected registerSerializers(): void {
        // Handlers will be registered via registerDefaultHandlers() from handlers.ts
    }

    /**
     * Register default type guards. Override in subclasses to customize.
     */
    protected registerTypeGuards(): void {
        // Guards will be registered via registerDefaultTypeGuards() from handlers.ts
    }

    /**
     * Clear all registries.
     */
    clear(): void {
        this.serializeRegistry.clear();
        this.deserializeRegistry.clear();
        this.typeGuards.clear();
        for (const entry of Object.values(this.typeGuardCaches)) {
            entry.cache.clear();
            entry.building.clear();
        }
    }

    /**
     * Build a serializer function for a type.
     *
     * @param type - The type to serialize
     * @returns A function that serializes data of that type
     */
    buildSerializer<T>(type: Type): SerializeFunction<T> {
        return fn(
            arg<T>(),
            arg<SerializationOptions>(),
            (b: Builder, data: Ref<T>, options: Ref<SerializationOptions>) => {
                // Ensure options is always an object (for safe property access in handlers)
                const optionsRef = b.let(b.nullish(options, b.emptyObj()));
                const state = new JsonBuildContext('serialize', this, b, optionsRef, this.serializeRegistry);

                return state.build(type, data);
            },
        );
    }

    /**
     * Build a deserializer function for a type.
     *
     * @param type - The type to deserialize to
     * @returns A function that deserializes data to that type
     */
    buildDeserializer<T>(type: Type): SerializeFunction<any, T> {
        return fn(
            arg<any>(),
            arg<SerializationOptions>(),
            (b: Builder, data: Ref<any>, options: Ref<SerializationOptions>) => {
                // Ensure options is always an object (for safe property access in handlers)
                const optionsRef = b.let(b.nullish(options, b.emptyObj()));
                const state = new JsonBuildContext('deserialize', this, b, optionsRef, this.deserializeRegistry);

                return state.build(type, data);
            },
        );
    }

    /**
     * Build a validator function for a type.
     *
     * @param type - The type to validate
     * @returns A function that validates data and returns errors
     */
    buildValidator<T>(type: Type): (data: any, errors?: ValidationErrorItem[]) => boolean {
        return fn(
            arg<any>(),
            arg<{ errors?: ValidationErrorItem[] }>(),
            (b: Builder, data: Ref<any>, stateArg: Ref<{ errors?: ValidationErrorItem[] }>) => {
                const optionsRef = b.let(b.nullish(stateArg, b.emptyObj()));

                const state = new JsonBuildContext('validate', this, b, optionsRef, this.typeGuards, {
                    validation: 'strict',
                    collectErrors: true,
                    rejectUnknownKeys: false,
                });

                // For validation, we return a boolean
                const result = state.build(type, data);
                return result as Ref<boolean>;
            },
        );
    }

    /**
     * Build a type guard function.
     *
     * @param type - The type to guard
     * @param withLoose - Whether to include loose guards
     * @returns A type guard function
     */
    buildTypeGuard<T>(type: Type, withLoose: boolean = true): Guard<T> {
        return fn(
            arg<any>(),
            arg<{ errors?: ValidationErrorItem[] }>(),
            (b: Builder, data: Ref<any>, stateArg: Ref<{ errors?: ValidationErrorItem[] }>) => {
                const optionsRef = b.let(b.nullish(stateArg, b.emptyObj()));

                const state = new JsonBuildContext('validate', this, b, optionsRef, this.typeGuards, {
                    validation: withLoose ? 'loose' : 'strict',
                    collectErrors: true,
                    rejectUnknownKeys: false,
                });

                const result = state.build(type, data);
                return result as Ref<boolean>;
            },
        ) as Guard<T>;
    }

    /**
     * Internal helper: build a cached type guard with recursion detection.
     * All three public type guard builders delegate to this method.
     */
    private buildCachedTypeGuard<T>(
        type: Type,
        mode: 'fast' | 'strict' | 'weak',
        contextOptions: { validation: 'fast' | 'strict' | 'loose'; rejectUnknownKeys: boolean; skipNaN?: boolean },
    ): (data: unknown) => data is T {
        const { cache, building } = this.typeGuardCaches[mode];

        const cached = cache.get(type);
        if (cached) return cached as (data: unknown) => data is T;

        if (building.has(type)) {
            return ((data: unknown) => {
                const f = cache.get(type);
                if (!f) throw new DeepkitError('DK-T112', 'Recursive type guard not yet initialized');
                return f(data);
            }) as (data: unknown) => data is T;
        }

        building.add(type);

        try {
            const guardFn = fn(arg<unknown>(), (b: Builder, data: Ref<unknown>) => {
                const state = new JsonBuildContext('validate', this, b, b.emptyObj(), this.typeGuards, {
                    ...contextOptions,
                    collectErrors: false,
                });
                return state.build(type, data);
            }) as (data: unknown) => data is T;

            cache.set(type, guardFn as (data: unknown) => boolean);
            return guardFn;
        } finally {
            building.delete(type);
        }
    }

    /**
     * Build a fast type guard function (pure && chain, no error collection).
     * Use this for maximum performance when you only need to know if data matches the type.
     */
    buildFastTypeGuard<T>(type: Type): (data: unknown) => data is T {
        return this.buildCachedTypeGuard<T>(type, 'fast', {
            validation: 'fast',
            rejectUnknownKeys: false,
        });
    }

    /**
     * Build a strict type guard function (rejects unknown keys).
     * Similar to buildFastTypeGuard but also checks for extra/unknown properties.
     */
    buildStrictTypeGuard<T>(type: Type): (data: unknown) => data is T {
        return this.buildCachedTypeGuard<T>(type, 'strict', {
            validation: 'strict',
            rejectUnknownKeys: true,
        });
    }

    /**
     * Build a weak type guard function (skips NaN checks for maximum speed).
     * Only checks structure/types but skips Number.isNaN() checks.
     */
    buildWeakTypeGuard<T>(type: Type): (data: unknown) => data is T {
        return this.buildCachedTypeGuard<T>(type, 'weak', {
            validation: 'fast',
            rejectUnknownKeys: false,
            skipNaN: true,
        });
    }
}

/**
 * Compute a cache key suffix from build options.
 * Returns empty string for default options (no baked values).
 */
export function computeBuildOptionsKey(buildOptions?: BuildOptions): string {
    if (!buildOptions) return '';

    const parts: string[] = [];

    // Loose mode: L=loose, S=strict
    if (buildOptions.looseBaked !== undefined) {
        parts.push(buildOptions.looseBaked ? 'L' : 'S');
    }

    // Groups: G:group1,group2 or GX:excludedGroup1,excludedGroup2
    if (buildOptions.groupsBaked !== undefined) {
        const sorted = [...buildOptions.groupsBaked].sort();
        parts.push(`G:${sorted.join(',')}`);
    }
    if (buildOptions.groupsExcludeBaked !== undefined) {
        const sorted = [...buildOptions.groupsExcludeBaked].sort();
        parts.push(`GX:${sorted.join(',')}`);
    }

    return parts.length > 0 ? '_' + parts.join('_') : '';
}

/**
 * Convert SerializationOptions to BuildOptions for baking into specialized functions.
 */
export function serializationOptionsToBuildOptions(options?: SerializationOptions): BuildOptions | undefined {
    if (!options) return undefined;

    const buildOptions: BuildOptions = {};
    let hasBakedOptions = false;

    // Bake loose mode if explicitly set
    if (options.loosely !== undefined) {
        buildOptions.looseBaked = options.loosely;
        hasBakedOptions = true;
    }

    // Bake groups if provided
    if (options.groups !== undefined) {
        buildOptions.groupsBaked = options.groups;
        hasBakedOptions = true;
    }
    if (options.groupsExclude !== undefined) {
        buildOptions.groupsExcludeBaked = options.groupsExclude;
        hasBakedOptions = true;
    }

    return hasBakedOptions ? buildOptions : undefined;
}

/**
 * Get a cached serializer function for a type.
 *
 * @param type - The type to serialize
 * @param registry - The handler registry (serialize or deserialize)
 * @param namingStrategy - Property naming strategy
 * @param path - Path prefix for error messages
 * @param buildOptions - Optional build-time options to bake into the function
 */
export function getSerializeFunction(
    type: Type,
    registry: HandlerRegistry<JsonBuildContext>,
    namingStrategy: NamingStrategy = defaultNamingStrategy,
    path: string = '',
    buildOptions?: BuildOptions,
): SerializeFunction {
    const jitContainer = getTypeJitContainer(type);

    // Fast path: default naming, empty path, no buildOptions (the common case)
    let id: string;
    if (namingStrategy === defaultNamingStrategy && path === '' && !buildOptions) {
        id = registry._fastCacheKey || (registry._fastCacheKey = `${registry.id}_default_`);
    } else {
        const nsPrefix = namingStrategy._cacheKeyPrefix || (namingStrategy._cacheKeyPrefix = `${namingStrategy.id}_`);
        id = `${registry.id}_${nsPrefix}${path}${computeBuildOptionsKey(buildOptions)}`;
    }

    if (jitContainer[id]) {
        return jitContainer[id];
    }

    jitContainer[id] = createSerializeFunction(type, registry, namingStrategy, path, buildOptions);
    toFastProperties(jitContainer);

    return jitContainer[id];
}

/**
 * Create a serializer function for a type (not cached).
 *
 * @param type - The type to serialize
 * @param registry - The handler registry
 * @param namingStrategy - Property naming strategy
 * @param path - Path prefix for error messages
 * @param buildOptions - Optional build-time options to bake into the function
 */
export function createSerializeFunction(
    type: Type,
    registry: HandlerRegistry<JsonBuildContext>,
    namingStrategy: NamingStrategy = defaultNamingStrategy,
    path: string = '',
    buildOptions?: BuildOptions,
): SerializeFunction {
    // Get direction from registry
    const direction = registry.direction;

    return fn(
        arg<any>(),
        arg<SerializationOptions>(),
        (b: Builder, data: Ref<any>, options: Ref<SerializationOptions>) => {
            // Ensure options is always an object (for safe property access in handlers)
            const optionsRef = b.let(b.nullish(options, b.emptyObj()));

            const state = new JsonBuildContext(
                direction,
                serializer, // Use default serializer
                b,
                optionsRef,
                registry,
                { namingStrategy, buildOptions },
            );

            return state.build(type, data);
        },
    );
}

/**
 * Create a type guard function for a type.
 */
export function createTypeGuardFunction(
    type: Type,
    serializerToUse?: Serializer,
    withLoose: boolean = true,
): Guard<any> {
    const s = serializerToUse || serializer;
    return s.buildTypeGuard(type, withLoose);
}

/**
 * Get a Partial<T> type for a class or object literal.
 */
export function getPartialType(type: TypeClass | TypeObjectLiteral): TypeObjectLiteral {
    const jitContainer = getTypeJitContainer(type);
    if (jitContainer.partialType) return jitContainer.partialType;

    // Copy type and make all properties optional
    type = copyAndSetParent(type);
    type.types = type.types.map(v => ({ ...v })) as any;

    for (const member of type.types) {
        if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
            member.optional = true;
        }
    }

    return (jitContainer.partialType = getTypeObjectLiteralFromTypeClass(type));
}

/**
 * Get a cached serializer for Partial<T>.
 */
export function getPartialSerializeFunction(
    type: TypeClass | TypeObjectLiteral,
    registry: HandlerRegistry<JsonBuildContext>,
    namingStrategy: NamingStrategy = defaultNamingStrategy,
): SerializeFunction {
    return getSerializeFunction(getPartialType(type), registry, namingStrategy);
}

class JSONSerializer extends Serializer {
    constructor() {
        super('json');
        registerDefaultHandlers(this);
        registerTypeGuards(this);
        registerUnionHandler(this);
        registerValidationHook(this);
    }
}

/**
 * The default JSON serializer instance.
 */
export const serializer = new JSONSerializer();
