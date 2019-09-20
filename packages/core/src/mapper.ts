import {isOptional, validate, ValidationFailed} from "./validation";
import * as clone from 'clone';
import * as getParameterNames from 'get-parameter-names';
import {Buffer} from 'buffer';
import {getClassTypeFromInstance, getEntitySchema} from "./decorators";
import {
    ClassType,
    getClassName,
    getClassPropertyName,
    getEnumLabels,
    getEnumValues,
    getValidEnumValue,
    isArray,
    isObject,
    isUndefined,
    isValidEnumValue,
    eachPair,
    eachKey
} from "@marcj/estdlib";

export type Types =
    'objectId'
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

/**
 * Parameter names for the constructor.
 *
 * @hidden
 */
export function getCachedParameterNames<T>(classType: ClassType<T>): string[] {
    const cpn = getEntitySchema(classType).constructorParamNames;
    if (cpn.length > 0) {
        return cpn;
    }

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

/**
 * @hidden
 */
export interface ResolvedReflectionFound {
    resolvedClassType: ClassType<any>;
    resolvedPropertyName: string;
    type: Types;
    typeValue: any;
    array: boolean;
    map: boolean;
}

/**
 * @hidden
 */
export type ResolvedReflection = ResolvedReflectionFound | undefined;

type ResolvedReflectionCaches = {[path: string]: ResolvedReflection};
const resolvedReflectionCaches = new Map<ClassType<any>, ResolvedReflectionCaches>();

/**
 * @hidden
 */
export function getResolvedReflection<T>(classType: ClassType<T>, propertyPath: string): ResolvedReflection {
    let cache = resolvedReflectionCaches.get(classType);
    if (!cache) {
        cache = {};
        resolvedReflectionCaches.set(classType, cache);
    }

    if (cache[propertyPath]) {
        return cache[propertyPath];
    }

    const names = propertyPath === '' ? [] : propertyPath.split('.');
    const schema = getEntitySchema(classType);

    if (names.length === 1) {
        if (!schema.hasProperty(names[0])) {
            return;
        }

        const prop = schema.getProperty(names[0]);

        return cache[propertyPath] = {
            resolvedClassType: classType,
            resolvedPropertyName: names[0],
            type: prop.type,
            typeValue: prop.getResolvedClassTypeForValidType(),
            array: prop.isArray,
            map: prop.isMap,
        }
    }

    for (let i = 0; i < names.length; i++) {
        const name = names[i];

        if (!schema.hasProperty(name)) {
            return;
        }

        let prop = schema.getProperty(name);

        if (prop.type === 'class' && prop.isResolvedClassTypeIsDecorated()) {
            const foreignSchema = getEntitySchema(prop.getResolvedClassType());
            prop = foreignSchema.getProperty(foreignSchema.decorator!);
        }

        if (prop.isMap || prop.isArray) {
            if (prop.type === 'class') {
                if (names[i + 2]) {
                    return getResolvedReflection(prop.getResolvedClassType(), names.slice(i + 2).join('.'));
                } else if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = {
                        resolvedClassType: classType,
                        resolvedPropertyName: name,
                        type: prop.type,
                        typeValue: prop.getResolvedClassTypeForValidType(),
                        array: false,
                        map: false,
                    }
                }
            } else {
                if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = {
                        resolvedClassType: classType,
                        resolvedPropertyName: name,
                        type: prop.type,
                        typeValue: prop.getResolvedClassTypeForValidType(),
                        array: false,
                        map: false,
                    }
                }
            }
        } else {
            if (prop.type === 'class') {
                return getResolvedReflection(prop.getResolvedClassType(), names.slice(i + 1).join('.'));
            } else {
                //`Property ${getClassPropertyName(classType, name)} is not an array or map, so can not resolve ${propertyPath}.`
                return;
            }
        }
    }

    return;
}

/**
 * @hidden
 */
export function getReflectionType<T>(classType: ClassType<T>, propertyName: string): { type: Types | undefined, typeValue: any | undefined } {
    let valueMap = cache.get(classType.prototype);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(classType.prototype, valueMap);
    }

    let value = valueMap.get('getReflectionType::' + propertyName);

    if (undefined === value) {
        const schema = getEntitySchema(classType).getPropertyOrUndefined(propertyName);

        try {
            if (schema) {
                value = {
                    type: schema.type,
                    typeValue: schema.getResolvedClassTypeForValidType()
                };
            } else {
                value = {
                    type: undefined,
                    typeValue: undefined
                }
            }
        } catch (error) {
            throw new Error(`${getClassPropertyName(classType, propertyName)}: ${error}`);
        }

        valueMap.set('getReflectionType::' + propertyName, value);
    }

    return value;
}

/**
 * @hidden
 */
export function getParentReferenceClass<T>(classType: ClassType<T>, propertyName: string): any {
    let valueMap = cache.get(classType.prototype);
    if (!valueMap) {
        valueMap = new Map();
        cache.set(classType.prototype, valueMap);
    }

    let value = valueMap.get('ParentReferenceClass::' + propertyName);
    if (undefined === value) {
        if (getEntitySchema(classType).getProperty(propertyName).isParentReference) {
            const {typeValue} = getReflectionType(classType, propertyName);

            if (!typeValue) {
                throw new Error(`${getClassPropertyName(classType, propertyName)} has @ParentReference but no @Class defined.`);
            }
            value = typeValue;
        }
        valueMap.set('ParentReferenceClass::' + propertyName, value || '');
    }
    return value;
}

/**
 * @hidden
 */
export function propertyClassToPlain<T>(classType: ClassType<T>, propertyName: string, propertyValue: any) {

    if (undefined === propertyValue) {
        return undefined;
    }

    if (null === propertyValue) {
        return null;
    }
    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) {
        throw new Error(`No reflection available for ${getClassPropertyName(classType, propertyName)}`);
    }

    const {type, typeValue, array, map} = reflection;

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
                    `Could not convert ${getClassPropertyName(classType, propertyName)} since target is not a ` +
                    `class instance of ${getClassName(typeValue)}. Got ${getClassName(value)}`);
            }

            return classToPlain(typeValue, value);
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

/**
 * @hidden
 */
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

    const {resolvedClassType, resolvedPropertyName, type, typeValue, array, map} = reflection;

    function convert(value: any) {
        if ('date' === type && ('string' === typeof value || 'number' === typeof value)) {
            return new Date(value);
        }

        if ('string' === type && 'string' !== typeof value) {
            return String(value);
        }

        if ('number' === type && 'number' !== typeof value) {
            return +value;
        }

        if ('binary' === type && 'string' === typeof value) {
            return Buffer.from(value, 'base64');
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
            const allowLabelsAsValue = isEnumAllowLabelsAsValue(resolvedClassType, resolvedPropertyName);
            if (undefined !== value && !isValidEnumValue(typeValue, value, allowLabelsAsValue)) {
                const valids = getEnumValues(typeValue);
                if (allowLabelsAsValue) {
                    for (const label of getEnumLabels(typeValue)) {
                        valids.push(label);
                    }
                }
                throw new Error(`Invalid ENUM given in property ${resolvedPropertyName}: ${value}, valid: ${valids.join(',')}`);
            }

            return getValidEnumValue(typeValue, value, allowLabelsAsValue);
        }

        if (type === 'class') {
            if (value instanceof typeValue) {
                //already the target type, this is an error
                throw new Error(`${getClassPropertyName(resolvedClassType, resolvedPropertyName)} is already in target format. Are you calling plainToClass() with an class instance?`);
            }

            return toClass(typeValue, value, propertyPlainToClass, parents, incomingLevel, state);
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

/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, parents?: any[]): T {
    return plainToClass(getClassTypeFromInstance(target), classToPlain(getClassTypeFromInstance(target), target), parents);
}

/**
 * Converts a class instance into a plain object, which an be used with JSON.stringify() to convert it into a JSON string.
 */
export function classToPlain<T>(classType: ClassType<T>, target: T): any {
    const result: any = {};

    if (!(target instanceof classType)) {
        throw new Error(`Could not classToPlain since target is not a class instance of ${getClassName(classType)}`);
    }

    const decoratorName = getDecorator(classType);
    if (decoratorName) {
        return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    }

    const propertyNames = getRegisteredProperties(classType);

    for (const propertyName of propertyNames) {
        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        if (isExcluded(classType, propertyName, 'plain')) {
            continue
        }

        result[propertyName] = propertyClassToPlain(classType, propertyName, (target as any)[propertyName]);
    }

    return result;
}

/**
 * @hidden
 */
export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

const propertyNamesCache = new Map<ClassType<any>, string[]>();
const parentReferencesCache = new Map<ClassType<any>, { [propertyName: string]: any }>();

/**
 * @hidden
 */
function findParent<T>(parents: any[], parentType: ClassType<T>): T | null {
    for (let i = parents.length - 1; i >= 0; i--) {
        if (parents[i] instanceof parentType) {
            return parents[i];
        }
    }

    return null;
}

/**
 * @hidden
 */
export function toClass<T>(
    classType: ClassType<T>,
    data: object,
    converter: (classType: ClassType<T>, propertyName: string, propertyValue: any, parents: any[], incomingLevel: number, state: ToClassState) => any,
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
            parentReferences[propertyName] = getParentReferenceClass(classType, propertyName);
        }
        parentReferencesCache.set(classType, parentReferences);
    }

    const parameterNames = getCachedParameterNames(classType);
    const decoratorName = getDecorator(classType);

    const argsValues = {};
    const args: any[] = [];
    for (const propertyName of parameterNames) {
        if (decoratorName && propertyName === decoratorName) {
            argsValues[propertyName] = converter(classType, decoratorName, data, parents, incomingLevel, state);
        } else if (parentReferences[propertyName]) {
            const parent = findParent(parents, parentReferences[propertyName]);
            if (parent) {
                argsValues[propertyName] = parent;
            } else if (!isOptional(classType, propertyName)) {
                throw new Error(`${getClassPropertyName(classType, propertyName)} is in constructor ` +
                    `has @ParentReference() and NOT @Optional(), but no parent of type ${getClassName(parentReferences[propertyName])} found. ` +
                    `In case of circular reference, remove '${propertyName}' from constructor, or make sure you provided all parents.`
                );
            }
        } else {
            argsValues[propertyName] = converter(classType, propertyName, data[propertyName], parents, incomingLevel + 1, state);
        }

        assignedViaConstructor[propertyName] = true;
        args.push(argsValues[propertyName]);
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
                throw new Error(`${getClassPropertyName(classType, propertyName)} is defined as @ParentReference() and ` +
                    `NOT @Optional(), but no parent found. Add @Optional() or provide ${propertyName} in parents to fix that.`);
            }
        } else if (undefined !== data[propertyName] && null !== data[propertyName]) {
            item[propertyName] = converter(classType, propertyName, data[propertyName], parentsWithItem, incomingLevel + 1, state);
        }
    }

    for (const onLoad of getEntitySchema(classType).onLoad) {
        if (onLoad.options.fullLoad) {
            state.onFullLoadCallbacks.push(() => {
                item[onLoad.methodName]();
            });
        } else {
            item[onLoad.methodName]();
        }
    }

    return item;
}

/**
 * Takes a regular object with partial fields defined of classType and converts only them into the class variant.
 *
 * Returns a new regular object again.
 */
export function partialPlainToClass<T, K extends keyof T>(classType: ClassType<T>, target: { [path: string]: any }, parents?: any[]): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};
    const state = new ToClassState();

    for (const i of eachKey(target)) {
        result[i] = propertyPlainToClass(classType, i, target[i], parents || [], 1, state);
    }

    return result;
}


/**
 * Takes a object with partial class fields defined of classType and converts only them into the plain variant.
 *
 * Returns a new regular object again.
 */
export function partialClassToPlain<T, K extends keyof T>(classType: ClassType<T>, target: { [path: string]: any }): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};

    for (const i of eachKey(target)) {
        result[i] = propertyClassToPlain(classType, i, target[i]);
    }

    return result;
}


/**
 * Take a regular object literal and returns an instance of classType.
 * Missing data is either replaced by the default value of that property or undefined.
 *
 * This method does not validate the given data. Use either [[validatedPlainToClass]] to validate beforehand
 * or use [[validate]] on your newly created instance.
 *
 * ```typescript
 * const entity = plainToClass(MyEntity, {field1: 'value'});
 * entity instanceof MyEntity; //true
 * ```
 */
export function plainToClass<T>(
    classType: ClassType<T>,
    data: object,
    parents?: any[]
): T {
    const state = new ToClassState();
    const item = toClass(classType, data, propertyPlainToClass, parents || [], 1, state);

    for (const callback of state.onFullLoadCallbacks) {
        callback();
    }

    return item;
}

/**
 * Same as [plainToClass] but with validation before creating the class instance.
 *
 * ```typescript
 * try {
 *     const entity = await validatedPlainToClass(MyEntity, {field1: 'value'});
 *     entity instanceof MyEntity; //true
 * } catch (error) {
 *     if (error instanceof ValidationFailed) {
 *         //handle that case.
 *     }
 * }
 * ```
 */
export function validatedPlainToClass<T>(
    classType: ClassType<T>,
    data: object,
    parents?: any[]
): T {
    const errors = validate(classType, data);
    if (errors.length) {
        throw new ValidationFailed(errors);
    }

    return plainToClass(classType, data, parents);
}

/**
 * @hidden
 */
export function deleteExcludedPropertiesFor<T>(classType: ClassType<T>, item: any, target: 'mongo' | 'plain') {
    for (const propertyName of eachKey(item)) {
        if (isExcluded(classType, propertyName, target)) {
            delete item[propertyName];
        }
    }
}

/**
 * @hidden
 */
export function getIdField<T>(classType: ClassType<T>): string | undefined {
    return getEntitySchema(classType).idField;
}

/**
 * @hidden
 */
export function getIdFieldValue<T>(classType: ClassType<T>, target: any): any {
    const id = getIdField(classType);
    return id ? target[id] : undefined;
}

/**
 * @hidden
 */
export function getDecorator<T>(classType: ClassType<T>): string | undefined {
    return getEntitySchema(classType).decorator;
}

/**
 * @hidden
 */
export function getRegisteredProperties<T>(classType: ClassType<T>): string[] {
    return getEntitySchema(classType).propertyNames;
}

/**
 * @hidden
 */
export function isArrayType<T>(classType: ClassType<T>, property: string): boolean {
    return getEntitySchema(classType).getProperty(property).isArray;
}

/**
 * @hidden
 */
export function isMapType<T>(classType: ClassType<T>, property: string): boolean {
    return getEntitySchema(classType).getProperty(property).isMap;
}

/**
 * @hidden
 */
export function isEnumAllowLabelsAsValue<T>(classType: ClassType<T>, property: string): boolean {
    return getEntitySchema(classType).getProperty(property).allowLabelsAsValue;
}

/**
 * @hidden
 */
export function isExcluded<T>(classType: ClassType<T>, property: string, wantedTarget: 'mongo' | 'plain'): boolean {
    const mode = getEntitySchema(classType).getProperty(property).exclude;

    if ('all' === mode) {
        return true;
    }

    return mode === wantedTarget;
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = getEntitySchema(classType).name;

    if (!name) {
        throw new Error('No @Entity() defined for class ' + classType);
    }

    return name;
}

/**
 * @hidden
 */
export function getDatabaseName<T>(classType: ClassType<T>): string | undefined {
    return getEntitySchema(classType).databaseName;
}

/**
 * @hidden
 */
export function getCollectionName<T>(classType: ClassType<T>): string | undefined {
    return getEntitySchema(classType).collectionName;
}

/**
 * @hidden
 */
export function applyDefaultValues<T>(classType: ClassType<T>, value: { [name: string]: any }): object {
    if (!isObject(value)) return {};

    const valueWithDefaults = value;
    const instance = plainToClass(classType, value);
    const entitySchema = getEntitySchema(classType);

    for (const [i, v] of eachPair(entitySchema.properties)) {
        if (undefined === value[i] || null === value[i]) {
            const decoratedProp = v.getForeignClassDecorator();
            if (decoratedProp) {
                valueWithDefaults[i] = (instance as any)[i][decoratedProp.name];
            } else {
                valueWithDefaults[i] = (instance as any)[i];
            }
        }
    }

    return valueWithDefaults;
}
