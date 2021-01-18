/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, getClassSchema, JSONEntity, jsonSerializer, resolvePropertySchema, TypedArrays, } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import './mongo-serializer';
import { mongoSerializer } from './mongo-serializer';
import { convertQueryFilter, QueryCustomFields, QueryFieldNames } from '@deepkit/orm';
import { FilterQuery } from './query.model';


/**
 * Takes a mongo filter query and converts its class values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertClassQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T>,
    query: Q,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: { [name: string]: (name: string, value: any, fieldNamesMap: { [name: string]: boolean }) => any } = {},
): Q {
    const serializer = mongoSerializer.for(getClassSchema(classType));

    return convertQueryFilter(classType, query, (convertClassType: ClassSchema, path: string, value: any) => {
        return serializer.serializeProperty(path, value);
    }, fieldNamesMap, customMapping);
}

/**
 * Takes a mongo filter query and converts its plain values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertPlainQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: FilterQuery<T>,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): { [path: string]: any } {
    return convertQueryFilter(classType, target, (convertClassType: ClassSchema, path: string, value: any) => {
        const property = resolvePropertySchema(convertClassType, path);
        const classValue = jsonSerializer.deserializeProperty(property, value);
        return mongoSerializer.serializeProperty(property, classValue);
    }, fieldNamesMap, customMapping);
}
