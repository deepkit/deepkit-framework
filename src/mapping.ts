import {Binary, ObjectID} from "mongodb";
import * as clone from "clone";
import * as mongoUuid from "mongo-uuid";
import {
    classToPlain,
    deleteExcludedPropertiesFor,
    getClassSchema,
    getDecorator,
    getParentReferenceClass,
    getRegisteredProperties,
    getResolvedReflection,
    isEnumAllowLabelsAsValue,
    isOptional,
    isTypedArray,
    MarshalGlobal,
    moment,
    nodeBufferToArrayType,
    nodeBufferToTypedArray,
    toClass,
    ToClassState,
    typedArrayNamesMap,
    typedArrayToBuffer
} from "@marcj/marshal";
import {
    ClassType,
    each,
    eachKey,
    getClassName,
    getClassPropertyName,
    getEnumValues,
    getValidEnumValue,
    isArray,
    isObject,
    isPlainObject,
    isUndefined,
    isValidEnumValue
} from "@marcj/estdlib";

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

export function uuid4Stringify(u: Binary): string {
    return mongoUuid.stringify(u);
}

export function partialClassToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
): { [path: string]: any } {
    const result: { [path: string]: any } = {};
    for (const i of eachKey(target)) {
        result[i] = propertyClassToMongo(classType, i, target[i]);
    }

    return result;
}

export function partialPlainToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
): { [path: string]: any } {
    const result: { [path: string]: any } = {};
    for (const i of eachKey(target)) {
        result[i] = propertyPlainToMongo(classType, i, target[i]);
    }

    return result;
}

export function partialMongoToClass<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    parents: any[] = [],
): { [path: string]: any } {
    const result: { [path: string]: any } = {};
    for (const i of eachKey(target)) {
        result[i] = propertyMongoToClass(classType, i, target[i], parents);
    }

    return result;
}

export function partialMongoToPlain<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
): { [path: string]: any } {
    const result: { [path: string]: any } = {};

    for (const i of eachKey(target)) {
        result[i] = propertyMongoToPlain(classType, i, target[i]);
    }

    return result;
}

export function propertyMongoToPlain<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any
) {
    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) return propertyValue;

    const {type} = reflection;

    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }

    function convert(value: any) {
        if (value && 'uuid' === type && 'string' !== typeof value) {
            return uuid4Stringify(value);
        }

        if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
            return (<ObjectID>value).toHexString();
        }

        //Date automatically is converted since it has toJSON() method.
        if (value && 'function' === typeof value.toJSON) {
            return value.toJSON();
        }

        if (isTypedArray(type) && value instanceof Binary) {
            return value.buffer.toString('base64');
        }

        if (type === 'arrayBuffer' && value instanceof Binary) {
            return value.buffer.toString('base64');
        }

        return value;
    }

    return convert(propertyValue);
}

export function propertyClassToMongo<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any
) {
    const reflection = getResolvedReflection(classType, propertyName);

    if (!reflection) return propertyValue;

    const {resolvedClassType, resolvedPropertyName, type, typeValue, array, map} = reflection;

    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }

    if (getParentReferenceClass(resolvedClassType, resolvedPropertyName)) {
        return undefined;
    }

    function convert(value: any) {
        if (value && 'objectId' === type && 'string' === typeof value) {
            try {
                return new ObjectID(value);
            } catch (e) {
                throw new Error(`Invalid ObjectID given in property ${getClassPropertyName(resolvedClassType, resolvedPropertyName)}: '${value}'`);
            }
        }

        if (value && 'uuid' === type && 'string' === typeof value) {
            try {
                return uuid4Binary(value);
            } catch (e) {
                throw new Error(`Invalid UUID given in property ${getClassPropertyName(resolvedClassType, resolvedPropertyName)}: '${value}'`);
            }
        }

        if ('moment' === type) {
            return value.toDate();
        }

        if ('string' === type) {
            return String(value);
        }

        if ('number' === type) {
            return Number(value);
        }

        if ('enum' === type) {
            //the class instance itself can only have the actual value which can be used in plain as well
            return value;
        }

        if (type === 'class') {
            return classToMongo(typeValue, value);
        }

        if (isTypedArray(type) && value) {
            return new Binary(typedArrayToBuffer(value));
        }

        if (type === 'arrayBuffer' && value) {
            return new Binary(Buffer.from(value));
        }

        return value;
    }

    if (array) {
        if (isArray(propertyValue)) {
            return propertyValue.map(v => convert(v));
        }
        return [];
    }

    if (map) {
        const result: { [name: string]: any } = {};
        if (isObject(propertyValue)) {
            for (const i of eachKey(propertyValue)) {
                result[i] = convert((<any>propertyValue)[i]);
            }
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyPlainToMongo<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any
) {
    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) return propertyValue;

    const {resolvedClassType, resolvedPropertyName, type, typeValue, array, map, partial} = reflection;

    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }

    function convert(value: any) {
        if (value && 'objectId' === type && 'string' === typeof value) {
            try {
                return new ObjectID(value);
            } catch (e) {
                throw new Error(`Invalid ObjectID given in property ${getClassPropertyName(resolvedClassType, resolvedPropertyName)}: '${value}'`);
            }
        }

        if (value && 'uuid' === type && 'string' === typeof value) {
            try {
                return uuid4Binary(value);
            } catch (e) {
                throw new Error(`Invalid UUID given in property ${getClassPropertyName(resolvedClassType, resolvedPropertyName)}: '${value}'`);
            }
        }
        if ('date' === type && ('string' === typeof value || 'number' === typeof value)) {
            return new Date(value);
        }

        if ('string' === type && 'string' !== typeof value) {
            return String(value);
        }

        if ('number' === type && 'number' !== typeof value) {
            return +value;
        }

        if ('boolean' === type && 'boolean' !== typeof value) {
            if ('true' === value || '1' === value || 1 === value) return true;
            if ('false' === value || '0' === value || 0 === value) return false;

            return true === value;
        }

        if ('any' === type) {
            return clone(value, false);
        }

        if (type === 'class') {
            //we need to check if value has all properties set, if one not-optional is missing, we throw an error
            for (const property of getRegisteredProperties(typeValue)) {
                if (value[property] === undefined) {
                    if (isOptional(typeValue, property)) {
                        continue;
                    }
                    throw new Error(`Missing value in ${getClassPropertyName(resolvedClassType, propertyName)} for ` +
                        `${getClassPropertyName(typeValue, property)}. Can not convert to mongo.`);
                }

                value[property] = propertyPlainToMongo(typeValue, property, value[property]);
            }
        }

        if (isTypedArray(type) && 'string' === typeof value) {
            return new Binary(Buffer.from(value, 'base64'));
        }


        if (type === 'arrayBuffer' && value) {
            return new Binary(Buffer.from(value, 'base64'));
        }

        return value;
    }

    if (array) {
        if (isArray(propertyValue)) {
            return propertyValue.map(v => convert(v));
        }
        return [];
    }

    if (partial) {
        return propertyValue ? partialPlainToMongo(typeValue, propertyValue) : propertyValue;
    }

    if (map) {
        const result: { [name: string]: any } = {};
        if (isObject(propertyValue)) {
            for (const i of eachKey(propertyValue)) {
                result[i] = convert((<any>propertyValue)[i]);
            }
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyMongoToClass<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any,
    parents: any[] = [],
    incomingLevel: number = 1,
    state: ToClassState = {onFullLoadCallbacks: []}
): any {
    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }

    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) return propertyValue;

    const {resolvedClassType, resolvedPropertyName, type, typeValue, array, map, partial} = reflection;

    function convert(value: any) {
        if (value && 'uuid' === type && 'string' !== typeof value) {
            return uuid4Stringify(value);
        }

        if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
            return (<ObjectID>value).toHexString();
        }

        if ('date' === type && !(value instanceof Date)) {
            return new Date(value);
        }

        if ('moment' === type) {
            return moment(value);
        }

        if ('any' === type) {
            return clone(value, false);
        }

        if ('string' === type && 'string' !== typeof value) {
            return String(value);
        }

        if ('number' === type && 'number' !== typeof value) {
            return +value;
        }

        if ('boolean' === type && 'boolean' !== typeof value) {
            if ('true' === value || '1' === value || 1 === value) return true;
            if ('false' === value || '0' === value || 0 === value) return false;

            return true === value;
        }

        if ('enum' === type) {
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(resolvedClassType, resolvedPropertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                throw new Error(`Invalid ENUM given in property ${resolvedPropertyName}: ${value}, valid: ${getEnumValues(typeValue).join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            if (value instanceof typeValue) {
                return value;
            }

            return toClass(typeValue, clone(value, false, 1), propertyMongoToClass, parents, incomingLevel, state);
        }

        if (value && isTypedArray(type) && value instanceof Binary) {
            //value.buffer might be a pooled buffer
            return nodeBufferToTypedArray(value.buffer, typedArrayNamesMap.get(type));
        }

        if (type === 'arrayBuffer' && value instanceof Binary) {
            //value.buffer might be a pooled buffer
            return nodeBufferToArrayType(value.buffer);
        }

        return value;
    }

    if (array) {
        if (isArray(propertyValue)) {
            return propertyValue.map(v => convert(v));
        }
        return [];
    }

    if (partial) {
        return propertyValue ? partialMongoToClass(typeValue, propertyValue) : propertyValue;
    }

    if (map) {
        const result: any = {};
        if (isObject(propertyValue)) {
            for (const i of eachKey(propertyValue)) {
                result[i] = convert((propertyValue as any)[i]);
            }
        }
        return result;
    }

    return convert(propertyValue);
}

export function mongoToClass<T>(classType: ClassType<T>, target: any, parents?: any[]): T {
    const state = new ToClassState();
    const item = toClass(classType, clone(target, false, 1), propertyMongoToClass, parents || [], 1, state);

    for (const callback of state.onFullLoadCallbacks) {
        callback();
    }

    return item;
}

export function mongoToPlain<T>(classType: ClassType<T>, target: any) {
    return classToPlain(classType, mongoToClass(classType, target));
}

export function plainToMongo<T>(classType: ClassType<T>, target: { [k: string]: any }): any {
    const result: any = {};

    if (target instanceof classType) {
        throw new Error(`Could not plainToMongo since target is a class instance of ${getClassName(classType)}`);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        result[propertyName] = propertyPlainToMongo(classType, propertyName, (target as any)[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return result;
}

export function classToMongo<T>(classType: ClassType<T>, target: T, omitUndefined: boolean = false): any {
    const result: any = {};

    if (!(target instanceof classType)) {
        throw new Error(`Could not classToMongo since target is not a class instance of ${getClassName(classType)}, got ${getClassName(target)}`);
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToMongo(classType, decoratorName, (target as any)[decoratorName]);
    }

    MarshalGlobal.unpopulatedCheckActive = false;
    for (const property of each(getClassSchema(classType).getClassProperties())) {
        if (property.isParentReference) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }
        if (property.backReference || property.isReferenceKey) continue;

        let value: any = (target as any)[property.name];
        let resultName = property.name;

        if (property.isReference) {
            //references are handled separately.
            if (value) {
                value = value[property.getResolvedClassSchema().getPrimaryField().name];
                resultName = property.getForeignKeyName();
            } else {
                //we reset the foreign key
                resultName = property.getForeignKeyName();
            }
        }

        value = propertyClassToMongo(classType, resultName, value);

        //since mongo driver doesn't support undefined value, we need to make sure the property doesn't exist at all
        //when used undefined. This results in not having the property in the database at all, which is equivalent to
        //undefined.
        if (omitUndefined && value === undefined) {
            continue;
        }

        result[resultName] = value;
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    MarshalGlobal.unpopulatedCheckActive = true;

    return result;
}

export type Converter = (convertClassType: ClassType<any>, path: string, value: any) => any;
export type QueryFieldNames = { [name: string]: boolean };
export type QueryCustomFields = { [name: string]: (name: string, value: any, fieldNames: QueryFieldNames, converter: Converter) => any };

/**
 * Takes a mongo filter query and converts its class values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertClassQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    fieldNamesMap: QueryFieldNames = {},
    customMapping: { [name: string]: (name: string, value: any, fieldNamesMap: { [name: string]: boolean }) => any } = {},
): { [path: string]: any } {
    return convertQueryToMongo(classType, target, (convertClassType: ClassType<any>, path: string, value: any) => {
        return propertyClassToMongo(convertClassType, path, value);
    }, fieldNamesMap, customMapping);
}

/**
 * Takes a mongo filter query and converts its plain values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertPlainQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): { [path: string]: any } {
    return convertQueryToMongo(classType, target, (convertClassType: ClassType<any>, path: string, value: any) => {
        return propertyPlainToMongo(convertClassType, path, value);
    }, fieldNamesMap, customMapping);
}

export function convertQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): { [path: string]: any } {
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
                    if (property && property.isReference) {
                        fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
                    }
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
                        if (property && property.isReference) {
                            const pk = property.getResolvedClassSchema().getPrimaryField().name;
                            queryValue = queryValue.map(v => v[pk]);
                        }
                        (fieldValue as any)[j] = (queryValue as any[]).map(v => converter(classType, targetI, v));
                    } else if (j === '$text' || j === '$exists' || j === '$mod' || j === '$size' || j === '$type' || j === '$regex' || j === '$where') {
                        if (property && property.isReference) {
                            targetI = i;
                        } else {
                            //don't transform
                            fieldNamesMap[targetI] = true;
                        }
                    } else {
                        fieldNamesMap[targetI] = true;
                        if (property && property.isReference) {
                            queryValue = queryValue[property.getResolvedClassSchema().getPrimaryField().name];
                        }
                        (fieldValue as any)[j] = converter(classType, targetI, queryValue);
                    }
                }
            }
        } else {
            fieldNamesMap[targetI] = true;

            if (property && property.isReference) {
                fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
            }

            fieldValue = converter(classType, targetI, fieldValue);
        }

        if (fieldValue !== undefined) {
            result[targetI] = fieldValue;
        }
    }

    return result;
}
