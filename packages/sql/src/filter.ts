/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { convertQueryFilter, FilterQuery } from '@deepkit/orm';
import { ReflectionClass, resolvePath, serialize, Serializer } from '@deepkit/type';

export function getSqlFilter<T>(classSchema: ReflectionClass<any>, filter: FilterQuery<T>, parameters: { [name: string]: any } = {}, serializer: Serializer): any {
    return convertQueryFilter(classSchema.getClassType(), (filter || {}), (convertClass: ReflectionClass<any>, path: string, value: any) => {
        return serialize(value, undefined, serializer, resolvePath(path, classSchema.type));
    }, {}, {
        $parameter: (name, value) => {
            if (undefined === parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return parameters[value];
        }
    });
}
