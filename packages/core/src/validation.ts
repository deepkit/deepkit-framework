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

export class RequiredValidator implements PropertyValidator {
    async validate<T>(value: any, target: ClassType<T>, propertyName: string): Promise<PropertyValidatorError | void> {
        if (undefined === value) {
            return new PropertyValidatorError('Required value is undefined');
        }
    }
}

export function Optional() {
    return (target: Object, propertyName: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(propertyName).isOptional = true;
    };
}

export function isOptional<T>(classType: ClassType<T>, propertyName: string): boolean {
    return getOrCreateEntitySchema(classType).getOrCreateProperty(propertyName).isOptional;
}

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

export async function validate<T>(classType: ClassType<T>, item: { [name: string]: any }, path?: string): Promise<ValidationError[]> {
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
        const {type, typeValue} = getReflectionType(classType, propertyName);
        const propertyPath = path ? path + '.' + propertyName : propertyName;
        const validators = schema.getProperty(propertyName).validators;
        const propertyValue: any = item[propertyName];
        const array = isArrayType(classType, propertyName);
        const map = isMapType(classType, propertyName);

        if (!isOptional(classType, propertyName)) {
            await handleValidator(RequiredValidator, propertyValue, propertyName, propertyPath);
        }

        if (undefined === propertyValue) {
            //there's no need to continue validation without a value.
            continue;
        }

        if (array) {
            if (!isArray(propertyValue)) {
                errors.push(ValidationError.createInvalidType(propertyPath, 'array', propertyValue));
                continue;
            }
        } else {
            if (type === 'class' || map) {
                if (!isObject(propertyValue)) {
                    errors.push(ValidationError.createInvalidType(propertyPath, 'object', propertyValue));
                    continue;
                }
            }
        }

        for (const validatorType of validators) {
            await handleValidator(validatorType, propertyValue, propertyName, propertyPath);
        }

        if (type === 'class') {
            if (map || array) {
                if (array && !isArray(propertyValue)) continue;
                if (map && !isObject(propertyValue)) continue;

                for (const i in propertyValue) {
                    const deepPropertyPath = propertyPath + '.' + i;
                    errors.push(...await validate(typeValue, propertyValue[i], deepPropertyPath));
                }
            } else {
                //deep validation
                errors.push(...await validate(typeValue, propertyValue, propertyPath));
            }
        }
    }

    return errors;
}
