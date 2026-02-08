/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref, arg, fn, isObject, toFastProperties } from '@deepkit/core';

import {
    UnpopulatedCheck,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    base64ToTypedArray,
    typeSettings,
    typedArrayToBase64,
} from './core.js';
import { ReflectionClass, ReflectionProperty } from './reflection/reflection.js';
import { ReflectionKind, Type, binaryTypes } from './reflection/type.js';
import { Serializer, serializer as defaultSerializer } from './serializer/serializer.js';
import { PrimaryKeyFields } from './type-annotations.js';

/**
 * Deep clone helper for snapshot values.
 */
function cloneValueDeep(value: any): any {
    if (Array.isArray(value)) return value.map(v => cloneValueDeep(v));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof Set) return new Set(value);
    if (value instanceof Map) return new Map(value);
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof Uint16Array) return new Uint16Array(value);
    if (value instanceof Uint32Array) return new Uint32Array(value);
    if (value instanceof Int8Array) return new Int8Array(value);
    if (value instanceof Int16Array) return new Int16Array(value);
    if (value instanceof Int32Array) return new Int32Array(value);
    if (value instanceof Float32Array) return new Float32Array(value);
    if (value instanceof Float64Array) return new Float64Array(value);
    if (value instanceof BigInt64Array) return new BigInt64Array(value);
    if (value instanceof BigUint64Array) return new BigUint64Array(value);
    if (value instanceof DataView) return new DataView(value.buffer.slice(0));
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (isObject(value)) {
        const copy: any = {};
        for (const i in value) {
            copy[i] = cloneValueDeep(value[i]);
        }
        return copy;
    }
    return value;
}

/**
 * Build a snapshot value converter for a single type.
 * Converts value to a snapshot-friendly format (JSON-like with references as primary keys).
 */
function buildSnapshotValue(b: Builder, input: Ref, type: Type, direction: 'serialize' | 'deserialize'): Ref {
    switch (type.kind) {
        case ReflectionKind.string:
        case ReflectionKind.number:
        case ReflectionKind.boolean:
        case ReflectionKind.bigint:
        case ReflectionKind.null:
        case ReflectionKind.undefined:
        case ReflectionKind.literal:
            // Primitives pass through unchanged
            return input;

        case ReflectionKind.any:
            // Any type: deep clone for snapshot
            return b.call(cloneValueDeep, input);

        case ReflectionKind.array: {
            const elemType = type.type;
            return b.map(input, elem => buildSnapshotValue(b, elem, elemType, direction));
        }

        case ReflectionKind.class: {
            const classType = type.classType;

            // Check if it's a binary type (ArrayBuffer, Uint8Array, etc)
            if (binaryTypes.includes(classType)) {
                if (direction === 'serialize') {
                    // Serialize: convert to base64
                    if (classType === ArrayBuffer) {
                        return b.call(arrayBufferToBase64, input);
                    } else {
                        // TypedArray
                        return b.call(typedArrayToBase64, input);
                    }
                } else {
                    // Deserialize: convert from base64
                    if (classType === ArrayBuffer) {
                        return b.call(base64ToArrayBuffer, input);
                    } else {
                        // TypedArray - need to call with the specific class
                        return b.call(
                            (val: string, ctor: any) => base64ToTypedArray(val, ctor),
                            input,
                            b.lit(classType),
                        );
                    }
                }
            }

            // Check if it's a Date
            if (classType === Date) {
                return b.new_(
                    Date,
                    b.call((d: Date) => d.getTime(), input),
                );
            }
            // Check if it's Set
            if (classType === Set) {
                return b.new_(Set, input);
            }
            // Check if it's Map
            if (classType === Map) {
                return b.new_(Map, input);
            }
            // For other classes, treat as object literal
            return buildSnapshotObject(b, input, type.types, direction);
        }

        case ReflectionKind.objectLiteral:
            return buildSnapshotObject(b, input, type.types, direction);

        case ReflectionKind.tuple: {
            const result = b.let(b.emptyArr());
            for (let i = 0; i < type.types.length; i++) {
                const member = type.types[i];
                const elemValue = buildSnapshotValue(b, input.at(i), member.type, direction);
                b.push(result, elemValue);
            }
            return result;
        }

        case ReflectionKind.union: {
            // For unions, pass through - runtime will handle which member applies
            return input;
        }

        default:
            // Unknown types pass through
            return input;
    }
}

/**
 * Build snapshot conversion for object/class members.
 * Handles both explicit properties and index signatures.
 */
function buildSnapshotObject(
    b: Builder,
    input: Ref,
    members: readonly Type[],
    direction: 'serialize' | 'deserialize',
): Ref {
    const result = b.let(b.emptyObj());
    const explicitNames: string[] = [];

    // Process explicit properties first
    for (const member of members) {
        if (member.kind !== ReflectionKind.property && member.kind !== ReflectionKind.propertySignature) {
            continue;
        }

        const propName = typeof member.name === 'symbol' ? member.name.toString() : String(member.name);
        explicitNames.push(propName);
        const propAccess = input.get(propName);
        const memberType = member.type;

        b.if_(
            b.not(b.isNullish(propAccess)),
            () => {
                const value = buildSnapshotValue(b, propAccess, memberType, direction);
                b.set(result, propName, value);
            },
            () => {
                b.set(result, propName, b.lit(null));
            },
        );
    }

    // Process index signatures (dynamic keys)
    const indexSignatures = members.filter(m => m.kind === ReflectionKind.indexSignature);
    if (indexSignatures.length > 0) {
        // For each index signature, iterate over all keys in input
        // Use the first index signature's type for value conversion
        // (TypeScript only allows one index signature per index type)
        const indexSig = indexSignatures[0] as { type: Type };

        b.forIn(input, key => {
            // Skip explicit property names
            let skipCondition: Ref<boolean> | undefined;
            for (const name of explicitNames) {
                const check = b.eq(key, b.lit(name));
                skipCondition = skipCondition ? b.or(skipCondition, check) : check;
            }

            const processKey = () => {
                const propAccess = input.get(key);
                b.if_(
                    b.not(b.isNullish(propAccess)),
                    () => {
                        const value = buildSnapshotValue(b, propAccess, indexSig.type, direction);
                        b.set(result, key, value);
                    },
                    () => {
                        b.set(result, key, b.lit(null));
                    },
                );
            };

            if (skipCondition) {
                b.if_(b.not(skipCondition), () => {
                    processKey();
                });
            } else {
                processKey();
            }
        });
    }

    return result;
}

/**
 * Creates a JIT converter for snapshot using fn().
 * Converts class instance to snapshot format where references are stored as their primary keys.
 */
function createJITConverterForSnapshot(
    schema: ReflectionClass<any>,
    properties: ReflectionProperty[],
    direction: 'serialize' | 'deserialize',
): (value: any, state?: any) => any {
    const hasCircular = schema.hasCircularReference();

    return fn(arg<any>(), arg<any>(), (b: Builder, input: Ref<any>, stateArg: Ref<any>) => {
        // Initialize state
        const state = b.let(b.ternary(stateArg, stateArg, b.emptyObj()));
        const result = b.let(b.emptyObj());

        // Circular reference check
        if (hasCircular) {
            const stack = state.get('_stack');
            b.if_(
                stack,
                () => {
                    b.if_(
                        b.call((arr: any[], val: any) => arr.includes(val), stack, input),
                        () => {
                            return b.lit(undefined);
                        },
                    );
                },
                () => {
                    b.set(state, '_stack', b.emptyArr());
                },
            );
            b.push(state.get('_stack'), input);
        }

        // Temporarily disable unpopulated check
        const oldCheck = b.let(b.lit(typeSettings).get('unpopulatedCheck'));
        b.set(b.lit(typeSettings), 'unpopulatedCheck', b.lit(UnpopulatedCheck.None));

        // Process each property
        for (const property of properties) {
            const propName = property.getNameAsString();
            const propAccess = input.get(propName);
            const propType = property.type;

            if (property.isReference()) {
                // Reference: store only primary keys
                const refClass = property.getResolvedReflectionClass();
                const primaries = refClass.getPrimaries();

                b.if_(
                    b.isNullish(propAccess),
                    () => {
                        b.set(result, propName, b.lit(null));
                    },
                    () => {
                        // Build object with primary keys only
                        const refResult = b.let(b.emptyObj());
                        for (const pk of primaries) {
                            const pkName = pk.getNameAsString();
                            const pkAccess = propAccess.get(pkName);
                            const pkValue = buildSnapshotValue(b, pkAccess, pk.type, direction);
                            b.set(refResult, pkName, pkValue);
                        }
                        b.set(result, propName, refResult);
                    },
                );
            } else {
                // Regular property: convert with snapshot serialization
                b.if_(
                    b.isNullish(propAccess),
                    () => {
                        b.set(result, propName, b.lit(null));
                    },
                    () => {
                        const value = buildSnapshotValue(b, propAccess, propType, direction);
                        b.set(result, propName, value);
                    },
                );
            }
        }

        // Restore unpopulated check
        b.set(b.lit(typeSettings), 'unpopulatedCheck', oldCheck);

        // Pop from circular stack
        if (hasCircular) {
            b.call((arr: any[]) => arr.pop(), state.get('_stack'));
        }

        return result;
    });
}

/**
 * Creates a new JIT compiled function to convert the class instance to a snapshot.
 * A snapshot is essentially the class instance as `plain` serialization while references are
 * stored only as their primary keys.
 *
 * Generated function is cached.
 */
export function getConverterForSnapshot(reflectionClass: ReflectionClass<any>): (value: any) => any {
    const jitContainer = reflectionClass.getJitContainer();
    if (jitContainer.snapshotConverter) return jitContainer.snapshotConverter;

    jitContainer.snapshotConverter = createJITConverterForSnapshot(
        reflectionClass,
        reflectionClass.getProperties(),
        'serialize',
    );
    toFastProperties(jitContainer);
    return jitContainer.snapshotConverter;
}

/**
 * Creates a snapshot using getConverterForSnapshot().
 */
export function createSnapshot<T>(reflectionClass: ReflectionClass<T>, item: T) {
    return getConverterForSnapshot(reflectionClass)(item);
}

/**
 * Extracts the primary key of a snapshot and converts to class type.
 */
export function getPrimaryKeyExtractor<T>(reflectionClass: ReflectionClass<T>): (value: any) => Partial<T> {
    const jitContainer = reflectionClass.getJitContainer();
    if (jitContainer.primaryKey) return jitContainer.primaryKey;

    jitContainer.primaryKey = createJITConverterForSnapshot(
        reflectionClass,
        reflectionClass.getPrimaries(),
        'deserialize',
    );
    toFastProperties(jitContainer);
    return jitContainer.primaryKey;
}

/**
 * Creates a primary key hash generator that takes an item from any format
 * converts it to class format, then to plain, then uses the primitive values to create a string hash.
 *
 * This function is designed to work on the plain values (db records or json values)
 */
export function getPrimaryKeyHashGenerator(
    reflectionClass: ReflectionClass<any>,
    serializerToUse: Serializer = defaultSerializer,
): (value: any) => string {
    const jitContainer = reflectionClass.getJitContainer();

    if (!jitContainer.pkHash) {
        jitContainer.pkHash = {};
        toFastProperties(jitContainer);
    }

    if (jitContainer.pkHash[serializerToUse.name]) return jitContainer.pkHash[serializerToUse.name];

    jitContainer.pkHash[serializerToUse.name] = createPrimaryKeyHashGenerator(reflectionClass, serializerToUse);
    toFastProperties(jitContainer.pkHash);
    return jitContainer.pkHash[serializerToUse.name];
}

function simplePrimaryKeyHash(value: any): string {
    return '\0' + value;
}

export function getSimplePrimaryKeyHashGenerator(reflectionClass: ReflectionClass<any>) {
    const primary = reflectionClass.getPrimary();
    return (data: PrimaryKeyFields<any>) => simplePrimaryKeyHash(data[primary.name]);
}

/**
 * Build hash value for a single type, converting to string representation.
 */
function buildHashValue(b: Builder, input: Ref, type: Type): Ref<string> {
    switch (type.kind) {
        case ReflectionKind.string:
            return input as Ref<string>;

        case ReflectionKind.number:
        case ReflectionKind.bigint:
            return b.concat(input, b.lit(''));

        case ReflectionKind.boolean:
            return b.ternary(input, b.lit('true'), b.lit('false'));

        case ReflectionKind.literal:
            return b.lit(String(type.literal));

        case ReflectionKind.class: {
            const classType = type.classType;
            if (classType === Date) {
                return b.call((d: Date) => d.toISOString(), input);
            }
            // Binary types: convert to base64 for hashing
            if (binaryTypes.includes(classType)) {
                if (classType === ArrayBuffer) {
                    return b.call(arrayBufferToBase64, input);
                } else {
                    return b.call(typedArrayToBase64, input);
                }
            }
            // Other classes: convert to string
            return b.concat(input, b.lit(''));
        }

        default:
            // Unknown types: convert to string
            return b.concat(input, b.lit(''));
    }
}

/**
 * Creates a primary key hash generator using fn().
 */
function createPrimaryKeyHashGenerator(
    reflectionClass: ReflectionClass<any>,
    serializerToUse: Serializer,
): (value: any, state?: any) => string {
    const hasCircular = reflectionClass.hasCircularReference();
    const primaries = reflectionClass.getPrimaries();

    return fn(arg<any>(), arg<any>(), (b: Builder, input: Ref<any>, stateArg: Ref<any>) => {
        // Initialize state
        const state = b.let(b.ternary(stateArg, stateArg, b.emptyObj()));
        const resultRef = b.var_('');

        // Circular reference check
        if (hasCircular) {
            const stack = state.get('_stack');
            b.if_(
                stack,
                () => {
                    b.if_(
                        b.call((arr: any[], val: any) => arr.includes(val), stack, input),
                        () => {
                            return b.lit(undefined);
                        },
                    );
                },
                () => {
                    b.set(state, '_stack', b.emptyArr());
                },
            );
            b.push(state.get('_stack'), input);
        }

        // Process each primary key property
        for (const property of primaries) {
            const propName = property.getNameAsString();
            const propAccess = input.get(propName);
            const propType = property.type;

            if (property.isReference()) {
                // Reference: get primary key from referenced object
                const refClass = property.getResolvedReflectionClass();
                const refPrimaries = refClass.getPrimaries();

                b.if_(
                    b.and(b.neq(propAccess, b.lit(undefined)), b.not(b.isNull(propAccess))),
                    () => {
                        b.if_(
                            b.call(isObject, propAccess),
                            () => {
                                // It's an object - extract primary keys
                                for (const pk of refPrimaries) {
                                    if (pk.type.kind === ReflectionKind.class && (pk.type as any).types?.length) {
                                        b.throw_(
                                            b.new_(
                                                Error,
                                                b.lit(
                                                    `Class as primary key (${refClass.getClassName()}.${pk.getNameAsString()}) is not supported`,
                                                ),
                                            ),
                                        );
                                    }

                                    const pkName = pk.getNameAsString();
                                    const deepAccess = propAccess.get(pkName);

                                    b.if_(
                                        b.and(b.neq(deepAccess, b.lit(null)), b.neq(deepAccess, b.lit(undefined))),
                                        () => {
                                            const hashVal = buildHashValue(b, deepAccess, pk.type);
                                            b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0'), hashVal));
                                        },
                                        () => {
                                            b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0')));
                                        },
                                    );
                                }
                            },
                            () => {
                                // Might be a primary key directly
                                const pkType = refClass.getPrimary().type;
                                const hashVal = buildHashValue(b, propAccess, pkType);
                                b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0'), hashVal));
                            },
                        );
                    },
                    () => {
                        b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0')));
                    },
                );
            } else {
                // Regular primary key property
                if (propType.kind === ReflectionKind.class && (propType as any).types?.length) {
                    b.throw_(
                        b.new_(
                            Error,
                            b.lit(
                                `Class as primary key (${reflectionClass.getClassName()}.${propName}) is not supported`,
                            ),
                        ),
                    );
                }

                b.if_(
                    b.and(b.neq(propAccess, b.lit(null)), b.neq(propAccess, b.lit(undefined))),
                    () => {
                        const hashVal = buildHashValue(b, propAccess, propType);
                        b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0'), hashVal));
                    },
                    () => {
                        b.setVar(resultRef, b.concat(b.getVar(resultRef), b.lit('\0')));
                    },
                );
            }
        }

        // Pop from circular stack
        if (hasCircular) {
            b.call((arr: any[]) => arr.pop(), state.get('_stack'));
        }

        return b.getVar(resultRef);
    });
}
