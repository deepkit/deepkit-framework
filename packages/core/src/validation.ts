import {ClassType} from "./utils";
import {applyDefaultValues, getReflectionType, getRegisteredProperties, isArrayType, isMapType} from "./mapper";

export function addValidator<T>(target: Object, property: string, validator: ClassType<T>) {
    const validators = Reflect.getMetadata('marshal:validators', target, property) || [];
    if (-1 === validators.indexOf(validator)) {
        validators.push(validator);
    }

    Reflect.defineMetadata('marshal:validators', validators, target, property);
}

export class PropertyValidatorError {
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}

export interface PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void>;
}

export function getValidators<T>(classType: ClassType<T>, propertyName: string): ClassType<PropertyValidator>[] {
    return Reflect.getMetadata('marshal:validators', classType.prototype, propertyName) || [];
}

export function AddValidator<T>(validator: ClassType<T>) {
    return (target: Object, property: string) => {
        addValidator(target, property, validator);
    };
}

export class RequiredValidator implements PropertyValidator {
    async validate<T>(value: any, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void> {
        if (undefined === value) {
            return new PropertyValidatorError('No value given');
        }
    }
}

export function Optional() {
    return (target: Object, property: string) => {
        Reflect.defineMetadata('marshal:isOptional', true, target, property);
    };
}

export function isOptional<T>(classType: ClassType<T>, property: string): boolean {
    return Reflect.getMetadata('marshal:isOptional', classType.prototype, property) || false;
}

export class ValidationError {
    path: string;
    message: string;

    constructor(path: string, message: string) {
        this.path = path;
        this.message = message;
    }
}

export async function validate<T>(classType: ClassType<T>, item: {[name: string]: any}, path?: string): Promise<ValidationError[]> {
    const properties = getRegisteredProperties(classType);
    const errors: ValidationError[] = [];

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
        const validators = getValidators(classType, propertyName);
        const propertyValue: any = item[propertyName];

        if (!isOptional(classType, propertyName)) {
            await handleValidator(RequiredValidator, propertyValue, propertyName,  propertyPath);
        }

        if (undefined === propertyValue) {
            //there's no need to continue validation without a value.
            continue;
        }

        if (type === 'class') {
            if (isMapType(classType, propertyName) || isArrayType(classType, propertyName)) {
                for (const i in propertyValue) {
                    const deepPropertyPath = propertyPath + '.' + i;
                    errors.push(...await validate(typeValue, propertyValue[i], deepPropertyPath));
                }
            } else {
                //deep validation
                errors.push(...await validate(typeValue, propertyValue, propertyPath));
            }
        } else {
            for (const validatorType of validators) {
                await handleValidator(validatorType, propertyValue, propertyName, propertyPath);
            }
        }
    }

    return errors;
}