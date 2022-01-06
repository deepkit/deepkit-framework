import { ParentLessType, ReflectionKind, ReflectionOp, Type } from '../src/reflection/type';
import { Processor, RuntimeStackEntry } from '../src/reflection/processor';
import { expect } from '@jest/globals';
import { visit } from '../src/reflection/reflection';
import { isArray, isObject } from '@deepkit/core';

export function assertValidParent(a: Type): void {
    visit(a, (type, path, parent) => {
        if (type.parent && type.parent !== parent) {
            if (!parent) throw new Error('Parent was set, but not expected at ' + path);
            throw new Error('Invalid parent set at ' + path);
        }
    });
}

export function expectType<E extends ParentLessType>(
    pack: ReflectionOp[] | { ops: ReflectionOp[], stack: RuntimeStackEntry[], inputs?: RuntimeStackEntry[] },
    expectObject: E | number | string | boolean
): void {
    const type = Processor.get().run(isArray(pack) ? pack : pack.ops, isArray(pack) ? [] : pack.stack, isArray(pack) ? [] : pack.inputs);

    // console.log('computed type', inspect(type, undefined, 4));
    if (isObject(expectObject)) {
        expectEqualType(type, expectObject);
        if (expectObject.kind === ReflectionKind.class || expectObject.kind === ReflectionKind.objectLiteral || expectObject.kind === ReflectionKind.function) {
            assertValidParent(type);
        }
    } else {
        expect(type).toEqual(expectObject);
    }
}

/**
 * Types can not be compared via toEqual since they contain circular references (.parent) and other stuff can not be easily assigned.
 */
export function expectEqualType(actual: any, expected: any, options: { noTypeNames?: true, noOrigin?: true, excludes?: string[], stack?: any[] } = {}, path: string = ''): void {
    if (!options.stack) options.stack = [];

    if (options.stack.includes(expected)) {
        return;
    }
    options.stack.push(expected);

    if ('object' === typeof expected) {
        if ('object' !== typeof actual) throw new Error('Not equal object type: ' + path);

        for (const i in expected) {
            if (i === 'parent') continue;
            if (i === 'decorators') continue;
            if (options.excludes && options.excludes.includes(i)) continue;
            if (i === 'annotations') continue;
            if (i === 'parent') continue;
            if (i === 'indexAccessOrigin') continue;
            if (options.noOrigin && i === 'origin') continue;
            if (options.noTypeNames && (i === 'typeName' || i === 'typeArguments')) continue;

            if (isArray(expected[i])) {
                if (!isArray(actual[i])) throw new Error('Not equal array type: ' + path);
                if (actual[i].length !== expected[i].length) throw new Error('Not equal array length: ' + path);
                for (let j = 0; j < expected[i].length; j++) {
                    expectEqualType(expected[i][j], actual[i][j], options, path + '.' + i + '.' + j);
                }
            } else {
                expectEqualType(expected[i], actual[i], options, path + '.' + i);
            }
        }
    } else {
        if (expected !== actual) throw new Error(`Invalid type ${path}: ${expected} !== ${actual}`);
    }

    options.stack.pop();
}
