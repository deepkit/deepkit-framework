import {
    ClassType,
    isArray,
    isObject,
    uuid4Binary,
    uuid4Stringify,
    isUndefined,
    getEnumKeys,
    isValidEnumValue, getValidEnumValue, getClassPropertyName
} from './utils';
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import {ObjectID} from "bson";

export type Types = 'objectId' | 'uuid' | 'class' | 'date' | 'string' | 'boolean' | 'number' | 'enum' | 'any';

export function isCircularDataType<T>(classType: ClassType<T>, propertyName: string): boolean {
    return Reflect.getMetadata('marshal:dataTypeValueCircular', classType.prototype, propertyName) || false;
}

export function getReflectionType<T>(classType: ClassType<T>, propertyName: string): { type: Types | null, typeValue: any | null } {
    const type = Reflect.getMetadata('marshal:dataType', classType.prototype, propertyName) || null;
    let value = Reflect.getMetadata('marshal:dataTypeValue', classType.prototype, propertyName) || null;

    if (isCircularDataType(classType, propertyName)) {
        value = value();
    }

    return {
        type: type,
        typeValue: value
    }
}

export function getAssignParentClass<T>(classType: ClassType<T>, propertyName: string): any {
    const assignParent = Reflect.getMetadata('marshal:assignParent', classType.prototype, propertyName) || false;

    if (assignParent) {
        const {typeValue} = getReflectionType(classType, propertyName);

        if (!typeValue) {
            throw new Error(`${getClassPropertyName(classType, propertyName)} has @AssignParent but no @Class defined.`);
        }

        return typeValue;
    }
}

export function propertyClassToMongo<T>(
        classType: ClassType<T>,
        propertyName: string,
        propertyValue: any
    ) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

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
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(classType, propertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                throw new Error(`Invalid ENUM given in property ${getClassPropertyName(classType, propertyName)}: ${value}, valid: ${getEnumKeys(typeValue).join(',')}`);
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
        const result: { [name: string]: any } = {};
        for (const i in propertyValue) {
            if (!propertyValue.hasOwnProperty(i)) continue;
            result[i] = convert((<any>propertyValue)[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyClassToPlain<T>(classType: ClassType<T>, propertyName: string, propertyValue: any) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    function convert(value: any) {
        if ('date' === type && value instanceof Date) {
            return value.toJSON();
        }

        if (type === 'enum') {
            return typeValue[value];
        }

        if (type === 'class') {
            return classToPlain(typeValue, clone(value));
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
            result[i] = convert((<any>propertyValue)[i]);
        }
        return result;
    }

    return convert(propertyValue);
}

export function propertyPlainToClass<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any,
    assignParents: AssignParentsRef,
    incomingLevel: number
) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    if (isUndefined(propertyValue)) {
        return undefined;
    }

    function convert(value: any) {
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
            return toClass(typeValue, clone(value), propertyPlainToClass, assignParents, incomingLevel);
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
        assignParents: AssignParentsRef,
        incomingLevel: number
    ) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    if (isUndefined(propertyValue)) {
        return undefined;
    }

    function convert(value: any) {
        if (value && 'uuid' === type && 'string' !== typeof value) {
            return uuid4Stringify(value);
        }

        if ('objectId' === type && 'string' !== typeof value && value.toHexString()) {
            return (<ObjectID>value).toHexString();
        }

        if (type === 'class') {
            return toClass(typeValue, clone(value), propertyMongoToClass, assignParents, incomingLevel);
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

export function cloneClass<T>(target: T): T {
    return plainToClass(target.constructor as ClassType<T>, classToPlain(target.constructor as ClassType<T>, target));
}

export function mongoToPlain<T>(classType: ClassType<T>, target: any) {
    return classToPlain(classType, mongoToClass(classType, target));
}

export function classToPlain<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (undefined === (target as any)[propertyName]) {
            continue;
        }

        if (getAssignParentClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        result[propertyName] = propertyClassToPlain(classType, propertyName, (target as any)[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'plain');
    return result;
}

export function plainToMongo<T>(classType: ClassType<T>, target: any): any {
    return classToMongo(classType, plainToClass(classType, target));
}

export function classToMongo<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToMongo(classType, decoratorName, (target as any)[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (undefined === (target as any)[propertyName]) {
            continue;
        }

        if (getAssignParentClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        result[propertyName] = propertyClassToMongo(classType, propertyName, (target as any)[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'mongo');
    return result;
}

type AssignParentsRef = {item: any, property: string, level: number, parentClass: ClassType<any>}[];

export function toClass<T>(
        classType: ClassType<T>,
        target: object,
        converter: (classType: ClassType<T>, propertyName: string, propertyValue: any, assignParents: AssignParentsRef, incomingLevel: number) => any,
        assignParents: AssignParentsRef,
        incomingLevel = 1
    ): T {

    const cloned = clone(target);

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return new classType(converter(classType, decoratorName, cloned, assignParents, incomingLevel));
    }

    const propertyNames = getRegisteredProperties(classType);
    for (const propertyName of propertyNames) {
        if (getAssignParentClass(classType, propertyName)) {
            //we don't populate it when its a parent ref
            continue;
        }

        cloned[propertyName] = converter(classType, propertyName, cloned[propertyName], assignParents, incomingLevel + 1);
    }

    const parameterNames = getParameterNames(classType.prototype.constructor);
    const args: any[] = [];

    for (const name of parameterNames) {
        args.push(cloned[name]);
    }

    const item = new class extends (classType as ClassType<{}>) {
        constructor() {
            super(...args);

            for (const i in cloned) {
                if (!cloned.hasOwnProperty(i)) continue;

                if (undefined === cloned[i]) {
                    continue;
                }

                (this as any)[i] = cloned[i];
            }
        }
    } as T;

    for (const propertyName of propertyNames) {
        const assignParent = getAssignParentClass(classType, propertyName);
        if (assignParent) {
            assignParents.push({
                item: item,
                level: incomingLevel,
                property: propertyName,
                parentClass: assignParent
            });
        }
    }

    const copy = assignParents.slice(0);
    for (let i = copy.length - 1; i >= 0; i--) {
        const assignParent = copy[i];
        if (incomingLevel < assignParent.level && item instanceof assignParent.parentClass) {
            assignParent.item[assignParent.property] = item;
            assignParents.splice(i, 1);
        }
    }

    item['level'] = incomingLevel;

    return item;
}

export function plainToClass<T>(classType: ClassType<T>, target: object, assignParents?: AssignParentsRef): T {
    return toClass(classType, target, propertyPlainToClass, assignParents || []);
}

export function mongoToClass<T>(classType: ClassType<T>, target: any, assignParents?: AssignParentsRef): T {
    return toClass(classType, target, propertyMongoToClass, assignParents || []);

}

export function toObject<T>(item: T): object {
    const result: any = {};

    for (const i in item) {
        if (!item.hasOwnProperty(i)) continue;
        result[i] = item[i];
    }

    return result;
}

export function deleteExcludedPropertiesFor<T>(classType: ClassType<T>, item: any, target: 'mongo' | 'plain') {
    for (const propertyName in item) {
        if (!item.hasOwnProperty(propertyName)) continue;
        if (isExcluded(classType, propertyName, target)) {
            delete item[propertyName];
        }
    }
}

export function getIdField<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshal:idField', classType.prototype) || null;
}

export function getIdFieldValue<T>(classType: ClassType<T>, target: any): any {
    const id = getIdField(classType);
    return id ? target[id] : null;
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = Reflect.getMetadata('marshal:entityName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

export function getDecorator<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshal:dataDecorator', classType.prototype) || null;
}

export function getRegisteredProperties<T>(classType: ClassType<T>): string[] {
    return Reflect.getMetadata('marshal:properties', classType.prototype) || [];
}

export function isArrayType<T>(classType: ClassType<T>, property: string): boolean {
    return Reflect.getMetadata('marshal:isArray', classType.prototype, property) || false;
}

export function isMapType<T>(classType: ClassType<T>, property: string): boolean {
    return Reflect.getMetadata('marshal:isMap', classType.prototype, property) || false;
}

export function isEnumAllowLabelsAsValue<T>(classType: ClassType<T>, property: string): boolean {
    return Reflect.getMetadata('marshal:enum:allowLabelsAsValue', classType.prototype, property) || false;
}

export function isExcluded<T>(classType: ClassType<T>, property: string, wantedTarget: 'mongo' | 'plain'): boolean {
    const mode = Reflect.getMetadata('marshal:exclude', classType.prototype, property);

    if ('all' === mode) {
        return true;
    }

    return mode === wantedTarget;
}

export function getDatabaseName<T>(classType: ClassType<T>): string | null {
    return Reflect.getMetadata('marshal:databaseName', classType) || null;
}

export function getCollectionName<T>(classType: ClassType<T>): string {
    const name = Reflect.getMetadata('marshal:collectionName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

export function applyDefaultValues<T>(classType: ClassType<T>, value: { [name: string]: any }): object {
    const valueWithDefaults = clone(value);
    const instance = plainToClass(classType, value);

    for (const i of getRegisteredProperties(classType)) {
        if (undefined === value[i]) {
            valueWithDefaults[i] = (instance as any)[i];
        }
    }

    return valueWithDefaults;
}