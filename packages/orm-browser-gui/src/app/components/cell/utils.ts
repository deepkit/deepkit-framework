import { eachPair, isArray, isObject } from '@deepkit/core';

export function objToString(obj: { [s: string]: any } | ArrayLike<any>): string {
    const strings: string[] = [];
    const array = isArray(obj);

    for (let [i, v] of eachPair(obj)) {
        if (isArray(v)) {
            v = objToString(v);
        } else if (v === null) {
            v = 'null';
        } else if (v === undefined) {
            v = 'undefined';
        } else if (v instanceof Date) {
            v = v.toString();
        } else if (isObject(v)) {
            v = objToString(v);
        }
        if (array) {
            strings.push(v);
        } else {
            strings.push(i + ': ' + v);
        }
    }

    if (array) {
        return '[' + strings.join(', ') + ']';
    }
    return '{' + strings.join(', ') + '}';
}

export interface TypeDecoration {
    name: number | string | symbol;
    description?: string;
}
