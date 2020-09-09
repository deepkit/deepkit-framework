import {getClassSchema, JSONEntity, plainSerializer, resolvePropertyCompilerSchema, TypedArrays,} from '@super-hornet/marshal';
import {ClassType, eachKey, isPlainObject} from '@super-hornet/core';
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

export type Converter = (convertClassType: ClassType, path: string, value: any) => any;
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

    return convertQueryToMongo(classType, query, (convertClassType: ClassType<any>, path: string, value: any) => {
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
    return convertQueryToMongo(classType, target, (convertClassType: ClassType<any>, path: string, value: any) => {
        const property = resolvePropertyCompilerSchema(getClassSchema(convertClassType), path);
        const classValue = plainSerializer.deserializeProperty(property, value);
        return mongoSerializer.serializeProperty(property, classValue);
    }, fieldNamesMap, customMapping);
}

export function convertQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T>,
    target: Q,
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): Q {
    const result: { [i: string]: any } = {};
    const schema = getClassSchema(classType);

    for (const i of eachKey(target)) {
        let fieldValue: any = target[i];
        const property = schema.getPropertyOrUndefined(i);

        //when i is a reference, we rewrite it to the foreign key name
        let targetI = property && property.isReference ? property.getForeignKeyName() : i;

        if (i[0] === '$') {
            result[i] = (fieldValue as any[]).map(v => convertQueryToMongo(classType, v, converter, fieldNamesMap, customMapping));
            continue;
        }

        if (isPlainObject(fieldValue)) {
            fieldValue = {...target[i]};

            for (const j of eachKey(fieldValue)) {
                let queryValue: any = (fieldValue as any)[j];

                if (j[0] !== '$') {
                    //its a regular classType object
                    // if (property && property.isReference) {
                    //     fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
                    // }
                    fieldValue = converter(classType, targetI, fieldValue);
                    break;
                } else {
                    //we got a mongo query, e.g. `{$all: []}` as fieldValue
                    if (customMapping[j]) {
                        const mappingResult = customMapping[j](i, queryValue, fieldNamesMap, converter);
                        if (mappingResult) {
                            fieldValue = mappingResult;
                            break;
                        } else {
                            fieldValue = undefined;
                            break;
                        }
                    } else if (j === '$in' || j === '$nin' || j === '$all') {
                        fieldNamesMap[targetI] = true;
                        // if (property && property.isReference) {
                        //     const pk = property.getResolvedClassSchema().getPrimaryField().name;
                        //     queryValue = queryValue.map(v => v[pk]);
                        // }
                        (fieldValue as any)[j] = (queryValue as any[]).map(v => converter(classType, targetI, v));
                    } else if (j === '$text' || j === '$exists' || j === '$mod' || j === '$size' || j === '$type' || j === '$regex' || j === '$where') {
                        // if (property && property.isReference) {
                        //     targetI = i;
                        // } else {
                        //don't transform
                        fieldNamesMap[targetI] = true;
                        // }
                    } else {
                        fieldNamesMap[targetI] = true;
                        // if (property && property.isReference) {
                        //     queryValue = queryValue[property.getResolvedClassSchema().getPrimaryField().name];
                        // }
                        (fieldValue as any)[j] = converter(classType, targetI, queryValue);
                    }
                }
            }
        } else {
            fieldNamesMap[targetI] = true;

            // if (property && property.isReference) {
            //     fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
            // }

            fieldValue = converter(classType, targetI, fieldValue);
        }

        if (fieldValue !== undefined) {
            result[targetI] = fieldValue;
        }
    }

    return result as Q;
}
