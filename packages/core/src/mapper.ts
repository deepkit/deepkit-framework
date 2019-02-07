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
    getEnumLabels,
} from './utils';
import { isOptional } from './validation';
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import { Buffer } from 'buffer';

export type Types =
    | 'objectId'
    | 'uuid'
    | 'binary'
    | 'class'
    | 'date'
    | 'string'
    | 'boolean'
    | 'number'
    | 'enum'
    | 'any';

const cache = new Map<Object, Map<string, any>>();

function getCachedMetaData<T>(
    key: string,
    target: Object,
    propertyName?: string
): any {
    let valueMap = cache.get(target);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(target, valueMap);
    }

    const cacheKey = key + '::' + propertyName;
    let value = valueMap.get(cacheKey);

    if (undefined === value) {
        if (propertyName) {
            value = Reflect.getMetadata(key, target, propertyName);
        } else {
            value = Reflect.getMetadata(key, target);
        }
        valueMap.set(cacheKey, value || '');
    }

    return value || '';
}

export function getCachedParameterNames<T>(classType: ClassType<T>): string[] {
    let valueMap = cache.get(classType.prototype);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(classType.prototype, valueMap);
    }

    let value = valueMap.get('parameter_names');
    if (!value) {
        value = getParameterNames(classType.prototype.constructor);
        valueMap.set('parameter_names', value);
    }

    return value;
}

export function isCircularDataType<T>(
    classType: ClassType<T>,
    propertyName: string
): boolean {
    return (
        getCachedMetaData(
            'marshal:dataTypeValueCircular',
            classType.prototype,
            propertyName
        ) || false
    );
}

export function getOnLoad<T>(
    classType: ClassType<T>
): { property: string; options: { fullLoad?: false } }[] {
    return getCachedMetaData('marshal:onLoad', classType.prototype) || [];
}

export interface ResolvedReflectionFound {
    resolvedClassType: ClassType<any>;
    resolvedPropertyName: string;
    type: Types;
    typeValue: any;
    array: boolean;
    map: boolean;
}

export type ResolvedReflection = ResolvedReflectionFound | null;

export function getResolvedReflection<T>(
    classType: ClassType<T>,
    propertyPath: string
): ResolvedReflection {
    const names = propertyPath.split('.');
    let resolvedClassType: ClassType<any> = classType;
    let resolvedTypeCandidate: Types | undefined;
    let resolvedClassTypeCandidate: ClassType<any> | undefined;
    let resolvedPropertyName: string = '';
    let inArrayOrMap = false;
    let inClassField = false;
    let isArray = false;
    let isMap = false;

    for (let i = 0; i < names.length; i++) {
        const name = names[i];

        if (inArrayOrMap) {
            if (inClassField && resolvedClassTypeCandidate) {
                const { type } = getReflectionType(
                    resolvedClassTypeCandidate,
                    name
                );
                if (!type) {
                    return null;
                }
                inClassField = false;
                inArrayOrMap = false;
                resolvedClassType = resolvedClassTypeCandidate;
            } else {
                inClassField = true;
                continue;
            }
        }

        const { type, typeValue } = getReflectionType(resolvedClassType, name);

        if (!type) {
            return null;
        }

        resolvedPropertyName = name;
        isArray = isArrayType(resolvedClassType, resolvedPropertyName);
        isMap = isMapType(resolvedClassType, resolvedPropertyName);
        if (isArray || isMap) {
            inArrayOrMap = true;
        }

        if (type === 'class') {
            resolvedClassTypeCandidate = typeValue;
            if (resolvedClassTypeCandidate) {
                const decorator = getDecorator(resolvedClassTypeCandidate);
                if (decorator) {
                    const { type, typeValue } = getReflectionType(
                        resolvedClassTypeCandidate,
                        decorator
                    );

                    if (
                        isArrayType(resolvedClassTypeCandidate, decorator) ||
                        isMapType(resolvedClassTypeCandidate, decorator)
                    ) {
                        inArrayOrMap = true;
                    }

                    if (type === 'class') {
                        if (!typeValue) {
                            throw new Error(
                                `${getClassPropertyName(
                                    resolvedClassType,
                                    resolvedPropertyName
                                )} has no class defined. Use Circular decorator if that class really exists.`
                            );
                        }
                        resolvedTypeCandidate = type;
                        resolvedClassTypeCandidate = typeValue;
                    } else if (type) {
                        if (names[i + 1]) {
                            return {
                                resolvedClassType: resolvedClassType,
                                resolvedPropertyName: resolvedPropertyName,
                                type: type,
                                typeValue: typeValue,
                                array: false,
                                map: false,
                            };
                        } else {
                            return {
                                resolvedClassType: resolvedClassType,
                                resolvedPropertyName: resolvedPropertyName,
                                type: 'class',
                                typeValue: resolvedClassTypeCandidate,
                                array: isArray,
                                map: isMap,
                            };
                        }
                    } else {
                        return null;
                    }
                }
            } else {
                throw new Error(
                    `${getClassPropertyName(
                        resolvedClassType,
                        resolvedPropertyName
                    )} has no class defined. Use Circular decorator if that class really exists.`
                );
            }
        }
    }

    if (inClassField) {
        isArray = false;
        isMap = false;

        if (resolvedTypeCandidate) {
            return {
                resolvedClassType: resolvedClassType,
                resolvedPropertyName: resolvedPropertyName,
                type: resolvedTypeCandidate,
                typeValue: resolvedClassTypeCandidate,
                array: isArray,
                map: isMap,
            };
        }
    }

    const { type, typeValue } = getReflectionType(
        resolvedClassType,
        resolvedPropertyName
    );
    if (type) {
        return {
            resolvedClassType: resolvedClassType,
            resolvedPropertyName: resolvedPropertyName,
            type: type,
            typeValue: typeValue,
            array: isArray,
            map: isMap,
        };
    }

    return null;
}

export function getReflectionType<T>(
    classType: ClassType<T>,
    propertyName: string
): { type: Types | null; typeValue: any | null } {
    let valueMap = cache.get(classType.prototype);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(classType.prototype, valueMap);
    }

    let value = valueMap.get('getReflectionType::' + propertyName);

    if (undefined === value) {
        const type =
            Reflect.getMetadata(
                'marshal:dataType',
                classType.prototype,
                propertyName
            ) || null;
        let typeValue =
            Reflect.getMetadata(
                'marshal:dataTypeValue',
                classType.prototype,
                propertyName
            ) || null;

        if (isCircularDataType(classType, propertyName)) {
            typeValue = typeValue();
        }
        value = {
            type: type,
            typeValue: typeValue,
        };

        valueMap.set('getReflectionType::' + propertyName, value);
    }

    return value;
}

export function getParentReferenceClass<T>(
    classType: ClassType<T>,
    propertyName: string
): any {
    let valueMap = cache.get(classType.prototype);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(classType.prototype, valueMap);
    }

    let value = valueMap.get('ParentReferenceClass::' + propertyName);
    if (undefined === value) {
        const parentReference =
            Reflect.getMetadata(
                'marshal:parentReference',
                classType.prototype,
                propertyName
            ) || false;

        if (parentReference) {
            const { typeValue } = getReflectionType(classType, propertyName);

            if (!typeValue) {
                throw new Error(
                    `${getClassPropertyName(
                        classType,
                        propertyName
                    )} has @ParentReference but no @Class defined.`
                );
            }
            value = typeValue;
        }
        valueMap.set('ParentReferenceClass::' + propertyName, value || '');
    }
    return value;
}

export function propertyClassToPlain<T>(
    classType: ClassType<T>,
    propertyName: string,
    propertyValue: any
) {
    if (undefined === propertyValue) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }
    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) return propertyValue;

    const {
        resolvedClassType,
        resolvedPropertyName,
        type,
        typeValue,
        array,
        map,
    } = reflection;

    function convert(value: any) {
        if ('date' === type && value instanceof Date) {
            return value.toJSON();
        }

        if ('string' === type) {
            return String(value);
        }

        if ('enum' === type) {
            //the class instance itself can only have the actual value which can be used in plain as well
            return value;
        }

        if ('binary' === type && value.toString) {
            return value.toString('base64');
        }

        if ('any' === type) {
            return clone(value, false);
        }

        if (type === 'class') {
            if (!(value instanceof typeValue)) {
                throw new Error(
                    `Could not convert ${getClassPropertyName(
                        classType,
                        propertyName
                    )} since target is not a ` +
                        `class instance of ${getClassName(
                            typeValue
                        )}. Got ${getClassName(value)}`
                );
            }

            return classToPlain(typeValue, value);
        }

        return value;
    }

    if (array) {
        if (isArray(propertyValue)) {
            return propertyValue.map((v) => convert(v));
        }

        return [];
    }

    if (map) {
        const result: { [name: string]: any } = {};
        if (isObject(propertyValue)) {
            for (const i in propertyValue) {
                if (!propertyValue.hasOwnProperty(i)) continue;
                result[i] = convert((<any>propertyValue)[i]);
            }
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
    if (isUndefined(propertyValue)) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }

    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) return propertyValue;

    const {
        resolvedClassType,
        resolvedPropertyName,
        type,
        typeValue,
        array,
        map,
    } = reflection;

    function convert(value: any) {
        if (
            'date' === type &&
            ('string' === typeof value || 'number' === typeof value)
        ) {
            return new Date(value);
        }

        if ('string' === type && 'string' !== typeof value) {
            return String(value);
        }

        if ('number' === type && 'number' !== typeof value) {
            return +value;
        }

        if ('binary' === type && 'string' === typeof value) {
            return new Buffer(value, 'base64');
        }

        if ('boolean' === type && 'boolean' !== typeof value) {
            if ('true' === value || '1' === value || 1 === value) return true;
            if ('false' === value || '0' === value || 0 === value) return false;

            return true === value;
        }

        if ('any' === type) {
            return clone(value, false);
        }

        if ('enum' === type) {
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(
                resolvedClassType,
                resolvedPropertyName
            );
            if (
                undefined !== value &&
                !isValidEnumValue(typeValue, value, allowLabelsAsValue)
            ) {
                const valids = getEnumKeys(typeValue);
                if (allowLabelsAsValue) {
                    for (const label of getEnumLabels(typeValue)) {
                        valids.push(label);
                    }
                }
                throw new Error(
                    `Invalid ENUM given in property ${resolvedPropertyName}: ${value}, valid: ${valids.join(
                        ','
                    )}`
                );
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            if (value instanceof typeValue) {
                //already the target type, this is an error
                throw new Error(
                    `${getClassPropertyName(
                        resolvedClassType,
                        resolvedPropertyName
                    )} is already in target format. Are you calling plainToClass() with an class instance?`
                );
            }

            return toClass(
                typeValue,
                value,
                propertyPlainToClass,
                parents,
                incomingLevel,
                state
            );
        }

        return value;
    }

    if (array) {
        if (isArray(propertyValue)) {
            return propertyValue.map((v) => convert(v));
        }

        return [];
    }

    if (map) {
        const result: { [name: string]: any } = {};
        if (isObject(propertyValue)) {
            for (const i in propertyValue) {
                if (!propertyValue.hasOwnProperty(i)) continue;
                result[i] = convert((<any>propertyValue)[i]);
            }
        }
        return result;
    }

    return convert(propertyValue);
}

export function cloneClass<T>(target: T, parents?: any[]): T {
    return plainToClass(
        target.constructor as ClassType<T>,
        classToPlain(target.constructor as ClassType<T>, target),
        parents
    );
}

export function classToPlain<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    if (!(target instanceof classType)) {
        throw new Error(
            `Could not classToPlain since target is not a class instance of ${getClassName(
                classType
            )}`
        );
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToPlain(
            classType,
            decoratorName,
            (target as any)[decoratorName]
        );
    }

    const propertyNames = getRegisteredProperties(classType);

    for (const propertyName of propertyNames) {
        if (undefined === (target as any)[propertyName]) {
            continue;
        }

        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        if (isExcluded(classType, propertyName, 'plain')) {
            continue;
        }

        result[propertyName] = propertyClassToPlain(
            classType,
            propertyName,
            (target as any)[propertyName]
        );
    }

    return result;
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

const propertyNamesCache = new Map<ClassType<any>, string[]>();
const parentReferencesCache = new Map<
    ClassType<any>,
    { [propertyName: string]: any }
>();

function findParent<T>(parents: any[], parentType: ClassType<T>): T | null {
    for (let i = parents.length - 1; i >= 0; i--) {
        if (parents[i] instanceof parentType) {
            return parents[i];
        }
    }

    return null;
}

export function toClass<T>(
    classType: ClassType<T>,
    cloned: object,
    converter: (
        classType: ClassType<T>,
        propertyName: string,
        propertyValue: any,
        parents: any[],
        incomingLevel: number,
        state: ToClassState
    ) => any,
    parents: any[],
    incomingLevel,
    state: ToClassState
): T {
    const assignedViaConstructor: { [propertyName: string]: boolean } = {};

    let propertyNames = propertyNamesCache.get(classType);
    if (!propertyNames) {
        propertyNames = getRegisteredProperties(classType);
        propertyNamesCache.set(classType, propertyNames);
    }

    let parentReferences = parentReferencesCache.get(classType);
    if (!parentReferences) {
        parentReferences = {};
        for (const propertyName of propertyNames) {
            parentReferences[propertyName] = getParentReferenceClass(
                classType,
                propertyName
            );
        }
        parentReferencesCache.set(classType, parentReferences);
    }

    const parameterNames = getCachedParameterNames(classType);

    const decoratorName = getDecorator(classType);
    const backupedClone = cloned;

    if (!isObject(cloned)) {
        cloned = {};
    }

    const args: any[] = [];
    for (const propertyName of parameterNames) {
        if (decoratorName && propertyName === decoratorName) {
            cloned[propertyName] = converter(
                classType,
                decoratorName,
                backupedClone,
                parents,
                incomingLevel,
                state
            );
        } else if (parentReferences[propertyName]) {
            const parent = findParent(parents, parentReferences[propertyName]);
            if (parent) {
                cloned[propertyName] = parent;
            } else if (!isOptional(classType, propertyName)) {
                throw new Error(
                    `${getClassPropertyName(
                        classType,
                        propertyName
                    )} is in constructor ` +
                        `has @ParentReference() and NOT @Optional(), but no parent of type ${getClassName(
                            parentReferences[propertyName]
                        )} found. ` +
                        `In case of circular reference, remove '${propertyName}' from constructor, or make sure you provided all parents.`
                );
            }
        } else {
            cloned[propertyName] = converter(
                classType,
                propertyName,
                cloned[propertyName],
                parents,
                incomingLevel + 1,
                state
            );
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
            const parent = findParent(parents, parentReferences[propertyName]);
            if (parent) {
                item[propertyName] = parent;
            } else if (!isOptional(classType, propertyName)) {
                throw new Error(
                    `${getClassPropertyName(
                        classType,
                        propertyName
                    )} is defined as @ParentReference() and ` +
                        `NOT @Optional(), but no parent found. Add @Optional() or provide ${propertyName} in parents to fix that.`
                );
            }
        } else if (undefined !== cloned[propertyName]) {
            item[propertyName] = converter(
                classType,
                propertyName,
                cloned[propertyName],
                parentsWithItem,
                incomingLevel + 1,
                state
            );
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

/**
 * Takes a regular object with partial fields defined of classType and converts only them into the class variant.
 *
 * Returns a new regular object again.
 */
export function partialPlainToClass<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    parents?: any[]
): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};
    const state = new ToClassState();

    for (const i in target) {
        if (!target.hasOwnProperty(i)) continue;
        result[i] = propertyPlainToClass(
            classType,
            i,
            target[i],
            parents || [],
            1,
            state
        );
    }

    return result;
}

/**
 * Takes a object with partial class fields defined of classType and converts only them into the plain variant.
 *
 * Returns a new regular object again.
 */
export function partialClassToPlain<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any }
): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};

    for (const i in target) {
        if (!target.hasOwnProperty(i)) continue;
        result[i] = propertyClassToPlain(classType, i, target[i]);
    }

    return result;
}

/**
 * Take a regular object with all fields default (missing default to class property default or undefined)
 * and returns an instance of classType.
 */
export function plainToClass<T>(
    classType: ClassType<T>,
    target: object,
    parents?: any[]
): T {
    const state = new ToClassState();
    const item = toClass(
        classType,
        target,
        propertyPlainToClass,
        parents || [],
        1,
        state
    );

    for (const callback of state.onFullLoadCallbacks) {
        callback();
    }

    return item;
}

export function deleteExcludedPropertiesFor<T>(
    classType: ClassType<T>,
    item: any,
    target: 'mongo' | 'plain'
) {
    for (const propertyName in item) {
        if (!item.hasOwnProperty(propertyName)) continue;
        if (isExcluded(classType, propertyName, target)) {
            delete item[propertyName];
        }
    }
}

export function getIdField<T>(classType: ClassType<T>): string | null {
    return getCachedMetaData('marshal:idField', classType.prototype) || null;
}

export function getIdFieldValue<T>(classType: ClassType<T>, target: any): any {
    const id = getIdField(classType);
    return id ? target[id] : null;
}

export function getDecorator<T>(classType: ClassType<T>): string | null {
    return (
        getCachedMetaData('marshal:dataDecorator', classType.prototype) || null
    );
}

export function getRegisteredProperties<T>(classType: ClassType<T>): string[] {
    return getCachedMetaData('marshal:properties', classType.prototype) || [];
}

export function isArrayType<T>(
    classType: ClassType<T>,
    property: string
): boolean {
    return (
        getCachedMetaData('marshal:isArray', classType.prototype, property) ||
        false
    );
}

export function isMapType<T>(
    classType: ClassType<T>,
    property: string
): boolean {
    return (
        getCachedMetaData('marshal:isMap', classType.prototype, property) ||
        false
    );
}

export function isEnumAllowLabelsAsValue<T>(
    classType: ClassType<T>,
    property: string
): boolean {
    return (
        getCachedMetaData(
            'marshal:enum:allowLabelsAsValue',
            classType.prototype,
            property
        ) || false
    );
}

export function isExcluded<T>(
    classType: ClassType<T>,
    property: string,
    wantedTarget: 'mongo' | 'plain'
): boolean {
    const mode = getCachedMetaData(
        'marshal:exclude',
        classType.prototype,
        property
    );

    if ('all' === mode) {
        return true;
    }

    return mode === wantedTarget;
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = getCachedMetaData('marshal:entityName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

export function getDatabaseName<T>(classType: ClassType<T>): string | null {
    return getCachedMetaData('marshal:databaseName', classType) || null;
}

export function getCollectionName<T>(classType: ClassType<T>): string {
    const name = getCachedMetaData('marshal:collectionName', classType);

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

export function applyDefaultValues<T>(
    classType: ClassType<T>,
    value: { [name: string]: any }
): object {
    if (!isObject(value)) return {};

    const valueWithDefaults = value;
    const instance = plainToClass(classType, value);

    for (const i of getRegisteredProperties(classType)) {
        if (undefined === value[i]) {
            valueWithDefaults[i] = (instance as any)[i];
        }
    }

    return valueWithDefaults;
}
