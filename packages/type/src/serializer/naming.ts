/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Type, TypeParameter, TypeProperty, TypePropertySignature, memberNameToString } from '../reflection/type.js';
import { mapNameAnnotation } from '../type-annotations.js';

/** Property-like types that have a name and type. */
export type PropertyLikeType = TypeProperty | TypePropertySignature | TypeParameter;

/**
 * Controls how property names are transformed during serialization.
 *
 * Make sure to change the id when implementing a custom naming strategy,
 * since caches are based on it.
 *
 * @example
 * ```typescript
 * class MyNamingStrategy extends NamingStrategy {
 *     constructor() {
 *         super('my-strategy');
 *     }
 *
 *     getPropertyName(type: PropertyLikeType, forSerializer: string): string | undefined {
 *         const name = super.getPropertyName(type, forSerializer);
 *         return name ? name.toUpperCase() : undefined;
 *     }
 * }
 * ```
 */
export class NamingStrategy {
    constructor(public id: string = 'default') {}

    /** Pre-formatted cache key prefix: `{id}_`. Lazily computed. */
    _cacheKeyPrefix?: string;

    /**
     * Get the serialized property name for a type property.
     *
     * @param type - The property type
     * @param forSerializer - The serializer name (e.g., 'json', 'bson')
     * @returns The property name to use, or undefined to skip
     */
    getPropertyName(type: PropertyLikeType, forSerializer: string): string | undefined {
        // Check for @MapName annotation first
        for (const mapName of mapNameAnnotation.getAnnotations(type.type)) {
            if (!mapName.serializer || mapName.serializer === forSerializer) {
                return mapName.name;
            }
        }

        return memberNameToString(type.name);
    }
}

/**
 * Built-in naming strategy that converts camelCase to snake_case.
 *
 * @example
 * ```typescript
 * // With underscoreNamingStrategy:
 * // userName -> user_name
 * // firstName -> first_name
 * // HTTPResponse -> _h_t_t_p_response
 * ```
 */
/** Default naming strategy singleton. Avoids allocating a new instance on every call. */
export const defaultNamingStrategy = new NamingStrategy();

export const underscoreNamingStrategy = new (class extends NamingStrategy {
    constructor() {
        super('underscore');
    }

    getPropertyName(type: PropertyLikeType, forSerializer: string): string | undefined {
        const name = super.getPropertyName(type, forSerializer);
        if (!name) return name;
        return name.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
})();
