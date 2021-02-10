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
import { ClassSchema, Serializer } from '@deepkit/type';

export function getSqlFilter<T>(classSchema: ClassSchema<T>, filter: FilterQuery<T>, parameters: {[name: string]: any} = {}, serializer: Serializer): any {
    const scope = serializer.for(classSchema);

    return convertQueryFilter(classSchema.classType, (filter || {}), (convertClassType: ClassSchema, path: string, value: any) => {
        return scope.serializeProperty(path, value);
    }, {}, {
        $parameter: (name, value) => {
            if (undefined === parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return parameters[value];
        }
    });
}
