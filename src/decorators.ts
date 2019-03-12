import {Types} from "./mapper";
import {ClassType, getClassName} from "./utils";
import {AddValidator, PropertyValidator, PropertyValidatorError} from "./validation";
import * as clone from 'clone';

export const RegisteredEntities: { [name: string]: ClassType<any> } = {};

export class PropertySchema {
    name: string;
    type: Types = 'any';
    isArray: boolean = false;
    isMap: boolean = false;
    isDecorated: boolean = false;
    isParentReference: boolean = false;
    isId: boolean = false;

    /**
     * For enums.
     */
    allowLabelsAsValue: boolean = false;

    exclude?: 'all' | 'mongo' | 'plain';

    classType?: ClassType<any>;
    classTypeCircular?: (() => ClassType<any>);

    constructor(name: string) {
        this.name = name;
    }

    getResolvedClassType(): ClassType<any> | undefined {
        if (this.classTypeCircular) {
            return this.classTypeCircular();
        }

        return this.classType;
    }
}

export class EntitySchema {
    proto: Object;
    name?: string;
    collectionName?: string;
    databaseName?: string;
    decorator?: string;
    properties: { [name: string]: PropertySchema } = {};
    idField?: string;
    propertyNames: string[] = [];

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];

    constructor(proto: Object) {
        this.proto = proto;
    }

    public getOrCreateProperty(name: string): PropertySchema {
        if (!this.properties[name]) {
            this.properties[name] = new PropertySchema(name);
            this.propertyNames.push(name);
        }

        return this.properties[name];
    }

    public getProperty(name: string): PropertySchema {
        if (!this.properties[name]) {
            throw new Error(`Property ${name} not found`);
        }

        return this.properties[name];
    }
}

export const EntitySchemas = new Map<object, EntitySchema>();

export function getOrCreateEntitySchema<T>(target: Object | ClassType<T>): EntitySchema {
    const proto = target['prototype'] ? target['prototype'] : target;

    if (!EntitySchemas.has(proto)) {
        //check if parent has a EntitySchema, if so clone and use it as base.

        let currentProto = Object.getPrototypeOf(proto);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (EntitySchemas.has(currentProto)) {
                found = true;
                const cloned = clone(EntitySchemas.get(currentProto));
                EntitySchemas.set(proto, cloned!);
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new EntitySchema(proto);
            EntitySchemas.set(proto, reflection);
        }
    }

    return EntitySchemas.get(proto)!;
}

export function getEntitySchema<T>(classType: ClassType<T>): EntitySchema {
    if (!EntitySchemas.has(classType.prototype)) {
        //check if parent has a EntitySchema, if so clone and use it as base.
        let currentProto = Object.getPrototypeOf(classType.prototype);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (EntitySchemas.has(currentProto)) {
                found = true;
                const cloned = clone(EntitySchemas.get(currentProto));
                EntitySchemas.set(classType.prototype, cloned!);
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new EntitySchema(classType.prototype);
            EntitySchemas.set(classType.prototype, reflection);
        }
    }

    return EntitySchemas.get(classType.prototype)!;
}

export function Entity<T>(name: string, collectionName?: string) {
    return (target: ClassType<T>) => {
        RegisteredEntities[name] = target;
        getOrCreateEntitySchema(target).name = name;
        getOrCreateEntitySchema(target).collectionName = collectionName;
    };
}

export function DatabaseName<T>(name: string) {
    return (target: ClassType<T>) => {
        getOrCreateEntitySchema(target).databaseName = name;
    };
}

export function Decorator<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).decorator = property;
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isDecorated = true;
    };
}

export function ID<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).idField = property;
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isId = true;
    };
}

export function ParentReference<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isParentReference = true;
    };
}


/**
 * Executes the method when the current class is instantiated and populated.
 */
export function OnLoad<T>(options: { fullLoad?: boolean } = {}) {
    return (target: T, property: string) => {

        getOrCreateEntitySchema(target).onLoad.push({
            methodName: property,
            options: options,
        });
    };
}

/**
 * Exclude in *toMongo and *toPlain.
 */
export function Exclude<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'all';
    };
}

export function ExcludeToMongo<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'mongo';
    };
}

export function ExcludeToPlain<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'plain';
    };
}


export function Type<T>(type: Types) {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).type = type;
    };
}

export function ArrayType<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isArray = true;
    };
}

export function MapType<T>() {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isMap = true;
    };
}

export function ClassCircular<T, K>(classType: () => ClassType<K>) {
    return (target: T, property: string) => {
        Type('class')(target, property);
        getOrCreateEntitySchema(target).getOrCreateProperty(property).classTypeCircular = classType;
    };
}

export function Class<T, K>(classType: ClassType<K>) {
    return (target: T, property: string) => {
        if (!classType) {
            throw new Error(`${getClassName(target)}::${property} has @Class but argument is empty. Use @ClassCircular(() => YourClass) to work around circular dependencies.`);
        }

        Type('class')(target, property);
        getOrCreateEntitySchema(target).getOrCreateProperty(property).classType = classType;
    };
}

export function ClassMap<T, K>(classType: ClassType<K>) {
    return (target: T, property: string) => {
        if (!classType) {
            throw new Error(`${getClassName(target)}::${property} has @ClassMap but argument is empty. Use @ClassMap(() => YourClass) to work around circular dependencies.`);
        }

        Class(classType)(target, property);
        MapType()(target, property);
    };
}

export function ClassMapCircular<T, K>(classType: () => ClassType<K>) {
    return (target: T, property: string) => {
        ClassCircular(classType)(target, property);
        MapType()(target, property);
    };
}

export function ClassArray<T, K>(classType: ClassType<K>) {
    return (target: T, property: string) => {
        if (!classType) {
            throw new Error(`${getClassName(target)}::${property} has @ClassArray but argument is empty. Use @ClassArrayCircular(() => YourClass) to work around circular dependencies.`);
        }

        Class(classType)(target, property);
        ArrayType()(target, property);
    };
}

export function ClassArrayCircular<T, K>(classType: () => ClassType<K>) {
    return (target: T, property: string) => {
        ClassCircular(classType)(target, property);
        ArrayType()(target, property);
    };
}

function concat(...decorators: ((target: Object, property: string) => void)[]) {
    return (target: Object, property: string) => {
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

export function BinaryType() {
    return Type('binary');
}

export function StringType() {
    class Validator implements PropertyValidator {
        async validate<T>(value: any, target: Object, property: string): Promise<PropertyValidatorError | void> {
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
        async validate<T>(value: any, target: Object, property: string): Promise<PropertyValidatorError | void> {
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

export function EnumType<T>(type: any, allowLabelsAsValue = false) {
    return (target: Object, property: string) => {
        Type('enum')(target, property);
        getOrCreateEntitySchema(target).getOrCreateProperty(property).classType = type;
        getOrCreateEntitySchema(target).getOrCreateProperty(property).allowLabelsAsValue = allowLabelsAsValue;
    }
}
