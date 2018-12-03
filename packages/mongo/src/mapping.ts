import {Binary, ObjectID} from "mongodb";
import {
    classToPlain,
    ClassType,
    deleteExcludedPropertiesFor,
    getClassName,
    getClassPropertyName,
    getDecorator, getEnumKeys,
    getParentReferenceClass,
    getReflectionType,
    getRegisteredProperties,
    getValidEnumValue,
    isArray,
    isArrayType,
    isEnumAllowLabelsAsValue,
    isMapType,
    isObject,
    isUndefined,
    isValidEnumValue,
    plainToClass,
    toClass,
    ToClassState
} from "@marcj/marshal";
import * as clone from "clone";
import * as mongoUuid from "mongo-uuid";

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

export function uuid4Stringify(u: Binary | string): string {
    return 'string' === typeof u ? u : mongoUuid.stringify(u);
}

export function partialClassToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target?: { [path: string]: any },
): { [path: string]: any } {
    if (!target) return {};

    const result = {};
    for (const i in target) {
        if (!target.hasOwnProperty(i)) continue;

        if (target[i] as any instanceof RegExp) {
            continue;
        }

        result[i] = propertyClassToMongo(classType, i, target[i]);
    }

    return result;
}

export function partialMongoToPlain<T, K extends keyof T>(
    classType: ClassType<T>,
    target?: { [path: string]: any },
): { [path: string]: any } {
    if (!target) return {};

    const result = {};
    for (const i in target) {
        if (!target.hasOwnProperty(i)) continue;

        if (target[i] as any instanceof RegExp) {
            continue;
        }

        result[i] = propertyMongoToPlain(classType, i, target[i]);
    }

    return result;
}

export function propertyMongoToPlain<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any
) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

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

        if ('date' === type && value instanceof Date) {
            return value.toJSON();
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
    const {type, typeValue} = getReflectionType(classType, propertyName);

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
                throw new Error(`Invalid ObjectID given in property ${getClassPropertyName(classType, propertyName)}: '${value}'`);
            }
        }

        if (value && 'uuid' === type && 'string' === typeof value) {
            try {
                return uuid4Binary(value);
            } catch (e) {
                throw new Error(`Invalid UUID given in property ${getClassPropertyName(classType, propertyName)}: '${value}'`);
            }
        }

        if ('enum' === type) {
            //the class instance itself can only have the actual value which can be used in plain as well
            return value;
        }


        if ('binary' === type) {
            return new Binary(value);
        }

        if (type === 'class') {
            return classToMongo(typeValue, value);
        }

        return value;
    }

    if (isArrayType(classType, propertyName) && isArray(propertyValue)) {
        return propertyValue.map(v => convert(v));
    }

    if (isMapType(classType, propertyName) && isObject(propertyValue)) {
        const result: { [name: string]: any } = {};
        for (const i in propertyValue) {
            if (!propertyValue.hasOwnProperty(i)) continue;
            result[i] = convert((<any>propertyValue)[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyMongoToClass<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any,
    parents: any[],
    incomingLevel: number,
    state: ToClassState
) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

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

        if ('date' === type && !(value instanceof Date)) {
            return new Date(value);
        }

        if ('binary' === type && value instanceof Binary) {
            return value.buffer;
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
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(classType, propertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                throw new Error(`Invalid ENUM given in property ${propertyName}: ${value}, valid: ${getEnumKeys(typeValue).join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            if (value instanceof typeValue) {
                //already the target type, this is an error
                throw new Error(`${getClassPropertyName(classType, propertyName)} is already in target format. Are you calling plainToClass() with an class instance?`);
            }

            return toClass(typeValue, clone(value, false, 1), propertyMongoToClass, parents, incomingLevel, state);
        }

        return value;
    }

    if (isArrayType(classType, propertyName) && isArray(propertyValue)) {
        return propertyValue.map(v => convert(v));
    }

    if (isMapType(classType, propertyName) && isObject(propertyValue)) {
        const result: any = {};
        for (const i in propertyValue) {
            if (!propertyValue.hasOwnProperty(i)) continue;
            result[i] = convert((propertyValue as any)[i]);
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

export function plainToMongo<T>(classType: ClassType<T>, target: any): any {
    return classToMongo(classType, plainToClass(classType, target));
}

export function classToMongo<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    if (!(target instanceof classType)) {
        throw new Error(`Could not classToMongo since target is not a class instance of ${getClassName(classType)}`);
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToMongo(classType, decoratorName, (target as any)[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (undefined === (target as any)[propertyName]) {
            continue;
        }

        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        result[propertyName] = propertyClassToMongo(classType, propertyName, (target as any)[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return result;
}

