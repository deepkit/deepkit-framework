/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { type Builder, type Ref, arg, fn, isNumeric, toFastProperties } from '@deepkit/core';

import { extendTemplateLiteral } from './reflection/extends.js';
import { ReceiveType, resolveReceiveType } from './reflection/reflection.js';
import { ReflectionKind, Type, TypeTemplateLiteral, getTypeJitContainer } from './reflection/type.js';

export type Resolver = (path: string) => Type | undefined;

/**
 * JitStack for tracking recursive type resolution during path resolver building.
 */
class PathJitStack {
    private map = new Map<Type, { fn: Resolver | undefined }>();

    getOrCreate(type: Type, create: () => Resolver): Resolver {
        const existing = this.map.get(type);
        if (existing) {
            // Return a thunk that will call the eventually-created resolver
            return (path: string) => {
                if (!existing.fn) throw new Error('Circular reference not yet resolved');
                return existing.fn(path);
            };
        }

        // Reserve a slot before creating (handles recursion)
        const entry: { fn: Resolver | undefined } = { fn: undefined };
        this.map.set(type, entry);

        // Create the resolver
        entry.fn = create();
        return entry.fn;
    }
}

/**
 * Check if a key matches an index signature type.
 */
function checkIndexKey(key: string, indexType: Type): boolean {
    if (indexType.kind === ReflectionKind.number) {
        return isNumeric(key);
    } else if (indexType.kind === ReflectionKind.string || indexType.kind === ReflectionKind.any) {
        return typeof key === 'string';
    } else if (indexType.kind === ReflectionKind.symbol) {
        return typeof key === 'symbol';
    } else if (indexType.kind === ReflectionKind.templateLiteral) {
        return (
            typeof key === 'string' &&
            extendTemplateLiteral({ kind: ReflectionKind.literal, literal: key }, indexType as TypeTemplateLiteral)
        );
    } else if (indexType.kind === ReflectionKind.union) {
        return indexType.types.some(t => checkIndexKey(key, t));
    }
    return false;
}

/**
 * Recursively resolve a path segment within a type.
 * Returns a function that takes a path string and returns the resolved Type or undefined.
 */
function buildPathResolver(type: Type, jitStack: PathJitStack): (path: string) => Type | undefined {
    if (type.kind === ReflectionKind.array) {
        // For arrays, the element type is accessed
        const elementResolver = buildPathResolver(type.type, jitStack);
        const elementType = type.type;

        return fn(arg<string>(), (b: Builder, pathSlot: Ref<string>) => {
            // Parse the path
            const dotIndex = b.let(
                b.call<number>(String.prototype.indexOf.call.bind(String.prototype.indexOf), pathSlot, b.lit('.')),
            );
            const restPath = b.let(
                b.ternary(
                    b.eq(dotIndex, b.lit(-1)),
                    b.lit(''),
                    b.call<string>(
                        String.prototype.substring.call.bind(String.prototype.substring),
                        pathSlot,
                        b.call<number>((x: number) => x + 1, dotIndex),
                    ),
                ),
            );

            // If there's more path, recurse into element type
            b.if_(b.neq(restPath, b.lit('')), () => {
                return b.call<Type | undefined>(elementResolver, restPath);
            });

            // Otherwise return element type
            return b.lit(elementType);
        });
    } else if (type.kind === ReflectionKind.tupleMember) {
        // Tuple member - return type or continue into subtype
        const innerResolver = buildPathResolver(type.type, jitStack);
        const memberType = type;

        return fn(arg<string>(), (b: Builder, pathSlot: Ref<string>) => {
            b.if_(b.eq(pathSlot, b.lit('')), () => b.lit(memberType));
            return b.call<Type | undefined>(innerResolver, pathSlot);
        });
    } else if (type.kind === ReflectionKind.tuple) {
        // Tuple - switch on segment to get tuple member
        const tupleMembers = type.types;
        const memberResolvers = tupleMembers.map(m => buildPathResolver(m, jitStack));

        return fn(arg<string>(), (b: Builder, pathSlot: Ref<string>) => {
            // Parse the path
            const dotIndex = b.let(
                b.call<number>(String.prototype.indexOf.call.bind(String.prototype.indexOf), pathSlot, b.lit('.')),
            );
            const segment = b.let(
                b.ternary(
                    b.eq(dotIndex, b.lit(-1)),
                    pathSlot,
                    b.call<string>(
                        String.prototype.substring.call.bind(String.prototype.substring),
                        pathSlot,
                        b.lit(0),
                        dotIndex,
                    ),
                ),
            );
            const restPath = b.let(
                b.ternary(
                    b.eq(dotIndex, b.lit(-1)),
                    b.lit(''),
                    b.call<string>(
                        String.prototype.substring.call.bind(String.prototype.substring),
                        pathSlot,
                        b.call<number>((x: number) => x + 1, dotIndex),
                    ),
                ),
            );

            // Switch on segment
            const cases: [any, () => Ref<Type | undefined> | void][] = [];
            for (let i = 0; i < tupleMembers.length; i++) {
                const resolver = memberResolvers[i];
                cases.push([String(i), () => b.call<Type | undefined>(resolver, restPath)]);
            }

            b.switch_(segment, cases, () => b.lit(undefined));
        });
    } else if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
        // For class/objectLiteral, use JitStack to handle recursion and return cached resolver
        return jitStack.getOrCreate(type, () => pathResolver(type, jitStack));
    }

    // Default: return the type itself
    const thisType = type;
    return fn(arg<string>(), (b: Builder, _pathSlot: Ref<string>) => {
        return b.lit(thisType);
    });
}

export function resolvePath<T>(path: string, type?: ReceiveType<T>): Type {
    type = resolveReceiveType(type);
    const resolver = pathResolver(type);
    const t = resolver(path);
    if (!t) throw new Error(`No type found for path ${path} in ${type.typeName}`);
    return t;
}

export function pathResolver<T>(type?: ReceiveType<T>, jitStack: PathJitStack = new PathJitStack()): Resolver {
    type = resolveReceiveType(type);
    const jitContainer = getTypeJitContainer(type);
    if (jitContainer.pathResolver) return jitContainer.pathResolver;

    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        // Collect property members and index signatures
        const propertyMembers: Array<{
            name: string;
            type: Type;
            memberType: Type;
        }> = [];
        const indexSignatures: Array<{
            index: Type;
            type: Type;
        }> = [];

        for (const member of type.types) {
            if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
                if (typeof member.name === 'symbol') continue;
                propertyMembers.push({
                    name: member.name as string,
                    type: member.type,
                    memberType: member,
                });
            } else if (member.kind === ReflectionKind.indexSignature) {
                indexSignatures.push({
                    index: member.index,
                    type: member.type,
                });
            }
        }

        // Build resolvers for each property type
        const propertyResolvers = new Map<string, { resolver: (path: string) => Type | undefined; memberType: Type }>();
        for (const prop of propertyMembers) {
            propertyResolvers.set(prop.name, {
                resolver: buildPathResolver(prop.type, jitStack),
                memberType: prop.memberType,
            });
        }

        // Build resolvers for index signatures
        const indexResolvers = indexSignatures.map(sig => ({
            indexType: sig.index,
            resolver: buildPathResolver(sig.type, jitStack),
        }));

        const thisType = type;

        // Build the main resolver function
        const resolver = fn(arg<string>(), (b: Builder, pathSlot: Ref<string>) => {
            // Parse the path
            const dotIndex = b.let(
                b.call<number>(String.prototype.indexOf.call.bind(String.prototype.indexOf), pathSlot, b.lit('.')),
            );
            const pathName = b.let(
                b.ternary(
                    b.eq(dotIndex, b.lit(-1)),
                    pathSlot,
                    b.call<string>(
                        String.prototype.substring.call.bind(String.prototype.substring),
                        pathSlot,
                        b.lit(0),
                        dotIndex,
                    ),
                ),
            );
            const restPath = b.let(
                b.ternary(
                    b.eq(dotIndex, b.lit(-1)),
                    b.lit(''),
                    b.call<string>(
                        String.prototype.substring.call.bind(String.prototype.substring),
                        pathSlot,
                        b.call<number>((x: number) => x + 1, dotIndex),
                    ),
                ),
            );

            // If no pathName, return the type itself
            b.if_(b.not(pathName), () => b.lit(thisType));

            // Build switch cases for each property
            const cases: [any, () => Ref<Type | undefined> | void][] = [];
            for (const prop of propertyMembers) {
                const info = propertyResolvers.get(prop.name)!;
                cases.push([
                    prop.name,
                    () => {
                        b.if_(b.eq(restPath, b.lit('')), () => b.lit(info.memberType));
                        return b.call<Type | undefined>(info.resolver, restPath);
                    },
                ]);
            }

            // Default case: check index signatures
            const defaultCase = () => {
                if (indexResolvers.length === 0) {
                    return b.lit(undefined);
                }

                // Build condition chain for index signatures
                const conditions: [Ref<boolean>, () => Ref<Type | undefined>][] = [];
                for (const idx of indexResolvers) {
                    conditions.push([
                        b.call<boolean>(checkIndexKey, pathName, b.lit(idx.indexType)),
                        () => b.call<Type | undefined>(idx.resolver, restPath),
                    ]);
                }

                b.cond(conditions, () => b.lit(undefined));
            };

            b.switch_(pathName, cases, defaultCase);
        });

        jitContainer.pathResolver = resolver;
        toFastProperties(jitContainer);

        return jitContainer.pathResolver;
    }

    throw new Error(`pathResolver requires TypeClass or TypeObjectLiteral`);
}
