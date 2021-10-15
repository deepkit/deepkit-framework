/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Packed, unpack } from './compiler';
import { Processor, resolveRuntimeType } from './processor';
import { ReflectionKind, Type } from './type';

export function reflect(o: any, ...args: any[]): Type {
    return resolveRuntimeType(o, args);
}

export function valuesOf<T>(args: any[] = [], p?: Packed): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.union) {
        return type.members.map(v => {
            if (v.kind === ReflectionKind.literal) return v.literal;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.members.map(v => {
            if (v.kind === ReflectionKind.method) return v;
            if (v.kind === ReflectionKind.property) return v.type;
            if (v.kind === ReflectionKind.propertySignature) return v.type;
            if (v.kind === ReflectionKind.methodSignature) return v;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

export function propertiesOf<T>(args: any[] = [], p?: Packed): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.members.map(v => {
            if (v.kind === ReflectionKind.method) return v.name;
            if (v.kind === ReflectionKind.property) return v.name;
            if (v.kind === ReflectionKind.propertySignature) return v.name;
            if (v.kind === ReflectionKind.methodSignature) return v.name;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

export function typeOf<T>(args: any[] = [], p?: Packed): Type {
    if (p) {
        const pack = unpack(p);
        const processor = new Processor();
        // debugPackStruct(pack);
        const type = processor.run(pack.ops, pack.stack, args);
        return type;
    }

    throw new Error('No type given');
}
