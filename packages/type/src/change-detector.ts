/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, VarRef, arg, empty, fn, toFastProperties } from '@deepkit/core';

import { Changes, ItemChanges, changeSetSymbol } from './changes.js';
import { ReflectionClass } from './reflection/reflection.js';
import { ReflectionKind, Type, TypeIndexSignature } from './reflection/type.js';
import { getConverterForSnapshot } from './snapshot.js';
import { referenceAnnotation } from './type-annotations.js';

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

/**
 * Check if a numeric index signature key
 */
function isNumeric(value: string): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value as any);
}

/**
 * Build state for change detector JIT function generation.
 */
interface ChangeDetectorState {
    /** Map from type to its cached detector function var */
    fnCache: Map<Type, VarRef<Function>>;
    /** Types currently being processed (for circular detection) */
    typeStack: Set<Type>;
}

/**
 * Check if a key is already handled by $inc or $unset in the changeSet.
 */
function hasChangeSet(changeSet: any, key: string): boolean {
    return (changeSet.$inc && key in changeSet.$inc) || (changeSet.$unset && key in changeSet.$unset);
}

/**
 * Build comparator code for a specific type.
 */
function buildComparator(
    b: Builder,
    type: Type,
    last: Ref,
    current: Ref,
    item: Ref,
    changedKey: Ref<string>,
    changesSlot: Ref,
    changeSetSlot: Ref,
    onChanged: () => void,
    state: ChangeDetectorState,
    schema?: ReflectionClass<any>,
): void {
    const hasChangeSetFn = hasChangeSet;

    // Check if this key is already handled by $inc or $unset
    b.if_(b.not(b.call<boolean>(hasChangeSetFn, changeSetSlot, changedKey)), () => {
        if (type.kind === ReflectionKind.array) {
            // Array comparison
            buildArrayComparator(
                b,
                type,
                last,
                current,
                item,
                changedKey,
                changesSlot,
                changeSetSlot,
                onChanged,
                state,
            );
        } else if (
            (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) &&
            type.types.length
        ) {
            const classSchema = ReflectionClass.from(type);

            if (referenceAnnotation.getFirst(type) !== undefined) {
                // Reference type - compare primary keys
                buildReferenceComparator(
                    b,
                    classSchema,
                    last,
                    current,
                    item,
                    changedKey,
                    changesSlot,
                    changeSetSlot,
                    onChanged,
                    state,
                );
            } else {
                // Nested object - use recursive detector
                buildNestedObjectComparator(
                    b,
                    classSchema,
                    type,
                    last,
                    current,
                    item,
                    changedKey,
                    changesSlot,
                    changeSetSlot,
                    onChanged,
                    state,
                );
            }
        } else if (
            type.kind === ReflectionKind.any ||
            type.kind === ReflectionKind.never ||
            type.kind === ReflectionKind.union
        ) {
            // Use generic comparison for any/never/union types
            b.if_(b.not(b.call<boolean>(genericEqual, last, current)), () => {
                b.set(changesSlot, changedKey, b.get(item, changedKey));
                onChanged();
            });
        } else {
            // Primitive comparison (number, string, boolean, etc.)
            b.if_(b.neq(last, current), () => {
                b.set(changesSlot, changedKey, b.get(item, changedKey));
                onChanged();
            });
        }
    });
}

/**
 * Build array comparison.
 */
function buildArrayComparator(
    b: Builder,
    type: Type & { kind: ReflectionKind.array; type: Type },
    last: Ref,
    current: Ref,
    item: Ref,
    changedKey: Ref<string>,
    changesSlot: Ref,
    changeSetSlot: Ref,
    onChanged: () => void,
    state: ChangeDetectorState,
): void {
    // Both null/undefined - no change
    b.if_(
        b.and(b.not(current), b.not(last)),
        () => {
            // No change - both are null/undefined
        },
        () => {
            // At least one exists
            b.if_(
                b.or(b.and(current, b.not(last)), b.and(b.not(current), last)),
                () => {
                    // One exists, other doesn't - change
                    b.set(changesSlot, changedKey, b.get(item, changedKey));
                    onChanged();
                },
                () => {
                    // Both exist - compare lengths first, then elements
                    b.if_(
                        b.neq(b.len(current), b.len(last)),
                        () => {
                            // Different lengths - change
                            b.set(changesSlot, changedKey, b.get(item, changedKey));
                            onChanged();
                        },
                        () => {
                            // Same length - compare elements
                            const changed = b.var_<boolean>(false);

                            b.loop(last, (elem, idx) => {
                                b.if_(b.not(b.getVar(changed)), () => {
                                    const lastElem = b.at(last, idx);
                                    const currentElem = b.at(current, idx);

                                    // For array elements, we need to compare them
                                    // Using nested comparator (simplified - using genericEqual for elements)
                                    if (
                                        type.type.kind === ReflectionKind.any ||
                                        type.type.kind === ReflectionKind.never ||
                                        type.type.kind === ReflectionKind.union ||
                                        type.type.kind === ReflectionKind.array ||
                                        type.type.kind === ReflectionKind.class ||
                                        type.type.kind === ReflectionKind.objectLiteral
                                    ) {
                                        b.if_(b.not(b.call<boolean>(genericEqual, lastElem, currentElem)), () => {
                                            b.setVar(changed, b.lit(true));
                                        });
                                    } else {
                                        b.if_(b.neq(lastElem, currentElem), () => {
                                            b.setVar(changed, b.lit(true));
                                        });
                                    }
                                });
                            });

                            b.if_(b.getVar(changed), () => {
                                b.set(changesSlot, changedKey, b.get(item, changedKey));
                                onChanged();
                            });
                        },
                    );
                },
            );
        },
    );
}

/**
 * Build reference type comparison (compare primary keys).
 */
function buildReferenceComparator(
    b: Builder,
    classSchema: ReflectionClass<any>,
    last: Ref,
    current: Ref,
    item: Ref,
    changedKey: Ref<string>,
    changesSlot: Ref,
    changeSetSlot: Ref,
    onChanged: () => void,
    state: ChangeDetectorState,
): void {
    // Both null/undefined - no change
    b.if_(
        b.and(b.not(current), b.not(last)),
        () => {
            // No change
        },
        () => {
            b.if_(
                b.or(b.and(current, b.not(last)), b.and(b.not(current), last)),
                () => {
                    // One exists, other doesn't - change
                    b.set(changesSlot, changedKey, b.get(item, changedKey));
                    onChanged();
                },
                () => {
                    // Both exist - compare primary key fields
                    const changed = b.var_<boolean>(false);

                    for (const primaryField of classSchema.getPrimaries()) {
                        const pkName = primaryField.getNameAsString();
                        const lastPk = b.get(last, pkName);
                        const currentPk = b.get(current, pkName);

                        b.if_(b.not(b.getVar(changed)), () => {
                            // Compare primary key values
                            if (
                                primaryField.type.kind === ReflectionKind.any ||
                                primaryField.type.kind === ReflectionKind.never ||
                                primaryField.type.kind === ReflectionKind.union
                            ) {
                                b.if_(b.not(b.call<boolean>(genericEqual, lastPk, currentPk)), () => {
                                    b.setVar(changed, b.lit(true));
                                });
                            } else {
                                b.if_(b.neq(lastPk, currentPk), () => {
                                    b.setVar(changed, b.lit(true));
                                });
                            }
                        });
                    }

                    b.if_(b.getVar(changed), () => {
                        b.set(changesSlot, changedKey, b.get(item, changedKey));
                        onChanged();
                    });
                },
            );
        },
    );
}

/**
 * Build nested object comparison using recursive detector.
 */
function buildNestedObjectComparator(
    b: Builder,
    classSchema: ReflectionClass<any>,
    type: Type,
    last: Ref,
    current: Ref,
    item: Ref,
    changedKey: Ref<string>,
    changesSlot: Ref,
    changeSetSlot: Ref,
    onChanged: () => void,
    state: ChangeDetectorState,
): void {
    // Both null/undefined - no change
    b.if_(
        b.and(b.not(current), b.not(last)),
        () => {
            // No change
        },
        () => {
            b.if_(
                b.or(b.and(current, b.not(last)), b.and(b.not(current), last)),
                () => {
                    // One exists, other doesn't - change
                    b.set(changesSlot, changedKey, b.get(item, changedKey));
                    onChanged();
                },
                () => {
                    // Both exist - use nested change detector
                    let fnVar = state.fnCache.get(type);

                    if (!fnVar) {
                        // Check for circular reference
                        if (state.typeStack.has(type)) {
                            // Circular reference - use lazy initialization
                            fnVar = b.var_<Function>(undefined as any);
                            state.fnCache.set(type, fnVar);

                            // Build the nested detector lazily
                            const nestedDetector = createJITChangeDetectorForSnapshot(classSchema, state);
                            b.setVar(fnVar, b.lit(nestedDetector));
                        } else {
                            // Not circular - build inline
                            state.typeStack.add(type);
                            try {
                                const nestedDetector = createJITChangeDetectorForSnapshot(classSchema, state);
                                fnVar = b.var_<Function>(b.lit(nestedDetector));
                                state.fnCache.set(type, fnVar);
                            } finally {
                                state.typeStack.delete(type);
                            }
                        }
                    }

                    const itemValue = b.get(item, changedKey);
                    const thisChanged = b.let(
                        b.call<ItemChanges<any> | undefined>(
                            (fn: Function, l: any, c: any, i: any) => fn(l, c, i),
                            b.getVar(fnVar),
                            last,
                            current,
                            itemValue,
                        ),
                    );

                    b.if_(b.and(thisChanged, b.not(b.call<boolean>(empty, thisChanged))), () => {
                        b.set(changesSlot, changedKey, itemValue);
                        onChanged();
                    });
                },
            );
        },
    );
}

/**
 * Sort index signatures: literals first, then numbers, then strings.
 */
function sortSignatures(signatures: TypeIndexSignature[]): void {
    signatures.sort((a, b) => {
        const aIsLiteral =
            a.index.kind === ReflectionKind.literal ||
            (a.index.kind === ReflectionKind.union && a.index.types.some(v => v.kind === ReflectionKind.literal));
        const bIsLiteral =
            b.index.kind === ReflectionKind.literal ||
            (b.index.kind === ReflectionKind.union && b.index.types.some(v => v.kind === ReflectionKind.literal));
        const aIsNumber =
            a.index.kind === ReflectionKind.number ||
            (a.index.kind === ReflectionKind.union && a.index.types.some(v => v.kind === ReflectionKind.number));

        if (aIsLiteral) return -1;
        if (aIsNumber && !bIsLiteral) return -1;
        return +1;
    });
}

/**
 * Build index check for index signature key.
 */
function buildIndexCheck(b: Builder, keyRef: Ref<string>, indexType: Type): Ref<boolean> {
    if (indexType.kind === ReflectionKind.number) {
        return b.call<boolean>(isNumeric, keyRef);
    } else if (indexType.kind === ReflectionKind.string || indexType.kind === ReflectionKind.any) {
        return b.eq(b.typeof_(keyRef), b.lit('string'));
    } else if (indexType.kind === ReflectionKind.symbol) {
        return b.eq(b.typeof_(keyRef), b.lit('symbol'));
    } else if (indexType.kind === ReflectionKind.union) {
        // OR of all member checks
        let result: Ref<boolean> | undefined;
        for (const member of indexType.types) {
            const check = buildIndexCheck(b, keyRef, member);
            result = result ? b.or(result, check) : check;
        }
        return result || b.lit(false);
    }
    return b.lit(true);
}

function createJITChangeDetectorForSnapshot(
    schema: ReflectionClass<any>,
    parentState?: ChangeDetectorState,
): (lastSnapshot: any, currentSnapshot: any, item: any) => ItemChanges<any> | undefined {
    const state: ChangeDetectorState = {
        fnCache: parentState?.fnCache ?? new Map(),
        typeStack: parentState?.typeStack ?? new Set(),
    };

    return fn(
        arg<any>(), // last snapshot
        arg<any>(), // current snapshot
        arg<any>(), // item
        (b: Builder, last: Ref<any>, current: Ref<any>, item: Ref<any>) => {
            // Get or create changeSet from item
            const changeSetFromItem = b.call<ItemChanges<any> | undefined>((i: any) => i[changeSetSymbol], item);
            const changeSet = b.let(
                b.ternary(changeSetFromItem, changeSetFromItem, b.new_(ItemChanges, b.lit(undefined), item)),
            );

            // Create changes object to collect detected changes
            const changes = b.let(b.emptyObj<Record<string, any>>());

            // Track existing property names for index signature exclusion
            const existingNames: string[] = [];

            // Process each property
            for (const property of schema.getProperties()) {
                if (property.isBackReference()) continue;

                const name = property.getNameAsString();
                existingNames.push(name);

                const nameRef = b.lit(name);
                const lastProp = b.get(last, name);
                const currentProp = b.get(current, name);

                buildComparator(
                    b,
                    property.type,
                    lastProp,
                    currentProp,
                    item,
                    nameRef,
                    changes,
                    changeSet,
                    () => {
                        /* no break needed at top level */
                    },
                    state,
                    schema,
                );
            }

            // Process index signatures
            const signatures = (schema.type.types as Type[]).filter(
                v => v.kind === ReflectionKind.indexSignature,
            ) as TypeIndexSignature[];

            if (signatures.length) {
                sortSignatures(signatures);

                // Process current keys not in existing properties
                b.forIn(current, (key, _value) => {
                    // Skip if key is in existing property names
                    let skipCondition: Ref<boolean> | undefined;
                    for (const name of existingNames) {
                        const check = b.eq(key, b.lit(name));
                        skipCondition = skipCondition ? b.or(skipCondition, check) : check;
                    }

                    if (skipCondition) {
                        b.if_(
                            skipCondition,
                            () => {
                                // Skip - already handled
                            },
                            () => {
                                buildIndexSignatureComparison(
                                    b,
                                    signatures,
                                    key,
                                    last,
                                    current,
                                    item,
                                    changes,
                                    changeSet,
                                    state,
                                );
                            },
                        );
                    } else {
                        buildIndexSignatureComparison(
                            b,
                            signatures,
                            key,
                            last,
                            current,
                            item,
                            changes,
                            changeSet,
                            state,
                        );
                    }
                });

                // Check for keys in last but not in current (deleted)
                b.forIn(last, (key, _value) => {
                    b.if_(b.not(b.has(current, key)), () => {
                        b.set(changes, key, b.get(item, key));
                    });
                });
            }

            // Merge detected changes into changeSet
            // Note: b.exec() forces evaluation for side effects (call alone is lazy)
            b.exec(b.call<void>((cs: ItemChanges<any>, c: Record<string, any>) => cs.mergeSet(c), changeSet, changes));

            // Return changeSet if not empty, undefined otherwise
            return b.ternary(b.get<boolean>(changeSet, 'empty'), b.lit(undefined), changeSet);
        },
    );
}

/**
 * Build index signature comparison for a dynamic key.
 */
function buildIndexSignatureComparison(
    b: Builder,
    signatures: TypeIndexSignature[],
    key: Ref<string>,
    last: Ref,
    current: Ref,
    item: Ref,
    changes: Ref,
    changeSet: Ref,
    state: ChangeDetectorState,
): void {
    // Build condition chain for signatures
    const cases: Array<[Ref<boolean>, () => void]> = [];

    for (const signature of signatures) {
        const check = buildIndexCheck(b, key, signature.index);
        cases.push([
            check,
            () => {
                const lastValue = b.get(last, key);
                const currentValue = b.get(current, key);

                buildComparator(
                    b,
                    signature.type,
                    lastValue,
                    currentValue,
                    item,
                    key,
                    changes,
                    changeSet,
                    () => {
                        /* no break needed */
                    },
                    state,
                );
            },
        ]);
    }

    if (cases.length > 0) {
        b.cond(cases);
    }
}

const changeDetectorSymbol = Symbol('changeDetector');

export function getChangeDetector<T extends object>(
    classSchema: ReflectionClass<T>,
): (last: any, current: any, item: T) => ItemChanges<T> | undefined {
    const jitContainer = classSchema.getJitContainer();
    if (jitContainer[changeDetectorSymbol]) return jitContainer[changeDetectorSymbol];

    jitContainer[changeDetectorSymbol] = createJITChangeDetectorForSnapshot(classSchema);
    toFastProperties(jitContainer);

    return jitContainer[changeDetectorSymbol];
}

export function buildChanges<T extends object>(
    classSchema: ReflectionClass<T>,
    lastSnapshot: any,
    item: T,
): Changes<T> {
    const currentSnapshot = getConverterForSnapshot(classSchema)(item);
    const detector = getChangeDetector(classSchema);
    return (detector(lastSnapshot, currentSnapshot, item) as Changes<T>) || new Changes<T>();
}
