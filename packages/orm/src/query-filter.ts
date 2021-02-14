/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, getClassSchema, isArray, PropertySchema } from '@deepkit/type';
import { ClassType, isPlainObject } from '@deepkit/core';
import { FilterQuery } from './query';

export type Converter = (convertClassType: ClassSchema, path: string, value: any) => any;
export type QueryFieldNames = { [name: string]: boolean };
export type QueryCustomFields = { [name: string]: (name: string, value: any, fieldNames: QueryFieldNames, converter: Converter) => any };

export function exportQueryFilterFieldNames(classSchema: ClassSchema<any>, filter: FilterQuery<any>): string[] {
    const filterFields: QueryFieldNames = {};
    convertQueryFilter(classSchema, filter, (c, p, v) => v, filterFields);
    return Object.keys(filterFields);
}

export function replaceQueryFilterParameter<T>(classSchema: ClassSchema<T>, filter: FilterQuery<T>, parameters: { [name: string]: any }): any {
    return convertQueryFilter(classSchema, filter, (convertClassType: ClassSchema, path: string, value: any) => {
        return value;
    }, {}, {
        $parameter: (name, value) => {
            if (!(value in parameters)) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return parameters[value];
        }
    });
}

function convertProperty(
    schema: ClassSchema,
    property: PropertySchema,
    fieldValue: any,
    name: string,
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
) {
    if (isPlainObject(fieldValue)) {
        fieldValue = { ...fieldValue };

        for (const key in fieldValue) {
            if (!fieldValue.hasOwnProperty(key)) continue;

            let value: any = (fieldValue as any)[key];

            if (key[0] !== '$') {
                fieldValue = converter(schema, name, fieldValue);
                break;
            } else {
                //we got a mongo query, e.g. `{$all: []}` as fieldValue
                if (customMapping[key]) {
                    const mappingResult = customMapping[key](name, value, fieldNamesMap, converter);
                    if (mappingResult) {
                        fieldValue = mappingResult;
                        break;
                    } else {
                        fieldValue = undefined;
                        break;
                    }
                } else if (key === '$not') {
                    fieldValue[key] = convertProperty(schema, property, value, name, converter, fieldNamesMap, customMapping);
                } else if (key === '$all') {
                    if (isArray(value[0])) {
                        //Nested Array
                        for (const nestedArray of value) {
                            for (let i = 0; i < nestedArray.length; i++) {
                                nestedArray[i] = converter(schema, name + '.' + i, nestedArray[i]);
                            }
                        }
                    } else if (isArray(value)) {
                        for (let i = 0; i < value.length; i++) {
                            value[i] = converter(schema, name + '.' + i, value[i]);
                        }
                    }
                } else if (key === '$in' || key === '$nin') {
                    fieldNamesMap[name] = true;
                    if (isArray(value)) {
                        (fieldValue as any)[key] = value.map(v => converter(schema, name, v));
                    } else {
                        (fieldValue as any)[key] = [];
                    }
                } else if (key === '$text' || key === '$exists' || key === '$mod' || key === '$size' || key === '$type'
                    || key === '$regex' || key === '$where' || key === '$elemMatch') {
                    fieldNamesMap[name] = true;
                } else {
                    fieldNamesMap[name] = true;
                    if (property.isArray && !isArray(value)) {
                        //implicit array conversion
                        (fieldValue as any)[key] = converter(schema, name + '.0', value);
                    } else {
                        (fieldValue as any)[key] = converter(schema, name, value);
                    }
                }
            }
        }
    } else {
        fieldNamesMap[name] = true;

        if (property.isArray && !isArray(fieldValue)) {
            //implicit array conversion
            return converter(schema, name + '.0', fieldValue);
        } else {
            return converter(schema, name, fieldValue);
        }
    }

    return fieldValue;
}

export function convertQueryFilter<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T> | ClassSchema<T>,
    filter: Q,
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): Q {
    const result: { [i: string]: any } = {};
    const schema = getClassSchema(classType);

    for (const key in filter) {
        if (!filter.hasOwnProperty(key)) continue;

        let fieldValue: any = filter[key];
        const property = schema.getPropertyOrUndefined(key);

        //when i is a reference, we rewrite it to the foreign key name
        let targetI = property && property.isReference ? property.getForeignKeyName() : key;

        if (key[0] === '$') {
            result[key] = (fieldValue as any[]).map(v => convertQueryFilter(classType, v, converter, fieldNamesMap, customMapping));
            continue;
        }

        if (property) {
            fieldValue = convertProperty(schema, property, filter[key], key, converter, fieldNamesMap, customMapping);
        }

        if (fieldValue !== undefined) {
            result[targetI] = fieldValue;
        }
    }

    return result as Q;
}
