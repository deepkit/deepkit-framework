import {Types} from "./mapper";

export function Entity(name: string, collectionName?: string) {
    return (target) => {
        Reflect.defineMetadata('marshaller:entityName', name, target.prototype);
        Reflect.defineMetadata('marshaller:collectionName', collectionName || (name + 's'), target.prototype);
    };
}

export function DatabaseName(name: string) {
    return (target) => {
        Reflect.defineMetadata('marshaller:databaseName', name, target);
    };
}

export function ID() {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:idField', property, target);
    };
}

export type ExcludeTarget = 'all' | 'class' | 'mongo' | 'plain';

export function Exclude(targets: ExcludeTarget[] | ExcludeTarget = 'all') {
    return (target, property) => {
        if (!Array.isArray(targets)) {
            targets = [targets];
        }

        Reflect.defineMetadata('marshaller:exclude', targets, target, property);
    };
}

export function Type(type: Types) {
    return (target, property) => {
        Reflect.defineMetadata('marshaller:dataType', type, target, property);
    };
}

export function ObjectIdType() {
    return Type('objectId');
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
        Reflect.defineMetadata('marshaller:dataTypeValue', type, target, property);
    }
}
