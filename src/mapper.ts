import 'reflect-metadata';
import {ClassType, isArray, isObject, uuid4Binary, uuid4Stringify, eachPair, isUndefined} from './utils';
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import {isBuffer, isDate} from 'util';
import {ObjectID} from "bson";

export type Types = 'objectId' | 'uuid' | 'class' | 'classArray' | 'classMap' | 'date' | 'string' | 'number' | 'enum' | 'any';

export function Class<T>(classType: ClassType<T>) {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataType', 'class', target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

export function ClassMap<T>(classType: ClassType<T>) {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataType', 'classMap', target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

export function ClassArray<T>(classType: ClassType<T>) {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataType', 'classArray', target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

function isPlainObject(value) {
    return isObject(value) && !isDate(value) && !isBuffer(value) && !isArray(value);
}

export function getReflectionType<T>(classType: ClassType<T>, propertyName: string): { type: Types, typeValue: any } {
    const type = Reflect.getMetadata('marshaller:dataType', classType.prototype, propertyName);
    const value = Reflect.getMetadata('marshaller:dataTypeValue', classType.prototype, propertyName);

    return {
        type: type,
        typeValue: value
    }
}

export function propertyPlainToMongo<T>(classType: ClassType<T>, propertyName, propertyValue) {
    const {type, typeValue} = getReflectionType(classType, propertyName);
    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if ('objectId' === type && 'string' === typeof propertyValue) {
        try {
            return new ObjectID(propertyValue);
        } catch (e) {
            throw new Error(`Invalid ObjectID given in property ${propertyName}: '${propertyValue}'`);
        }
    }

    if ('uuid' === type && 'string' === typeof propertyValue) {
        try {
            return uuid4Binary(propertyValue);
        } catch (e) {
            throw new Error(`Invalid UUID given in property ${propertyName}: '${propertyValue}'`);
        }
    }

    if ('date' === type && !(propertyValue instanceof Date)) {
        return new Date(propertyValue);
    }

    if ('string' === type && 'string' !== typeof propertyValue) {
        return String(propertyValue);
    }

    if ('number' === type && 'number' !== typeof propertyValue) {
        return +propertyValue;
    }

    if (type === 'classArray' && isArray(propertyValue)) {
        return propertyValue.map(v => plainToMongo(typeValue, v));
    }

    if (type === 'classMap' && isObject(propertyValue)) {
        for (const [k, v] of eachPair(propertyValue as { [k: string]: any })) {
            propertyValue[k] = plainToMongo(typeValue, v);
        }
    }

    if (type === 'class' && isObject(propertyValue)) {
        return plainToMongo(typeValue, propertyValue);
    }

    return propertyValue;
}

export function propertyClassToMongo<T>(classType: ClassType<T>, propertyName: string, propertyValue) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    if (propertyValue && 'objectId' === type && 'string' === typeof propertyValue) {
        try {
            return new ObjectID(propertyValue);
        } catch (e) {
            throw new Error(`Invalid ObjectID given in property ${propertyName}: '${propertyValue}'`);
        }
    }
    
    if (propertyValue && 'uuid' === type && 'string' === typeof propertyValue) {
        try {
            return uuid4Binary(propertyValue);
        } catch (e) {
            throw new Error(`Invalid UUID given in property ${propertyName}: '${propertyValue}'`);
        }
    }

    if (type === 'classArray' && isArray(propertyValue)) {
        return propertyValue.map(v => classToMongo(typeValue, v));
    }

    if ('enum' === type) {
        if (undefined === typeValue) {
            throw new Error(`Enum ${propertyName} has no type defined`);
        }

        return typeValue[propertyValue];
    }

    if (type === 'classMap' && isObject(propertyValue)) {
        for (const [k, v] of eachPair(propertyValue as { [k: string]: any })) {
            propertyValue[k] = classToMongo(typeValue, v);
        }
    }

    if (type === 'class' && isObject(propertyValue)) {
        return classToMongo(typeValue, propertyValue);
    }

    return propertyValue;
}

export function propertyPlainToClass<T>(classType: ClassType<T>, propertyValue, propertyName) {
    const {type, typeValue} = getReflectionType(classType, propertyName);
    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if ('date' === type && !(propertyValue instanceof Date)) {
        return new Date(propertyValue);
    }

    if ('string' === type && 'string' !== typeof propertyValue) {
        return String(propertyValue);
    }

    if ('number' === type && 'number' !== typeof propertyValue) {
        return +propertyValue;
    }

    if ('enum' === type) {
        if (undefined === typeValue) {
            throw new Error(`Enum ${propertyName} has no type defined`);
        }

        return typeValue[propertyValue];
    }

    if (type === 'classArray' && isArray(propertyValue)) {
        return propertyValue.map(v => plainToClass(typeValue, v));
    }

    if (type === 'classMap' && isObject(propertyValue)) {
        for (const [k, v] of eachPair(propertyValue as { [k: string]: any })) {
            propertyValue[k] = plainToClass(typeValue, v);
        }
    }

    if (type === 'class' && isObject(propertyValue)) {
        try {
            return plainToClass(typeValue, propertyValue);
        } catch (e) {
            console.error(e);
            console.error('propertyValue', propertyValue);
            console.error('typeValue', typeValue);
            throw new Error(`Could not parse property ${propertyName}`);
        }
    }

    return propertyValue;
}

export function propertyMongoToPlain<T>(classType: ClassType<T>, target, propertyName) {
    const {type, typeValue} = getReflectionType(classType, propertyName);
    const value = target[propertyName];
    if (isUndefined(value)) {
        return undefined;
    }

    if ('uuid' === type && 'string' !== typeof value) {
        return uuid4Stringify(value);
    }

    if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
        return (<ObjectID>value).toHexString();
    }

    if ('date' === type && value instanceof Date) {
        return value.toJSON();
    }

    if (type === 'classArray' && isArray(value)) {
        return value.map(v => mongoToPlain(typeValue, v));
    }

    if (type === 'classMap' && isObject(value)) {
        for (const [k, v] of eachPair(value as { [k: string]: any })) {
            value[k] = mongoToPlain(typeValue, v);
        }
    }

    if (type === 'class' && isObject(value)) {
        return mongoToPlain(typeValue, value);
    }

    return value;
}

export function propertyClassToPlain<T>(classType: ClassType<T>, target, propertyName) {
    const {type, typeValue} = getReflectionType(classType, propertyName);
    const value = target[propertyName];

    if ('date' === type && value instanceof Date) {
        return value.toJSON();
    }

    if (type === 'classArray' && isArray(value)) {
        return value.map(v => classToPlain(typeValue, v));
    }

    if (type === 'enum') {
        return typeValue[value];
    }

    if (type === 'classMap' && isObject(value)) {
        for (const [k, v] of eachPair(value as { [k: string]: any })) {
            value[k] = classToPlain(typeValue, v);
        }
    }

    if (type === 'class' && isObject(value)) {
        return classToPlain(typeValue, clone(value, false));
    }

    return value;
}

export function propertyMongoToClass<T>(classType: ClassType<T>, target, propertyName) {
    const {type, typeValue} = getReflectionType(classType, propertyName);
    const value = target[propertyName];

    if (value && 'uuid' === type && 'string' !== typeof value) {
        return uuid4Stringify(value);
    }

    if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
        return (<ObjectID>value).toHexString();
    }

    if (type === 'classArray' && isArray(value)) {
        return value.map(v => mongoToClass(typeValue, v));
    }

    if (type === 'classMap' && isObject(value)) {
        for (const [k, v] of eachPair(value as { [k: string]: any })) {
            value[k] = mongoToClass(typeValue, v);
        }
    }

    if (type === 'class' && isObject(value)) {
        return mongoToClass(typeValue, clone(value, false));
    }

    return value;
}

export function mongoToPlain<T>(classType: ClassType<T>, target) {
    const cloned = clone(target, false);
    const result = new classType; //important to have default values

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        result[propertyName] = propertyMongoToPlain(classType, target, propertyName);
    }

    deleteExcludedPropertiesFor(classType, result, 'plain');
    return toObject(result);
}

export function classToPlain<T>(classType: ClassType<T>, target: T) {
    const cloned = clone(target, false);

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        cloned[propertyName] = propertyClassToPlain(classType, cloned, propertyName);
    }

    deleteExcludedPropertiesFor(classType, cloned, 'plain');
    return toObject(cloned);
}

export function plainToMongo<T>(classType: ClassType<T>, target) {
    const cloned = clone(target, false);
    const result = new classType; //important to have default values

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        result[propertyName] = propertyPlainToMongo(classType, propertyName, target[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return toObject(result);
}

export function classToMongo<T>(classType: ClassType<T>, target: T): any {
    const cloned = clone(target, false);
    const result = new classType; //important to have default values

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;
        result[propertyName] = propertyClassToMongo(classType, propertyName, target[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return toObject(result);
}

export function partialObjectToMongo<T>(classType: ClassType<T>, target: object): any {
    const cloned = clone(target, false);

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;
        cloned[propertyName] = propertyClassToMongo(classType, propertyName, target[propertyName]);
    }

    return toObject(cloned);
}

export function mongoToClass<T>(classType: ClassType<T>, target: any): T {
    const cloned = clone(target, false);

    if ('_id' !== getIdField(classType)) {
        delete cloned['_id'];
    }

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        cloned[propertyName] = propertyMongoToClass(classType, cloned, propertyName);
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

    deleteExcludedPropertiesFor(classType, item, 'class');
    return item;
}

export function plainToClass<T>(classType: ClassType<T>, target: object): T {
    const cloned = clone(target, false);

    for (const propertyName in cloned) {
        if (!cloned.hasOwnProperty(propertyName)) continue;

        cloned[propertyName] = propertyPlainToClass(classType, cloned[propertyName], propertyName);
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
                if (!cloned.hasOwnProperty(i)) continue;
                if (undefined === cloned[i]) {
                    continue;
                }

                this[i] = cloned[i];
            }
        }
    } as T;

    for (const propertyName in item) {
        if (isExcluded(classType, propertyName, 'class')) {
            delete item[propertyName];
        }
    }

    deleteExcludedPropertiesFor(classType, item, 'class');
    return item;
}

export function toObject<T>(item: T): object {
    const result: any = {};

    for (const i in item) {
        result[i] = item[i];
    }

    return result;
}

export function deleteExcludedPropertiesFor<T>(classType: ClassType<T>, item, target: 'class' | 'mongo' | 'plain') {
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
    return Reflect.getMetadata('marshaller:entityName', classType.prototype);
}

export function isExcluded<T>(classType: ClassType<T>, property, wantedTarget: 'class' | 'mongo' | 'plain'): boolean {
    const targets = Reflect.getMetadata('marshaller:exclude', classType.prototype, property);

    if (targets && targets.length > 0) {
        for (const definedTarget of targets) {
            if ('all' === definedTarget) {
                return true;
            }

            if (definedTarget === wantedTarget) {
                return true;
            }
        }
    }

    return false;
}

export function getDatabaseName<T>(classType: ClassType<T>): string | null {
    const name = Reflect.getMetadata('marshaller:databaseName', classType.prototype);

    return name || null;
}

export function getCollectionName<T>(classType: ClassType<T>): string {
    const name = Reflect.getMetadata('marshaller:collectionName', classType.prototype);

    if (!name) {
        throw new Error('No name defined for class ' + classType);
    }

    return name;
}
