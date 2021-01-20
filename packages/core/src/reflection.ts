/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ClassType } from "./core";

const COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const DEFAULT_PARAMS = /=[^,]+/mg;
const FAT_ARROWS = /=>.*$/mg;

export function extractParameters(fn: string | Function | ClassType): string[] {
    fn = typeof fn === 'string' ? fn : fn.toString();
    fn = removeStrings(fn);

    if (fn.startsWith('class')) {
        const start = fn.match(new RegExp('[\t\ \n{]constructor\\('));
        if (!start) return [];

        fn = fn.substr((start.index || 0) + start[0].length);

        fn = fn.replace(COMMENTS, '').replace(FAT_ARROWS, '').replace(DEFAULT_PARAMS, '');
        return fn.slice(0, fn.indexOf('{')).match(/([^\(\){\s,]+)/g) || [];
    } else {
        fn = fn.replace(COMMENTS, '').replace(FAT_ARROWS, '').replace(DEFAULT_PARAMS, '');
        return fn.slice(fn.indexOf('(') + 1, fn.indexOf('{')).match(/([^\(\)\{\}\s,]+)/g) || [];
    }
}

export function extractMethodBody(classCode: string, name: string): string {
    let methodCode = '';
    classCode = removeStrings(classCode);
    const start = classCode.match(new RegExp('[\t\ \n]' + name + '\\('));
    if (!start) return '';

    classCode = classCode.substr((start.index || 0) + start[0].length);

    let blockDepth = 1;
    classCode = classCode.substr(classCode.indexOf('{') + 1);

    for (let i = 0; i < classCode.length; i++) {
        const char = classCode[i];
        if (char === '{') blockDepth++;
        if (char === '}') blockDepth--;

        if (blockDepth === 0) {
            return methodCode;
        }

        if (char === '\n' || char === '\t' || char === ' ') continue;
        methodCode += char;
    }

    return methodCode;
}

export function removeStrings(code: string) {
    let result = '';
    let inString: false | '"' | '\'' = false;
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (inString && char === '\\') {
            i++;
            continue;
        }

        if (char === '"') {
            if (inString === '"') {
                //end string
                inString = false;
                continue;
            }
            if (!inString) {
                inString = '"';
                continue;
            }
        }

        if (char === '\'') {
            if (inString === '\'') {
                //end string
                inString = false;
                continue;
            }
            if (!inString) {
                inString = '\'';
                continue;
            }
        }

        if (!inString) {
            result += char;
        }
    }
    return result;
}
