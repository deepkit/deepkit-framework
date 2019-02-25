import {eachKey} from "./iterators";

const cacheEnumLabels = new Map<Object, string[]>();


/**
 * Returns the enum label for a given enum value.
 */
export function getEnumLabel(enumType: { [field: string]: any }, id: any) {
    for (const i of eachKey(enumType)) {
        if (id === enumType[i]) {
            return i;
        }
    }
}

/**
 * Returns all possible enum labels.
 */
export function getEnumLabels(enumDefinition: any) {
    let value = cacheEnumLabels.get(enumDefinition);
    if (!value) {
        value = Object.keys(enumDefinition).filter(v => !Number.isFinite(parseInt(v)));
        cacheEnumLabels.set(enumDefinition, value);
    }

    return value;
}

const cacheEnumKeys = new Map<Object, string[]>();

/**
 * Returns all possible enum keys.
 */
export function getEnumValues(enumDefinition: any): any[] {
    let value = cacheEnumKeys.get(enumDefinition);
    if (!value) {
        const labels = getEnumLabels(enumDefinition);
        value = Object.values(enumDefinition)
            .filter(v => -1 === labels.indexOf(v as string)) as any[];

        cacheEnumKeys.set(enumDefinition, value);
    }

    return value;
}

/**
 * Checks whether given enum value is valid.
 */
export function isValidEnumValue(enumDefinition: any, value: any, allowLabelsAsValue = false) {
    if (allowLabelsAsValue) {
        const labels = getEnumLabels(enumDefinition);
        if (-1 !== labels.indexOf(String(value))) {
            return true;
        }
    }

    const values = getEnumValues(enumDefinition);
    return -1 !== values.indexOf(+value) || -1 !== values.indexOf(value) || -1 !== values.indexOf(String(value));
}

export function getValidEnumValue(enumDefinition: any, value: any, allowLabelsAsValue = false) {
    if (allowLabelsAsValue) {
        const labels = getEnumLabels(enumDefinition);
        if (-1 !== labels.indexOf(String(value))) {
            return enumDefinition[String(value)];
        }
    }

    const values = getEnumValues(enumDefinition);
    if (-1 !== values.indexOf(value)) {
        return value;
    }
    if (-1 !== values.indexOf(+value)) {
        return +value;
    }
    if (-1 !== values.indexOf(String(value))) {
        return String(value);
    }
}
