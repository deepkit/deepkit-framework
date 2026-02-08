/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { resolveRuntimeType } from './reflection/processor.js';
import { ReceiveType, resolveReceiveType } from './reflection/reflection.js';
import { ReflectionKind, Type } from './reflection/type.js';
import { NoTypeReceived } from './utils.js';

/**
 * Returns the runtime Type object for a given TypeScript type.
 *
 * ```typescript
 * const type = typeOf<string>(); // {kind: ReflectionKind.string}
 * const type = typeOf<User>();   // {kind: ReflectionKind.class, classType: User, ...}
 * ```
 */
export function typeOf<T>(args: any[] = [], p?: ReceiveType<T>): Type {
    if (p) {
        return args.length > 0 ? resolveRuntimeType(p, args) : (resolveReceiveType(p) as Type);
    }

    throw new NoTypeReceived('typeOf<T>() called without type parameter');
}

/**
 * Returns the values/types of a given type's members.
 *
 * For unions, returns the literal values or types.
 * For object literals and classes, returns the property types.
 */
export function valuesOf<T>(args: any[] = [], p?: ReceiveType<T>): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.union) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.literal) return v.literal;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.method) return v;
            if (v.kind === ReflectionKind.property) return v.type;
            if (v.kind === ReflectionKind.propertySignature) return v.type;
            if (v.kind === ReflectionKind.methodSignature) return v;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

/**
 * Returns the property names of a given type's members.
 *
 * For object literals and classes, returns property/method names.
 */
export function propertiesOf<T>(args: any[] = [], p?: ReceiveType<T>): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.method) return v.name;
            if (v.kind === ReflectionKind.property) return v.name;
            if (v.kind === ReflectionKind.propertySignature) return v.name;
            if (v.kind === ReflectionKind.methodSignature) return v.name;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

/**
 * Returns the nominal ID of a class or object literal type, if defined.
 */
export function getNominalId<T>(args: any[] = [], p?: ReceiveType<T>): number | undefined {
    const t = typeOf(args, p);
    if (t.kind === ReflectionKind.class || t.kind === ReflectionKind.objectLiteral) return t.id;
    return;
}
