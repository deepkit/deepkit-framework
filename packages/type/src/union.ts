/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { PropertySchema } from './model';
import { Types } from './types';

//sort by type group (literal, type, generic primitive, any)
const sorts: { [type in Types]: number } = {
    literal: 1,

    Uint16Array: 2,
    arrayBuffer: 2,
    Float32Array: 2,
    Float64Array: 2,
    Int8Array: 2,
    Int16Array: 2,
    Int32Array: 2,
    Uint8Array: 2,
    Uint8ClampedArray: 2,
    Uint32Array: 2,
    objectId: 2,
    uuid: 2,
    class: 2,
    date: 2,
    enum: 2,

    boolean: 3,
    string: 3,
    number: 3,
    bigint: 3,

    patch: 4,
    partial: 4,
    union: 4,
    map: 4,
    array: 4,
    any: 5,
};

export type UnionTypeGuard<T> = (p: PropertySchema) => T;

export type UnionGuardsTypes = Types;

export function getSortedUnionTypes<T>(property: PropertySchema, guards: Map<UnionGuardsTypes, UnionTypeGuard<T>>): { property: PropertySchema, guard: T }[] {
    const sorted = property.templateArgs.slice(0);

    sorted.sort((a, b) => {
        if (sorts[a.type] < sorts[b.type]) return -1;
        if (sorts[a.type] > sorts[b.type]) return +1;
        return 0;
    });

    const hasOnlyOneClassType = sorted.filter(v => v.type === 'class').length === 1
        && sorted.filter(v => v.type === 'map').length === 0
        && sorted.filter(v => v.type === 'patch').length === 0
        && sorted.filter(v => v.type === 'partial').length === 0;

    const result: { property: PropertySchema, guard: T }[] = [];
    for (const type of sorted) {
        let guardFactory = guards.get(type.type);

        if (type.type === 'class' && hasOnlyOneClassType) {
            //for simple union like string|MyClass we don't need a custom discriminator
            //we just use the 'map' guard
            guardFactory = guards.get('map');
        }

        if (!guardFactory) {
            throw new Error(`No type guard for ${type.type} found`);
        }

        result.push({
            property: type,
            guard: guardFactory(type),
        });
    }

    return result;
}
