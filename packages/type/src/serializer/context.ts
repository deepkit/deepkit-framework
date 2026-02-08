/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, VarRef } from '@deepkit/core';

import { ReflectionKind, Type } from '../reflection/type.js';
import { NamingStrategy, defaultNamingStrategy } from './naming.js';
import type { HandlerRegistry } from './registry.js';

/**
 * Represents a dynamic path segment that contains a Ref for the index/key value.
 * Used when the path segment is computed at runtime (e.g., array index or object key in a loop).
 */
export class DynamicPathSegment {
    constructor(public ref: Ref) {}
}

/**
 * Type for path segments - can be either a static string or a dynamic segment.
 */
export type PathSegment = string | DynamicPathSegment;

/**
 * Check if a type is complex (should count toward depth limit).
 * Complex types are those that contain nested types: objects, classes, arrays, tuples.
 */
export function isComplexType(type: Type): boolean {
    return (
        type.kind === ReflectionKind.objectLiteral ||
        type.kind === ReflectionKind.class ||
        type.kind === ReflectionKind.array ||
        type.kind === ReflectionKind.tuple
    );
}

/**
 * Options for constructing a SerializerBuildContext.
 */
export interface SerializerBuildContextOptions {
    /** Types currently being processed (for circular detection) */
    typeStack?: Set<Type>;
    /** Current depth in the type tree */
    depth?: number;
    /** Maximum depth before extracting to separate function */
    maxDepth?: number;
    /** Path segments for error messages */
    pathSegments?: PathSegment[];
    /** Naming strategy for property name transformation */
    namingStrategy?: NamingStrategy;
    /** Cache of extracted functions by type */
    fnCache?: Map<Type, VarRef<Function>>;
}

/**
 * Abstract base class for JIT serializer code generation context.
 *
 * This class contains shared state management logic used by both @deepkit/type
 * (JsonBuildContext) and @deepkit/bson (BsonBuildContext). It handles:
 * - Circular reference detection via typeStack
 * - Depth tracking for controlling function extraction
 * - Path segments for error messages
 * - The build() decision logic (inline vs extract)
 *
 * Subclasses implement:
 * - buildExtractedCall(): create an extracted function call for depth/recursion control
 */
export abstract class SerializerBuildContext {
    /** Default maximum inline depth before extracting to separate function */
    static readonly DEFAULT_MAX_DEPTH = 3;

    /** JIT2 Builder for expression tree construction */
    readonly b: Builder;

    /** The handler registry being used */
    readonly registry: HandlerRegistry<any>;

    /** Serialization direction */
    readonly direction: 'serialize' | 'deserialize';

    /** Types currently being processed (for circular detection) */
    readonly typeStack: Set<Type>;

    /** Current depth in the type tree */
    readonly depth: number;

    /** Maximum depth before extracting */
    readonly maxDepth: number;

    /** Path segments for error messages */
    readonly pathSegments: PathSegment[];

    /** Naming strategy for property name transformation */
    readonly namingStrategy: NamingStrategy;

    /** Cache of extracted functions by type */
    readonly fnCache: Map<Type, VarRef<Function>>;

    constructor(
        b: Builder,
        registry: HandlerRegistry<any>,
        direction: 'serialize' | 'deserialize',
        options: SerializerBuildContextOptions = {},
    ) {
        this.b = b;
        this.registry = registry;
        this.direction = direction;
        this.typeStack = options.typeStack ?? new Set();
        this.depth = options.depth ?? 0;
        this.maxDepth = options.maxDepth ?? SerializerBuildContext.DEFAULT_MAX_DEPTH;
        this.pathSegments = options.pathSegments ?? [];
        this.namingStrategy = options.namingStrategy ?? defaultNamingStrategy;
        this.fnCache = options.fnCache ?? new Map();
    }

    /**
     * Check if we should extract this type to a separate function.
     * Returns true if:
     * - Type is already in typeStack (circular reference)
     * - Depth exceeds maxDepth AND type is complex (code bloat prevention)
     */
    shouldExtract(type: Type): boolean {
        if (this.typeStack.has(type)) return true;
        if (this.depth >= this.maxDepth && isComplexType(type)) return true;
        return false;
    }

    /**
     * Check if type is in the current type stack (circular/mutual recursion).
     */
    isCircular(type: Type): boolean {
        return this.typeStack.has(type);
    }

    /**
     * Add type to the stack. Call before processing a complex type.
     */
    pushType(type: Type): void {
        this.typeStack.add(type);
    }

    /**
     * Remove type from the stack. Call after processing a complex type.
     */
    popType(type: Type): void {
        this.typeStack.delete(type);
    }

    /**
     * Get the current path as a string for error messages.
     * Static segments are joined with '.', dynamic segments are converted to their values.
     */
    getPath(): string {
        if (this.pathSegments.length === 0) {
            return '';
        }
        const parts: string[] = [];
        for (const segment of this.pathSegments) {
            if (segment instanceof DynamicPathSegment) {
                // For static path string, we'd need the actual index value at runtime
                // This method is for generating static strings; use pathRef() for runtime
                parts.push('[*]');
            } else {
                parts.push(segment);
            }
        }
        return parts.join('.');
    }

    /**
     * Get the current path as a Ref expression (for runtime path building).
     * Returns a Ref<string> that evaluates to the path at runtime.
     */
    pathRef(): Ref<string> {
        if (this.pathSegments.length === 0) {
            return this.b.lit('');
        }
        // Build path expression by concatenating segments
        const parts: Ref<string>[] = [];
        for (let i = 0; i < this.pathSegments.length; i++) {
            if (i > 0) {
                parts.push(this.b.lit('.'));
            }
            const segment = this.pathSegments[i];
            if (segment instanceof DynamicPathSegment) {
                // Dynamic segment - convert the number ref to string
                parts.push(this.b.call(String, segment.ref) as Ref<string>);
            } else {
                parts.push(this.b.lit(segment));
            }
        }
        return parts.length === 1 ? parts[0] : this.b.concat(...parts);
    }

    /**
     * Build a type, deciding whether to inline or extract.
     *
     * Decision tree:
     * 1. typeStack.has(type)? -> Extract (circular in current path) with fnCache reuse
     * 2. depth >= maxDepth && isComplex? -> Extract (size control) WITHOUT fnCache reuse
     * 3. Default -> Inline
     *
     * The distinction between cases 1 and 2 is critical:
     * - Case 1 (mutual recursion): We ARE on the same code path, so fnCache reuse is safe
     * - Case 2 (depth-based): We might be in different code paths (e.g., inside vs outside
     *   an if-block), so fnCache reuse would fail with "variable not defined" errors
     */
    build(type: Type, input: Ref): Ref {
        // 1. CIRCULAR: Already building this type in current path?
        // Pass isMutualRecursion=true to allow fnCache reuse (same code path guaranteed)
        if (this.typeStack.has(type)) {
            return this.buildExtractedCall(type, input, true);
        }

        // 2. DEPTH: Too deep? Extract to keep function size manageable
        // Pass isMutualRecursion=false - DON'T reuse fnCache (different code paths possible)
        if (this.depth >= this.maxDepth && isComplexType(type)) {
            return this.buildExtractedCall(type, input, false);
        }

        // 3. INLINE: Default - embed type handling directly
        return this.buildInlineWithTracking(type, input);
    }

    /**
     * Build a type inline, tracking it in the typeStack.
     * Wraps buildInline with push/pop for circular detection.
     */
    protected buildInlineWithTracking(type: Type, input: Ref): Ref {
        this.typeStack.add(type);
        try {
            return this.buildInline(type, input);
        } finally {
            this.typeStack.delete(type);
        }
    }

    /**
     * Build a type inline without extraction.
     * Uses the registry to generate code for the type.
     * Both @deepkit/type and @deepkit/bson use HandlerRegistry.
     */
    protected buildInline(type: Type, input: Ref): Ref {
        return this.registry.build(type, input, this.b, this as any);
    }

    /**
     * Create an extracted function call for a type.
     *
     * This method handles both mutual recursion and depth-based extraction:
     * - For mutual recursion (isMutualRecursion=true): reuses fnCache entry
     * - For depth-based (isMutualRecursion=false): creates new VarRef each time
     *
     * Subclasses must implement this because the extracted function needs to create
     * a child state with subclass-specific fields (e.g., optionsRef, serializer, etc.).
     *
     * @param type - The type to extract
     * @param input - The input value ref
     * @param isMutualRecursion - Whether this is a circular reference (safe to reuse cache)
     */
    abstract buildExtractedCall(type: Type, input: Ref, isMutualRecursion: boolean): Ref;
}
