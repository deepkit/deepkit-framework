import {ClassType, isArray, isObject, typeOf, eachKey} from "@marcj/estdlib";
import {applyDefaultValues, getRegisteredProperties} from "./mapper";
import {getEntitySchema, getOrCreateEntitySchema, PropertySchema, PropertyValidator} from "./decorators";

function addValidator<T extends PropertyValidator>(target: Object, property: string, validator: ClassType<T>) {
    getOrCreateEntitySchema(target).getOrCreateProperty(property).validators.push(validator);
}

export class PropertyValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
    ) {
    }
}

/**
 * Decorator to add a custom validator class.
 *
 * @example
 * ```typescript
 * import {PropertyValidator} from '@marcj/marshal';
 *
 * class MyCustomValidator implements PropertyValidator {
 *      async validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void {
 *          if (value.length > 10) {
 *              return new PropertyValidatorError('too_long', 'Too long :()');
 *          }
 *      };
 * }
 *
 * class Entity {
 *     @Field()
 *     @AddValidator(MyCustomValidator)
 *     name: string;
 * }
 *
 * ```
 *
 * @category Decorator
 */
export function AddValidator<T extends PropertyValidator>(validator: ClassType<T>) {
    return (target: Object, property: string) => {
        addValidator(target, property, validator);
    };
}

/**
 * Decorator to add a custom inline validator.
 *
 * @example
 * ```typescript
 * class Entity {
 *     @Field()
 *     @InlineValidator(async (value: any) => {
 *          if (value.length > 10) {
 *              return new PropertyValidatorError('too_long', 'Too long :()');
 *          }
 *     }))
 *     name: string;
 * }
 * ```
 * @category Decorator
 */
export function InlineValidator<T extends PropertyValidator>(cb: (value: any, target: ClassType<any>, propertyName: string) => PropertyValidatorError | void) {
    return (target: Object, property: string) => {
        addValidator(target, property, class implements PropertyValidator {
            validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void {
                try {
                    return cb(value, target, propertyName);
                } catch (error) {
                    return new PropertyValidatorError('error', error.message ? error.message : error);
                }
            }
        });
    };
}

/**
 * @hidden
 */
export class NumberValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        value = parseFloat(value);

        if (!Number.isFinite(value)) {
            return new PropertyValidatorError('invalid_number', 'No Number given');
        }
    }
}

/**
 * @hidden
 */
export class StringValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        if ('string' !== typeof value) {
            return new PropertyValidatorError('invalid_string', 'No String given');
        }
    }
}

/**
 * @hidden
 */
export class DateValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        if (value instanceof Date) {
            if (isNaN(new Date(value).getTime())) {
                return new PropertyValidatorError('invalid_date', 'No valid Date given');
            }

            return;
        }

        if ('string' !== typeof value || !value) {
            return new PropertyValidatorError('invalid_date', 'No Date string given');
        }

        if (isNaN(new Date(value).getTime())) {
            return new PropertyValidatorError('invalid_date', 'No valid Date string given');
        }
    }
}

/**
 * @hidden
 */
export class RequiredValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void {
        if (undefined === value) {
            return new PropertyValidatorError('required', 'Required value is undefined');
        }

        if (null === value) {
            //todo, we should add a decorator that allows to place null values.
            return new PropertyValidatorError('required', 'Required value is null');
        }
    }
}

/**
 * Used to mark a field as optional. The validation requires field values per default, this makes it optional.
 *
 * @category Decorator
 */
export function Optional() {
    return (target: Object, propertyName: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(propertyName).isOptional = true;
    };
}

/**
 * @hidden
 */
export function isOptional<T>(classType: ClassType<T>, propertyName: string): boolean {
    return getOrCreateEntitySchema(classType).getOrCreateProperty(propertyName).isOptional;
}

/**
 * The structure of a validation error.
 *
 * Path defines the shallow or deep path (using dots).
 * Message is an arbitrary message in english.
 */
export class ValidationError {
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

    static createInvalidType(path: string, expectedType: string, actual: any) {
        return new ValidationError(path, 'invalid_type', `Invalid type. Expected ${expectedType}, but got ${typeOf(actual)}`);
    }
}

/**
 *
 */
export class ValidationFailed {
    constructor(public readonly errors: ValidationError[]) {}
}

/**
 * Validates a object or class instance and returns all errors.
 *
 * @example
 * ```
 * validate(SimpleModel, {id: false});
 * ```
 */
export function validate<T>(classType: ClassType<T>, item: { [name: string]: any } | T, path?: string): ValidationError[] {
    const properties = getRegisteredProperties(classType);
    const errors: ValidationError[] = [];
    const schema = getEntitySchema(classType);

    if (!(item instanceof classType)) {
        item = applyDefaultValues(classType, item as object);
    }

    function handleValidator(
        propSchema: PropertySchema,
        validatorType: ClassType<PropertyValidator>,
        value: any,
        propertyName: string,
        propertyPath: string
    ): boolean {
        const instance = new validatorType;

        if (propSchema.isArray && isArray(value) || (propSchema.isMap && isObject(value))) {
            for (const i of eachKey(value)) {
                if ('string' !== typeof value[i]) {
                    const result = instance.validate(value[i], classType, propertyName, propSchema);

                    if (result instanceof PropertyValidatorError) {
                        errors.push(new ValidationError(propertyPath + '.' + i, result.code, result.message));
                    }
                }
            }
        } else {
            const result = instance.validate(value, classType, propertyName, propSchema);
            if (result instanceof PropertyValidatorError) {
                errors.push(new ValidationError(propertyPath, result.code, result.message));
                return true;
            }
        }

        return false;
    }

    for (const propertyName of properties) {
        const propSchema = getEntitySchema(classType).getProperty(propertyName);

        const propertyPath = path ? path + '.' + propertyName : propertyName;
        const validators = schema.getProperty(propertyName).getValidators();
        const propertyValue: any = item[propertyName];

        if (!isOptional(classType, propertyName)) {
            if (handleValidator(propSchema, RequiredValidator, propertyValue, propertyName, propertyPath)) {
                //there's no need to continue validation without a value.
                continue;
            }
        }

        if (undefined === propertyValue) {
            //there's no need to continue validation without a value.
            continue;
        }

        if (propSchema.isArray) {
            if (!isArray(propertyValue)) {
                errors.push(ValidationError.createInvalidType(propertyPath, 'array', propertyValue));
                continue;
            }
        } else {
            if (propSchema.type === 'class' || propSchema.isMap) {
                if (!isObject(propertyValue)) {
                    errors.push(ValidationError.createInvalidType(propertyPath, 'object', propertyValue));
                    continue;
                }
            }
        }

        for (const validatorType of validators) {
            handleValidator(propSchema, validatorType, propertyValue, propertyName, propertyPath);
        }

        if (propSchema.type === 'class') {
            if (propSchema.isMap || propSchema.isArray) {
                if (propSchema.isArray && !isArray(propertyValue)) continue;
                if (propSchema.isMap && !isObject(propertyValue)) continue;

                for (const i in propertyValue) {
                    const deepPropertyPath = propertyPath + '.' + i;
                    errors.push(...validate(propSchema.getResolvedClassType(), propertyValue[i], deepPropertyPath));
                }
            } else {
                //deep validation
                errors.push(...validate(propSchema.getResolvedClassType(), propertyValue, propertyPath));
            }
        }
    }

    return errors;
}
