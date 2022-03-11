/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { deserialize, ReflectionClass, resolvePath, serialize, serializer } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import './mongo-serializer';
import { mongoSerializer } from './mongo-serializer';
import { convertQueryFilter, QueryCustomFields, QueryFieldNames } from '@deepkit/orm';
import { FilterQuery } from './query.model';

export function convertClassQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ReflectionClass<T> | ClassType,
    query: Q,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: { [name: string]: (name: string, value: any, fieldNamesMap: { [name: string]: boolean }) => any } = {},
): Q {
    const schema = ReflectionClass.from(classType);
    return convertQueryFilter(schema, query, (convertClassType: ReflectionClass<any>, path: string, value: any) => {
        const type = resolvePath(path, schema.type);
        return serialize(value, undefined, mongoSerializer, type);
    }, fieldNamesMap, customMapping);
}

export function convertPlainQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: FilterQuery<T>,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): { [path: string]: any } {
    return convertQueryFilter(classType, target, (convertClassType: ReflectionClass<any>, path: string, value: any) => {
        const type = resolvePath(path, convertClassType.type);
        const classValue = deserialize(value, undefined, serializer, type);
        return serialize(classValue, undefined, mongoSerializer, type);
    }, fieldNamesMap, customMapping);
}
