import {Types} from "./mapper";

export function Entity(name: string, collectionName?: string) {
    return (target) => {
        Reflect.defineMetadata('entityName', name, target.prototype);
        Reflect.defineMetadata('collectionName', collectionName || (name + 's'), target.prototype);
    };
}

export function DatabaseName(name: string) {
    return (target) => {
        Reflect.defineMetadata('databaseName', name, target);
    };
}

export function ID() {
    return (target, property) => {
        Reflect.defineMetadata('idField', property, target);
    };
}

export function Type(type: Types) {
    return (target, property) => {
        Reflect.defineMetadata('dataType', type, target, property);
    };
}

export function UUIDType() {
    return Type('uuid');
}

export function DateType() {
    return Type('date');
}

export function StringType() {
    return Type('string');
}

export function AnyType() {
    return Type('any');
}

export function NumberType() {
    return Type('number');
}

export function EnumType(type) {
    return (target, property) => {
        Type('enum')(target, property);
        Reflect.defineMetadata('dataTypeValue', type, target, property);
    }
}
