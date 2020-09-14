import {ClassSchema, getClassSchema, isArray, JSONEntity, plainSerializer, PropertySchema, resolvePropertyCompilerSchema, TypedArrays,} from '@deepkit/marshal';
import {ClassType, isPlainObject} from '@deepkit/core';
import './mongo-serializer';
import {Binary} from 'bson';
import {FilterQuery} from 'mongodb';
import {mongoSerializer} from './mongo-serializer';

export type MongoTypeSingle<T> = T extends Date ? Date :
    T extends Array<infer K> ? Array<MongoTypeSingle<K>> :
        T extends ArrayBuffer ? Binary :
            T extends TypedArrays ? Binary :
                T extends object ? JSONEntity<T> :
                    T extends string ? T :
                        T extends boolean ? T :
                            T extends number ? T : T;

export type MongoType<T> = { [name in keyof T & string]: MongoTypeSingle<T[name]> };

export type Converter = (convertClassType: ClassSchema, path: string, value: any) => any;
export type QueryFieldNames = { [name: string]: boolean };
export type QueryCustomFields = { [name: string]: (name: string, value: any, fieldNames: QueryFieldNames, converter: Converter) => any };

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

    return convertQueryToMongo(classType, query, (convertClassType: ClassSchema, path: string, value: any) => {
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
    return convertQueryToMongo(classType, target, (convertClassType: ClassSchema, path: string, value: any) => {
        const property = resolvePropertyCompilerSchema(convertClassType, path);
        const classValue = plainSerializer.deserializeProperty(property, value);
        return mongoSerializer.serializeProperty(property, classValue);
    }, fieldNamesMap, customMapping);
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
        fieldValue = {...fieldValue};

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
                    (fieldValue as any)[key] = (value as any[]).map(v => converter(schema, name, v));
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

export function convertQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T> | ClassSchema<T>,
    target: Q,
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): Q {
    const result: { [i: string]: any } = {};
    const schema = getClassSchema(classType);

    for (const key in target) {
        if (!target.hasOwnProperty(key)) continue;

        let fieldValue: any = target[key];
        const property = schema.getPropertyOrUndefined(key);

        //when i is a reference, we rewrite it to the foreign key name
        let targetI = property && property.isReference ? property.getForeignKeyName() : key;

        if (key[0] === '$') {
            result[key] = (fieldValue as any[]).map(v => convertQueryToMongo(classType, v, converter, fieldNamesMap, customMapping));
            continue;
        }

        if (property) {
            fieldValue = convertProperty(schema, property, target[key], key, converter, fieldNamesMap, customMapping);
        }

        if (fieldValue !== undefined) {
            result[targetI] = fieldValue;
        }
    }

    return result as Q;
}
