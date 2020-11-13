/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {ClassType, CustomError} from '@deepkit/core';
import {ClassSchema, getClassSchema, PropertyCompilerSchema, PropertyValidator,} from './decorators';
import {jitValidate, jitValidateProperty} from './jit-validation';
import {ExtractClassType, PlainOrFullEntityFromClassTypeOrSchema} from './utils';

export class PropertyValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
    ) {
    }
}

/**
 * The structure of a validation error.
 *
 * Path defines the shallow or deep path (using dots).
 * Message is an arbitrary message in english.
 */
export class ValidationFailedItem {
    constructor(
        /**
         * The path to the property. May be a deep path separated by dot.
         */
        public readonly path: string,
        /**
         * A lower cased error code that can be used to identify this error and translate.
         */
        public readonly code: string,
        /**
         * Free text of the error.
         */
        public readonly message: string,
    ) {
    }

    toString() {
        return `${this.path}(${this.code}): ${this.message}`;
    }
}

/**
 *
 */
export class ValidationFailed extends CustomError {
    constructor(public readonly errors: ValidationFailedItem[]) {
        super('Validation failed: ' + (errors.map(e => e.toString()).join(', ')));
    }
}

export function handleCustomValidator<T>(
    propSchema: PropertyCompilerSchema,
    validator: PropertyValidator,
    value: any,
    propertyPath: string,
    errors: ValidationFailedItem[],
    classType?: ClassType,
) {
    try {
        validator.validate(value, propSchema.name, classType);
    } catch (error) {
        if (error instanceof PropertyValidatorError) {
            errors.push(new ValidationFailedItem(propertyPath, error.code, error.message || String(error)));
        } else {
            errors.push(new ValidationFailedItem(propertyPath, 'error', error.message || String(error)));
        }
    }
}

/**
 * Validates a set of method arguments and returns the number of errors found.
 */
export function validateMethodArgs<T>(classType: ClassType<T>, methodName: string, args: any[]): ValidationFailedItem[] {
    const errors: ValidationFailedItem[] = [];
    const schema = getClassSchema(classType);

    const properties = schema.getMethodProperties(methodName);

    for (const i in properties) {
        jitValidateProperty(properties[i], classType)(
            args[i],
            '#' + String(i),
            errors
        );
    }

    return errors;
}

/**
 * Validates a object or class instance and returns all errors.
 * Returns an empty array if not errors found and validation succeeded.
 *
 * Warning: If `item` is a plain object this does not check if `item` is exactly of type T, but if it can safely be
 * converted to one using plainToClass. For example `t.string` allows numbers because it can be safely converted to string.
 *
 * @example
 * ```
 * validate(SimpleModel, {id: false});
 * ```
 */
export function validate<T extends ClassType | ClassSchema>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>, path?: string): ValidationFailedItem[] {
    return jitValidate(classType)(item, path);
}


/**
 * Same as `validate` but as prepared JIT function.
 */
export function validateFactory<T extends ClassType | ClassSchema>(classType: T,) {
    return jitValidate(classType);
}

/**
 * A type guarded way of using deepkit/type.
 *
 * Note: Methods are not type guarded.
 *
 * Warning: If `item` is a plain object this does not check if `item` is exactly of type T, but if it can safely be
 * converted to one using plainToClass. For example `t.string` allows numbers because it can be safely converted to string.
 *
 * @example
 * ```
 * if (validates(SimpleMode, item)) {
 *     //data is now typeof SimpleMode
 * }
 * ```
 */
export function validates<T extends ClassType | ClassSchema>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>): item is ExtractClassType<T> {
    return jitValidate(classType)(item).length === 0;
}

/**
 * A type guarded way of using deepkit/type as factory for faster access.
 *
 * Note: Methods are not type guarded.
 *
 * Warning: If `item` is a plain object this does not check if `item` is exactly of type T, but if it can safely be
 * converted to one using deserialize. For example `t.string` allows numbers because it can be safely converted to string.
 *
 * @example
 * ```
 * const simpleModelValidates = validatesFactory(SimpleMode);
 * if (simpleModelValidates(item)) {
 *     //item is now typeof SimpleMode
 * }
 * ```
 */
export function validatesFactory<T extends ClassType | ClassSchema>(classType: T): (item: PlainOrFullEntityFromClassTypeOrSchema<T>) => item is ExtractClassType<T> {
    const validation = jitValidate(classType);
    return (item): item is ExtractClassType<T> => {
        return validation(item).length === 0;
    };
}

