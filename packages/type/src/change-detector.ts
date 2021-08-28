/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext, empty, getObjectKeysSize } from '@deepkit/core';
import { Changes, changeSetSymbol, ItemChanges } from './changes';
import { JitStack } from './jit';
import { ClassSchema, PropertySchema } from './model';
import { reserveVariable } from './serializer-compiler';
import { getConverterForSnapshot } from './snapshot';

function genericEqualArray(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (!genericEqual(a[i], b[i])) return false;
    }

    return true;
}

function genericEqualObject(a: { [name: string]: any }, b: { [name: string]: any }): boolean {
    for (let i in a) {
        if (!a.hasOwnProperty(i)) continue;
        if (!genericEqual(a[i], b[i])) return false;
    }

    //is there a faster way?
    for (let i in b) {
        if (!b.hasOwnProperty(i)) continue;
        if (!genericEqual(a[i], b[i])) return false;
    }

    return true;
}

/**
 * This is a comparator function for the snapshots. They are either string, number, boolean, array, or objects.
 * No date, moment, or custom classes involved here.
 */
function genericEqual(a: any, b: any): boolean {
    //is array, the fast way
    const aIsArray = a && 'string' !== typeof a && 'function' === a.slice && 'number' === typeof a.length;
    const bIsArray = b && 'string' !== typeof b && 'function' === b.slice && 'number' === typeof b.length;
    if (aIsArray) return bIsArray ? genericEqualArray(a, b) : false;
    if (bIsArray) return aIsArray ? genericEqualArray(a, b) : false;

    const aIsObject = 'object' === typeof a && a !== null;
    const bIsObject = 'object' === typeof b && b !== null;
    if (aIsObject) return bIsObject ? genericEqualObject(a, b) : false;
    if (aIsObject) return bIsObject ? genericEqualObject(a, b) : false;

    return a === b;
}

function createJITChangeDetectorForSnapshot(schema: ClassSchema, jitStack: JitStack = new JitStack()): (lastSnapshot: any, currentSnapshot: any) => ItemChanges<any> {
    const compiler = new CompilerContext();
    const prepared = jitStack.prepare(schema);
    compiler.context.set('genericEqual', genericEqual);
    compiler.context.set('empty', empty);
    const props: string[] = [];

    function has(accessor: string): string {
        return `(changeSet.$inc && '${accessor}' in changeSet.$inc) || (changeSet.$unset && '${accessor}' in changeSet.$unset)`;
    }

    function getComparator(property: PropertySchema, last: string, current: string, accessor: string, changedName: string, onChanged: string, jitStack: JitStack): string {
        if (property.isArray) {
            const l = reserveVariable(compiler.context, 'l');
            return `
                if (!${has(changedName)}) {
                if (!${current} && !${last}) {

                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                } else if (${current}.length !== ${last}.length) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                } else {
                    let ${l} = ${last}.length;
                    ${onChanged ? '' : 'root:'}
                    while (${l}--) {
                         ${getComparator(property.getSubType(), `${last}[${l}]`, `${current}[${l}]`, `${accessor}[${l}]`, changedName, 'break root;', jitStack)}
                    }
                }
                }
            `;

        } else if (property.isMap || property.isPartial) {
            compiler.context.set('getObjectKeysSize', getObjectKeysSize);
            const i = reserveVariable(compiler.context, 'i');
            return `
                if (!${has(changedName)}) {
                if (!${current} && !${last}) {

                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                } else if (getObjectKeysSize(${current}) !== getObjectKeysSize(${last})) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                } else {
                    ${onChanged ? '' : 'root:'}
                    for (let ${i} in ${last}) {
                        if (!${last}.hasOwnProperty(${i})) continue;
                         ${getComparator(property.getSubType(), `${last}[${i}]`, `${current}[${i}]`, `${accessor}[${i}]`, changedName, 'break root;', jitStack)}
                    }
                }
                }
            `;
        } else if (property.type === 'class') {
            if (property.isReference) {
                const checks: string[] = [];

                for (const primaryField of property.getResolvedClassSchema().getPrimaryFields()) {
                    checks.push(`
                         ${getComparator(primaryField, `${last}.${primaryField.name}`, `${current}.${primaryField.name}`, `${accessor}.${primaryField.name}`, changedName, onChanged, jitStack)}
                    `);
                }
                return `
                if (!${has(changedName)}) {
                if (!${current} && !${last}) {

                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                } else {
                    ${checks.join('\n')}
                }
                }
            `;
            }

            const classSchema = property.getResolvedClassSchema();
            const jitChangeDetectorThis = compiler.reserveVariable('jitChangeDetector', jitStack.getOrCreate(classSchema, () => createJITChangeDetectorForSnapshot(classSchema, jitStack)));

            return `
                if (!${has(changedName)}) {
                    if (!${current} && !${last}) {

                    } else if ((${current} && !${last}) || (!${current} && ${last})) {
                        changes.${changedName} = item.${changedName};
                        ${onChanged}
                    } else {
                        const thisChanged = ${jitChangeDetectorThis}.fn(${last}, ${current}, ${accessor});
                        if (!empty(thisChanged)) {
                            changes.${changedName} = item.${changedName};
                            ${onChanged}
                        }
                    }
                }
            `;
        } else if (property.isBinary || property.type === 'any' || property.type === 'union') {
            return `
                if (!${has(changedName)}) {
                    if (!genericEqual(${last}, ${current})) {
                        changes.${changedName} = item.${changedName};
                        ${onChanged}
                    }
                }
            `;
        } else {
            //binary, date, boolean, etc are encoded as simple JSON objects (number, boolean, or string) primitives
            return `
            if (!${has(changedName)}) {
                if (${last} !== ${current}) {
                    changes.${changedName} = item.${changedName};
                    ${onChanged}
                }
            }
            `;
        }
    }

    for (const property of schema.getProperties()) {
        if (property.isParentReference) continue;
        if (property.backReference) continue;

        props.push(getComparator(property, `last.${property.name}`, `current.${property.name}`, 'item.' + property.name, property.name, '', jitStack));
    }

    compiler.context.set('changeSetSymbol', changeSetSymbol);
    compiler.context.set('ItemChanges', ItemChanges);

    const functionCode = `
        var changeSet = item[changeSetSymbol] || new ItemChanges(undefined, item);
        var changes = {};
        ${props.join('\n')}
        changeSet.mergeSet(changes);
        return changeSet.empty ? undefined : changeSet;
        `;

    // console.log('functionCode', functionCode);

    try {
        const fn = compiler.build(functionCode, 'last', 'current', 'item');
        prepared(fn);
        fn.buildId = schema.buildId;
        return fn;
    } catch (error) {
        console.log('functionCode', functionCode);
        throw error;
    }
}

const changeDetectorSymbol = Symbol('changeDetector');

export function getChangeDetector<T>(classSchema: ClassSchema<T>): (last: any, current: any, item: T) => ItemChanges<T> | undefined {
    return classSchema.getJit(changeDetectorSymbol, () => createJITChangeDetectorForSnapshot(classSchema));
}

export function buildChanges<T>(classSchema: ClassSchema, lastSnapshot: any, item: T): Changes<T> {
    const currentSnapshot = getConverterForSnapshot(classSchema)(item);
    return getChangeDetector(classSchema)(lastSnapshot, currentSnapshot, item) as Changes<T> || new Changes<T>();
}
