/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import type { Builder, Ref } from '@deepkit/core';
import type { ClassType } from '@deepkit/core';

import { ReflectionKind, Type, binaryTypes } from '../reflection/type.js';
import type { SerializerBuildContext } from './context.js';

/**
 * Type handler function signature.
 * Handlers receive the type, input ref, builder, and build context,
 * and return a Ref representing the transformed value.
 *
 * The Ctx type parameter allows handlers to be typed for specific build contexts
 * (e.g., JsonBuildContext for JSON serialization, BsonBuildContext for BSON).
 *
 * @example
 * ```typescript
 * const stringHandler: TypeHandler<TypeString> = (type, input, b, ctx) => {
 *     return b.ternary(
 *         b.isType(input, 'string'),
 *         input,
 *         b.call(String, input)
 *     );
 * };
 * ```
 */
export type TypeHandler<T extends Type = Type, Ctx extends SerializerBuildContext = SerializerBuildContext> = (
    type: T,
    input: Ref,
    b: Builder,
    ctx: Ctx,
) => Ref;

/**
 * Hook function for wrapping type handlers.
 * Can modify behavior before/after the main handler executes.
 *
 * The Ctx type parameter allows hooks to be typed for specific build contexts.
 *
 * @example
 * ```typescript
 * const validationHook: TypeHook = (type, input, b, ctx, next) => {
 *     const result = next();
 *     // Add validation after type conversion
 *     runValidators(type, result, b, ctx);
 *     return result;
 * };
 * ```
 */
export type TypeHook<Ctx extends SerializerBuildContext = SerializerBuildContext> = (
    type: Type,
    input: Ref,
    b: Builder,
    ctx: Ctx,
    next: () => Ref,
) => Ref;

/**
 * Registry for type handlers, organized by ReflectionKind, class type, and annotations.
 *
 * The Ctx type parameter specifies the build context type this registry works with.
 * This allows @deepkit/bson to create registries typed for BsonBuildContext while
 * @deepkit/type uses JsonBuildContext.
 *
 * Handlers are executed in order:
 * 1. Pre-hooks (in order added)
 * 2. Annotation handlers (first matching predicate wins)
 * 3. Class handlers (for class types with specific classType)
 * 4. Kind handlers (by ReflectionKind)
 * 5. Post-hooks (in order added)
 */
export class HandlerRegistry<Ctx extends SerializerBuildContext = SerializerBuildContext> {
    private static nextId = 0;
    /** Unique ID that changes when handlers are modified. Used for cache invalidation. */
    public id: number;
    public readonly direction: 'serialize' | 'deserialize';
    /** Pre-formatted cache key for default naming strategy. Lazily computed. */
    _fastCacheKey?: string;

    private kindHandlers = new Map<ReflectionKind, TypeHandler<any, Ctx>[]>();
    private classHandlers = new Map<ClassType, TypeHandler<any, Ctx>[]>();
    private annotationHandlers: Array<{
        predicate: (type: Type) => boolean;
        handler: TypeHandler<any, Ctx>;
    }> = [];
    private preHooks: TypeHook<Ctx>[] = [];
    private postHooks: TypeHook<Ctx>[] = [];

    constructor(direction: 'serialize' | 'deserialize' = 'serialize') {
        this.id = HandlerRegistry.nextId++;
        this.direction = direction;
    }

    /** Increment ID to invalidate cached functions. */
    private invalidateCache(): void {
        this.id = HandlerRegistry.nextId++;
        this._fastCacheKey = undefined;
    }

    /**
     * Register a handler for a ReflectionKind.
     * Multiple handlers can be registered for the same kind.
     */
    register<T extends Type = Type>(kind: ReflectionKind, handler: TypeHandler<T, Ctx>): this {
        const handlers = this.kindHandlers.get(kind);
        if (handlers) {
            handlers.push(handler);
        } else {
            this.kindHandlers.set(kind, [handler]);
        }
        this.invalidateCache();
        return this;
    }

    /**
     * Prepend a handler for a ReflectionKind (runs before existing handlers).
     */
    prepend<T extends Type = Type>(kind: ReflectionKind, handler: TypeHandler<T, Ctx>): this {
        const handlers = this.kindHandlers.get(kind);
        if (handlers) {
            handlers.unshift(handler);
        } else {
            this.kindHandlers.set(kind, [handler]);
        }
        this.invalidateCache();
        return this;
    }

    /**
     * Append a handler for a ReflectionKind (alias for register).
     */
    append<T extends Type = Type>(kind: ReflectionKind, handler: TypeHandler<T, Ctx>): this {
        return this.register(kind, handler);
    }

    /**
     * Register a handler for a specific class type (Date, Set, Map, etc.).
     */
    registerClass<T extends Type = Type>(classType: ClassType, handler: TypeHandler<T, Ctx>): this {
        const handlers = this.classHandlers.get(classType);
        if (handlers) {
            handlers.push(handler);
        } else {
            this.classHandlers.set(classType, [handler]);
        }
        this.invalidateCache();
        return this;
    }

    /**
     * Register a handler for all binary types (ArrayBuffer, TypedArrays).
     */
    registerBinary<T extends Type = Type>(handler: TypeHandler<T, Ctx>): this {
        for (const binaryType of binaryTypes) {
            this.registerClass(binaryType, handler);
        }
        return this;
    }

    /**
     * Register a handler based on an annotation/decorator predicate.
     * First matching predicate wins.
     */
    addDecorator<T extends Type = Type>(predicate: (type: Type) => boolean, handler: TypeHandler<T, Ctx>): this {
        this.annotationHandlers.push({ predicate, handler });
        this.invalidateCache();
        return this;
    }

    /**
     * Add a pre-hook that runs before main handlers.
     */
    addPreHook(hook: TypeHook<Ctx>): this {
        this.preHooks.push(hook);
        this.invalidateCache();
        return this;
    }

    /**
     * Add a post-hook that runs after main handlers.
     */
    addPostHook(hook: TypeHook<Ctx>): this {
        this.postHooks.push(hook);
        this.invalidateCache();
        return this;
    }

    /**
     * Get handlers for a ReflectionKind.
     */
    getKindHandlers(kind: ReflectionKind): TypeHandler<any, Ctx>[] {
        return this.kindHandlers.get(kind) || [];
    }

    /**
     * Get handlers for a class type.
     */
    getClassHandlers(classType: ClassType): TypeHandler<any, Ctx>[] {
        return this.classHandlers.get(classType) || [];
    }

    /**
     * Check if any handlers exist for a type.
     */
    has(type: Type): boolean {
        // Check annotation handlers
        for (const { predicate } of this.annotationHandlers) {
            if (predicate(type)) return true;
        }

        // Check class handlers for class types
        if (type.kind === ReflectionKind.class && type.classType) {
            if (this.classHandlers.has(type.classType)) return true;
        }

        // Check kind handlers
        return this.kindHandlers.has(type.kind);
    }

    /**
     * Build the output for a type using registered handlers.
     * Executes pre-hooks, handlers, and post-hooks in order.
     */
    build(type: Type, input: Ref, b: Builder, ctx: Ctx): Ref {
        const executeMain = (): Ref => {
            // 1. Check annotation handlers first
            for (const { predicate, handler } of this.annotationHandlers) {
                if (predicate(type)) {
                    return handler(type, input, b, ctx);
                }
            }

            // 2. Check class handlers for class types
            if (type.kind === ReflectionKind.class && type.classType) {
                const classHandlers = this.classHandlers.get(type.classType);
                if (classHandlers && classHandlers.length > 0) {
                    // Execute all class handlers in sequence
                    let result = input;
                    for (const handler of classHandlers) {
                        result = handler(type, result, b, ctx);
                    }
                    return result;
                }
            }

            // 3. Execute kind handlers
            const kindHandlers = this.kindHandlers.get(type.kind);
            if (kindHandlers && kindHandlers.length > 0) {
                let result = input;
                for (const handler of kindHandlers) {
                    result = handler(type, result, b, ctx);
                }
                return result;
            }

            // No handler found - return input unchanged
            return input;
        };

        // Wrap with hooks
        let execute = executeMain;

        // Apply post-hooks (innermost to outermost)
        for (let i = this.postHooks.length - 1; i >= 0; i--) {
            const hook = this.postHooks[i];
            const prev = execute;
            execute = () => hook(type, input, b, ctx, prev);
        }

        // Apply pre-hooks (outermost to innermost)
        for (let i = this.preHooks.length - 1; i >= 0; i--) {
            const hook = this.preHooks[i];
            const prev = execute;
            execute = () => hook(type, input, b, ctx, prev);
        }

        return execute();
    }

    /**
     * Clear all registered handlers and hooks.
     */
    clear(): void {
        this.kindHandlers.clear();
        this.classHandlers.clear();
        this.annotationHandlers = [];
        this.preHooks = [];
        this.postHooks = [];
        this.invalidateCache();
    }
}

/**
 * Registry for type guards organized by specificality level.
 *
 * @deprecated Use HandlerRegistry instead. The Serializer now uses a single
 * unified HandlerRegistry for type guards with behavior controlled by
 * BuildState flags (collectErrors, rejectUnknownKeys).
 *
 * Specificality levels determine when guards activate:
 * - Negative values: Loose mode only (string coercion)
 * - 1: Exact/strict mode (typeof checks)
 * - > 1: Fallback modes (late resolution)
 *
 * @example
 * ```typescript
 * const guards = new TypeGuardRegistry();
 *
 * // Exact match (specificality 1)
 * guards.register(1, ReflectionKind.number, (type, input, b) =>
 *     b.isType(input, 'number')
 * );
 *
 * // Loose from string (specificality -0.5)
 * guards.register(-0.5, ReflectionKind.number, (type, input, b) =>
 *     b.and(b.isType(input, 'string'), b.call(isNumeric, input))
 * );
 * ```
 */
export class TypeGuardRegistry {
    private levels = new Map<number, HandlerRegistry>();

    /**
     * Get or create a HandlerRegistry for a specificality level.
     */
    getRegistry(specificality: number): HandlerRegistry {
        let registry = this.levels.get(specificality);
        if (!registry) {
            registry = new HandlerRegistry();
            this.levels.set(specificality, registry);
        }
        return registry;
    }

    /**
     * Register a guard for a ReflectionKind at a specificality level.
     */
    register(specificality: number, kind: ReflectionKind, handler: TypeHandler): this {
        this.getRegistry(specificality).register(kind, handler);
        return this;
    }

    /**
     * Register a guard for a class type at a specificality level.
     */
    registerClass(specificality: number, classType: ClassType, handler: TypeHandler): this {
        this.getRegistry(specificality).registerClass(classType, handler);
        return this;
    }

    /**
     * Register a guard for binary types at a specificality level.
     */
    registerBinary(specificality: number, handler: TypeHandler): this {
        this.getRegistry(specificality).registerBinary(handler);
        return this;
    }

    /**
     * Register a guard based on an annotation predicate.
     */
    addDecorator(specificality: number, predicate: (type: Type) => boolean, handler: TypeHandler): this {
        this.getRegistry(specificality).addDecorator(predicate, handler);
        return this;
    }

    /**
     * Get all specificality levels sorted ascending (lowest first).
     * Lower specificality = more loose, tried first.
     */
    getSortedLevels(): Array<[number, HandlerRegistry]> {
        return [...this.levels.entries()].sort((a, b) => a[0] - b[0]);
    }

    /**
     * Get levels within a specificality range, sorted ascending.
     */
    getLevelsInRange(min: number, max: number): Array<[number, HandlerRegistry]> {
        return this.getSortedLevels().filter(([level]) => level >= min && level <= max);
    }

    /**
     * Check if any guards exist for a type at any specificality level.
     */
    has(type: Type): boolean {
        for (const registry of this.levels.values()) {
            if (registry.has(type)) return true;
        }
        return false;
    }

    /**
     * Clear all guards at all specificality levels.
     */
    clear(): void {
        for (const registry of this.levels.values()) {
            registry.clear();
        }
        this.levels.clear();
    }
}
