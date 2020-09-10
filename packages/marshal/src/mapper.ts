import {ClassSchema, getClassSchema, getClassTypeFromInstance} from './decorators';
import {ClassType, getClassName} from '@super-hornet/core';
import {JitConverterOptions} from './jit';
import {plainSerializer} from './plain-serializer';


/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, options?: JitConverterOptions): T {
    const s = plainSerializer.for(getClassTypeFromInstance(target));
    return s.deserialize(s.serialize(target, options), options, options?.parents);
}

/**
 * @hidden
 */
export function isArrayType<T>(classType: ClassType<T>, property: string): boolean {
    return getClassSchema(classType).getProperty(property).isArray;
}

/**
 * @hidden
 */
export function isMapType<T>(classType: ClassType<T>, property: string): boolean {
    return getClassSchema(classType).getProperty(property).isMap;
}

/**
 * @hidden
 */
export function isExcluded<T>(schema: ClassSchema<T>, property: string, wantedTarget: string): boolean {
    const mode = schema.getProperty(property).exclude;

    if ('all' === mode) {
        return true;
    }

    return mode === wantedTarget;
}

export function getEntityName<T>(classType: ClassType<T>): string {
    const name = getClassSchema(classType).name;

    if (!name) {
        throw new Error('No @Entity() defined for class ' + getClassName(classType));
    }

    return name;
}

/**
 * @hidden
 */
export function getDatabaseName<T>(classType: ClassType<T>): string | undefined {
    return getClassSchema(classType).databaseSchemaName;
}

/**
 * @hidden
 */
export function getCollectionName<T>(classType: ClassType<T>): string | undefined {
    return getClassSchema(classType).collectionName;
}
