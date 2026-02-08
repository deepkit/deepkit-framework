/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Ref } from '@deepkit/core';
import { NamingStrategy, Type, TypeProperty, TypePropertySignature, memberNameToString } from '@deepkit/type';

/**
 * Property name type for BSON serialization.
 * Can be a static string, a numeric Ref (for array indices), or a string Ref (for index signatures).
 * @internal
 */
export type PropertyName = string | Ref<number> | Ref<string>;

/**
 * Default naming strategy for BSON serialization.
 */
const defaultBsonNamingStrategy = new NamingStrategy('bson');

/**
 * Get the serialized property name for a type property using the given naming strategy.
 * Uses the naming strategy to handle @MapName annotations and transformations.
 */
function bsonPropertyName(namingStrategy: NamingStrategy, prop: TypeProperty | TypePropertySignature): string {
    return namingStrategy.getPropertyName(prop, 'bson') ?? memberNameToString(prop.name);
}

/**
 * Build state for BSON JIT serialization code generation.
 *
 * This is a simple state class that tracks:
 * - Type stack for circular reference detection
 * - Depth tracking for extraction control
 * - Path tracking for error messages
 * - Naming strategy for property name transformation
 *
 * This is the primary state class used by the BSON serializer.
 * @internal
 */
export class BSONBuildState {
    /** Maximum inline depth before extracting to separate function */
    static readonly MAX_DEPTH = 3;

    /** Types currently being processed (for circular detection) */
    readonly typeStack: Set<Type>;

    /** Current depth in the type tree */
    readonly depth: number;

    /** Path segments for error messages */
    readonly pathSegments: string[];

    /** Naming strategy for property name transformation */
    readonly namingStrategy: NamingStrategy;

    constructor(
        options: {
            typeStack?: Set<Type>;
            depth?: number;
            pathSegments?: string[];
            namingStrategy?: NamingStrategy;
        } = {},
    ) {
        this.typeStack = options.typeStack ?? new Set();
        this.depth = options.depth ?? 0;
        this.pathSegments = options.pathSegments ?? [];
        this.namingStrategy = options.namingStrategy ?? defaultBsonNamingStrategy;
    }

    /**
     * Get the serialized property name for a type property.
     */
    getPropertyName(prop: TypeProperty | TypePropertySignature): string {
        return bsonPropertyName(this.namingStrategy, prop);
    }

    /**
     * Fork state for a property.
     * Shares typeStack (for global circular detection), increments depth, adds path segment.
     */
    forProperty(name: string): BSONBuildState {
        return new BSONBuildState({
            typeStack: this.typeStack,
            depth: this.depth + 1,
            pathSegments: [...this.pathSegments, name],
            namingStrategy: this.namingStrategy,
        });
    }

    /**
     * Fork state for an array/tuple index.
     * Uses fresh typeStack because map callbacks create new JS scope where
     * outer variables aren't visible - types "in progress" shouldn't carry over.
     * Does NOT increment depth because array loop bodies share a single code path —
     * they don't cause code bloat like property-level nesting does.
     */
    forIndex(index: number | string = '*'): BSONBuildState {
        return new BSONBuildState({
            typeStack: new Set(), // Fresh stack for map callback scope
            depth: this.depth,
            pathSegments: [...this.pathSegments, `[${index}]`],
            namingStrategy: this.namingStrategy,
        });
    }

    /**
     * Get the current path as a string for error messages.
     */
    getPath(): string {
        return this.pathSegments.length > 0 ? this.pathSegments.join('.') : '<root>';
    }

    /**
     * Check if we should extract this type to a separate function.
     * Returns true if:
     * - Type is already in typeStack (circular reference)
     * - Depth exceeds MAX_DEPTH (code bloat prevention)
     */
    shouldExtract(type: Type): boolean {
        return this.typeStack.has(type) || this.depth >= BSONBuildState.MAX_DEPTH;
    }

    /**
     * Check if type is in the current type stack (circular reference).
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
}
