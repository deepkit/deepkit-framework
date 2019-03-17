import {ClassType, isArray, isObject, typeOf} from "@marcj/estdlib";
import {applyDefaultValues, getReflectionType, getRegisteredProperties, isArrayType, isMapType} from "./mapper";
import {getEntitySchema, getOrCreateEntitySchema, PropertyValidator} from "./decorators";

export function addValidator<T extends PropertyValidator>(target: Object, property: string, validator: ClassType<T>) {
    getOrCreateEntitySchema(target).getOrCreateProperty(property).validators.push(validator);
}

export class PropertyValidatorError {
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}

export function AddValidator<T extends PropertyValidator>(validator: ClassType<T>) {
    return (target: Object, property: string) => {
        addValidator(target, property, validator);
    };
}

/**
 * @hidden
 */
export class NumberValidator implements PropertyValidator {
    async validate<T>(value: any, target: Object, property: string): Promise<PropertyValidatorError | void> {
        value = parseFloat(value);

        if (!Number.isFinite(value)) {
            return new PropertyValidatorError('No Number given');
        }
    }
}

/**
 * @hidden
 */
export class StringValidator implements PropertyValidator {
    async validate<T>(value: any, target: Object, property: string): Promise<PropertyValidatorError | void> {
        if ('string' !== typeof value) {
            return new PropertyValidatorError('No String given');
        }
    }
}

/**
 * @hidden
 */
export class RequiredValidator implements PropertyValidator {
    async validate<T>(value: any, target: ClassType<T>, propertyName: string): Promise<PropertyValidatorError | void> {
        if (undefined === value) {
            return new PropertyValidatorError('Required value is undefined');
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
    path: string;
    message: string;

    constructor(path: string, message: string) {
        this.path = path;
        this.message = message;
    }

    static createInvalidType(path: string, expectedType: string, actual: any) {
        return new ValidationError(path, `Invalid type. Expected ${expectedType}, but got ${typeOf(actual)}`);
    }
}

/**
 * Validates a object or class instance and returns all errors.
 *
 * @example
 * ```
 * validate(SimpleModel, {id: false});
 * ```
 */
export async function validate<T>(classType: ClassType<T>, item: { [name: string]: any } | T, path?: string): Promise<ValidationError[]> {
    const properties = getRegisteredProperties(classType);
    const errors: ValidationError[] = [];
    const schema = getEntitySchema(classType);

    if (!(item instanceof classType)) {
        item = applyDefaultValues(classType, item as object);
    }

    async function handleValidator(
        validatorType: ClassType<PropertyValidator>,
        value: any,
        propertyName: string,
        propertyPath: string
    ): Promise<boolean> {
        const instance = new validatorType;
        const result = await instance.validate(value, classType, propertyName);
        if (result instanceof PropertyValidatorError) {
            errors.push(new ValidationError(propertyPath, result.message));
            return true;
        }

        return false;
    }

    for (const propertyName of properties) {
        const propSchema = getEntitySchema(classType).getProperty(propertyName);

        const propertyPath = path ? path + '.' + propertyName : propertyName;
        const validators = schema.getProperty(propertyName).getValidators();
        const propertyValue: any = item[propertyName];

        if (!isOptional(classType, propertyName)) {
            await handleValidator(RequiredValidator, propertyValue, propertyName, propertyPath);
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
            await handleValidator(validatorType, propertyValue, propertyName, propertyPath);
        }

        if (propSchema.type === 'class') {
            if (propSchema.isMap || propSchema.isArray) {
                if (propSchema.isArray && !isArray(propertyValue)) continue;
                if (propSchema.isMap && !isObject(propertyValue)) continue;

                for (const i in propertyValue) {
                    const deepPropertyPath = propertyPath + '.' + i;
                    errors.push(...await validate(propSchema.getResolvedClassType(), propertyValue[i], deepPropertyPath));
                }
            } else {
                //deep validation
                errors.push(...await validate(propSchema.getResolvedClassType(), propertyValue, propertyPath));
            }
        }
    }

    return errors;
}
