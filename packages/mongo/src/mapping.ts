/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ClassSchema, getClassSchema, JSONEntity, jsonSerializer, resolvePropertyCompilerSchema, TypedArrays,} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import './mongo-serializer';
import {Binary} from 'bson';
import {FilterQuery} from 'mongodb';
import {mongoSerializer} from './mongo-serializer';
import {convertQueryFilter, QueryCustomFields, QueryFieldNames} from '@deepkit/orm';

export type MongoTypeSingle<T> = T extends Date ? Date :
    T extends Array<infer K> ? Array<MongoTypeSingle<K>> :
        T extends ArrayBuffer ? Binary :
            T extends TypedArrays ? Binary :
                T extends object ? JSONEntity<T> :
                    T extends string ? T :
                        T extends boolean ? T :
                            T extends number ? T : T;

export type MongoType<T> = { [name in keyof T & string]: MongoTypeSingle<T[name]> };


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
        const property = resolvePropertyCompilerSchema(convertClassType, path);
        const classValue = jsonSerializer.deserializeProperty(property, value);
        return mongoSerializer.serializeProperty(property, classValue);
    }, fieldNamesMap, customMapping);
}
