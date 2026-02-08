/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, VarRef, arg, fn, stringifyValueWithType } from '@deepkit/core';

import { hasCircularReference } from '../reflection/reflection.js';
import { Type, stringifyType } from '../reflection/type.js';
import { ValidationError, ValidationErrorItem } from '../validator.js';
import {
    DynamicPathSegment,
    PathSegment,
    SerializerBuildContext,
    SerializerBuildContextOptions,
    isComplexType,
} from './context.js';
import { NamingStrategy } from './naming.js';
import { HandlerRegistry } from './registry.js';
import type { Serializer } from './serializer.js';

/**
 * Options passed at runtime to serialization/deserialization functions.
 */
export interface SerializationOptions {
    /**
     * Which groups to include. If a property is not assigned to
     * a given group, it will be excluded.
     * Use an empty array to include only non-grouped properties.
     */
    groups?: string[];

    /**
     * Which groups to exclude. If a property is assigned to at least
     * one given group, it will be excluded.
     * Use an empty array to exclude only non-grouped properties.
     */
    groupsExclude?: string[];

    /**
     * Enable loose type coercion (default: true).
     * When true, allows string-to-number, string-to-boolean conversions, etc.
     */
    loosely?: boolean;
}

/**
 * Build-time options that are baked into specialized functions.
 * When set, the corresponding runtime checks are eliminated.
 */
export interface BuildOptions {
    /**
     * Loose mode baked in at build time.
     * When defined, no runtime check is needed - use this value directly.
     */
    looseBaked?: boolean;

    /**
     * Groups to include, baked in at build time.
     * When defined, group filtering is done at build time (properties excluded from generated code).
     */
    groupsBaked?: string[];

    /**
     * Groups to exclude, baked in at build time.
     * When defined, group filtering is done at build time.
     */
    groupsExcludeBaked?: string[];
}

/**
 * Check if a property with given groups should be serialized based on options.
 * Handles undefined/null options gracefully (returns true = allowed).
 */
export function isGroupAllowed(options: SerializationOptions | undefined | null, groupNames: string[]): boolean {
    if (!options || (!options.groups && !options.groupsExclude)) return true;

    if (options.groupsExclude) {
        if (options.groupsExclude.length === 0 && groupNames.length === 0) {
            return false;
        }
        for (const group of options.groupsExclude) {
            if (groupNames.includes(group)) {
                return false;
            }
        }
    }

    if (options.groups) {
        if (options.groups.length === 0 && groupNames.length === 0) {
            return true;
        }
        for (const group of options.groups) {
            if (groupNames.includes(group)) {
                return true;
            }
        }
        return false;
    }

    return true;
}

/**
 * Build-specific options extending serializer context options.
 */
export interface JsonBuildContextOptions extends SerializerBuildContextOptions {
    validation?: 'strict' | 'loose' | 'fast';
    collectErrors?: boolean;
    rejectUnknownKeys?: boolean;
    inUnionContext?: boolean;
    collectUnionMemberErrors?: boolean;
    skipNaN?: boolean;
    buildOptions?: BuildOptions;
}

/**
 * Build context for JSON/object JIT serialization code generation.
 *
 * Extends SerializerBuildContext with JSON-specific functionality:
 * - Direction (serialize/deserialize/validate)
 * - Validation mode and error collection
 * - SerializationOptions reference
 */
export class JsonBuildContext extends SerializerBuildContext {
    /** The serializer instance */
    readonly serializer: Serializer;

    /** Options ref (bound with nullish coalescing by caller) */
    readonly optionsRef: Ref<SerializationOptions>;

    /** Validation mode: strict, loose, fast (pure && chain), or undefined */
    readonly validation: 'strict' | 'loose' | 'fast' | undefined;

    /** Whether to collect validation errors (for buildTypeGuard with error collection) */
    readonly collectErrors: boolean;

    /** Whether to reject unknown object keys (for strict type guards) */
    readonly rejectUnknownKeys: boolean;

    /** Whether currently checking union members (skip error-adding in post-hook) */
    readonly inUnionContext: boolean;

    /** Whether to collect errors during union member checks (for #577 error filtering) */
    readonly collectUnionMemberErrors: boolean;

    /** Whether to skip NaN checks on numbers (for weak/fastest mode) */
    readonly skipNaN: boolean;

    /** Build-time baked options - when set, eliminate runtime checks */
    readonly buildOptions: BuildOptions;

    constructor(
        direction: 'serialize' | 'deserialize' | 'validate',
        serializer: Serializer,
        b: Builder,
        optionsRef: Ref<SerializationOptions>,
        registry: HandlerRegistry<JsonBuildContext>,
        options: JsonBuildContextOptions = {},
    ) {
        // Note: validate direction is mapped to 'deserialize' for SerializerBuildContext
        // since validation is a form of deserialization (input -> validated output)
        super(b, registry, direction === 'validate' ? 'deserialize' : direction, options);
        this.serializer = serializer;
        this.optionsRef = optionsRef;
        this.validation = options.validation;
        this.collectErrors = options.collectErrors ?? false;
        this.rejectUnknownKeys = options.rejectUnknownKeys ?? false;
        this.inUnionContext = options.inUnionContext ?? false;
        this.collectUnionMemberErrors = options.collectUnionMemberErrors ?? false;
        this.skipNaN = options.skipNaN ?? false;
        this.buildOptions = options.buildOptions ?? {};
    }

    /**
     * Get the direction including 'validate' for JsonBuildContext-specific logic.
     * This returns the actual direction passed to the constructor.
     */
    get actualDirection(): 'serialize' | 'deserialize' | 'validate' {
        if (this.validation !== undefined) return 'validate';
        return this.direction;
    }

    /**
     * Check if loose mode is enabled.
     * If looseBaked is defined, returns a literal (no runtime check).
     * Otherwise returns runtime check: options.loosely !== false
     */
    isLoose(): Ref<boolean> {
        // If loose mode is baked in at build time, return literal (no runtime check)
        if (this.buildOptions.looseBaked !== undefined) {
            return this.b.lit(this.buildOptions.looseBaked);
        }
        // Runtime check: loosely defaults to true (loosely !== false)
        // optionsRef is already guaranteed to be an object via nullish coalescing
        return this.b.neq(this.optionsRef.get('loosely'), this.b.lit(false));
    }

    /**
     * Check if type can have circular data at runtime.
     */
    hasCircularReference(type: Type): boolean {
        return hasCircularReference(type);
    }

    /**
     * Throw a serialization error.
     */
    throw_(type: Type, value: Ref, message?: string): void {
        const typeStr = stringifyType(type).replace(/\n/g, '').replace(/\s+/g, ' ').trim();
        const pathExpr = this.pathRef();

        // Create error message with stringified value (format: "type value" e.g., 'string "hello"')
        const valueStr = this.b.call(stringifyValueWithType, value);
        const errorMsg = this.b.concat(
            this.b.lit('Cannot convert '),
            valueStr,
            this.b.lit(' to '),
            this.b.lit(typeStr),
            message ? this.b.lit('. ' + message) : this.b.lit(''),
        );

        // Create and throw ValidationError
        const errorItem = this.b.obj({
            code: this.b.lit('type'),
            path: pathExpr,
            message: errorMsg,
        });

        const errorArray = this.b.let(this.b.emptyArr());
        this.b.push(errorArray, errorItem);

        const validationErrorCreate = (items: ValidationErrorItem[]) => ValidationError.from(items);
        const error = this.b.call(validationErrorCreate, errorArray);
        this.b.throw_(error);
    }

    /**
     * Store an external value for use in generated code.
     */
    extern<T>(value: T): Ref<T> {
        return this.b.lit(value);
    }

    /**
     * Fork state for a property.
     */
    forProperty(name: string): JsonBuildContext {
        return new JsonBuildContext(this.actualDirection, this.serializer, this.b, this.optionsRef, this.registry, {
            validation: this.validation,
            collectErrors: this.collectErrors,
            rejectUnknownKeys: this.rejectUnknownKeys,
            inUnionContext: this.inUnionContext,
            collectUnionMemberErrors: this.collectUnionMemberErrors,
            skipNaN: this.skipNaN,
            depth: this.depth + 1,
            maxDepth: this.maxDepth,
            typeStack: this.typeStack,
            fnCache: this.fnCache,
            pathSegments: [...this.pathSegments, name],
            namingStrategy: this.namingStrategy,
            buildOptions: this.buildOptions,
        });
    }

    /**
     * Fork state for an array/tuple index.
     *
     * IMPORTANT: Uses fresh fnCache AND fresh typeStack because forIndex is called
     * inside b.map() callbacks, which create a new JavaScript scope. Variables
     * declared inside map callbacks are not visible outside, so:
     * - fnCache must be fresh to avoid variable scope leakage
     * - typeStack must be fresh because types "in progress" in the outer scope
     *   should not be considered mutual recursion inside the map callback
     */
    forIndex(index: Ref<number>): JsonBuildContext {
        return new JsonBuildContext(this.actualDirection, this.serializer, this.b, this.optionsRef, this.registry, {
            validation: this.validation,
            collectErrors: this.collectErrors,
            rejectUnknownKeys: this.rejectUnknownKeys,
            inUnionContext: this.inUnionContext,
            collectUnionMemberErrors: this.collectUnionMemberErrors,
            skipNaN: this.skipNaN,
            depth: this.depth + 1,
            maxDepth: this.maxDepth,
            typeStack: new Set(), // Fresh stack - map callbacks break call path
            fnCache: new Map(), // Fresh cache - map callbacks create new JS scope
            // Use DynamicPathSegment with the actual index ref
            pathSegments: [...this.pathSegments, new DynamicPathSegment(index)],
            namingStrategy: this.namingStrategy,
            buildOptions: this.buildOptions,
        });
    }

    /**
     * Fork state for an object key (index signature iteration).
     *
     * Unlike forIndex, this keeps the SAME typeStack and fnCache because forKey is used
     * inside b.forIn() which generates a plain for...in loop (not a new JS scope).
     * Variables declared in the outer scope are accessible inside the loop body.
     */
    forKey(key: Ref<string>): JsonBuildContext {
        return new JsonBuildContext(this.actualDirection, this.serializer, this.b, this.optionsRef, this.registry, {
            validation: this.validation,
            collectErrors: this.collectErrors,
            rejectUnknownKeys: this.rejectUnknownKeys,
            inUnionContext: this.inUnionContext,
            collectUnionMemberErrors: this.collectUnionMemberErrors,
            skipNaN: this.skipNaN,
            depth: this.depth + 1,
            maxDepth: this.maxDepth,
            typeStack: this.typeStack,
            fnCache: this.fnCache,
            pathSegments: [...this.pathSegments, new DynamicPathSegment(key)],
            namingStrategy: this.namingStrategy,
            buildOptions: this.buildOptions,
        });
    }

    /**
     * Fork state for a different registry.
     */
    forRegistry(registry: HandlerRegistry<JsonBuildContext>): JsonBuildContext {
        return new JsonBuildContext(this.actualDirection, this.serializer, this.b, this.optionsRef, registry, {
            validation: this.validation,
            collectErrors: this.collectErrors,
            rejectUnknownKeys: this.rejectUnknownKeys,
            inUnionContext: this.inUnionContext,
            collectUnionMemberErrors: this.collectUnionMemberErrors,
            skipNaN: this.skipNaN,
            depth: this.depth,
            maxDepth: this.maxDepth,
            typeStack: this.typeStack,
            fnCache: this.fnCache,
            pathSegments: this.pathSegments,
            namingStrategy: this.namingStrategy,
            buildOptions: this.buildOptions,
        });
    }

    /**
     * Fork state for checking a union member.
     * Error collection is suppressed so that failing members don't add errors.
     * The union handler itself will add ONE error if all members fail.
     */
    forUnionMember(): JsonBuildContext {
        return new JsonBuildContext(this.actualDirection, this.serializer, this.b, this.optionsRef, this.registry, {
            validation: this.validation,
            collectErrors: this.collectErrors,
            rejectUnknownKeys: this.rejectUnknownKeys,
            inUnionContext: true,
            collectUnionMemberErrors: false, // Don't collect when just checking
            skipNaN: this.skipNaN,
            depth: this.depth + 1,
            maxDepth: this.maxDepth,
            typeStack: this.typeStack,
            fnCache: this.fnCache,
            pathSegments: this.pathSegments,
            namingStrategy: this.namingStrategy,
            buildOptions: this.buildOptions,
        });
    }

    /**
     * Build an extracted function call for a type.
     * Implements the abstract method from SerializerBuildContext.
     *
     * @param isMutualRecursion - If true, this is a recursive reference to a type
     *   currently being built (typeStack.has(type) was true). In this case, fnCache
     *   reuse is safe because we're guaranteed to be on the same code path.
     *   If false, this is depth-based extraction and fnCache reuse is NOT safe
     *   because different code paths might trigger this.
     */
    override buildExtractedCall(type: Type, input: Ref, isMutualRecursion: boolean): Ref {
        // Only reuse cached fnVar for MUTUAL RECURSION.
        // For depth-based extraction, always create new variable to avoid
        // using a variable that was initialized in a different code path.
        let fnVar = isMutualRecursion ? this.fnCache.get(type) : undefined;

        if (!fnVar) {
            // Create placeholder variable - will be filled after function is built
            fnVar = this.b.var_<Function>(undefined as any);
            this.fnCache.set(type, fnVar);

            // Build the extracted function
            const self = this;

            // Lazily built and cached function for this extracted type.
            // Built on first call, then reused for all subsequent calls.
            let cachedBuildFn: Function | undefined;
            let isBuilding = false;

            const extractedFn = (data: any, opts: any, path: string): any => {
                // Fast path: function already built, just call it
                if (cachedBuildFn) return cachedBuildFn(data, opts, path);

                // Guard against re-entrant building (recursive types)
                if (isBuilding) return data;

                isBuilding = true;
                try {
                    cachedBuildFn = fn(
                        arg<any>(), // data
                        arg<any>(), // options
                        arg<string>(), // path
                        (b: Builder, dataRef: Ref<any>, optsRef: Ref<any>, pathRef: Ref<string>) => {
                            const childState = new JsonBuildContext(
                                self.actualDirection,
                                self.serializer,
                                b,
                                optsRef,
                                self.registry,
                                {
                                    validation: self.validation,
                                    collectErrors: self.collectErrors,
                                    rejectUnknownKeys: self.rejectUnknownKeys,
                                    skipNaN: self.skipNaN,
                                    depth: 0, // Reset depth
                                    maxDepth: self.maxDepth,
                                    typeStack: new Set(), // Fresh stack
                                    fnCache: new Map(), // Fresh cache - VarRefs are Builder-scoped
                                    pathSegments: [], // Path will come from argument
                                    namingStrategy: self.namingStrategy,
                                    buildOptions: self.buildOptions, // Preserve baked options
                                },
                            );
                            return childState.buildInline(type, dataRef);
                        },
                    );

                    return cachedBuildFn(data, opts, path);
                } finally {
                    isBuilding = false;
                }
            };

            // Fill the placeholder with the built function
            this.b.setVar(fnVar, this.b.lit(extractedFn));
        }

        // Emit call to the extracted function
        return this.b.call(
            (fn: Function, data: any, opts: any, path: string) => fn(data, opts, path),
            this.b.getVar(fnVar),
            input,
            this.optionsRef,
            this.pathRef(),
        );
    }

    /**
     * Build a type inline without extraction.
     * Overrides the protected method from SerializerBuildContext to expose it for buildExtractedCall.
     */
    override buildInline(type: Type, input: Ref): Ref {
        return this.registry.build(type, input, this.b, this);
    }
}
