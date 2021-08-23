/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CustomError } from '@deepkit/core';
import { ClassSchema, createClassSchema, getClassSchema, PropertySchema, } from './model';
import { jitValidate, jitValidateProperty, ValidationFailedItem } from './jit-validation';
import { ExtractClassType, PlainOrFullEntityFromClassTypeOrSchema } from './utils';

/**
 *
 */
export class ValidationFailed extends CustomError {
    constructor(public readonly errors: ValidationFailedItem[]) {
        super('Validation failed: ' + (errors.map(e => e.toString()).join(', ')));
    }

    static from(errors: { path: string, message: string, code?: string }[]) {
        return new ValidationFailed(errors.map(v => new ValidationFailedItem(v.path, v.code || '', v.message)));
    }
}

createClassSchema(ValidationFailed)
    .registerProperty(new PropertySchema('message').setType('string').setOptional(false))
    .registerProperty(new PropertySchema('errors').setType('array').setTemplateArgs(new PropertySchema('v').setFromJSType(ValidationFailedItem)));

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
 *
 * Returns an empty array if not errors found and validation succeeded.
 *
 * Note: You want probably to pass as `item` the deserialized structure, like `validate(T, plainToClass(T, jsonObject))`.
 *
 * @example
 * ```
 * validate(SimpleModel, {id: false});
 * ```
 */
export function validate<T extends ClassType | ClassSchema>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>, path?: string): ValidationFailedItem[] {
    const v = jitValidate(classType);
    return v(item, path);
}


/**
 * Same as `validate` but as prepared JIT function.
 */
export function validateFactory<T extends ClassType | ClassSchema>(classType: T) {
    return jitValidate(classType);
}

/**
 * A type guarded way of using deepkit/type.
 *
 * Note: Methods are not type guarded.
 *
 * @example
 * ```
 * if (validates(SimpleMode, item)) {
 *     //data is now typeof SimpleMode
 * }
 * ```
 */
export function validates<T extends ClassType | ClassSchema>(classType: T, item: PlainOrFullEntityFromClassTypeOrSchema<T>): item is ExtractClassType<T> {
    const v = jitValidate(classType);
    return v(item).length === 0;
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

