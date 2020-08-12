import {validate, ValidationFailed} from './validation';
import {ClassSchema, getClassSchema, getClassTypeFromInstance, PropertySchema} from './decorators';
import {ClassType, getClassName} from '@super-hornet/core';
import {createJITConverterFromPropertySchema, jitClassToPlain, JitConverterOptions, jitPartialClassToPlain, jitPartialPlainToClass, jitPlainToClass} from './jit';
import {PlainOrFullEntityFromClassTypeOrSchema, ExtractClassType, JSONPartial} from './utils';

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
 * Converts a single property value.
 */
export function propertyClassToPlain<T>(classType: ClassType<T>, propertyName: string, propertyValue: any, propertySchema?: PropertySchema) {
    return createJITConverterFromPropertySchema('class', 'plain', propertySchema || getClassSchema(classType).getProperty(propertyName))(propertyValue);
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
export function cloneClass<T>(target: T, options?: JitConverterOptions): T {
    return plainToClass(getClassTypeFromInstance(target) as ClassType<T>, classToPlain(getClassTypeFromInstance(target), target), options);
}

/**
 * Converts a class instance into a plain object, which can be used with JSON.stringify() to convert it into a JSON string.
 */
export function classToPlain<T>(classType: ClassType<T> | ClassSchema<T>, target: T, options?: JitConverterOptions): any {
    return jitClassToPlain(classType)(target, options);
}

/**
 * Takes a regular object with partial fields defined of classType and converts only them into the class variant.
 *
 * Returns a new regular object again.
 */
export function partialPlainToClass<T, R extends object>(
    classType: ClassType<T>,
    partial: R,
    options?: JitConverterOptions
) {
    return jitPartialPlainToClass(classType, partial, options);
}


/**
 * Takes a object with partial class fields defined of classType and converts only them into the plain variant.
 *
 * Returns a new regular object again.
 */
export function partialClassToPlain<T, R extends object>(
    classType: ClassType<T>,
    partial: R,
    options?: JitConverterOptions
) {
    return jitPartialClassToPlain(classType, partial, options);
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
export function plainToClass<T extends ClassType<any> | ClassSchema<any>>(
    classType: T,
    data: PlainOrFullEntityFromClassTypeOrSchema<ExtractClassType<T>>,
    options?: JitConverterOptions
): ExtractClassType<T> {
    return jitPlainToClass(classType)(data, options);
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
export function validatedPlainToClass<T extends ClassType<any> | ClassSchema<any>>(
    classType: T,
    data: PlainOrFullEntityFromClassTypeOrSchema<ExtractClassType<T>>,
    options?: JitConverterOptions
): T {
    const errors = validate(classType, data);
    if (errors.length) {
        throw new ValidationFailed(errors);
    }

    return plainToClass(classType, data, options);
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
export function isExcluded<T>(schema: ClassSchema<T>, property: string, wantedTarget: string): boolean {
    const mode = schema.getProperty(property).exclude;

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
