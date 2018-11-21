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
    return 'object' === typeOf(obj);
}

export function isArray(obj: any): obj is any[] {
    return 'array' === typeOf(obj);
}


export function isUndefined(obj: any): obj is undefined {
    return 'undefined' === typeOf(obj);
}

export function getEnumLabels(enumDefinition: any) {
    return Object.keys(enumDefinition).filter(v => !Number.isFinite(parseInt(v)));
}

export function getEnumKeys(enumDefinition: any): any[] {
    const labels = getEnumLabels(enumDefinition);
    return Object.values(enumDefinition)
        .filter(v => -1 === labels.indexOf(v as string));
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