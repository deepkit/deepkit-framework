/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import {
    ReflectionKind,
    Type,
    TypeLiteral,
    TypeUnion,
    isPropertyMemberType,
    memberNameToString,
    resolveTypeMembers,
} from '../reflection/type.js';

/**
 * Threshold for optimizing unions with literal members.
 * When a union has this many or more literal members, we use Set.has()
 * instead of generating individual if-else statements.
 */
export const UNION_LITERAL_THRESHOLD = 5;

/**
 * Information about a discriminator property in a union.
 * A discriminator is a property with distinct literal values for each member,
 * allowing O(1) lookup to determine which union member to use.
 */
export interface DiscriminatorInfo {
    property: string;
    valueToMember: Map<any, Type>;
}

/**
 * Detect if a union has a discriminator property.
 * A discriminator is a property with distinct literal values for each member.
 *
 * This allows for O(1) union member lookup instead of trying each member in sequence.
 *
 * @param type The union type to analyze
 * @returns DiscriminatorInfo if a discriminator property is found, undefined otherwise
 */
export function detectDiscriminator(type: TypeUnion): DiscriminatorInfo | undefined {
    const candidates = new Map<string, Map<any, Type>>();

    for (const member of type.types) {
        if (member.kind !== ReflectionKind.objectLiteral && member.kind !== ReflectionKind.class) {
            continue;
        }

        for (const prop of resolveTypeMembers(member)) {
            if (!isPropertyMemberType(prop)) continue;
            if (prop.type.kind !== ReflectionKind.literal) continue;

            const name = memberNameToString(prop.name);
            const literal = (prop.type as TypeLiteral).literal;

            if (!candidates.has(name)) {
                candidates.set(name, new Map());
            }
            candidates.get(name)!.set(literal, member);
        }
    }

    // Find property where all members have distinct values
    for (const [prop, valueMap] of candidates) {
        if (valueMap.size === type.types.length) {
            return { property: prop, valueToMember: valueMap };
        }
    }

    return undefined;
}

/**
 * Check if all members of a union are literals.
 *
 * @param type The union type to check
 * @returns true if all union members are literal types
 */
export function isAllLiterals(type: TypeUnion): boolean {
    return type.types.every(t => t.kind === ReflectionKind.literal);
}

/**
 * Check if a type is primitive for union handling purposes.
 * This includes symbol unlike the base isPrimitive from reflection/type.js.
 * Primitive types include: string, number, boolean, bigint, null, undefined, literal, symbol.
 *
 * @param type The type to check
 * @returns true if the type is a primitive type (including symbol)
 */
export function isUnionPrimitive(type: Type): boolean {
    return (
        type.kind === ReflectionKind.string ||
        type.kind === ReflectionKind.number ||
        type.kind === ReflectionKind.boolean ||
        type.kind === ReflectionKind.bigint ||
        type.kind === ReflectionKind.null ||
        type.kind === ReflectionKind.undefined ||
        type.kind === ReflectionKind.literal ||
        type.kind === ReflectionKind.symbol
    );
}

/**
 * Check if a type is object-like.
 * Object-like types include: objectLiteral, class, array, tuple.
 *
 * @param type The type to check
 * @returns true if the type is an object-like type
 */
export function isObjectLike(type: Type): boolean {
    return (
        type.kind === ReflectionKind.objectLiteral ||
        type.kind === ReflectionKind.class ||
        type.kind === ReflectionKind.array ||
        type.kind === ReflectionKind.tuple
    );
}
