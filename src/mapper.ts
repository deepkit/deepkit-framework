import 'reflect-metadata';
import {
    ClassType,
    isArray,
    isObject,
    uuid4Binary,
    uuid4Stringify,
    isUndefined,
    getEnumKeys,
    isValidEnumValue, getValidEnumValue
} from './utils';
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import {ObjectID} from "bson";

export type Types = 'objectId' | 'uuid' | 'class' | 'date' | 'string' | 'boolean' | 'number' | 'enum' | 'any';

export function getReflectionType<T>(classType: ClassType<T>, propertyName: string): { type: Types | null, typeValue: any | null } {
    const type = Reflect.getMetadata('marshaller:dataType', classType.prototype, propertyName) || null;
    const value = Reflect.getMetadata('marshaller:dataTypeValue', classType.prototype, propertyName) || null;

    return {
        type: type,
        typeValue: value
    }
}

export function propertyClassToMongo<T>(classType: ClassType<T>, propertyName: string, propertyValue) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    function convert(value) {
        if (value && 'objectId' === type && 'string' === typeof value) {
            try {
                return new ObjectID(value);
            } catch (e) {
                throw new Error(`Invalid ObjectID given in property ${propertyName}: '${value}'`);
            }
        }

        if (value && 'uuid' === type && 'string' === typeof value) {
            try {
                return uuid4Binary(value);
            } catch (e) {
                throw new Error(`Invalid UUID given in property ${propertyName}: '${value}'`);
            }
        }

        if ('enum' === type) {
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(classType, propertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                throw new Error(`Invalid ENUM given in property ${propertyName}: ${value}, valid: ${getEnumKeys(typeValue).join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
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
        const result = {};
        for (const i in propertyValue) {
            result[i] = convert(propertyValue[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyPlainToClass<T>(classType: ClassType<T>, propertyName, propertyValue) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    if (isUndefined(propertyValue)) {
        //todo, check if optional
        return undefined;
    }

    function convert(value) {
        if ('date' === type && !(value instanceof Date)) {
            return new Date(value);
        }

        if ('string' === type && 'string' !== typeof value) {
            return String(value);
        }

        if ('number' === type && 'number' !== typeof value) {
            return +value;
        }

        if ('boolean' === type && 'boolean' !== typeof value) {
            return !!value;
        }

        if ('enum' === type) {
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(classType, propertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                throw new Error(`Invalid ENUM given in property ${propertyName}: ${value}, valid: ${getEnumKeys(typeValue).join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            return plainToClass(typeValue, value);
        }

        return value;
    }

    if (isArrayType(classType, propertyName) && isArray(propertyValue)) {
        return propertyValue.map(v => convert(v));
    }

    if (isMapType(classType, propertyName) && isObject(propertyValue)) {
        const result = {};
        for (const i in propertyValue) {
            result[i] = convert(propertyValue[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyClassToPlain<T>(classType: ClassType<T>, propertyName, propertyValue) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    function convert(value) {
        if ('date' === type && value instanceof Date) {
            return value.toJSON();
        }

        if (type === 'enum') {
            return typeValue[value];
        }

        if (type === 'class') {
            return classToPlain(typeValue, clone(value, false));
        }

        return value;
    }

    if (isArrayType(classType, propertyName) && isArray(propertyValue)) {
        return propertyValue.map(v => convert(v));
    }

    if (isMapType(classType, propertyName) && isObject(propertyValue)) {
        const result = {};
        for (const i in propertyValue) {
            result[i] = convert(propertyValue[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyMongoToClass<T>(classType: ClassType<T>, propertyValue, propertyName) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    function convert(value) {
        if (value && 'uuid' === type && 'string' !== typeof value) {
            return uuid4Stringify(value);
        }

        if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
            return (<ObjectID>value).toHexString();
        }

        if (type === 'class') {
            return mongoToClass(typeValue, clone(value, false));
        }

        return value;
    }

    if (isArrayType(classType, propertyName) && isArray(propertyValue)) {
        return propertyValue.map(v => convert(v));
    }

    if (isMapType(classType, propertyName) && isObject(propertyValue)) {
        const result = {};
        for (const i in propertyValue) {
            result[i] = convert(propertyValue[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function cloneClass<T>(target: T): T {
    return plainToClass(target.constructor as ClassType<T>, classToPlain(target.constructor as ClassType<T>, target));
}

export function mongoToPlain<T>(classType: ClassType<T>, target) {
    return classToPlain(classType, mongoToClass(classType, target));
}

export function classToPlain<T>(classType: ClassType<T>, target: T): any {
    const result = {};

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToPlain(classType, decoratorName, target[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        result[propertyName] = propertyClassToPlain(classType, propertyName, target[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'plain');
    return result;
}

export function plainToMongo<T>(classType: ClassType<T>, target): any {
    return classToMongo(classType, plainToClass(classType, target));
}

export function classToMongo<T>(classType: ClassType<T>, target: T): any {
    const result = {};

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToMongo(classType, decoratorName, target[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        result[propertyName] = propertyClassToMongo(classType, propertyName, target[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return result;
}

export function partialFilterObjectToMongo<T>(classType: ClassType<T>, target: object = {}): {} {
    const cloned = clone(target, false);

    for (const propertyName of getRegisteredProperties(classType)) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        if (target[propertyName] instanceof RegExp) {
            continue;
        }

        cloned[propertyName] = propertyClassToMongo(classType, propertyName, target[propertyName]);
    }

    return toObject(cloned);
}

export function mongoToClass<T>(classType: ClassType<T>, target: any): T {
    const cloned = clone(target, false);

    if ('_id' !== getIdField(classType)) {
        delete cloned['_id'];
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return new classType(propertyMongoToClass(classType, target, decoratorName));
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        cloned[propertyName] = propertyMongoToClass(classType, cloned[propertyName], propertyName);
    }

    const parameterNames = getParameterNames(classType.prototype.constructor);
    const args = [];

    for (const name of parameterNames) {
        args.push(cloned[name]);
    }

    const item = new class extends (classType as ClassType<{}>) {
        constructor() {
            super(...args);

            for (const i in cloned) {
                if (!cloned.hasOwnProperty(i)) continue;
                this[i] = cloned[i];
            }
        }
    } as T;

    return item;
}

export function plainToClass<T>(classType: ClassType<T>, target: object): T {
    const cloned = clone(target, false);

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return new classType(propertyPlainToClass(classType, decoratorName, cloned));
    }

    const propertyNames = getRegisteredProperties(classType);
    for (const propertyName of propertyNames) {
        cloned[propertyName] = propertyPlainToClass(classType, propertyName, cloned[propertyName]);
    }

    const parameterNames = getParameterNames(classType.prototype.constructor);
    const args = [];

    for (const name of parameterNames) {
        args.push(cloned[name]);
    }

    const item =  new class extends (classType as ClassType<{}>) {
        constructor() {
            super(...args);

            for (const i in cloned) {
                if (undefined === cloned[i]) {
                    continue;
                }

                this[i] = cloned[i];
            }
        }
    } as T;

    return item;
}

export function toObject<T>(item: T): object {
    const result: any = {};

    for (const i in item) {
        result[i] = item[i];
    }

    return result;
}

export function deleteExcludedPropertiesFor<T>(classType: ClassType<T>, item, target: 'mongo' | 'plain') {
    for (const propertyName in item) {
        if (isExcluded(classType, propertyName, target)) {
            delete item[propertyName];
        }
    }
}

export function getIdField<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshaller:idField', classType.prototype) || null;
}

export function getIdFieldValue<T>(classType: ClassType<T>, target): any {
    return target[getIdField(classType)];
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = Reflect.getMetadata('marshaller:entityName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

export function getDecorator<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshaller:dataDecorator', classType.prototype) || null;
}

export function getRegisteredProperties<T>(classType: ClassType<T>): string[] {
    return Reflect.getMetadata('marshaller:properties', classType.prototype) || [];
}

export function isArrayType<T>(classType: ClassType<T>, property): boolean {
    return Reflect.getMetadata('marshaller:isArray', classType.prototype, property) || false;
}

export function isMapType<T>(classType: ClassType<T>, property): boolean {
    return Reflect.getMetadata('marshaller:isMap', classType.prototype, property) || false;
}

export function isEnumAllowLabelsAsValue<T>(classType: ClassType<T>, property): boolean {
    return Reflect.getMetadata('marshaller:enum:allowLabelsAsValue', classType.prototype, property) || false;
}

export function isExcluded<T>(classType: ClassType<T>, property, wantedTarget: 'mongo' | 'plain'): boolean {
    const mode = Reflect.getMetadata('marshaller:exclude', classType.prototype, property);

    if ('all' === mode) {
        return true;
    }

    if (mode === wantedTarget) {
        return true;
    }

    return false;
}

export function getDatabaseName<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshaller:databaseName', classType) || null;
}

export function getCollectionName<T>(classType: ClassType<T>): string {
    const name = Reflect.getMetadata('marshaller:collectionName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}
