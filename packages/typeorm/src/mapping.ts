import {
    ClassType,
    getParentReferenceClass,
    getRegisteredProperties,
    getEntityName,
    getResolvedReflection,
    Types,
} from '@marcj/marshal';
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm';

export function plainToTypeOrm<T>(
    classType: ClassType<T>,
    target: { [k: string]: any }
): any {}

function mapTypeToNativeType(type: Types) {
    switch (type) {
        case 'string':
            return String;
        case 'number':
            return Number;
        case 'boolean':
            return Boolean;
    }
}

function propertyClassToEntitySchema<T>(
    classType: ClassType<T>,
    propertyName,
    property
): EntitySchemaColumnOptions | void {
    const result: any = {};

    const reflection = getResolvedReflection(classType, propertyName);

    if (!reflection) {
        return;
    }

    result.type = mapTypeToNativeType(reflection.type);

    return result;
}

export function classToEntitySchema<T>(
    classType: ClassType<T>
): EntitySchema<T> {
    const result: any = {
        name: getEntityName(classType),
        columns: {},
    };

    for (const propertyName of getRegisteredProperties(classType)) {
        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        const definition = propertyClassToEntitySchema(
            classType,
            propertyName,
            classType[propertyName]
        );

        if (!definition) {
            continue;
        }

        result.columns[propertyName] = definition;
    }

    return new EntitySchema(result);
}
