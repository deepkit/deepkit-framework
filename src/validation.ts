import {ClassType, eachKey, getClassName, isArray, isObject, isPlainObject, typeOf, eachPair} from "@marcj/estdlib";
import {applyDefaultValues, getRegisteredProperties, getResolvedReflection} from "./mapper";
import {
    getClassSchema,
    getClassTypeFromInstance,
    getOrCreateEntitySchema,
    PropertySchema,
    PropertyValidator,
} from "./decorators";

export class PropertyValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
    ) {
    }
}

/**
 * @hidden
 */
export class BooleanValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        if ('boolean' !== typeof value) {
            if (value === '1' || value === '0' || value === 'true' || value === 'false' || value === 0 || value === 1) {
                return;
            }

            return new PropertyValidatorError('invalid_boolean', 'No Boolean given');
        }
    }
}


const objectIdValidation = new RegExp(/^[a-fA-F0-9]{24}$/);

/**
 * @hidden
 */
export class ObjectIdValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        if ('string' !== typeof value) {
            return new PropertyValidatorError('invalid_objectid', 'No Mongo ObjectID given');
        }

        if (!value.match(objectIdValidation)) {
            return new PropertyValidatorError('invalid_objectid', 'No Mongo ObjectID given');
        }
    }
}

const uuidValidation = new RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

/**
 * @hidden
 */
export class UUIDValidator implements PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string, propertySchema: PropertySchema): PropertyValidatorError | void {
        if ('string' !== typeof value) {
            return new PropertyValidatorError('invalid_uuid', 'No UUID given');
        }

        if (!value.match(uuidValidation)) {
            return new PropertyValidatorError('invalid_uuid', 'No UUID given');
        }
    }
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
 * @hidden
 */
export function isOptional<T>(classType: ClassType<T>, propertyName: string): boolean {
    return getOrCreateEntitySchema(classType).getProperty(propertyName).isOptional;
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
    constructor(public readonly errors: ValidationError[]) {
    }
}

function handleValidator<T>(
    classType: ClassType<T>,
    propSchema: PropertySchema,
    validatorType: ClassType<PropertyValidator>,
    value: any,
    propertyName: string,
    propertyPath: string,
    errors: ValidationError[]
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

export function validatePropSchema<T>(
    classType: ClassType<T>,
    propSchema: PropertySchema,
    errors: ValidationError[],
    propertyValue: any,
    propertyName: string,
    propertyPath: string,
    fromObjectLiteral: boolean = false
) {
    if (propSchema.type === 'any') {
        //any can be anything, nothing to check here.
        return;
    }

    if (!propSchema.isOptional) {
        if (handleValidator(classType, propSchema, RequiredValidator, propertyValue, propertyName, propertyPath, errors)) {
            //there's no need to continue validation without a value.
            return;
        }
    }

    if (undefined === propertyValue || null === propertyValue) {
        //there's no need to continue validation without a value.
        return;
    }

    if (propSchema.type === 'class') {
        const targetEntitySchema = getClassSchema(propSchema.getResolvedClassType());
        if (targetEntitySchema.decorator && fromObjectLiteral) {
            //the required type is actual the type of the decorated field
            //when we come from objectLiteral (from JSON)
            propSchema = targetEntitySchema.getDecoratedPropertySchema();
        }
    }

    const validators = propSchema.getValidators();

    if (propSchema.isArray) {
        if (!isArray(propertyValue)) {
            errors.push(ValidationError.createInvalidType(propertyPath, 'array', propertyValue));
            return;
        }
    } else {
        if (propSchema.type === 'class' || propSchema.isMap || propSchema.isPartial) {
            if (!isObject(propertyValue)) {
                errors.push(ValidationError.createInvalidType(propertyPath, 'object', propertyValue));
                return;
            }
        }
    }

    for (const validatorType of validators) {
        handleValidator(classType, propSchema, validatorType, propertyValue, propertyName, propertyPath, errors);
    }

    if (propSchema.type === 'class') {
        if (propSchema.isMap || propSchema.isArray) {
            for (const i in propertyValue) {
                const deepPropertyPath = propertyPath + '.' + i;
                errors.push(...validate(propSchema.getResolvedClassType(), propertyValue[i], deepPropertyPath));
            }
        } else if (propSchema.isPartial) {
            errors.push(...partialValidate(propSchema.getResolvedClassType(), propertyValue, propertyPath));
        } else {
            //deep validation
            errors.push(...validate(propSchema.getResolvedClassType(), propertyValue, propertyPath));
        }
    }
}

/**
 * Validates a set of method arguments and returns the number of errors found.
 */
export function validateMethodArgs<T>(classType: ClassType<T>, methodName: string, args: any[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const properties = getClassSchema(classType).getMethodProperties(methodName);

    for (const [i, property] of eachPair(properties)) {
        validatePropSchema(
            classType,
            property,
            errors,
            args[i],
            String(i),
            '#' + String(i),
            false
        );
    }

    return errors;
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
    const schema = getClassSchema(classType);
    let fromObjectLiteral = false;

    if (!schema.decorator) {
        if (isPlainObject(item)) {
            fromObjectLiteral = true;
            item = applyDefaultValues(classType, item as object);
        } else if (isObject(item) && !(item instanceof classType)) {
            throw new Error(`Given item is from the wrong class type. Expected ${getClassName(classType)}, got ${getClassTypeFromInstance(item)}.`)
        }
    }


    for (const propertyName of properties) {
        let propertyPath = path ? path + '.' + propertyName : propertyName;

        if (schema.decorator) {
            //when classType is a decorator, we only check the decorated field
            //and omit that field name in the propertyPath.
            if (schema.decorator !== propertyName) {
                continue;
            }

            propertyPath = path ? path : '';
        }

        validatePropSchema(
            classType,
            schema.getProperty(propertyName),
            errors,
            item[propertyName],
            propertyName,
            propertyPath,
            fromObjectLiteral
        );
    }

    return errors;
}

/**
 * Validates a Partial<T> object.
 */
export function partialValidate<T>(classType: ClassType<T>, item: Partial<T>, path?: string): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const propertyName of eachKey(item)) {
        const reflection = getResolvedReflection(classType, propertyName);
        if (!reflection) continue;

        let propertyPath = path ? path + '.' + propertyName : propertyName;

        const propertySchema = reflection.propertySchema.clone();
        propertySchema.isArray = reflection.array;
        propertySchema.isMap = reflection.map;
        propertySchema.isPartial = reflection.partial;

        validatePropSchema(
            classType,
            propertySchema,
            errors,
            item[propertyName],
            propertyName,
            propertyPath,
            false,
        );
    }

    return errors;
}
