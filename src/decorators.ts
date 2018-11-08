import {Types} from "./mapper";
import {ClassType} from "./utils";
import {AddValidator, PropertyValidator, PropertyValidatorError} from "./validation";

export function Entity(name: string, collectionName?: string) {
    return (target) => {
        Reflect.defineMetadata('marshaller:entityName', name, target);
        Reflect.defineMetadata('marshaller:collectionName', collectionName || (name + 's'), target);
    };
}

export function DatabaseName(name: string) {
    return (target) => {
        Reflect.defineMetadata('marshaller:databaseName', name, target);
    };
}

export function Decorator() {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataDecorator', property, target);
    };
}

export function ID() {
    return (target, property) => {
        registerProperty(target, property);
        Reflect.defineMetadata('marshaller:idField', property, target);
    };
}

/**
 * Exclude in *toMongo and *toPlain.
 */
export function Exclude() {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:exclude', 'all', target, property);
    };
}

export function ExcludeToMongo() {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:exclude', 'mongo', target, property);
    };
}

export function ExcludeToPlain() {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:exclude', 'plain', target, property);
    };
}

export function registerProperty(target, property) {
    const properties = Reflect.getMetadata('marshaller:properties', target) || [];
    if (-1 === properties.indexOf(property)) {
        properties.push(property);
    }

    Reflect.defineMetadata('marshaller:properties', properties, target);
}


export function Type(type: Types) {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataType', type, target, property);
        registerProperty(target, property);
    };
}

export function ArrayType() {
    return (target, property) => {
        class Validator implements PropertyValidator {
            async validate<T>(value, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void> {
                if (!Array.isArray(value)) {
                    return new PropertyValidatorError('No Array given');
                }
            }
        }

        AddValidator(Validator)(target, property);
        registerProperty(target, property);
        Reflect.defineMetadata('marshaller:isArray', true, target, property);
    };
}

export function MapType() {
    return (target, property) => {

        class Validator implements PropertyValidator {
            async validate<T>(value, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void> {
                console.log('map', property, typeof value);
                if ('object' !== typeof value) {
                    return new PropertyValidatorError('No Map given');
                }
            }
        }


        AddValidator(Validator)(target, property);
        registerProperty(target, property);
        Reflect.defineMetadata('marshaller:isMap', true, target, property);
    };
}

export function Class<T>(classType: ClassType<T>) {
    return (target, property) => {
        Type('class')(target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

export function ClassMap<T>(classType: ClassType<T>) {
    return (target, property) => {
        Class(classType)(target, property);
        MapType()(target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

export function ClassArray<T>(classType: ClassType<T>) {
    return (target, property) => {
        Class(classType)(target, property);
        ArrayType()(target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', classType, target, property);
    };
}

function concat(...decorators: ((target, property) => void)[]) {
    return (target, property) => {
        for (const decorator of decorators) {
            decorator(target, property);
        }
    }
}

export function MongoIdType() {
    return Type('objectId');
}

export function UUIDType() {
    return Type('uuid');
}

export function DateType() {
    return Type('date');
}

export function StringType() {
    class Validator implements PropertyValidator {
        async validate<T>(value, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void> {
            if ('string' !== typeof value) {
                return new PropertyValidatorError('No String given');
            }
        }
    }

    return concat(AddValidator(Validator), Type('string'));
}

export function AnyType() {
    return Type('any');
}

export function NumberType() {
    class Validator implements PropertyValidator {
        async validate<T>(value, target: ClassType<T>, property: string): Promise<PropertyValidatorError | void> {
            value = parseFloat(value);

            if (!Number.isFinite(value)) {
                return new PropertyValidatorError('No Number given');
            }
        }
    }

    return concat(AddValidator(Validator), Type('number'));
}

export function BooleanType() {
    return Type('boolean');
}

export function EnumType(type, allowLabelsAsValue = false) {
    return (target, property) => {
        Type('enum')(target, property);
        Reflect.defineMetadata('marshaller:dataTypeValue', type, target, property);
        Reflect.defineMetadata('marshaller:enum:allowLabelsAsValue', allowLabelsAsValue, target, property);
    }
}
