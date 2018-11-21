import {
    ClassType,
    isArray,
    isObject,
    isUndefined,
    getEnumKeys,
    isValidEnumValue,
    getValidEnumValue,
    getClassPropertyName,
    getClassName,
    getEnumLabels
} from './utils';
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import {isOptional} from "./validation";

export type Types = 'objectId' | 'uuid' | 'class' | 'date' | 'string' | 'boolean' | 'number' | 'enum' | 'any';

export function isCircularDataType<T>(classType: ClassType<T>, propertyName: string): boolean {
    return Reflect.getMetadata('marshal:dataTypeValueCircular', classType.prototype, propertyName) || false;
}

export function getOnLoad<T>(classType: ClassType<T>): {property: string, options: {fullLoad?: false}}[] {
    return Reflect.getMetadata('marshal:onLoad', classType.prototype) || [];
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

export function getParentReferenceClass<T>(classType: ClassType<T>, propertyName: string): any {
    const parentReference = Reflect.getMetadata('marshal:parentReference', classType.prototype, propertyName) || false;

    if (parentReference) {
        const {typeValue} = getReflectionType(classType, propertyName);

        if (!typeValue) {
            throw new Error(`${getClassPropertyName(classType, propertyName)} has @ParentReference but no @Class defined.`);
        }

        return typeValue;
    }
}

export function propertyClassToPlain<T>(classType: ClassType<T>, propertyName: string, propertyValue: any) {
    const {type, typeValue} = getReflectionType(classType, propertyName);

    function convert(value: any) {
        if ('date' === type && value instanceof Date) {
            return value.toJSON();
        }

        if ('enum' === type) {
            //the class instance itself can only have the actual value which can be used in plain as well
            return value;
        }

        if (type === 'class') {
            return classToPlain(typeValue, clone(value, false, 1));
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

        if ('any' === type) {
            return clone(value, false, 1);
        }

        if ('enum' === type) {
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(classType, propertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                const valids = getEnumKeys(typeValue);
                if (allowLabelsAsValue) {
                    for (const label of getEnumLabels(typeValue)) {
                        valids.push(label);
                    }
                }
                throw new Error(`Invalid ENUM given in property ${propertyName}: ${value}, valid: ${valids.join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            if (value instanceof typeValue) {
                //already the target type, this is an error
                throw new Error(`${getClassPropertyName(classType, propertyName)} is already in target format. Are you calling plainToClass() with an class instance?`);
            }

            return toClass(typeValue, clone(value, false, 1), propertyPlainToClass, parents, incomingLevel, state);
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


export function cloneClass<T>(target: T, parents?: any[]): T {
    return plainToClass(target.constructor as ClassType<T>, classToPlain(target.constructor as ClassType<T>, target), parents);
}


export function classToPlain<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    if (!(target instanceof classType)) {
        throw new Error(`Could not classToPlain since target is not a class instance of ${getClassName(classType)}`);
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    }

    for (const propertyName of getRegisteredProperties(classType)) {
        if (undefined === (target as any)[propertyName]) {
            continue;
        }

        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        result[propertyName] = propertyClassToPlain(classType, propertyName, (target as any)[propertyName]);
    }

    deleteExcludedPropertiesFor(classType, result, 'plain');
    return result;
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

export function toClass<T>(
    classType: ClassType<T>,
    cloned: object,
    converter: (classType: ClassType<T>, propertyName: string, propertyValue: any, parents: any[], incomingLevel: number, state: ToClassState) => any,
    parents: any[],
    incomingLevel,
    state: ToClassState
): T {

    const parentReferences: { [propertyName: string]: any } = {};
    const assignedViaConstructor: { [propertyName: string]: boolean } = {};
    const propertyNames = getRegisteredProperties(classType);

    for (const propertyName of propertyNames) {
        parentReferences[propertyName] = getParentReferenceClass(classType, propertyName);
    }

    const parameterNames = getParameterNames(classType.prototype.constructor);

    function findParent<T>(parentType: ClassType<T>): T | null {
        for (let i = parents.length - 1; i >= 0; i--) {
            if (parents[i] instanceof parentType) {
                return parents[i];
            }
        }

        return null;
    }

    const decoratorName = getDecorator(classType);

    const args: any[] = [];
    for (const propertyName of parameterNames) {
        if (decoratorName && propertyName === decoratorName) {
            cloned[propertyName] = converter(classType, decoratorName, cloned, parents, incomingLevel, state);
        } else if (parentReferences[propertyName]) {
            const parent = findParent(parentReferences[propertyName]);
            if (parent) {
                cloned[propertyName] = parent;
            } else if (!isOptional(classType, propertyName)) {
                throw new Error(`${getClassPropertyName(classType, propertyName)} is in constructor ` +
                    `has @ParentReference() and NOT @Optional(), but no parent of type ${getClassName(parentReferences[propertyName])} found. ` +
                    `In case of circular reference, remove '${propertyName}' from constructor, or make sure you provided all parents.`
                );
            }
        } else {
            cloned[propertyName] = converter(classType, propertyName, cloned[propertyName], parents, incomingLevel + 1, state);
        }

        assignedViaConstructor[propertyName] = true;
        args.push(cloned[propertyName]);
    }

    const item = new classType(...args);

    const parentsWithItem = parents.slice(0);
    parentsWithItem.push(item);

    for (const propertyName of propertyNames) {
        if (assignedViaConstructor[propertyName]) {
            //already given via constructor
            continue;
        }

        if (parentReferences[propertyName]) {
            const parent = findParent(parentReferences[propertyName]);
            if (parent) {
                item[propertyName] = parent;
            } else if (!isOptional(classType, propertyName)) {
                throw new Error(`${getClassPropertyName(classType, propertyName)} is defined as @ParentReference() and `+
                    `NOT @Optional(), but no parent found. Add @Optional() or provide ${propertyName} in parents to fix that.`);
            }
        } else if (!isUndefined(cloned[propertyName])) {
            item[propertyName] = converter(classType, propertyName, cloned[propertyName], parentsWithItem, incomingLevel + 1, state);
        }
    }

    const onLoads = getOnLoad(classType);
    for (const onLoad of onLoads) {
        if (onLoad.options.fullLoad) {
            state.onFullLoadCallbacks.push(() => {
                item[onLoad.property]();
            });
        } else {
            item[onLoad.property]();
        }
    }

    return item;
}

export function plainToClass<T>(classType: ClassType<T>, target: object, parents?: any[]): T {
    const state = new ToClassState();
    const item = toClass(classType, clone(target, false, 1), propertyPlainToClass, parents || [], 1, state);

    for (const callback of state.onFullLoadCallbacks) {
        callback();
    }

    return item;
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
    const valueWithDefaults = clone(value, false, 1);
    const instance = plainToClass(classType, value);

    for (const i of getRegisteredProperties(classType)) {
        if (undefined === value[i]) {
            valueWithDefaults[i] = (instance as any)[i];
        }
    }

    return valueWithDefaults;
}