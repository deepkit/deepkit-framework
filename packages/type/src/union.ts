/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

//sort by type group (literal, type, generic primitive, any)
import {PropertyCompilerSchema} from './model';
import {Types} from './types';
import {JSONTypeGuard, jsonTypeGuards} from './json-typeguards';

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
    moment: 2,

    boolean: 3,
    string: 3,
    number: 3,

    patch: 4,
    partial: 4,
    union: 4,
    map: 4,
    array: 4,
    any: 5,
};

export function getSortedUnionTypes(property: PropertyCompilerSchema): {property: PropertyCompilerSchema, guard: JSONTypeGuard}[] {
    const sorted = property.templateArgs.slice(0);

    sorted.sort((a, b) => {
        if (sorts[a.type] < sorts[b.type]) return -1;
        if (sorts[a.type] > sorts[b.type]) return +1;
        return 0;
    });

    const result: {property: PropertyCompilerSchema, guard: JSONTypeGuard}[] = [];
    for (const type of sorted) {
        const guardFactory = jsonTypeGuards.get(type.type);
        if (!guardFactory) {
            throw new Error(`No type guard for ${type.type} found`);
        }

        result.push({
            property: type,
            guard: guardFactory(type),
        })
    }

    return result;
}
