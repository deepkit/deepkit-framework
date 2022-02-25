/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext, empty, toFastProperties } from '@deepkit/core';
import { Changes, changeSetSymbol, ItemChanges } from './changes';
import { getConverterForSnapshot } from './snapshot';
import { ReflectionClass } from './reflection/reflection';
import { ContainerAccessor, getIndexCheck, sortSignatures, TemplateRegistry, TemplateState } from './serializer';
import { referenceAnnotation, ReflectionKind, Type, TypeIndexSignature } from './reflection/type';

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
export function genericEqual(a: any, b: any): boolean {
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

function createJITChangeDetectorForSnapshot(schema: ReflectionClass<any>, stateIn?: TemplateState): (lastSnapshot: any, currentSnapshot: any) => ItemChanges<any> {
    const compiler = new CompilerContext();
    const state = new TemplateState('', '', compiler, stateIn ? stateIn.registry : new TemplateRegistry(), undefined, stateIn ? stateIn.jitStack : undefined);
    state.setContext({
        genericEqual, empty
    });
    const lines: string[] = [];

    function has(accessor: string): string {
        return `(changeSet.$inc && ${accessor} in changeSet.$inc) || (changeSet.$unset && ${accessor} in changeSet.$unset)`;
    }

    function getComparator(type: Type, last: ContainerAccessor, current: ContainerAccessor, accessor: ContainerAccessor, changedName: string, onChanged: string, state: TemplateState): string {
        if (type.kind === ReflectionKind.array) {
            const l = compiler.reserveName('l');

            const lastAccessor = new ContainerAccessor(last, l);
            const currentAccessor = new ContainerAccessor(current, l);
            const itemAccessor = new ContainerAccessor(accessor, l);
            return `
                if (!${has(changedName)}) {
                if (!${current} && !${last}) {

                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes[${changedName}] = item[${changedName}];
                    ${onChanged}
                } else if (${current}.length !== ${last}.length) {
                    changes[${changedName}] = item[${changedName}];
                    ${onChanged}
                } else {
                    let ${l} = ${last}.length;
                    ${onChanged ? '' : 'root:'}
                    while (${l}--) {
                         ${getComparator(type.type, lastAccessor, currentAccessor, itemAccessor, changedName, 'break root;', state)}
                    }
                }
                }
            `;

            // } else if (type.isMap || type.isPartial) {
            //     compiler.context.set('getObjectKeysSize', getObjectKeysSize);
            //     const i = reserveVariable(compiler.context, 'i');
            //     return `
            //         if (!${has(changedName)}) {
            //         if (!${current} && !${last}) {
            //
            //         } else if ((${current} && !${last}) || (!${current} && ${last})) {
            //             changes[${changedName}] = item[${changedName}];
            //             ${onChanged}
            //         } else if (getObjectKeysSize(${current}) !== getObjectKeysSize(${last})) {
            //             changes[${changedName}] = item[${changedName}];
            //             ${onChanged}
            //         } else {
            //             ${onChanged ? '' : 'root:'}
            //             for (let ${i} in ${last}) {
            //                 if (!${last}.hasOwnProperty(${i})) continue;
            //                  ${getComparator(type.getSubType(), `${last}[${i}]`, `${current}[${i}]`, `${accessor}[${i}]`, changedName, 'break root;', jitStack)}
            //             }
            //         }
            //         }
            //     `;
        } else if ((type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) && type.types.length) {
            const classSchema = ReflectionClass.from(type);

            if (referenceAnnotation.getFirst(type) !== undefined) {
                const checks: string[] = [];

                for (const primaryField of classSchema.getPrimaries()) {
                    const name = JSON.stringify(primaryField.getNameAsString());
                    const lastAccessor = new ContainerAccessor(last, name);
                    const currentAccessor = new ContainerAccessor(current, name);
                    const itemAccessor = new ContainerAccessor(accessor, name);
                    checks.push(`
                         ${getComparator(primaryField.type, lastAccessor, currentAccessor, itemAccessor, changedName, onChanged, state)}
                    `);
                }

                return `
                    if (!${has(changedName)}) {
                    if (!${current} && !${last}) {

                    } else if ((${current} && !${last}) || (!${current} && ${last})) {
                        changes[${changedName}] = item[${changedName}];
                        ${onChanged}
                    } else {
                        ${checks.join('\n')}
                    }
                    }
                `;
            }

            const jitChangeDetectorThis = compiler.reserveVariable('jitChangeDetector', state.jitStack.getOrCreate(state.registry, type, () => {
                return createJITChangeDetectorForSnapshot(classSchema, state);
            }));

            return `
                if (!${has(changedName)}) {
                    if (!${current} && !${last}) {

                    } else if ((${current} && !${last}) || (!${current} && ${last})) {
                        changes[${changedName}] = item[${changedName}];
                        ${onChanged}
                    } else {
                        const thisChanged = ${jitChangeDetectorThis}.fn(${last}, ${current}, ${accessor});
                        if (!empty(thisChanged)) {
                            changes[${changedName}] = item[${changedName}];
                            ${onChanged}
                        }
                    }
                }
            `;
        } else if (type.kind === ReflectionKind.any || type.kind === ReflectionKind.never || type.kind === ReflectionKind.union) {
            return `
                if (!${has(changedName)}) {
                    if (!genericEqual(${last}, ${current})) {
                        changes[${changedName}] = item[${changedName}];
                        ${onChanged}
                    }
                }
            `;
        } else {
            //binary, date, boolean, etc are encoded as simple JSON objects (number, boolean, or string) primitives
            return `
            if (!${has(changedName)}) {
                if (${last} !== ${current}) {
                    changes[${changedName}] = item[${changedName}];
                    ${onChanged}
                }
            }
            `;
        }
    }

    const existing: string[] = [];

    for (const property of schema.getProperties()) {
        // if (property.isParentReference) continue;
        if (property.isBackReference()) continue;
        const name = JSON.stringify(property.getNameAsString());
        existing.push(name);

        const lastAccessor = new ContainerAccessor('last', name);
        const currentAccessor = new ContainerAccessor('current', name);
        const itemAccessor = new ContainerAccessor('item', name);
        lines.push(getComparator(property.type, lastAccessor, currentAccessor, itemAccessor, JSON.stringify(property.getNameAsString()), '', state));
    }

    for (const t of schema.type.types) {

    }

    const signatures = (schema.type.types as Type[]).filter(v => v.kind === ReflectionKind.indexSignature) as TypeIndexSignature[];
    if (signatures.length) {
        const i = compiler.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
        const signatureLines: string[] = [];
        sortSignatures(signatures);

        const lastAccessor = new ContainerAccessor('last', i);
        const currentAccessor = new ContainerAccessor('current', i);
        const itemAccessor = new ContainerAccessor('item', i);

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
            ${getComparator(signature.type, lastAccessor, currentAccessor, itemAccessor, i, '', state)}
        }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        for (const ${i} in current) {
            if (!current.hasOwnProperty(${i})) continue;
            if (${existingCheck}) continue;
            if (false) {} ${signatureLines.join(' ')}
        }

        for (const ${i} in last) {
            if (!last.hasOwnProperty(${i})) continue;
            if (!current.hasOwnProperty(${i})) {
               changes[${i}] = item[${i}];
               break;
            }
        }
        `);
    }

    compiler.context.set('changeSetSymbol', changeSetSymbol);
    compiler.context.set('ItemChanges', ItemChanges);

    const functionCode = `
        var changeSet = item[changeSetSymbol] || new ItemChanges(undefined, item);
        var changes = {};
        ${lines.join('\n')}
        changeSet.mergeSet(changes);
        return changeSet.empty ? undefined : changeSet;
        `;

    // console.log('functionCode', functionCode);

    try {
        const fn = compiler.build(functionCode, 'last', 'current', 'item');
        // prepared(fn);
        return fn;
    } catch (error) {
        console.log('functionCode', functionCode);
        throw error;
    }
}

const changeDetectorSymbol = Symbol('changeDetector');

export function getChangeDetector<T>(classSchema: ReflectionClass<T>): (last: any, current: any, item: T) => ItemChanges<T> | undefined {
    const jit = classSchema.getJitContainer();
    if (jit[changeDetectorSymbol]) return jit[changeDetectorSymbol];

    jit[changeDetectorSymbol] = createJITChangeDetectorForSnapshot(classSchema);
    toFastProperties(jit);

    return jit[changeDetectorSymbol];
}

export function buildChanges<T>(classSchema: ReflectionClass<T>, lastSnapshot: any, item: T): Changes<T> {
    const currentSnapshot = getConverterForSnapshot(classSchema)(item);
    const detector = getChangeDetector(classSchema);
    return detector(lastSnapshot, currentSnapshot, item) as Changes<T> || new Changes<T>();
}
