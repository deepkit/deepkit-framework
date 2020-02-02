import {validate, ValidationFailed} from "./validation";
import {getClassSchema, getClassTypeFromInstance} from "./decorators";
import {ClassType, eachKey, getClassName, isObject} from "@marcj/estdlib";
import {
    createJITConverterFromPropertySchema,
    jitClassToPlain,
    jitPartialClassToPlain,
    jitPartialPlainToClass,
    jitPlainToClass
} from "./jit";

/**
 * Converts a argument of a method from class to plain.
 */
export function argumentClassToPlain<T>(classType: ClassType<T>, methodName: string, argument: number, value: any): any {
    const schema = getClassSchema(classType);
    return createJITConverterFromPropertySchema('class', 'plain', schema.getMethodProperties(methodName)[argument])(value);
}

/**
 * Converts a result type of a method from class to plain.
 */
export function methodResultClassToPlain<T>(classType: ClassType<T>, methodName: string, value: any): any {
    const schema = getClassSchema(classType);
    return createJITConverterFromPropertySchema('class', 'plain', schema.getMethod(methodName))(value);
}

/**
 * Converts an argument of a method from class to plain.
 */
export function argumentPlainToClass<T>(classType: ClassType<T>, methodName: string, argument: number, value: any): any {
    const schema = getClassSchema(classType);
    return createJITConverterFromPropertySchema('plain', 'class', schema.getMethodProperties(methodName)[argument])(value);
}

/**
 * Converts a result type of a method from class to plain.
 */
export function methodResultPlainToClass<T>(classType: ClassType<T>, methodName: string, value: any): any {
    const schema = getClassSchema(classType);
    return createJITConverterFromPropertySchema('plain', 'class', schema.getMethod(methodName))(value);
}

/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, parents?: any[]): T {
    return plainToClass(getClassTypeFromInstance(target), classToPlain(getClassTypeFromInstance(target), target), parents);
}

/**
 * Converts a class instance into a plain object, which can be used with JSON.stringify() to convert it into a JSON string.
 */
export function classToPlain<T>(classType: ClassType<T>, target: T, options?: { excludeReferences?: boolean }): any {
    //todo use options again?
    return jitClassToPlain(classType, target);
}


/**
 * Takes a regular object with partial fields defined of classType and converts only them into the class variant.
 *
 * Returns a new regular object again.
 */
export function partialPlainToClass<T, K extends keyof T>(classType: ClassType<T>, target: { [path: string]: any }, parents?: any[]): Partial<{ [F in K]: any }> {
    return jitPartialPlainToClass(classType, target, parents);
}


/**
 * Takes a object with partial class fields defined of classType and converts only them into the plain variant.
 *
 * Returns a new regular object again.
 */
export function partialClassToPlain<T, K extends keyof T>(classType: ClassType<T>, target: { [path: string]: any }): Partial<{ [F in K]: any }> {
    return jitPartialClassToPlain(classType, target);
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
    return jitPlainToClass(classType, data, parents);
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
    return getClassSchema(classType).idField;
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
    return getClassSchema(classType).decorator;
}

/**
 * @hidden
 */
export function getRegisteredProperties<T>(classType: ClassType<T>): string[] {
    return getClassSchema(classType).propertyNames;
}

/**
 * @hidden
 */
export function isArrayType<T>(classType: ClassType<T>, property: string): boolean {
    return getClassSchema(classType).getProperty(property).isArray;
}

/**
 * @hidden
 */
export function isMapType<T>(classType: ClassType<T>, property: string): boolean {
    return getClassSchema(classType).getProperty(property).isMap;
}

/**
 * @hidden
 */
export function isEnumAllowLabelsAsValue<T>(classType: ClassType<T>, property: string): boolean {
    return getClassSchema(classType).getProperty(property).allowLabelsAsValue;
}

/**
 * @hidden
 */
export function isExcluded<T>(classType: ClassType<T>, property: string, wantedTarget: string): boolean {
    const mode = getClassSchema(classType).getProperty(property).exclude;

    if ('all' === mode) {
        return true;
    }

    return mode === wantedTarget;
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = getClassSchema(classType).name;

    if (!name) {
        throw new Error('No @Entity() defined for class ' + getClassName(classType));
    }

    return name;
}

/**
 * @hidden
 */
export function getDatabaseName<T>(classType: ClassType<T>): string | undefined {
    return getClassSchema(classType).databaseName;
}

/**
 * @hidden
 */
export function getCollectionName<T>(classType: ClassType<T>): string | undefined {
    return getClassSchema(classType).collectionName;
}

/**
 * @hidden
 */
export function applyDefaultValues<T>(classType: ClassType<T>, value: { [name: string]: any }): object {
    if (!isObject(value)) return {};

    const valueWithDefaults = value;
    const instance = plainToClass(classType, value);
    const entitySchema = getClassSchema(classType);

    for (const [i, v] of entitySchema.getClassProperties().entries()) {
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
