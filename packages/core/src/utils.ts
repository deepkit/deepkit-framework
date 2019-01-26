import {v4} from 'uuid';

export function getClassName<T>(classType: ClassType<T> | Object): string {
    return classType['name'] || (classType.constructor ? classType.constructor.name : '');
}

export function getClassPropertyName<T>(classType: ClassType<T> | Object, propertyName: string): string {
    const name = getClassName(classType);

    return `${name}::${propertyName}`;
}

export function uuid(): string {
    return v4();
}

export interface ClassType<T> {
    new(...args: any[]): T;
}

export function typeOf(obj: any) {
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

export function isObject(obj: any): obj is object {
    if (obj === null) {
        return false;
    }
    return ((typeof obj === 'function') || (typeof obj === 'object' && !isArray(obj)));
}

export function isArray(obj: any): obj is any[] {
    return Array.isArray(obj)
}

export function isUndefined(obj: any): obj is undefined {
    return undefined === obj;
}

const cacheEnumLabels = new Map<Object, string[]>();

export function getEnumLabels(enumDefinition: any) {
    let value = cacheEnumLabels.get(enumDefinition);
    if (!value) {
        value = Object.keys(enumDefinition).filter(v => !Number.isFinite(parseInt(v)));
        cacheEnumLabels.set(enumDefinition, value);
    }

    return value;
}

const cacheEnumKeys = new Map<Object, string[]>();

export function getEnumKeys(enumDefinition: any): any[] {
    let value = cacheEnumKeys.get(enumDefinition);
    if (!value) {
        const labels = getEnumLabels(enumDefinition);
        value = Object.values(enumDefinition)
            .filter(v => -1 === labels.indexOf(v as string)) as any[];

        cacheEnumKeys.set(enumDefinition, value);
    }

    return value;
}

export function isValidEnumValue(enumDefinition: any, value: any, allowLabelsAsValue = false) {
    if (allowLabelsAsValue) {
        const labels = getEnumLabels(enumDefinition);
        if (-1 !== labels.indexOf(String(value))) {
            return true;
        }
    }

    const keys = getEnumKeys(enumDefinition);
    return -1 !== keys.indexOf(+value) || -1 !== keys.indexOf(value) || -1 !== keys.indexOf(String(value));
}

export function getValidEnumValue(enumDefinition: any, value: any, allowLabelsAsValue = false) {
    if (allowLabelsAsValue) {
        const labels = getEnumLabels(enumDefinition);
        if (-1 !== labels.indexOf(String(value))) {
            return enumDefinition[String(value)];
        }
    }

    const keys = getEnumKeys(enumDefinition);
    if (-1 !== keys.indexOf(value)) {
        return value;
    }
    if (-1 !== keys.indexOf(+value)) {
        return +value;
    }
    if (-1 !== keys.indexOf(String(value))) {
        return String(value);
    }
}