/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import type { Builder, Ref } from '@deepkit/core';
import { isNumeric, stringifyValueWithType } from '@deepkit/core';
import { TypeNumberBrand } from '@deepkit/type-spec';

import {
    arrayBufferToBase64,
    base64ToArrayBuffer,
    base64ToTypedArray,
    typedArrayToBase64,
    unpopulatedSymbol,
} from '../core.js';
import { createReference, isReferenceInstance } from '../reference.js';
import { extendTemplateLiteral, isExtendable } from '../reflection/extends.js';
import { resolveRuntimeType } from '../reflection/processor.js';
import { ReflectionClass, hasCircularReference } from '../reflection/reflection.js';
import {
    ReflectionKind,
    Type,
    TypeArray,
    TypeClass,
    TypeEnum,
    TypeFunction,
    TypeIndexSignature,
    TypeLiteral,
    TypeMethod,
    TypeMethodSignature,
    TypeNumber,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTemplateLiteral,
    TypeTuple,
    TypeUnion,
    binaryTypes,
    getDeepConstructorProperties,
    getEnumValueIndexMatcher,
    isNullable,
    isOptional,
    isPropertyMemberType,
    memberNameToString,
    resolveTypeMembers,
    stringifyType,
} from '../reflection/type.js';
import {
    BinaryBigIntType,
    binaryBigIntAnnotation,
    embeddedAnnotation,
    excludedAnnotation,
    groupAnnotation,
    isBackReferenceType,
    isMongoIdType,
    isNanoIdType,
    isReferenceType,
    isUUIDType,
    referenceAnnotation,
} from '../type-annotations.js';
import { ValidationErrorItem, ValidatorError } from '../validator.js';
import type { TypeHandler } from './registry.js';
import type { Serializer } from './serializer.js';
import { JsonBuildContext, isGroupAllowed } from './state.js';
import { UNION_LITERAL_THRESHOLD, detectDiscriminator } from './union-utils.js';

/**
 * Type handler for JSON serialization.
 * Uses JsonBuildContext which provides JSON-specific methods like forProperty, isLoose, etc.
 */
type JsonTypeHandler<T extends Type = Type> = TypeHandler<T, JsonBuildContext>;

// ============================================================================
// Validation Error Helpers
// ============================================================================

/**
 * Create a guard that returns a score (0 or 1000) with optional error collection.
 */
function guardWithError(
    b: Builder,
    state: JsonBuildContext,
    input: Ref,
    condition: Ref<boolean>,
    errorCode: string,
    errorMessage: string,
): Ref<number> {
    const score = b.var_(b.ternary(condition, b.lit(1000), b.lit(0)));
    const errorsRef = state.optionsRef.get('errors' as any);
    b.if_(b.and(errorsRef, b.eq(b.getVar(score), b.lit(0))), () => {
        const errorItem = b.new_(ValidationErrorItem, state.pathRef(), b.lit(errorCode), b.lit(errorMessage), input);
        b.push(errorsRef, errorItem);
    });
    return b.getVar(score);
}

/**
 * Create a guard with a "Cannot convert X to Y" style error message.
 */
function guardWithTypeError(
    b: Builder,
    state: JsonBuildContext,
    input: Ref,
    condition: Ref<boolean>,
    expectedType: string,
): Ref<number> {
    const score = b.var_(b.ternary(condition, b.lit(1000), b.lit(0)));
    const errorsRef = state.optionsRef.get('errors' as any);
    b.if_(b.and(errorsRef, b.eq(b.getVar(score), b.lit(0))), () => {
        const valueStr = b.call(stringifyValueWithType, input);
        const errorMsg = b.concat(b.lit('Cannot convert '), valueStr, b.lit(' to '), b.lit(expectedType));
        const errorItem = b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), errorMsg, input);
        b.push(errorsRef, errorItem);
    });
    return b.getVar(score);
}

// ============================================================================
// String Helpers
// ============================================================================

function isSignedNumericString(value: string): boolean {
    if (!value) return false;
    let candidate = value;
    if (candidate[0] === '-' || candidate[0] === '+') {
        candidate = candidate.slice(1);
        if (!candidate) return false;
    }
    return isNumeric(candidate);
}

function isSignedIntegerString(value: string): boolean {
    if (!value) return false;
    let candidate = value;
    if (candidate[0] === '-' || candidate[0] === '+') {
        candidate = candidate.slice(1);
        if (!candidate) return false;
    }
    if (candidate.includes('.')) return false;
    return isNumeric(candidate);
}

// ============================================================================
// Binary BigInt Helpers
// ============================================================================

function getBinaryBigIntMode(type: Type): BinaryBigIntType | undefined {
    const annotation = binaryBigIntAnnotation.getFirst(type);
    if (annotation !== undefined) return annotation;
    if (type.typeName === 'BinaryBigInt') return BinaryBigIntType.unsigned;
    if (type.typeName === 'SignedBinaryBigInt') return BinaryBigIntType.signed;
    const originNames = type.originTypes?.map(origin => origin.typeName) || [];
    if (originNames.includes('BinaryBigInt')) return BinaryBigIntType.unsigned;
    if (originNames.includes('SignedBinaryBigInt')) return BinaryBigIntType.signed;
    return undefined;
}

// ============================================================================
// Type Guard Helpers
// ============================================================================

/**
 * Check if input is an object (not null, not array).
 */
function isPlainObject(b: Builder, input: Ref): Ref<boolean> {
    return b.and(b.isType(input, 'object'), b.not(b.isNull(input)));
}

/**
 * Push a type error when a condition is met and error collection is enabled.
 */
function pushTypeErrorWhen(
    b: Builder,
    state: JsonBuildContext,
    input: Ref,
    condition: Ref<boolean>,
    message: string,
): void {
    const errorsRef = state.optionsRef.get('errors' as any);
    b.if_(b.and(errorsRef, condition), () => {
        b.push(errorsRef, b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit(message), input));
    });
}

/**
 * Check if a type's guard can use pure expression-only code (no statements).
 */
function isPureTypeGuard(type: Type, visited: Set<Type> = new Set()): boolean {
    if (visited.has(type)) return true;
    visited.add(type);

    switch (type.kind) {
        case ReflectionKind.string:
        case ReflectionKind.number:
        case ReflectionKind.boolean:
        case ReflectionKind.bigint:
        case ReflectionKind.null:
        case ReflectionKind.undefined:
        case ReflectionKind.symbol:
        case ReflectionKind.literal:
        case ReflectionKind.any:
        case ReflectionKind.unknown:
        case ReflectionKind.never:
        case ReflectionKind.void:
        case ReflectionKind.enum:
        case ReflectionKind.regexp:
        case ReflectionKind.templateLiteral:
            return true;

        case ReflectionKind.union:
            return (type as TypeUnion).types.every(t => isPureTypeGuard(t, visited));

        case ReflectionKind.objectLiteral: {
            const members = resolveTypeMembers(type as TypeObjectLiteral);
            for (const member of members) {
                if (member.kind === ReflectionKind.indexSignature) return false;
                if (isPropertyMemberType(member)) {
                    if (!isPureTypeGuard(member.type, visited)) return false;
                }
            }
            return true;
        }

        case ReflectionKind.class: {
            const classType = type as TypeClass;
            const builtinImpure = [
                Map,
                Set,
                WeakMap,
                WeakSet,
                Date,
                RegExp,
                ArrayBuffer,
                DataView,
                Int8Array,
                Uint8Array,
                Uint8ClampedArray,
                Int16Array,
                Uint16Array,
                Int32Array,
                Uint32Array,
                Float32Array,
                Float64Array,
                BigInt64Array,
                BigUint64Array,
            ];
            if (builtinImpure.some(c => classType.classType === c)) return false;

            const reflection = ReflectionClass.from(classType.classType);
            if (reflection.validationMethod) return false;

            const members = resolveTypeMembers(classType);
            for (const member of members) {
                if (member.kind === ReflectionKind.indexSignature) return false;
                if (isPropertyMemberType(member)) {
                    if (!isPureTypeGuard(member.type, visited)) return false;
                }
            }
            return true;
        }

        case ReflectionKind.tuple: {
            const tupleType = type as TypeTuple;
            for (const elem of tupleType.types) {
                if (elem.type.kind === ReflectionKind.rest) return false;
                if (!isPureTypeGuard(elem.type, visited)) return false;
            }
            return true;
        }

        case ReflectionKind.array:
            return false;

        case ReflectionKind.function:
        case ReflectionKind.method:
        case ReflectionKind.methodSignature:
        case ReflectionKind.promise:
            return false;

        case ReflectionKind.intersection: {
            const types = (type as any).types as Type[];
            return types.every(t => isPureTypeGuard(t, visited));
        }

        default:
            return false;
    }
}

/**
 * Find the rest element in a tuple type.
 */
function findTupleRest(tupleType: TypeTuple): { index: number; type?: Type } {
    for (let i = 0; i < tupleType.types.length; i++) {
        if (tupleType.types[i].type.kind === ReflectionKind.rest) {
            return { index: i, type: (tupleType.types[i].type as any).type };
        }
    }
    return { index: -1 };
}

/**
 * Collect prefixed property names for embedded types.
 */
function collectPrefixedPropertyNames(embeddedMembers: Type[], prefix: string, state: JsonBuildContext): string[] {
    const names: string[] = [];
    for (const m of embeddedMembers) {
        if (!isPropertyMemberType(m)) continue;
        const subPropName = memberNameToString((m as TypeProperty | TypePropertySignature).name);
        const serializedName =
            state.namingStrategy.getPropertyName(m as TypeProperty | TypePropertySignature, state.serializer.name) ||
            subPropName;
        names.push(prefix + serializedName);
    }
    return names;
}

/**
 * Get error message for type mismatch.
 */
function getTypeMismatchMessage(type: Type): string {
    switch (type.kind) {
        case ReflectionKind.string:
            return 'Not a string';
        case ReflectionKind.number:
            return 'Not a number';
        case ReflectionKind.boolean:
            return 'Not a boolean';
        case ReflectionKind.bigint:
            return 'Not a bigint';
        case ReflectionKind.null:
            return 'Not null';
        case ReflectionKind.undefined:
            return 'Not undefined';
        case ReflectionKind.array:
            return 'Not an array';
        case ReflectionKind.objectLiteral:
        case ReflectionKind.class:
            return 'Not an object';
        default:
            return 'Type mismatch';
    }
}

// ============================================================================
// Guard Factory
// ============================================================================

/**
 * Factory for creating primitive type guard pairs (score-based and fast).
 */
function createPrimitiveGuardPair(
    check: (b: Builder, input: Ref) => Ref<boolean>,
    errorMessage: string,
): { score: JsonTypeHandler; fast: JsonTypeHandler } {
    return {
        score: (type, input, b, state) => guardWithError(b, state, input, check(b, input), 'type', errorMessage),
        fast: (type, input, b, state) => check(b, input),
    };
}

/**
 * Factory for creating type-aware guard pairs where the condition depends on
 * the Type or JsonBuildContext. Returns both score-based and fast variants.
 */
function createTypeGuardPair(
    buildCondition: (type: Type, input: Ref, b: Builder, state: JsonBuildContext) => Ref<boolean>,
    errorMessage: string,
): { score: JsonTypeHandler; fast: JsonTypeHandler } {
    return {
        score: (type, input, b, state) =>
            guardWithError(b, state, input, buildCondition(type, input, b, state), 'type', errorMessage),
        fast: (type, input, b, state) => buildCondition(type, input, b, state),
    };
}

// Primitive guard pairs
const stringGuards = createPrimitiveGuardPair((b, input) => b.isType(input, 'string'), 'Not a string');
const booleanGuards = createPrimitiveGuardPair((b, input) => b.isType(input, 'boolean'), 'Not a boolean');
const bigIntGuards = createPrimitiveGuardPair((b, input) => b.isType(input, 'bigint'), 'Not a bigint');
const nullGuards = createPrimitiveGuardPair((b, input) => b.isNull(input), 'Not null');
const undefinedGuards = createPrimitiveGuardPair((b, input) => b.eq(input, b.lit(undefined)), 'Not undefined');

// Any is special: always valid
const anyGuards = {
    score: ((type: Type, input: Ref, b: Builder, state: JsonBuildContext) => b.lit(1000)) as JsonTypeHandler,
    fast: ((type: Type, input: Ref, b: Builder, state: JsonBuildContext) => b.lit(true)) as JsonTypeHandler,
};

// ============================================================================
// Primitive Serialize Handlers
// ============================================================================

export const handleString: JsonTypeHandler = (type, input, b, state) => input;
export const handleNumber: JsonTypeHandler = (type, input, b, state) => input;
export const handleBoolean: JsonTypeHandler = (type, input, b, state) => input;
export const handleBigInt: JsonTypeHandler = (type, input, b, state) => b.call(String, input);
export const handleNull: JsonTypeHandler = (type, input, b, state) => b.lit(null);
export const handleUndefined: JsonTypeHandler = (type, input, b, state) => b.lit(undefined);
export const serializeUndefined: JsonTypeHandler = (type, input, b, state) => b.lit(null); // JSON has no undefined
export const handleAny: JsonTypeHandler = (type, input, b, state) => input;
export const handleUnknown: JsonTypeHandler = (type, input, b, state) => input;
export const handleLiteral: JsonTypeHandler = (type, input, b, state) => b.lit((type as TypeLiteral).literal);
export const handleEnum: JsonTypeHandler = (type, input, b, state) => input;
export const handlePromise: JsonTypeHandler = (type, input, b, state) => state.build((type as any).type, input);

// ============================================================================
// Primitive Deserialize Handlers
// ============================================================================

export const deserializeString: JsonTypeHandler = (type, input, b, state) => {
    const result = b.var_(input);
    const isLoose = state.isLoose();

    b.if_(
        b.and(isLoose, b.or(b.isType(input, 'number'), b.or(b.isType(input, 'boolean'), b.isType(input, 'bigint')))),
        () => {
            b.setVar(result, b.call(String, input));
        },
    );

    return b.getVar(result);
};

export const deserializeNumber: JsonTypeHandler = (type, input, b, state) => {
    const numberType = type as TypeNumber;
    const brand = numberType.brand;
    const isLoose = state.isLoose();

    const canCoerceString = b.var_(b.lit(false));
    b.if_(b.and(isLoose, b.isType(input, 'string')), () => {
        b.setVar(canCoerceString, b.call(isSignedNumericString, input));
    });
    const canCoerceBoolean = b.and(isLoose, b.isType(input, 'boolean'));

    const coerced = b.ternary(
        b.isType(input, 'number'),
        input,
        b.ternary(
            canCoerceBoolean,
            b.ternary(input, b.lit(1), b.lit(0)),
            b.ternary(b.getVar(canCoerceString), b.call(Number, input), input),
        ),
    );

    // Apply brand constraints
    const isNumber = b.isType(coerced, 'number');

    if (brand === TypeNumberBrand.integer) {
        return b.ternary(isNumber, b.call(Math.trunc, coerced), coerced);
    }
    if (brand === TypeNumberBrand.int8) {
        return b.ternary(
            isNumber,
            b.call((v: number) => Math.max(-128, Math.min(127, Math.trunc(v))), coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.uint8) {
        return b.ternary(
            isNumber,
            b.call((v: number) => Math.max(0, Math.min(255, Math.trunc(v))), coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.int16) {
        return b.ternary(
            isNumber,
            b.call((v: number) => Math.max(-32768, Math.min(32767, Math.trunc(v))), coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.uint16) {
        return b.ternary(
            isNumber,
            b.call((v: number) => Math.max(0, Math.min(65535, Math.trunc(v))), coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.int32) {
        return b.ternary(
            isNumber,
            b.call((v: number) => v | 0, coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.uint32) {
        return b.ternary(
            isNumber,
            b.call((v: number) => v >>> 0, coerced),
            coerced,
        );
    }
    if (brand === TypeNumberBrand.float32) {
        return b.ternary(isNumber, b.call(Math.fround, coerced), coerced);
    }

    return coerced;
};

export const deserializeBoolean: JsonTypeHandler = (type, input, b, state) => {
    const isLoose = state.isLoose();
    const result = b.var_(input);

    const truthy = b.or(b.eq(input, b.lit('true')), b.or(b.eq(input, b.lit('1')), b.eq(input, b.lit(1))));
    const falsy = b.or(b.eq(input, b.lit('false')), b.or(b.eq(input, b.lit('0')), b.eq(input, b.lit(0))));

    b.if_(b.isType(input, 'boolean'), () => b.setVar(result, input));
    b.if_(b.and(isLoose, b.not(b.isType(input, 'boolean'))), () => {
        b.if_(truthy, () => b.setVar(result, b.lit(true)));
        b.if_(falsy, () => b.setVar(result, b.lit(false)));
    });

    return b.getVar(result);
};

export const deserializeBigInt: JsonTypeHandler = (type, input, b, state) => {
    const isLoose = state.isLoose();
    const canCoerceString = b.var_(b.lit(false));
    b.if_(b.and(isLoose, b.isType(input, 'string')), () => {
        b.setVar(canCoerceString, b.call(isSignedIntegerString, input));
    });
    const canCoerceNumber = b.and(isLoose, b.isType(input, 'number'));
    const result = b.var_(
        b.ternary(
            b.isType(input, 'bigint'),
            input,
            b.ternary(b.or(b.getVar(canCoerceString), canCoerceNumber), b.call(BigInt, input), input),
        ),
    );
    return b.getVar(result);
};

export const serializeBinaryBigInt: JsonTypeHandler = (type, input, b, state) => {
    const annotation = getBinaryBigIntMode(type);
    const result = b.var_(input);

    b.if_(b.lit(annotation === BinaryBigIntType.unsigned), () => {
        b.if_(b.lt(b.getVar(result), b.lit(0n)), () => {
            b.setVar(result, b.lit(0n));
        });
    });

    return b.call(String, b.getVar(result));
};

export const deserializeBinaryBigInt: JsonTypeHandler = (type, input, b, state) => {
    const annotation = getBinaryBigIntMode(type);
    const base = deserializeBigInt(type, input, b, state);
    const result = b.var_(base);

    b.if_(b.and(b.lit(annotation === BinaryBigIntType.unsigned), b.isType(b.getVar(result), 'bigint')), () => {
        b.if_(b.lt(b.getVar(result), b.lit(0n)), () => {
            b.setVar(result, b.lit(0n));
        });
    });

    return b.getVar(result);
};

export const deserializeEnum: JsonTypeHandler = (type, input, b, state) => {
    const enumType = type as TypeEnum;
    const matcher = getEnumValueIndexMatcher(enumType);
    return b.call(
        (value: any, match: (v: any) => number, values: any[]) => {
            const idx = match(value);
            return idx === -1 ? value : values[idx];
        },
        input,
        b.lit(matcher),
        b.lit(enumType.values),
    );
};

// ============================================================================
// Date Handlers
// ============================================================================

export const serializeDate: JsonTypeHandler = (type, input, b, state) => {
    return b.ternary(
        b.isNullish(input),
        input,
        b.call((d: Date) => d.toISOString(), input),
    );
};

export const deserializeDate: JsonTypeHandler = (type, input, b, state) => {
    return b.new_(Date, input);
};

// ============================================================================
// RegExp Handlers
// ============================================================================

export const serializeRegExp: JsonTypeHandler = (type, input, b, state) => {
    return b.call((r: RegExp) => r.toString(), input);
};

export const deserializeRegExp: JsonTypeHandler = (type, input, b, state) => {
    return b.call((v: any) => {
        if (v instanceof RegExp) return v;
        if (v && typeof v === 'object' && '$regex' in v) {
            return new RegExp(v.$regex, v.$options || '');
        }
        if (typeof v === 'string') {
            if (v.startsWith('/') && v.length > 1) {
                const lastSlash = v.lastIndexOf('/');
                if (lastSlash > 0) {
                    const pattern = v.slice(1, lastSlash);
                    const flags = v.slice(lastSlash + 1);
                    return new RegExp(pattern, flags);
                }
            }
            return new RegExp(v);
        }
        return v;
    }, input);
};

// ============================================================================
// Set Handlers
// ============================================================================

export const serializeSet: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const elementType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const arr = b.call((s: Set<any>) => [...s], input);
    if (elementType.kind === ReflectionKind.any) return arr;
    return b.map(arr, (elem, idx) => state.build(elementType, elem));
};

export const deserializeSet: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const elementType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    if (elementType.kind === ReflectionKind.any) return b.new_(Set, input);
    const deserializedArr = b.map(input, (elem, idx) => state.build(elementType, elem));
    return b.new_(Set, deserializedArr);
};

// ============================================================================
// Map Handlers
// ============================================================================

export const serializeMap: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const keyType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const valueType = classType.arguments?.[1] || { kind: ReflectionKind.any };
    const entries = b.call((m: Map<any, any>) => [...m.entries()], input);
    if (keyType.kind === ReflectionKind.any && valueType.kind === ReflectionKind.any) return entries;
    return b.map(entries, (entry, idx) => {
        const key = entry.at(0);
        const value = entry.at(1);
        const serializedKey = keyType.kind === ReflectionKind.any ? key : state.build(keyType, key);
        const serializedValue = valueType.kind === ReflectionKind.any ? value : state.build(valueType, value);
        return b.call((k: any, v: any) => [k, v], serializedKey, serializedValue);
    });
};

export const deserializeMap: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const keyType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const valueType = classType.arguments?.[1] || { kind: ReflectionKind.any };
    if (keyType.kind === ReflectionKind.any && valueType.kind === ReflectionKind.any) {
        return b.new_(Map, input);
    }
    const deserializedEntries = b.map(input, (entry, idx) => {
        const key = entry.at(0);
        const value = entry.at(1);
        const deserializedKey = keyType.kind === ReflectionKind.any ? key : state.build(keyType, key);
        const deserializedValue = valueType.kind === ReflectionKind.any ? value : state.build(valueType, value);
        return b.call((k: any, v: any) => [k, v], deserializedKey, deserializedValue);
    });
    return b.new_(Map, deserializedEntries);
};

// ============================================================================
// Binary Type Handlers (TypedArray, ArrayBuffer)
// ============================================================================

export const serializeTypedArray: JsonTypeHandler = (type, input, b, state) => {
    return b.call(typedArrayToBase64, input);
};

export const serializeArrayBuffer: JsonTypeHandler = (type, input, b, state) => {
    return b.call(arrayBufferToBase64, input);
};

export const deserializeTypedArray: JsonTypeHandler = (type, input, b, state) => {
    const classType = (type as TypeClass).classType;
    const result = b.var_<any>(undefined);
    b.if_(
        b.isInstance(input, classType),
        () => b.setVar(result, input),
        () => b.setVar(result, b.call(base64ToTypedArray, input, b.lit(classType))),
    );
    return b.getVar(result);
};

export const deserializeArrayBuffer: JsonTypeHandler = (type, input, b, state) => {
    const result = b.var_<any>(undefined);
    b.if_(
        b.isInstance(input, ArrayBuffer),
        () => b.setVar(result, input),
        () => b.setVar(result, b.call(base64ToArrayBuffer, input)),
    );
    return b.getVar(result);
};

// ============================================================================
// Array Handler
// ============================================================================

export const handleArray: JsonTypeHandler = (type, input, b, state) => {
    const arrType = type as TypeArray;
    const elementType = arrType.type;
    if (elementType.kind === ReflectionKind.any) return input;

    const isSerialize = state.direction === 'serialize';
    const isPassThrough =
        isSerialize &&
        (elementType.kind === ReflectionKind.string ||
            elementType.kind === ReflectionKind.number ||
            elementType.kind === ReflectionKind.boolean ||
            elementType.kind === ReflectionKind.unknown);

    if (isPassThrough) {
        return input;
    }

    const result = b.var_<any>(b.lit(undefined));
    b.if_(b.call(Array.isArray, input), () => {
        b.setVar(
            result,
            b.map(input, (elem, idx) => state.forIndex(idx).build(elementType, elem)),
        );
    });
    return b.getVar(result);
};

// ============================================================================
// Tuple Handler
// ============================================================================

export const handleTuple: JsonTypeHandler = (type, input, b, state) => {
    const tupleType = type as TypeTuple;
    const result = b.let(b.emptyArr());

    const rest = findTupleRest(tupleType);
    const restIndex = rest.index;
    const restType = rest.type;

    if (restIndex === -1) {
        // No rest element
        for (let i = 0; i < tupleType.types.length; i++) {
            const member = tupleType.types[i];
            b.push(result, state.build(member.type, input.at(i)));
        }
    } else {
        // Has rest element
        const beforeRest = restIndex;
        const afterRest = tupleType.types.length - restIndex - 1;

        // Elements before rest
        for (let i = 0; i < beforeRest; i++) {
            const member = tupleType.types[i];
            b.push(result, state.build(member.type, input.at(i)));
        }

        // Rest elements
        if (restType) {
            const processRest = (
                inputArr: any[],
                resultArr: any[],
                restIdx: number,
                afterCount: number,
                rt: Type,
                st: JsonBuildContext,
            ): number => {
                const restEnd = inputArr.length - afterCount;
                for (let j = restIdx; j < restEnd; j++) {
                    const serializer = (st as any).serializer;
                    const direction = (st as any).direction;
                    const fn =
                        direction === 'serialize' ? serializer.buildSerializer(rt) : serializer.buildDeserializer(rt);
                    resultArr.push(fn(inputArr[j], {}));
                }
                return 0;
            };
            b.exec(
                b.call(processRest, input, result, b.lit(restIndex), b.lit(afterRest), b.lit(restType), b.lit(state)),
            );
        }

        // Elements after rest
        for (let i = 0; i < afterRest; i++) {
            const memberIdx = restIndex + 1 + i;
            const member = tupleType.types[memberIdx];
            const offset = afterRest - i;
            const inputIdx = b.call((arr: any[], off: number) => arr.length - off, input, b.lit(offset));
            b.push(result, state.build(member.type, input.at(inputIdx)));
        }
    }

    return result;
};

// ============================================================================
// Type Guards - Primitives
// ============================================================================

export const guardStringExact = stringGuards.score;
export const guardStringFast = stringGuards.fast;
export const guardBooleanExact = booleanGuards.score;
export const guardBooleanFast = booleanGuards.fast;
export const guardBigIntExact = bigIntGuards.score;
export const guardBigIntFast = bigIntGuards.fast;
export const guardNull = nullGuards.score;
export const guardNullFast = nullGuards.fast;
export const guardUndefined = undefinedGuards.score;
export const guardUndefinedFast = undefinedGuards.fast;
export const guardAny = anyGuards.score;
export const guardAnyFast = anyGuards.fast;

const literalGuards = createTypeGuardPair(
    (type, input, b) => b.eq(input, b.lit((type as TypeLiteral).literal)),
    'Invalid literal',
);
export const guardLiteral = literalGuards.score;
export const guardLiteralFast = literalGuards.fast;

// ============================================================================
// Type Guards - Number (with brand constraints)
// ============================================================================

const integerRanges: Record<number, [number, number]> = {
    [TypeNumberBrand.int8]: [-128, 127],
    [TypeNumberBrand.int16]: [-32768, 32767],
    [TypeNumberBrand.int32]: [-2147483648, 2147483647],
    [TypeNumberBrand.uint8]: [0, 255],
    [TypeNumberBrand.uint16]: [0, 65535],
    [TypeNumberBrand.uint32]: [0, 4294967295],
};

const float32Max = 3.40282347e38;

function buildNumberCondition(type: Type, input: Ref, b: Builder, state: JsonBuildContext): Ref<boolean> {
    const numberType = type as TypeNumber;
    const brand = numberType.brand;

    let condition = b.isType(input, 'number');

    if (!state.skipNaN) {
        condition = b.and(condition, b.not(b.call(Number.isNaN, input)));
    }

    if (brand !== undefined) {
        if (brand === TypeNumberBrand.integer) {
            condition = b.and(condition, b.call(Number.isInteger, input));
        } else if (integerRanges[brand]) {
            const [min, max] = integerRanges[brand];
            condition = b.and(
                condition,
                b.and(b.call(Number.isInteger, input), b.and(b.gte(input, b.lit(min)), b.lte(input, b.lit(max)))),
            );
        } else if (brand === TypeNumberBrand.float || brand === TypeNumberBrand.float64) {
            // Float/float64 just needs to be a number
        } else if (brand === TypeNumberBrand.float32) {
            condition = b.and(condition, b.and(b.gte(input, b.lit(-float32Max)), b.lte(input, b.lit(float32Max))));
        }
    }

    return condition;
}

const numberGuards = createTypeGuardPair(buildNumberCondition, 'Not a number');
export const guardNumberExact = numberGuards.score;
export const guardNumberFast = numberGuards.fast;

// ============================================================================
// Type Guards - Enum
// ============================================================================

const enumGuards = createTypeGuardPair((type, input, b) => {
    const valuesSet = new Set((type as TypeEnum).values);
    return b.call((set: Set<any>, v: any) => set.has(v), b.lit(valuesSet), input);
}, 'Invalid enum member');
export const guardEnum = enumGuards.score;
export const guardEnumFast = enumGuards.fast;

// ============================================================================
// Type Guards - Date, RegExp
// ============================================================================

const dateGuards = createTypeGuardPair((type, input, b) => b.isInstance(input, Date), 'Not a Date');
export const guardDateExact = dateGuards.score;
export const guardDateFast = dateGuards.fast;

const regExpGuards = createTypeGuardPair((type, input, b) => b.isInstance(input, RegExp), 'Not a RegExp');
export const guardRegExp = regExpGuards.score;
export const guardRegExpFast = regExpGuards.fast;

// ============================================================================
// Type Guards - Binary Types
// ============================================================================

export const guardTypedArray: JsonTypeHandler = (type, input, b, state) => {
    const classType = (type as TypeClass).classType;
    return guardWithError(b, state, input, b.isInstance(input, classType), 'type', 'Not a ' + classType.name);
};

export const guardTypedArrayFast: JsonTypeHandler = (type, input, b) => {
    return b.isInstance(input, (type as TypeClass).classType);
};

export const guardTypedArrayLoose: JsonTypeHandler = (type, input, b, state) => {
    return guardWithError(b, state, input, b.isType(input, 'string'), 'type', 'Not a string');
};

const arrayBufferGuards = createTypeGuardPair(
    (type, input, b) => b.isInstance(input, ArrayBuffer),
    'Not an ArrayBuffer',
);
export const guardArrayBuffer = arrayBufferGuards.score;
export const guardArrayBufferFast = arrayBufferGuards.fast;

// ============================================================================
// Type Guards - Set
// ============================================================================

const setGuards = {
    validateFast: (set: Set<any>, validator: (v: unknown) => boolean): boolean => {
        for (const elem of set) {
            if (!validator(elem)) return false;
        }
        return true;
    },
    validateScore: (
        set: Set<any>,
        validator: Function,
        errors: ValidationErrorItem[] | undefined,
        basePath: string,
    ): number => {
        let idx = 0;
        for (const elem of set) {
            const childErrors: ValidationErrorItem[] = [];
            const isValid = validator(elem, { errors: childErrors });
            if (!isValid) {
                const path = basePath ? basePath + '.' + idx : String(idx);
                for (const err of childErrors) {
                    const newErr = new ValidationErrorItem(
                        err.path ? path + '.' + err.path : path,
                        err.code,
                        err.message,
                        err.value,
                    );
                    if (errors) errors.push(newErr);
                }
                return 0;
            }
            idx++;
        }
        return 1000;
    },
};

export const guardSet: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const elementType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const errorsRef = state.optionsRef.get('errors' as any);
    const score = b.var_(b.lit(1000));

    b.if_(
        b.not(b.isInstance(input, Set)),
        () => {
            b.setVar(score, b.lit(0));
            b.if_(errorsRef, () => {
                b.push(
                    errorsRef,
                    b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not a Set'), input),
                );
            });
        },
        () => {
            if (elementType.kind !== ReflectionKind.any) {
                const validator = state.serializer.buildTypeGuard(elementType, false);
                const elemScore = b.call(setGuards.validateScore, input, b.lit(validator), errorsRef, state.pathRef());
                b.if_(b.eq(elemScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
            }
        },
    );
    return b.getVar(score);
};

export const guardSetFast: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const elementType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const isSet = b.call((v: any) => v instanceof Set, input);

    if (elementType.kind === ReflectionKind.any) {
        return isSet;
    }

    const validator = state.serializer.buildFastTypeGuard(elementType);
    const result = b.var_<boolean>(b.lit(false));
    b.if_(isSet, () => {
        const elementsValid = b.call(setGuards.validateFast, input, b.lit(validator));
        b.setVar(result, elementsValid);
    });
    return b.getVar(result);
};

// ============================================================================
// Type Guards - Map
// ============================================================================

const mapGuards = {
    validateFast: (
        map: Map<any, any>,
        keyValidator: ((v: unknown) => boolean) | undefined,
        valueValidator: ((v: unknown) => boolean) | undefined,
    ): boolean => {
        for (const [key, value] of map) {
            if (keyValidator && !keyValidator(key)) return false;
            if (valueValidator && !valueValidator(value)) return false;
        }
        return true;
    },
    validateScore: (
        map: Map<any, any>,
        keyValidator: Function | undefined,
        valueValidator: Function | undefined,
        errors: ValidationErrorItem[] | undefined,
        basePath: string,
    ): number => {
        let idx = 0;
        for (const [key, value] of map) {
            const path = basePath ? basePath + '.' + idx : String(idx);
            if (keyValidator) {
                const keyErrors: ValidationErrorItem[] = [];
                const keyValid = keyValidator(key, { errors: keyErrors });
                if (!keyValid) {
                    for (const err of keyErrors) {
                        const newErr = new ValidationErrorItem(path + '.key', err.code, err.message, err.value);
                        if (errors) errors.push(newErr);
                    }
                    return 0;
                }
            }
            if (valueValidator) {
                const valueErrors: ValidationErrorItem[] = [];
                const valueValid = valueValidator(value, { errors: valueErrors });
                if (!valueValid) {
                    for (const err of valueErrors) {
                        const newErr = new ValidationErrorItem(path + '.value', err.code, err.message, err.value);
                        if (errors) errors.push(newErr);
                    }
                    return 0;
                }
            }
            idx++;
        }
        return 1000;
    },
};

export const guardMap: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const keyType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const valueType = classType.arguments?.[1] || { kind: ReflectionKind.any };
    const errorsRef = state.optionsRef.get('errors' as any);
    const score = b.var_(b.lit(1000));

    b.if_(
        b.not(b.isInstance(input, Map)),
        () => {
            b.setVar(score, b.lit(0));
            b.if_(errorsRef, () => {
                b.push(
                    errorsRef,
                    b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not a Map'), input),
                );
            });
        },
        () => {
            if (keyType.kind !== ReflectionKind.any || valueType.kind !== ReflectionKind.any) {
                const keyValidator =
                    keyType.kind !== ReflectionKind.any ? state.serializer.buildTypeGuard(keyType, false) : undefined;
                const valueValidator =
                    valueType.kind !== ReflectionKind.any
                        ? state.serializer.buildTypeGuard(valueType, false)
                        : undefined;
                const mapScore = b.call(
                    mapGuards.validateScore,
                    input,
                    b.lit(keyValidator),
                    b.lit(valueValidator),
                    errorsRef,
                    state.pathRef(),
                );
                b.if_(b.eq(mapScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
            }
        },
    );
    return b.getVar(score);
};

export const guardMapFast: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const keyType = classType.arguments?.[0] || { kind: ReflectionKind.any };
    const valueType = classType.arguments?.[1] || { kind: ReflectionKind.any };
    const isMap = b.call((v: any) => v instanceof Map, input);

    if (keyType.kind === ReflectionKind.any && valueType.kind === ReflectionKind.any) {
        return isMap;
    }

    const keyValidator = keyType.kind !== ReflectionKind.any ? state.serializer.buildFastTypeGuard(keyType) : undefined;
    const valueValidator =
        valueType.kind !== ReflectionKind.any ? state.serializer.buildFastTypeGuard(valueType) : undefined;
    const result = b.var_<boolean>(b.lit(false));
    b.if_(isMap, () => {
        const entriesValid = b.call(mapGuards.validateFast, input, b.lit(keyValidator), b.lit(valueValidator));
        b.setVar(result, entriesValid);
    });
    return b.getVar(result);
};

// ============================================================================
// Type Guards - Array
// ============================================================================

export const guardArray: JsonTypeHandler = (type, input, b, state) => {
    const arrType = type as TypeArray;
    const elementType = arrType.type;
    const errorsRef = state.optionsRef.get('errors' as any);
    const score = b.var_(b.lit(1000));

    const isArray = b.call(Array.isArray, input);
    b.if_(
        b.not(isArray),
        () => {
            b.setVar(score, b.lit(0));
            b.if_(errorsRef, () => {
                b.push(
                    errorsRef,
                    b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not an array'), input),
                );
            });
        },
        () => {
            if (elementType.kind !== ReflectionKind.any) {
                b.loop(input, (elem, idx) => {
                    const childState = state.forIndex(idx);
                    const elemScore = childState.build(elementType, elem);
                    b.if_(b.eq(elemScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
                });
            }
        },
    );

    return b.getVar(score);
};

export const guardArrayFast: JsonTypeHandler = (type, input, b, state) => {
    const arrType = type as TypeArray;
    const elementType = arrType.type;

    const isArray = b.call(Array.isArray, input);

    // Handle error collection for "not an array"
    if (state.collectErrors) {
        const errorsRef = state.optionsRef.get('errors' as any);
        b.if_(b.and(errorsRef, b.not(isArray)), () => {
            b.push(
                errorsRef,
                b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not an array'), input),
            );
        });
    }

    if (elementType.kind === ReflectionKind.any) {
        return isArray;
    }

    const result = b.var_(isArray);
    b.if_(isArray, () => {
        b.loop(input, (elem, idx) => {
            const childState = state.forIndex(idx);
            const elemValid = childState.build(elementType, elem) as Ref<boolean>;
            b.if_(b.not(elemValid), () => b.setVar(result, b.lit(false)));
        });
    });
    return b.getVar(result);
};

// ============================================================================
// Type Guards - Tuple
// ============================================================================

export const guardTuple: JsonTypeHandler = (type, input, b, state) => {
    const tupleType = type as TypeTuple;
    const errorsRef = state.optionsRef.get('errors' as any);
    const score = b.var_(b.lit(1000));

    const isArray = b.call(Array.isArray, input);
    b.if_(
        b.not(isArray),
        () => {
            b.setVar(score, b.lit(0));
            b.if_(errorsRef, () => {
                b.push(
                    errorsRef,
                    b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not an array'), input),
                );
            });
        },
        () => {
            const rest = findTupleRest(tupleType);
            const hasRest = rest.index !== -1;
            const minLen = hasRest ? rest.index : tupleType.types.length;
            const exactLen = !hasRest ? tupleType.types.length : undefined;

            // Check length
            if (exactLen !== undefined) {
                b.if_(b.neq(input.len(), b.lit(exactLen)), () => {
                    b.setVar(score, b.lit(0));
                    b.if_(errorsRef, () => {
                        b.push(
                            errorsRef,
                            b.new_(
                                ValidationErrorItem,
                                state.pathRef(),
                                b.lit('type'),
                                b.lit(`Expected tuple of length ${exactLen}`),
                                input,
                            ),
                        );
                    });
                });
            } else {
                b.if_(b.lt(input.len(), b.lit(minLen)), () => {
                    b.setVar(score, b.lit(0));
                    b.if_(errorsRef, () => {
                        b.push(
                            errorsRef,
                            b.new_(
                                ValidationErrorItem,
                                state.pathRef(),
                                b.lit('type'),
                                b.lit(`Expected tuple of at least ${minLen} elements`),
                                input,
                            ),
                        );
                    });
                });
            }

            // Check elements
            for (let i = 0; i < tupleType.types.length; i++) {
                const elem = tupleType.types[i];
                if (elem.type.kind === ReflectionKind.rest) continue;
                const pathSegment = elem.name ?? String(i);
                const childState = state.forProperty(pathSegment);
                const elemScore = childState.build(elem.type, input.at(i));
                b.if_(b.eq(elemScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
            }
        },
    );

    return b.getVar(score);
};

export const guardTupleFast: JsonTypeHandler = (type, input, b, state) => {
    const tupleType = type as TypeTuple;

    const isArray = b.call(Array.isArray, input);
    const result = b.var_(isArray);

    b.if_(isArray, () => {
        const rest = findTupleRest(tupleType);
        const hasRest = rest.index !== -1;
        const restIndex = rest.index;
        const restType = rest.type;
        const exactLen = !hasRest ? tupleType.types.length : undefined;
        // For rest tuples, minimum length is elements before rest + elements after rest
        const afterRestCount = hasRest ? tupleType.types.length - restIndex - 1 : 0;
        const minLen = hasRest ? restIndex + afterRestCount : tupleType.types.length;

        // Check length
        if (exactLen !== undefined) {
            b.if_(b.neq(input.len(), b.lit(exactLen)), () => {
                b.setVar(result, b.lit(false));
            });
        } else {
            b.if_(b.lt(input.len(), b.lit(minLen)), () => {
                b.setVar(result, b.lit(false));
            });
        }

        if (!hasRest) {
            // No rest element - check elements by index
            for (let i = 0; i < tupleType.types.length; i++) {
                const elem = tupleType.types[i];
                const pathSegment = elem.name ?? String(i);
                const childState = state.forProperty(pathSegment);
                const elemValid = childState.build(elem.type, input.at(i)) as Ref<boolean>;
                b.if_(b.not(elemValid), () => b.setVar(result, b.lit(false)));
            }
        } else {
            // Has rest element - need to handle indices properly
            // Check elements before rest
            for (let i = 0; i < restIndex; i++) {
                const elem = tupleType.types[i];
                const pathSegment = elem.name ?? String(i);
                const childState = state.forProperty(pathSegment);
                const elemValid = childState.build(elem.type, input.at(i)) as Ref<boolean>;
                b.if_(b.not(elemValid), () => b.setVar(result, b.lit(false)));
            }

            // Check rest elements (validate each against rest type)
            if (restType) {
                const restGuard = state.serializer.buildFastTypeGuard(restType);
                const validateRest = (
                    arr: any[],
                    startIdx: number,
                    endOffset: number,
                    guard: (v: unknown) => boolean,
                ): boolean => {
                    const endIdx = arr.length - endOffset;
                    for (let j = startIdx; j < endIdx; j++) {
                        if (!guard(arr[j])) return false;
                    }
                    return true;
                };
                const restValid = b.call(
                    validateRest,
                    input,
                    b.lit(restIndex),
                    b.lit(afterRestCount),
                    b.lit(restGuard),
                );
                b.if_(b.not(restValid), () => b.setVar(result, b.lit(false)));
            }

            // Check elements after rest (access from end of array)
            for (let i = 0; i < afterRestCount; i++) {
                const memberIdx = restIndex + 1 + i;
                const elem = tupleType.types[memberIdx];
                const offset = afterRestCount - i;
                const inputIdx = b.call((arr: any[], off: number) => arr.length - off, input, b.lit(offset));
                const pathSegment = elem.name ?? String(memberIdx);
                const childState = state.forProperty(pathSegment);
                const elemValid = childState.build(elem.type, input.at(inputIdx)) as Ref<boolean>;
                b.if_(b.not(elemValid), () => b.setVar(result, b.lit(false)));
            }
        }
    });

    return b.getVar(result);
};

// ============================================================================
// Type Guards - Template Literal
// ============================================================================

const templateLiteralGuards = {
    check: (v: any, t: Type): boolean => {
        if (typeof v !== 'string') return false;
        try {
            return extendTemplateLiteral({ kind: ReflectionKind.literal, literal: v }, t as TypeTemplateLiteral);
        } catch {
            return false;
        }
    },
};

export const guardTemplateLiteral: JsonTypeHandler = (type, input, b, state) => {
    const isValid = b.call(templateLiteralGuards.check, input, b.lit(type));
    return b.ternary(isValid, b.lit(1000), b.lit(0));
};

export const guardTemplateLiteralFast: JsonTypeHandler = (type, input, b, state) => {
    return b.call(templateLiteralGuards.check, input, b.lit(type));
};

// ============================================================================
// Type Guards - Function
// ============================================================================

const functionGuards = {
    check: (
        fn: any,
        expectedType: TypeFunction,
        isExtendableFn: typeof isExtendable,
        resolveRuntimeTypeFn: typeof resolveRuntimeType,
        reflectionKind: typeof ReflectionKind,
    ): boolean => {
        if (typeof fn !== 'function') return false;
        if ('__type' in fn) {
            const actualType = resolveRuntimeTypeFn(fn);
            if (actualType && actualType.kind === reflectionKind.function) {
                if (!isExtendableFn(actualType, expectedType)) {
                    return false;
                }
            }
        }
        return true;
    },
    checkWithError: (
        fn: any,
        expectedType: TypeFunction,
        isExtendableFn: typeof isExtendable,
        resolveRuntimeTypeFn: typeof resolveRuntimeType,
        reflectionKind: typeof ReflectionKind,
    ): { valid: boolean; errorMsg?: string } => {
        if (typeof fn !== 'function') return { valid: false, errorMsg: 'Not a function' };
        if ('__type' in fn) {
            const actualType = resolveRuntimeTypeFn(fn);
            if (actualType && actualType.kind === reflectionKind.function) {
                if (!isExtendableFn(actualType, expectedType)) {
                    return { valid: false, errorMsg: 'Function type mismatch' };
                }
            }
        }
        return { valid: true };
    },
};

export const guardFunction: JsonTypeHandler = (type, input, b, state) => {
    const funcType = type as TypeFunction;
    const errorsRef = state.optionsRef.get('errors' as any);

    const validateFunction = (
        fn: any,
        expectedType: TypeFunction,
        errors: ValidationErrorItem[] | undefined,
        path: string,
        isExtendableFn: typeof isExtendable,
        resolveRuntimeTypeFn: typeof resolveRuntimeType,
        reflectionKind: typeof ReflectionKind,
    ): number => {
        const result = functionGuards.checkWithError(
            fn,
            expectedType,
            isExtendableFn,
            resolveRuntimeTypeFn,
            reflectionKind,
        );
        if (!result.valid) {
            if (errors) errors.push(new ValidationErrorItem(path, 'type', result.errorMsg!, fn));
            return 0;
        }
        return 1000;
    };

    return b.call(
        validateFunction,
        input,
        b.lit(funcType),
        errorsRef,
        state.pathRef(),
        b.lit(isExtendable),
        b.lit(resolveRuntimeType),
        b.lit(ReflectionKind),
    );
};

export const guardFunctionFast: JsonTypeHandler = (type, input, b, state) => {
    const funcType = type as TypeFunction;
    return b.call(
        functionGuards.check,
        input,
        b.lit(funcType),
        b.lit(isExtendable),
        b.lit(resolveRuntimeType),
        b.lit(ReflectionKind),
    );
};

// ============================================================================
// ID Pattern Handlers (NanoId, UUID, MongoId)
// ============================================================================

interface IdPatternConfig {
    pattern?: RegExp;
    length?: number;
    allowEmpty?: boolean;
    errorMessage: string;
}

function createIdPatternHandlers(config: IdPatternConfig): {
    guardScore: JsonTypeHandler;
    guardFast: JsonTypeHandler;
    deserialize: JsonTypeHandler;
} {
    const buildCheck = (b: Builder, input: Ref): Ref<boolean> => {
        let valid = b.isType(input, 'string');

        if (config.length !== undefined) {
            valid = b.and(valid, b.eq(input.get('length'), b.lit(config.length)));
        }

        if (config.pattern) {
            const matchesPattern = b.call(
                (pattern: RegExp, value: string) => pattern.test(value),
                b.lit(config.pattern),
                input,
            );
            if (config.allowEmpty) {
                const isEmpty = b.eq(input, b.lit(''));
                valid = b.and(valid, b.or(isEmpty, matchesPattern));
            } else {
                valid = b.and(valid, matchesPattern);
            }
        }

        return valid;
    };

    return {
        guardScore: (type, input, b, state) =>
            guardWithError(b, state, input, buildCheck(b, input), 'type', config.errorMessage),
        guardFast: (type, input, b, state) => buildCheck(b, input),
        deserialize: (type, input, b, state) => {
            b.if_(b.not(buildCheck(b, input)), () => {
                state.throw_(type, input, config.errorMessage);
            });
            return input;
        },
    };
}

const nanoIdHandlers = createIdPatternHandlers({
    length: 21,
    errorMessage: 'Not a valid NanoId',
});

const uuidHandlers = createIdPatternHandlers({
    pattern: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    errorMessage: 'Not a valid UUID',
});

const mongoIdHandlers = createIdPatternHandlers({
    pattern: /^[0-9a-fA-F]{24}$/,
    allowEmpty: true,
    errorMessage: 'Not a MongoId (ObjectId)',
});

export const guardNanoId = nanoIdHandlers.guardScore;
export const guardNanoIdFast = nanoIdHandlers.guardFast;
export const deserializeNanoId = nanoIdHandlers.deserialize;

export const guardUUID = uuidHandlers.guardScore;
export const guardUUIDFast = uuidHandlers.guardFast;
export const deserializeUUID = uuidHandlers.deserialize;

export const guardMongoId = mongoIdHandlers.guardScore;
export const guardMongoIdFast = mongoIdHandlers.guardFast;
export const deserializeMongoId = mongoIdHandlers.deserialize;

// ============================================================================
// Object Guards Helper Functions
// ============================================================================

/**
 * Runtime function to validate index signatures for score-based validation.
 * guardCache is pre-built at JIT time — maps each signature to its pre-built validator.
 */
const validateMultipleIndexSignatures = (
    obj: any,
    signatures: TypeIndexSignature[],
    guardCache: Map<TypeIndexSignature, Function>,
    errors: ValidationErrorItem[] | undefined,
    basePath: string,
    reflectionKind: typeof ReflectionKind,
    extendTemplateLiteralFn: typeof extendTemplateLiteral,
): number => {
    let valid = true;
    for (const key of Object.keys(obj)) {
        const path = basePath ? basePath + '.' + key : key;
        const numKey = Number(key);
        const isNumericKey = !isNaN(numKey) && key !== '';

        // Find the matching index signature for this key
        let matchingSig: TypeIndexSignature | undefined;

        for (const sig of signatures) {
            if (sig.index.kind === reflectionKind.number) {
                if (isNumericKey) {
                    matchingSig = sig;
                    break;
                }
            } else if (sig.index.kind === reflectionKind.templateLiteral) {
                const keyLiteral = { kind: reflectionKind.literal, literal: key } as any;
                if (extendTemplateLiteralFn(keyLiteral, sig.index as any)) {
                    matchingSig = sig;
                    break;
                }
            } else if (sig.index.kind === reflectionKind.string) {
                if (!matchingSig) matchingSig = sig;
            }
        }

        if (!matchingSig) {
            if (obj[key] === undefined) continue;
            valid = false;
            if (errors)
                errors.push(new ValidationErrorItem(path, 'type', 'Key does not match any index signature', key));
            continue;
        }

        const validator = guardCache.get(matchingSig)!;
        const childErrors: ValidationErrorItem[] = [];
        const isValid = validator(obj[key], { errors: childErrors });
        if (!isValid) {
            valid = false;
            for (const err of childErrors) {
                const newErr = new ValidationErrorItem(
                    err.path ? path + '.' + err.path : path,
                    err.code,
                    err.message,
                    err.value,
                );
                if (errors) errors.push(newErr);
            }
        }
    }
    return valid ? 1000 : 0;
};

/**
 * Runtime function to call class-level validator method.
 */
const callClassValidator = (
    obj: any,
    validatorMethod: string | symbol | number,
    errors: ValidationErrorItem[] | undefined,
    basePath: string,
    validatorErrorClass: typeof ValidatorError,
    validationErrorItemClass: typeof ValidationErrorItem,
): void => {
    if (!obj || typeof obj[validatorMethod] !== 'function') return;
    const result = obj[validatorMethod]();
    if (result instanceof validatorErrorClass) {
        if (errors) {
            errors.push(new validationErrorItemClass(basePath, result.code, result.message, obj));
        }
    }
};

/**
 * Runtime function to validate index signature values with error collection.
 */
const validateIndexSignatureValue = (
    obj: any,
    key: string,
    value: any,
    signatures: TypeIndexSignature[],
    explicit: Set<string>,
    guardCache: Map<TypeIndexSignature, Function>,
    basePath: string,
    errors: ValidationErrorItem[] | undefined,
    kind: typeof ReflectionKind,
    ValidationErrorItemClass: typeof ValidationErrorItem,
    extendTemplateLiteralFn: typeof extendTemplateLiteral,
): boolean => {
    if (explicit.has(key)) return true;
    if (value === undefined) return true;

    const numKey = Number(key);
    const isNumericKeyVal = !isNaN(numKey) && key !== '';

    let matchedSignature: TypeIndexSignature | undefined;
    let stringSignature: TypeIndexSignature | undefined;
    for (const sig of signatures) {
        if (sig.index.kind === kind.number && isNumericKeyVal) {
            matchedSignature = sig;
            break;
        } else if (sig.index.kind === kind.templateLiteral) {
            const keyLiteral = { kind: kind.literal, literal: key } as any;
            if (extendTemplateLiteralFn(keyLiteral, sig.index as any)) {
                matchedSignature = sig;
                break;
            }
        } else if (sig.index.kind === kind.string) {
            stringSignature = sig;
        }
    }
    if (!matchedSignature) matchedSignature = stringSignature;
    if (!matchedSignature) return false;

    const valuePath = basePath ? `${basePath}.${key}` : key;
    const typeGuard = guardCache.get(matchedSignature)!;
    if (errors) {
        const tempErrors: ValidationErrorItem[] = [];
        const isValid = typeGuard(value, { errors: tempErrors });
        for (const err of tempErrors) {
            const fullPath = err.path ? `${valuePath}.${err.path}` : valuePath;
            errors.push(new ValidationErrorItemClass(fullPath, err.code, err.message, err.value));
        }
        return isValid;
    } else {
        return typeGuard(value, {});
    }
};

// ============================================================================
// Object Guards
// ============================================================================

/**
 * Score-based object guard - returns 0 or 1000.
 */
export const guardObjectScore: JsonTypeHandler = (type, input, b, state) => {
    const objType = type as TypeObjectLiteral | TypeClass;
    const members = resolveTypeMembers(objType);
    const propertyMembers: (TypeProperty | TypePropertySignature)[] = [];
    const methodMembers: (TypeMethod | TypeMethodSignature)[] = [];
    const indexSignatures: TypeIndexSignature[] = [];

    for (const member of members) {
        if (isPropertyMemberType(member)) {
            propertyMembers.push(member as TypeProperty | TypePropertySignature);
        } else if (member.kind === ReflectionKind.indexSignature) {
            indexSignatures.push(member);
        } else if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
            methodMembers.push(member as TypeMethod | TypeMethodSignature);
        }
    }

    const score = b.var_(b.lit(1000));
    const errorsRef = state.optionsRef.get('errors' as any);
    const isObj = isPlainObject(b, input);

    b.if_(
        b.not(isObj),
        () => {
            b.setVar(score, b.lit(0));
            b.if_(errorsRef, () => {
                b.push(
                    errorsRef,
                    b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not an object'), input),
                );
            });
        },
        () => {
            // Validate properties
            for (const member of propertyMembers) {
                const propName = memberNameToString(member.name);
                const propType = member.type;
                const isOpt = isOptional(member);
                const propInput = input.get(propName);
                const hasProp = b.has(input, propName);

                b.if_(
                    b.not(hasProp),
                    () => {
                        if (!isOpt) {
                            b.setVar(score, b.lit(0));
                            b.if_(errorsRef, () => {
                                b.push(
                                    errorsRef,
                                    b.new_(
                                        ValidationErrorItem,
                                        state.forProperty(propName).pathRef(),
                                        b.lit('type'),
                                        b.lit(getTypeMismatchMessage(propType)),
                                        b.lit(undefined),
                                    ),
                                );
                            });
                        }
                    },
                    () => {
                        b.if_(
                            b.isNullish(propInput),
                            () => {
                                if (!isNullable(member) && !isOpt) {
                                    b.setVar(score, b.lit(0));
                                    b.if_(errorsRef, () => {
                                        b.push(
                                            errorsRef,
                                            b.new_(
                                                ValidationErrorItem,
                                                state.forProperty(propName).pathRef(),
                                                b.lit('type'),
                                                b.lit(getTypeMismatchMessage(propType)),
                                                propInput,
                                            ),
                                        );
                                    });
                                }
                            },
                            () => {
                                const childState = state.forProperty(propName);
                                const propScore = childState.build(propType, propInput);
                                b.if_(b.eq(propScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
                            },
                        );
                    },
                );
            }

            // Validate methods for object literals
            if (objType.kind === ReflectionKind.objectLiteral) {
                for (const method of methodMembers) {
                    const methodName = memberNameToString(method.name);
                    const methodInput = input.get(methodName);
                    const hasMethod = b.has(input, methodName);

                    const funcType: TypeFunction = {
                        kind: ReflectionKind.function,
                        name: method.name,
                        parameters: method.parameters || [],
                        return: method.return || { kind: ReflectionKind.void },
                    };

                    b.if_(hasMethod, () => {
                        const childState = state.forProperty(methodName);
                        const methodScore = childState.build(funcType, methodInput);
                        b.if_(b.eq(methodScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
                    });
                }
            }

            // Validate index signatures
            if (indexSignatures.length > 0) {
                // Pre-build type guards at JIT time
                const guardCache = new Map<TypeIndexSignature, Function>();
                for (const sig of indexSignatures) {
                    guardCache.set(sig, state.serializer.buildTypeGuard(sig.type, false));
                }
                const indexScore = b.call(
                    validateMultipleIndexSignatures,
                    input,
                    b.lit(indexSignatures),
                    b.lit(guardCache),
                    errorsRef,
                    state.pathRef(),
                    b.lit(ReflectionKind),
                    b.lit(extendTemplateLiteral),
                );
                b.if_(b.eq(indexScore, b.lit(0)), () => b.setVar(score, b.lit(0)));
            }

            // Call class validator if present
            if (objType.kind === ReflectionKind.class) {
                const reflection = ReflectionClass.from((objType as TypeClass).classType);
                if (reflection.validationMethod) {
                    const methodName = reflection.validationMethod;
                    b.exec(
                        b.call(
                            callClassValidator,
                            input,
                            b.lit(methodName),
                            errorsRef,
                            state.pathRef(),
                            b.lit(ValidatorError),
                            b.lit(ValidationErrorItem),
                        ),
                    );
                }
            }
        },
    );

    return b.getVar(score);
};

/**
 * Fast (boolean) object guard - validates properties AND rejects unknown keys.
 */
export const guardObjectFast: JsonTypeHandler = (type, input, b, state) => {
    const objType = type as TypeObjectLiteral | TypeClass;
    const members = resolveTypeMembers(objType);

    const propNames: string[] = [];
    const explicitProps = new Set<string>();
    let hasOptional = false;
    const indexSignatures: TypeIndexSignature[] = [];
    const methods: (TypeMethod | TypeMethodSignature)[] = [];

    for (const member of members) {
        if (member.kind === ReflectionKind.indexSignature) {
            indexSignatures.push(member);
        } else if (isPropertyMemberType(member)) {
            const propName = memberNameToString(member.name);
            propNames.push(propName);
            explicitProps.add(propName);
            if (isOptional(member)) hasOptional = true;
        } else if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
            methods.push(member as TypeMethod | TypeMethodSignature);
            const methodName = memberNameToString(member.name);
            propNames.push(methodName);
            explicitProps.add(methodName);
        }
    }

    const isObject = isPlainObject(b, input);

    // Check if we need class validation method
    let hasClassValidator = false;
    if (objType.kind === ReflectionKind.class) {
        const reflection = ReflectionClass.from((objType as TypeClass).classType);
        hasClassValidator = !!reflection.validationMethod;
    }

    // Fast path: pure types without complex checks
    const canUsePurePath =
        !state.collectErrors &&
        indexSignatures.length === 0 &&
        !state.rejectUnknownKeys &&
        !hasClassValidator &&
        isPureTypeGuard(type);

    if (canUsePurePath) {
        // Collect all property checks - avoid starting with `true &&` for better perf
        const checks: Ref<boolean>[] = [isObject];

        for (const member of members) {
            if (!isPropertyMemberType(member)) continue;

            const propName = memberNameToString(member.name);
            const propType = member.type;
            const isOpt = isOptional(member);
            const propInput = input.get(propName);

            if (!isOpt) {
                const childState = state.forProperty(propName);
                checks.push(childState.build(propType, propInput) as Ref<boolean>);
            } else {
                const propIsNullOrUndefined = b.isNullish(propInput);
                const childState = state.forProperty(propName);
                const propCheck = childState.build(propType, propInput) as Ref<boolean>;
                checks.push(b.or(propIsNullOrUndefined, propCheck));
            }
        }

        // Handle methods for object literals
        if (objType.kind === ReflectionKind.objectLiteral) {
            for (const method of methods) {
                const methodName = memberNameToString(method.name);
                const methodInput = input.get(methodName);
                const isOpt = isOptional(method);

                if (!isOpt) {
                    const childState = state.forProperty(methodName);
                    checks.push(childState.build(method, methodInput) as Ref<boolean>);
                } else {
                    const methodIsNullOrUndefined = b.isNullish(methodInput);
                    const childState = state.forProperty(methodName);
                    const methodCheck = childState.build(method, methodInput) as Ref<boolean>;
                    checks.push(b.or(methodIsNullOrUndefined, methodCheck));
                }
            }
        }

        // Chain without leading `true &&` - reduces overhead
        if (checks.length === 0) return b.lit(true);
        if (checks.length === 1) return checks[0];
        return checks.reduce((acc, check) => b.and(acc, check));
    }

    // Standard path with result variable
    const result = b.var_<boolean>(b.lit(false));

    if (state.collectErrors) {
        pushTypeErrorWhen(b, state, input, b.not(isObject), 'Not an object');
    }

    b.if_(isObject, () => {
        // When collecting errors, we need to check ALL properties (no short-circuit)
        // to collect all errors. When not collecting errors, we can short-circuit.
        if (state.collectErrors) {
            // Use a mutable variable to track overall validity
            const allValid = b.var_<boolean>(b.lit(true));

            for (const member of members) {
                if (!isPropertyMemberType(member)) continue;

                const propName = memberNameToString(member.name);
                const propType = member.type;
                const isOpt = isOptional(member);
                const propInput = input.get(propName);
                const hasProp = b.has(input, propName);

                if (!isOpt) {
                    // Required property - always validate (even if missing, the type validator
                    // will produce the correct error like "Not an array" for undefined)
                    const childState = state.forProperty(propName);
                    const propCheck = childState.build(propType, propInput) as Ref<boolean>;
                    b.if_(b.not(propCheck), () => {
                        b.setVar(allValid, b.lit(false));
                    });
                } else {
                    // Optional property - only validate if present and not null/undefined
                    const propIsNullOrUndefined = b.isNullish(propInput);
                    b.if_(b.not(propIsNullOrUndefined), () => {
                        const childState = state.forProperty(propName);
                        const propCheck = childState.build(propType, propInput) as Ref<boolean>;
                        b.if_(b.not(propCheck), () => {
                            b.setVar(allValid, b.lit(false));
                        });
                    });
                }
            }

            if (objType.kind === ReflectionKind.objectLiteral) {
                for (const method of methods) {
                    const methodName = memberNameToString(method.name);
                    const methodInput = input.get(methodName);
                    const isOpt = isOptional(method);
                    const hasMethod = b.has(input, methodName);

                    if (!isOpt) {
                        // Required method - always validate
                        const childState = state.forProperty(methodName);
                        const methodCheck = childState.build(method, methodInput) as Ref<boolean>;
                        b.if_(b.not(methodCheck), () => {
                            b.setVar(allValid, b.lit(false));
                        });
                    } else {
                        const methodIsNullOrUndefined = b.isNullish(methodInput);
                        b.if_(b.not(methodIsNullOrUndefined), () => {
                            const childState = state.forProperty(methodName);
                            const methodCheck = childState.build(method, methodInput) as Ref<boolean>;
                            b.if_(b.not(methodCheck), () => {
                                b.setVar(allValid, b.lit(false));
                            });
                        });
                    }
                }
            }

            b.setVar(result, b.getVar(allValid));
        } else {
            // Not collecting errors - can use short-circuit && chain
            let propertyCheck: Ref<boolean> = b.lit(true);

            for (const member of members) {
                if (!isPropertyMemberType(member)) continue;

                const propName = memberNameToString(member.name);
                const propType = member.type;
                const isOpt = isOptional(member);
                const propInput = input.get(propName);

                if (!isOpt) {
                    const hasProp = b.has(input, propName);
                    const childState = state.forProperty(propName);
                    const propCheck = childState.build(propType, propInput) as Ref<boolean>;
                    propertyCheck = b.and(propertyCheck, b.and(hasProp, propCheck));
                } else {
                    const propIsNullOrUndefined = b.isNullish(propInput);
                    const childState = state.forProperty(propName);
                    const propCheck = childState.build(propType, propInput) as Ref<boolean>;
                    propertyCheck = b.and(propertyCheck, b.or(propIsNullOrUndefined, propCheck));
                }
            }

            if (objType.kind === ReflectionKind.objectLiteral) {
                for (const method of methods) {
                    const methodName = memberNameToString(method.name);
                    const methodInput = input.get(methodName);
                    const isOpt = isOptional(method);

                    if (!isOpt) {
                        const hasMethod = b.has(input, methodName);
                        const childState = state.forProperty(methodName);
                        const methodCheck = childState.build(method, methodInput) as Ref<boolean>;
                        propertyCheck = b.and(propertyCheck, b.and(hasMethod, methodCheck));
                    } else {
                        const methodIsNullOrUndefined = b.isNullish(methodInput);
                        const childState = state.forProperty(methodName);
                        const methodCheck = childState.build(method, methodInput) as Ref<boolean>;
                        propertyCheck = b.and(propertyCheck, b.or(methodIsNullOrUndefined, methodCheck));
                    }
                }
            }

            b.setVar(result, propertyCheck);
        }
    });

    // Handle index signatures
    if (indexSignatures.length > 0) {
        const indexValid = b.var_<boolean>(b.lit(true));
        const hasExplicit = explicitProps.has.bind(explicitProps);

        b.if_(b.getVar(result), () => {
            if (indexSignatures.length === 1) {
                // Single index signature: inline the type guard directly
                const sig = indexSignatures[0];

                b.forIn(input, (key, value) => {
                    // Skip explicit (named) properties
                    b.if_(b.not(b.call(hasExplicit, key)), () => {
                        // Skip undefined values
                        b.if_(b.neq(value, b.lit(undefined)), () => {
                            if (sig.index.kind === ReflectionKind.string) {
                                // String index: all non-explicit keys match — inline value guard
                                const childState = state.forKey(key);
                                const check = childState.build(sig.type, value) as Ref<boolean>;
                                b.if_(b.not(check), () => {
                                    b.setVar(indexValid, b.lit(false));
                                });
                            } else if (sig.index.kind === ReflectionKind.number) {
                                // Number index: check key is numeric
                                const isNumeric = b.call((k: string) => {
                                    const n = Number(k);
                                    return !isNaN(n) && k !== '';
                                }, key);
                                b.if_(
                                    isNumeric,
                                    () => {
                                        const childState = state.forKey(key);
                                        const check = childState.build(sig.type, value) as Ref<boolean>;
                                        b.if_(b.not(check), () => {
                                            b.setVar(indexValid, b.lit(false));
                                        });
                                    },
                                    () => {
                                        b.setVar(indexValid, b.lit(false));
                                    },
                                );
                            } else if (sig.index.kind === ReflectionKind.templateLiteral) {
                                // Template literal index: check key matches pattern
                                const matchesTemplate = b.call(
                                    (k: string, tpl: any) =>
                                        extendTemplateLiteral({ kind: ReflectionKind.literal, literal: k } as any, tpl),
                                    key,
                                    b.lit(sig.index),
                                );
                                b.if_(
                                    matchesTemplate,
                                    () => {
                                        const childState = state.forKey(key);
                                        const check = childState.build(sig.type, value) as Ref<boolean>;
                                        b.if_(b.not(check), () => {
                                            b.setVar(indexValid, b.lit(false));
                                        });
                                    },
                                    () => {
                                        b.setVar(indexValid, b.lit(false));
                                    },
                                );
                            }
                        });
                    });
                });
            } else {
                // Multiple index signatures: use pre-built guards (complex matching logic)
                const guardCache = new Map<TypeIndexSignature, Function>();
                for (const sig of indexSignatures) {
                    guardCache.set(sig, state.serializer.buildTypeGuard(sig.type, true));
                }
                const errorsRef = state.optionsRef.get('errors' as any);

                b.forIn(input, (key, value) => {
                    const keyValid = b.call(
                        validateIndexSignatureValue,
                        input,
                        key,
                        value,
                        b.lit(indexSignatures),
                        b.lit(explicitProps),
                        b.lit(guardCache),
                        state.pathRef(),
                        errorsRef,
                        b.lit(ReflectionKind),
                        b.lit(ValidationErrorItem),
                        b.lit(extendTemplateLiteral),
                    );
                    b.if_(b.not(keyValid), () => {
                        b.setVar(indexValid, b.lit(false));
                    });
                });
            }

            b.if_(b.not(b.getVar(indexValid)), () => {
                b.setVar(result, b.lit(false));
            });
        });
    }

    // Handle unknown keys rejection
    if (state.rejectUnknownKeys && indexSignatures.length === 0) {
        b.if_(b.getVar(result), () => {
            if (!hasOptional) {
                const keysLength = b.call((obj: any) => Object.keys(obj).length, input);
                b.if_(b.neq(keysLength, b.lit(propNames.length)), () => {
                    b.setVar(result, b.lit(false));
                });
            } else {
                const allowedKeys = new Set(propNames);
                const checkUnknownKeys = b.call(
                    (obj: any, allowed: Set<string>) => {
                        for (const key of Object.keys(obj)) {
                            if (!allowed.has(key)) return false;
                        }
                        return true;
                    },
                    input,
                    b.lit(allowedKeys),
                );
                b.if_(b.not(checkUnknownKeys), () => {
                    b.setVar(result, b.lit(false));
                });
            }
        });
    }

    // Call class validator
    if (state.collectErrors && objType.kind === ReflectionKind.class && hasClassValidator) {
        const reflection = ReflectionClass.from((objType as TypeClass).classType);
        const methodName = reflection.validationMethod!;
        const errorsRef = state.optionsRef.get('errors' as any);
        b.exec(
            b.call(
                callClassValidator,
                input,
                b.lit(methodName),
                errorsRef,
                state.pathRef(),
                b.lit(ValidatorError),
                b.lit(ValidationErrorItem),
            ),
        );
    }

    return b.getVar(result);
};

// ============================================================================
// Object Literal Handler
// ============================================================================

/**
 * Handle object literal serialization/deserialization.
 */
export const handleObjectLiteral: JsonTypeHandler = (type, input, b, state) => {
    const objType = type as TypeObjectLiteral | TypeClass;
    const members = resolveTypeMembers(objType);
    const isDeserialize = state.direction === 'deserialize';

    // Check for embedded annotation
    const embedded = embeddedAnnotation.getFirst(objType);
    if (embedded) {
        const properties = members.filter(isPropertyMemberType) as (TypeProperty | TypePropertySignature)[];

        if (properties.length === 1) {
            // Single property embedded: serialize to just the value
            const prop = properties[0];
            const propName = memberNameToString(prop.name);
            const propType = prop.type;

            if (isDeserialize) {
                const result = b.var_<any>(undefined);
                const converted = state.forProperty(propName).build(propType, input);

                if (objType.kind === ReflectionKind.class) {
                    b.setVar(result, b.new_((objType as TypeClass).classType, converted));
                } else {
                    const obj = b.let(b.emptyObj());
                    b.set(obj, propName, converted);
                    b.setVar(result, obj);
                }
                return b.getVar(result);
            } else {
                const propInput = input.get(propName);
                return state.forProperty(propName).build(propType, propInput);
            }
        }

        // Multi-property embedded with prefix
        if (embedded.prefix !== undefined && embedded.prefix !== '') {
            const prefix = embedded.prefix;

            if (isDeserialize) {
                const result = b.var_<any>(undefined);

                if (objType.kind === ReflectionKind.class) {
                    const classType = objType as TypeClass;
                    const ctorProps = getDeepConstructorProperties(classType);
                    if (ctorProps.length > 0) {
                        const args: Ref[] = [];
                        for (const ctorProp of ctorProps) {
                            const subPropName = memberNameToString(ctorProp.name);
                            const serializedSubName =
                                state.namingStrategy.getPropertyName(ctorProp, state.serializer.name) || subPropName;
                            const prefixedName = prefix + serializedSubName;
                            const propInput = input.get(prefixedName);
                            args.push(state.forProperty(subPropName).build(ctorProp.type, propInput));
                        }
                        b.setVar(result, b.new_(classType.classType, ...args));
                    } else {
                        const instance = b.let(b.new_(classType.classType));
                        for (const prop of properties) {
                            const subPropName = memberNameToString(prop.name);
                            const serializedName =
                                state.namingStrategy.getPropertyName(prop, state.serializer.name) || subPropName;
                            const prefixedName = prefix + serializedName;
                            const propInput = input.get(prefixedName);
                            b.set(instance, subPropName, state.forProperty(subPropName).build(prop.type, propInput));
                        }
                        b.setVar(result, instance);
                    }
                } else {
                    const obj = b.let(b.emptyObj());
                    for (const prop of properties) {
                        const subPropName = memberNameToString(prop.name);
                        const serializedName =
                            state.namingStrategy.getPropertyName(prop, state.serializer.name) || subPropName;
                        const prefixedName = prefix + serializedName;
                        const propInput = input.get(prefixedName);
                        b.set(obj, subPropName, state.forProperty(subPropName).build(prop.type, propInput));
                    }
                    b.setVar(result, obj);
                }

                return b.getVar(result);
            } else {
                const entries: Record<string, Ref> = {};
                for (const prop of properties) {
                    const subPropName = memberNameToString(prop.name);
                    const serializedName =
                        state.namingStrategy.getPropertyName(prop, state.serializer.name) || subPropName;
                    const prefixedName = prefix + serializedName;
                    const propInput = input.get(subPropName);
                    entries[prefixedName] = state.forProperty(subPropName).build(prop.type, propInput);
                }
                return b.obj(entries);
            }
        }
    }

    // Check for circular references during serialization
    const hasCircular = !isDeserialize && hasCircularReference(objType);

    if (isDeserialize) {
        const isObjectCheck = b.and(b.isType(input, 'object'), b.not(b.isNull(input)));
        const result = b.var_<any>(undefined);

        b.if_(
            isObjectCheck,
            () => {
                const innerResult = buildObjectLiteralBody(objType, members, input, b, state, isDeserialize);
                b.setVar(result, innerResult);
            },
            () => {
                state.throw_(type, input);
            },
        );

        return b.getVar(result);
    } else {
        if (hasCircular) {
            const checkCircular = (data: any, stack: any[] | undefined, opts: any): any[] | undefined => {
                if (data && typeof data === 'object') {
                    if (stack) {
                        if (stack.includes(data)) return undefined;
                    } else {
                        stack = [];
                        opts._stack = stack;
                    }
                    stack.push(data);
                }
                return stack;
            };

            const popStack = (stack: any[] | undefined): void => {
                if (stack) stack.pop();
            };

            const result = b.var_<any>(undefined);
            const stackRef = b.call(checkCircular, input, state.optionsRef.get('_stack' as any), state.optionsRef);

            b.if_(b.neq(stackRef, b.lit(undefined)), () => {
                const innerResult = buildObjectLiteralBody(objType, members, input, b, state, isDeserialize);
                b.call(popStack, stackRef);
                b.setVar(result, innerResult);
            });

            return b.getVar(result);
        } else {
            return buildObjectLiteralBody(objType, members, input, b, state, isDeserialize);
        }
    }
};

/**
 * Build the body of object literal serialization/deserialization.
 */
function buildObjectLiteralBody(
    objType: TypeObjectLiteral | TypeClass,
    members: Type[],
    input: Ref,
    b: Builder,
    state: JsonBuildContext,
    isDeserialize: boolean,
): Ref {
    const explicitProps = new Set<string>();
    let indexSignature: TypeIndexSignature | undefined;

    interface LiteralProp {
        outputKey: string;
        valueRef: Ref;
    }
    interface IncrementalProp {
        memberType: TypeProperty | TypePropertySignature;
        propType: Type;
        inputKey: string;
        outputKey: string;
        propInput: Ref;
        propGroups: string[];
    }
    interface EmbeddedProp {
        memberType: TypeProperty | TypePropertySignature;
        propName: string;
        embeddedType: TypeClass | TypeObjectLiteral;
        prefix: string;
        propGroups: string[];
        isUnion: boolean;
        originalType: Type;
    }

    const literalProps: LiteralProp[] = [];
    const incrementalProps: IncrementalProp[] = [];
    const embeddedProps: EmbeddedProp[] = [];

    // Pre-scan to check if any property has groups defined
    // If no groups are defined, we can skip group filtering entirely
    let typeHasAnyGroups = false;
    for (const member of members) {
        if (!isPropertyMemberType(member)) continue;
        const memberType = member as TypeProperty | TypePropertySignature;
        const propGroups = groupAnnotation.getAnnotations(memberType.type) || [];
        if (propGroups.length > 0) {
            typeHasAnyGroups = true;
            break;
        }
    }

    for (const member of members) {
        if (member.kind === ReflectionKind.indexSignature) {
            indexSignature = member;
            continue;
        }
        if (!isPropertyMemberType(member)) continue;

        const memberType = member as TypeProperty | TypePropertySignature;
        const propName = memberNameToString(memberType.name);
        explicitProps.add(propName);

        const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
        if (!serializedName) continue;

        const excluded = excludedAnnotation.getAnnotations(memberType.type);
        if (excluded.includes('*') || excluded.includes(state.serializer.name)) continue;

        const propGroups = groupAnnotation.getAnnotations(memberType.type) || [];
        const propType = memberType.type;

        // Check for embedded type
        let embedded = embeddedAnnotation.getFirst(propType);
        let embeddedType: TypeClass | TypeObjectLiteral | undefined;
        let isUnion = false;

        if (embedded && (propType.kind === ReflectionKind.class || propType.kind === ReflectionKind.objectLiteral)) {
            embeddedType = propType as TypeClass | TypeObjectLiteral;
        } else if (propType.kind === ReflectionKind.union) {
            const unionType = propType as TypeUnion;
            for (const unionMember of unionType.types) {
                const memberEmbedded = embeddedAnnotation.getFirst(unionMember);
                if (
                    memberEmbedded &&
                    (unionMember.kind === ReflectionKind.class || unionMember.kind === ReflectionKind.objectLiteral)
                ) {
                    embedded = memberEmbedded;
                    embeddedType = unionMember as TypeClass | TypeObjectLiteral;
                    isUnion = true;
                    break;
                }
            }
        }

        if (embedded && embeddedType) {
            const embeddedMembers = resolveTypeMembers(embeddedType);
            const embeddedProperties = embeddedMembers.filter(isPropertyMemberType);
            const isSingleProp = embeddedProperties.length === 1;
            const hasExplicitPrefix = embedded.prefix !== undefined;

            if (hasExplicitPrefix || !isSingleProp) {
                const prefix = embedded.prefix !== undefined ? embedded.prefix : propName + '_';
                embeddedProps.push({
                    memberType,
                    propName,
                    embeddedType,
                    prefix,
                    propGroups,
                    isUnion,
                    originalType: propType,
                });
                continue;
            }
        }

        const inputKey = isDeserialize ? serializedName : propName;
        const outputKey = isDeserialize ? propName : serializedName;
        const propInput = input.get(inputKey);

        // Use literal style for simple required non-nullable properties without groups
        // For serialize, only use literal style if the type has no groups anywhere
        // (meaning group filtering is never applicable to this type)
        const canUseLiteral =
            (isDeserialize || !typeHasAnyGroups) &&
            !isOptional(memberType) &&
            !isNullable(memberType) &&
            propGroups.length === 0 &&
            !(propType.kind === ReflectionKind.array && isBackReferenceType(memberType));

        if (canUseLiteral) {
            literalProps.push({
                outputKey,
                valueRef: state.build(propType, propInput),
            });
        } else {
            incrementalProps.push({
                memberType,
                propType,
                inputKey,
                outputKey,
                propInput,
                propGroups,
            });
        }
    }

    // Helper to build incremental property body
    const buildIncrementalPropBody = (
        result: Ref,
        memberType: TypeProperty | TypePropertySignature,
        propType: Type,
        inputKey: string,
        outputKey: string,
        propInput: Ref,
    ) => {
        const needsHasCheck = isDeserialize || isOptional(memberType);

        if (needsHasCheck) {
            b.if_(
                b.has(input, inputKey),
                () => {
                    if (isDeserialize) {
                        b.if_(
                            b.not(b.isNullish(propInput)),
                            () => {
                                b.set(result, outputKey, state.build(propType, propInput));
                            },
                            () => {
                                if (isNullable(memberType)) {
                                    b.set(result, outputKey, b.lit(null));
                                } else if (isOptional(memberType)) {
                                    b.set(result, outputKey, b.lit(undefined));
                                }
                            },
                        );
                    } else {
                        const isPrimitivePassThrough =
                            propType.kind === ReflectionKind.string ||
                            propType.kind === ReflectionKind.number ||
                            propType.kind === ReflectionKind.boolean;

                        if (isPrimitivePassThrough) {
                            // Use ternary for nullish coalesce: value ?? null
                            b.set(result, outputKey, b.ternary(b.isNullish(propInput), b.lit(null), propInput));
                        } else {
                            b.if_(
                                b.not(b.isNullish(propInput)),
                                () => {
                                    b.set(result, outputKey, state.build(propType, propInput));
                                },
                                () => {
                                    if (isNullable(memberType) || isOptional(memberType)) {
                                        b.set(result, outputKey, b.lit(null));
                                    }
                                },
                            );
                        }
                    }
                },
                () => {
                    if (isNullable(memberType)) {
                        b.set(result, outputKey, b.lit(null));
                    }
                },
            );
        } else {
            if (isNullable(memberType)) {
                b.if_(
                    b.not(b.isNullish(propInput)),
                    () => {
                        b.set(result, outputKey, state.build(propType, propInput));
                    },
                    () => {
                        b.set(result, outputKey, b.lit(null));
                    },
                );
            } else if (propType.kind === ReflectionKind.array && isBackReferenceType(memberType)) {
                b.if_(
                    b.eq(propInput, b.lit(unpopulatedSymbol)),
                    () => {
                        b.set(result, outputKey, b.emptyArr());
                    },
                    () => {
                        b.set(result, outputKey, state.build(propType, propInput));
                    },
                );
            } else {
                b.set(result, outputKey, state.build(propType, propInput));
            }
        }
    };

    // Create result object
    let result: Ref;

    // Fast path: all properties are literals, no incremental work needed
    if (literalProps.length > 0 && incrementalProps.length === 0 && !indexSignature && embeddedProps.length === 0) {
        const entries: Record<string, Ref> = {};
        for (const prop of literalProps) {
            entries[prop.outputKey] = prop.valueRef;
        }
        return b.obj(entries);
    }

    // Incremental build path
    if (literalProps.length > 0) {
        const entries: Record<string, Ref> = {};
        for (const prop of literalProps) {
            entries[prop.outputKey] = prop.valueRef;
        }
        result = b.let(b.obj(entries));
    } else {
        result = b.let(b.emptyObj());
    }

    // Handle incremental properties
    for (const prop of incrementalProps) {
        const { memberType, propType, inputKey, outputKey, propInput, propGroups } = prop;

        const buildPropBody = () => {
            buildIncrementalPropBody(result, memberType, propType, inputKey, outputKey, propInput);
        };

        // Always check groups in the slow path (only reached when filtering is active)
        if (typeHasAnyGroups) {
            const groupCheck = b.call(isGroupAllowed, state.optionsRef, b.lit(propGroups));
            b.if_(groupCheck, buildPropBody);
        } else {
            buildPropBody();
        }
    }

    // Handle index signature
    if (indexSignature) {
        const valueType = indexSignature.type;
        const valueAllowsNull = isNullable(indexSignature) || isOptional(indexSignature);
        const indexType = indexSignature.index;
        const hasExplicit = explicitProps.has.bind(explicitProps);

        b.forIn(input, (key, value) => {
            // Skip explicit (named) properties
            b.if_(b.not(b.call(hasExplicit, key)), () => {
                if (indexType.kind === ReflectionKind.templateLiteral) {
                    // Template literal index: check key matches, set undefined if not
                    const matchesTemplate = b.call(
                        (k: string, tpl: any) =>
                            extendTemplateLiteral({ kind: ReflectionKind.literal, literal: k } as any, tpl),
                        key,
                        b.lit(indexType),
                    );
                    b.if_(
                        matchesTemplate,
                        () => {
                            b.if_(
                                b.neq(value, b.lit(undefined)),
                                () => {
                                    const childState = state.forKey(key);
                                    b.set(result, key, childState.build(valueType, value));
                                },
                                () => {
                                    if (valueAllowsNull) b.set(result, key, b.lit(null));
                                },
                            );
                        },
                        () => {
                            b.set(result, key, b.lit(undefined));
                        },
                    );
                } else if (indexType.kind === ReflectionKind.number) {
                    // Number index: check key is numeric, set undefined if not
                    const isNumeric = b.call((k: string) => {
                        const n = Number(k);
                        return !isNaN(n) && k !== '';
                    }, key);
                    b.if_(
                        isNumeric,
                        () => {
                            b.if_(
                                b.neq(value, b.lit(undefined)),
                                () => {
                                    const childState = state.forKey(key);
                                    b.set(result, key, childState.build(valueType, value));
                                },
                                () => {
                                    if (valueAllowsNull) b.set(result, key, b.lit(null));
                                },
                            );
                        },
                        () => {
                            b.set(result, key, b.lit(undefined));
                        },
                    );
                } else {
                    // String index (most common): all keys match
                    b.if_(
                        b.neq(value, b.lit(undefined)),
                        () => {
                            const childState = state.forKey(key);
                            b.set(result, key, childState.build(valueType, value));
                        },
                        () => {
                            if (valueAllowsNull) b.set(result, key, b.lit(null));
                        },
                    );
                }
            });
        });
    }

    // Handle embedded properties
    for (const embeddedProp of embeddedProps) {
        const { memberType, propName, embeddedType, prefix, propGroups, isUnion, originalType } = embeddedProp;
        const embeddedMembers = resolveTypeMembers(embeddedType);
        const isOpt = isOptional(memberType);

        const buildEmbeddedBody = () => {
            if (isDeserialize) {
                const embeddedResult = b.var_<any>(undefined);
                const requiredKeys: string[] = [];

                for (const member of embeddedMembers) {
                    if (!isPropertyMemberType(member)) continue;
                    const memberProp = member as TypeProperty | TypePropertySignature;
                    const subPropName = memberNameToString(memberProp.name);
                    const serializedSubName =
                        state.namingStrategy.getPropertyName(memberProp, state.serializer.name) || subPropName;
                    const prefixedName = prefix + serializedSubName;
                    if (!isOptional(memberProp)) {
                        requiredKeys.push(prefixedName);
                    }
                }

                const buildEmbedded = () => {
                    if (embeddedType.kind === ReflectionKind.class) {
                        const ctorProps = getDeepConstructorProperties(embeddedType);
                        if (ctorProps.length > 0) {
                            const args: Ref[] = [];
                            for (const ctorProp of ctorProps) {
                                const subPropName = memberNameToString(ctorProp.name);
                                const serializedSubName =
                                    state.namingStrategy.getPropertyName(ctorProp, state.serializer.name) ||
                                    subPropName;
                                const prefixedName = prefix + serializedSubName;
                                const propInput = input.get(prefixedName);
                                args.push(state.forProperty(prefixedName).build(ctorProp.type, propInput));
                            }
                            b.setVar(embeddedResult, b.new_((embeddedType as TypeClass).classType, ...args));
                        } else {
                            const instance = b.let(b.new_((embeddedType as TypeClass).classType));
                            for (const m of embeddedMembers) {
                                if (!isPropertyMemberType(m)) continue;
                                const mProp = m as TypeProperty | TypePropertySignature;
                                const subPropName = memberNameToString(mProp.name);
                                const serializedName =
                                    state.namingStrategy.getPropertyName(mProp, state.serializer.name) || subPropName;
                                const prefixedName = prefix + serializedName;
                                const propInput = input.get(prefixedName);
                                b.set(
                                    instance,
                                    subPropName,
                                    state.forProperty(prefixedName).build(mProp.type, propInput),
                                );
                            }
                            b.setVar(embeddedResult, instance);
                        }
                    } else {
                        const obj = b.let(b.emptyObj());
                        for (const m of embeddedMembers) {
                            if (!isPropertyMemberType(m)) continue;
                            const mProp = m as TypeProperty | TypePropertySignature;
                            const subPropName = memberNameToString(mProp.name);
                            const serializedName =
                                state.namingStrategy.getPropertyName(mProp, state.serializer.name) || subPropName;
                            const prefixedName = prefix + serializedName;
                            const propInput = input.get(prefixedName);
                            b.set(obj, subPropName, state.forProperty(prefixedName).build(mProp.type, propInput));
                        }
                        b.setVar(embeddedResult, obj);
                    }
                };

                const allPrefixedKeys = collectPrefixedPropertyNames(embeddedMembers, prefix, state);

                const deserializeFallback = () => {
                    const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
                    const fallbackInput = input.get(serializedName || propName);
                    b.if_(b.has(input, serializedName || propName), () => {
                        b.setVar(embeddedResult, state.build(originalType, fallbackInput));
                    });
                };

                if (isUnion) {
                    const hasPrefixed = b.call(
                        (obj: any, keys: string[]) => keys.some(k => k in obj && obj[k] !== undefined),
                        input,
                        b.lit(allPrefixedKeys),
                    );
                    b.if_(hasPrefixed, buildEmbedded, deserializeFallback);
                } else if (isOpt && requiredKeys.length > 0) {
                    const hasAny = b.call(
                        (obj: any, keys: string[]) => keys.some(k => k in obj && obj[k] !== undefined),
                        input,
                        b.lit(requiredKeys),
                    );
                    b.if_(hasAny, buildEmbedded);
                } else {
                    buildEmbedded();
                }

                b.set(result, propName, b.getVar(embeddedResult));
            } else {
                const embeddedInput = input.get(propName);

                const serializeEmbedded = () => {
                    for (const member of embeddedMembers) {
                        if (!isPropertyMemberType(member)) continue;
                        const memberProp = member as TypeProperty | TypePropertySignature;
                        const subPropName = memberNameToString(memberProp.name);
                        const serializedSubName =
                            state.namingStrategy.getPropertyName(memberProp, state.serializer.name) || subPropName;
                        const prefixedName = prefix + serializedSubName;
                        const subPropInput = embeddedInput.get(subPropName);

                        const isOptOrNull = isOptional(memberProp) || isNullable(memberProp);
                        if (isOptOrNull) {
                            b.if_(
                                b.isNullish(subPropInput),
                                () => {
                                    b.set(result, prefixedName, b.lit(null));
                                },
                                () => {
                                    b.set(
                                        result,
                                        prefixedName,
                                        state.forProperty(prefixedName).build(memberProp.type, subPropInput),
                                    );
                                },
                            );
                        } else {
                            b.set(
                                result,
                                prefixedName,
                                state.forProperty(prefixedName).build(memberProp.type, subPropInput),
                            );
                        }
                    }
                };

                const serializeFallback = () => {
                    const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
                    b.set(result, serializedName || propName, state.build(originalType, embeddedInput));
                };

                if (isUnion) {
                    const classRef =
                        embeddedType.kind === ReflectionKind.class ? (embeddedType as TypeClass).classType : Object;

                    const isEmbeddedInstance = b.call(
                        (val: any, cls: any) => val instanceof cls,
                        embeddedInput,
                        b.lit(classRef),
                    );
                    b.if_(isEmbeddedInstance, serializeEmbedded, serializeFallback);
                } else if (isOpt) {
                    b.if_(b.not(b.isNullish(embeddedInput)), serializeEmbedded);
                } else {
                    serializeEmbedded();
                }
            }
        };

        const groupCheck = b.call(isGroupAllowed, state.optionsRef, b.lit(propGroups));
        b.if_(groupCheck, buildEmbeddedBody);
    }

    return result;
}

// ============================================================================
// Class Deserializer
// ============================================================================

/**
 * Deserialize class types - creates actual class instances.
 */
export const deserializeClass: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const classRef = classType.classType;
    const clazz = ReflectionClass.from(classRef);
    const members = resolveTypeMembers(classType);

    // Check for embedded annotation
    const embedded = embeddedAnnotation.getFirst(classType);
    if (embedded) {
        const properties = members.filter(isPropertyMemberType) as (TypeProperty | TypePropertySignature)[];

        if (properties.length === 1) {
            const prop = properties[0];
            const propName = memberNameToString(prop.name);
            const propType = prop.type;
            const converted = state.forProperty(propName).build(propType, input);
            const ctorProps = getDeepConstructorProperties(classType);

            if (ctorProps.length > 0 && ctorProps.some(p => memberNameToString(p.name) === propName)) {
                return b.new_(classRef, converted);
            } else {
                const instance = b.let(b.new_(classRef));
                b.set(instance, propName, converted);
                return instance;
            }
        }

        if (embedded.prefix !== undefined && embedded.prefix !== '') {
            const prefix = embedded.prefix;
            const result = b.var_<any>(undefined);
            const ctorProps = getDeepConstructorProperties(classType);

            if (ctorProps.length > 0) {
                const args: Ref[] = [];
                for (const ctorProp of ctorProps) {
                    const subPropName = memberNameToString(ctorProp.name);
                    const serializedSubName =
                        state.namingStrategy.getPropertyName(ctorProp, state.serializer.name) || subPropName;
                    const prefixedName = prefix + serializedSubName;
                    const propInput = input.get(prefixedName);
                    args.push(state.forProperty(subPropName).build(ctorProp.type, propInput));
                }
                b.setVar(result, b.new_(classRef, ...args));
            } else {
                const instance = b.let(b.new_(classRef));
                for (const prop of properties) {
                    const subPropName = memberNameToString(prop.name);
                    const serializedSubName =
                        state.namingStrategy.getPropertyName(prop, state.serializer.name) || subPropName;
                    const prefixedName = prefix + serializedSubName;
                    const propInput = input.get(prefixedName);
                    b.set(instance, subPropName, state.forProperty(subPropName).build(prop.type, propInput));
                }
                b.setVar(result, instance);
            }

            return b.getVar(result);
        }
    }

    // Track constructor properties and embedded properties
    const constructorPropNames = new Set<string>();
    const explicitProps = new Set<string>();
    let indexSignature: TypeIndexSignature | undefined;

    interface EmbeddedPropInfo {
        memberType: TypeProperty | TypePropertySignature;
        propName: string;
        embeddedType: TypeClass | TypeObjectLiteral;
        prefix: string;
    }
    const embeddedProps: EmbeddedPropInfo[] = [];
    const embeddedPropNames = new Set<string>();

    for (const member of members) {
        if (member.kind === ReflectionKind.indexSignature) {
            indexSignature = member;
            continue;
        }
        if (isPropertyMemberType(member)) {
            const propName = memberNameToString((member as TypeProperty | TypePropertySignature).name);
            explicitProps.add(propName);

            const memberType = member as TypeProperty | TypePropertySignature;
            const propType = memberType.type;
            const embeddedInfo = embeddedAnnotation.getFirst(propType);

            if (
                embeddedInfo &&
                (propType.kind === ReflectionKind.class || propType.kind === ReflectionKind.objectLiteral)
            ) {
                const embeddedType = propType as TypeClass | TypeObjectLiteral;
                const embeddedMembers = resolveTypeMembers(embeddedType);
                const embeddedProperties = embeddedMembers.filter(isPropertyMemberType);
                const isSingleProp = embeddedProperties.length === 1;
                const hasExplicitPrefix = embeddedInfo.prefix !== undefined;

                if (hasExplicitPrefix || !isSingleProp) {
                    const prefix = embeddedInfo.prefix !== undefined ? embeddedInfo.prefix : propName + '_';
                    embeddedProps.push({ memberType, propName, embeddedType, prefix });
                    embeddedPropNames.add(propName);
                }
            }
        }
    }

    // Helper to process embedded properties
    const processEmbeddedProps = (result: Ref<any>): void => {
        for (const embProp of embeddedProps) {
            const { memberType, propName, embeddedType, prefix } = embProp;
            const embeddedMembers = resolveTypeMembers(embeddedType);
            const isOpt = isOptional(memberType);
            const prefixedNames = collectPrefixedPropertyNames(embeddedMembers, prefix, state);

            const buildEmbedded = () => {
                if (embeddedType.kind === ReflectionKind.class) {
                    const ctorProps = getDeepConstructorProperties(embeddedType);
                    if (ctorProps.length > 0) {
                        const args: Ref[] = [];
                        for (const ctorProp of ctorProps) {
                            const subPropName = memberNameToString(ctorProp.name);
                            const serializedName =
                                state.namingStrategy.getPropertyName(ctorProp, state.serializer.name) || subPropName;
                            const prefixedName = prefix + serializedName;
                            const propInput = input.get(prefixedName);
                            args.push(state.forProperty(subPropName).build(ctorProp.type, propInput));
                        }
                        b.set(result, propName, b.new_((embeddedType as TypeClass).classType, ...args));
                    } else {
                        const instance = b.let(b.new_((embeddedType as TypeClass).classType));
                        for (const m of embeddedMembers) {
                            if (!isPropertyMemberType(m)) continue;
                            const mProp = m as TypeProperty | TypePropertySignature;
                            const subPropName = memberNameToString(mProp.name);
                            const serializedName =
                                state.namingStrategy.getPropertyName(mProp, state.serializer.name) || subPropName;
                            const prefixedName = prefix + serializedName;
                            const propInput = input.get(prefixedName);
                            b.set(instance, subPropName, state.forProperty(subPropName).build(mProp.type, propInput));
                        }
                        b.set(result, propName, instance);
                    }
                } else {
                    const obj = b.let(b.emptyObj());
                    for (const m of embeddedMembers) {
                        if (!isPropertyMemberType(m)) continue;
                        const mProp = m as TypeProperty | TypePropertySignature;
                        const subPropName = memberNameToString(mProp.name);
                        const serializedName =
                            state.namingStrategy.getPropertyName(mProp, state.serializer.name) || subPropName;
                        const prefixedName = prefix + serializedName;
                        const propInput = input.get(prefixedName);
                        b.set(obj, subPropName, state.forProperty(subPropName).build(mProp.type, propInput));
                    }
                    b.set(result, propName, obj);
                }
            };

            if (isOpt && prefixedNames.length > 0) {
                const hasAny = b.call(
                    (obj: any, keys: string[]) => keys.some(k => k in obj && obj[k] !== undefined),
                    input,
                    b.lit(prefixedNames),
                );
                b.if_(hasAny, buildEmbedded);
            } else {
                buildEmbedded();
            }
        }
    };

    // Helper to process index signature (inline version)
    const processIndexSignatureOnResult = (result: Ref<any>): void => {
        if (!indexSignature) return;

        const valueType = indexSignature.type;
        const valueAllowsNull = isNullable(indexSignature) || isOptional(indexSignature);
        const indexType = indexSignature.index;
        const hasExplicit = explicitProps.has.bind(explicitProps);

        b.forIn(input, (key, value) => {
            // Skip explicit (named) properties
            b.if_(b.not(b.call(hasExplicit, key)), () => {
                const buildValueConversion = () => {
                    b.if_(
                        b.neq(value, b.lit(undefined)),
                        () => {
                            if (valueAllowsNull) {
                                // Null allowed: convert non-null values, pass null through
                                b.if_(
                                    b.neq(value, b.lit(null)),
                                    () => {
                                        const childState = state.forKey(key);
                                        b.set(result, key, childState.build(valueType, value));
                                    },
                                    () => {
                                        b.set(result, key, b.lit(null));
                                    },
                                );
                            } else {
                                // Null not allowed: skip null values, convert others
                                b.if_(b.neq(value, b.lit(null)), () => {
                                    const childState = state.forKey(key);
                                    b.set(result, key, childState.build(valueType, value));
                                });
                            }
                        },
                        () => {
                            if (valueAllowsNull) b.set(result, key, b.lit(null));
                        },
                    );
                };

                if (indexType.kind === ReflectionKind.templateLiteral) {
                    const matchesTemplate = b.call(
                        (k: string, tpl: any) =>
                            extendTemplateLiteral({ kind: ReflectionKind.literal, literal: k } as any, tpl),
                        key,
                        b.lit(indexType),
                    );
                    b.if_(matchesTemplate, buildValueConversion, () => {
                        b.set(result, key, b.lit(undefined));
                    });
                } else if (indexType.kind === ReflectionKind.number) {
                    const isNumeric = b.call((k: string) => {
                        const n = Number(k);
                        return !isNaN(n) && k !== '';
                    }, key);
                    b.if_(isNumeric, buildValueConversion, () => {
                        b.set(result, key, b.lit(undefined));
                    });
                } else {
                    // String index (most common): all keys match
                    buildValueConversion();
                }
            });
        });
    };

    // Handle disableConstructor
    if (clazz.disableConstructor) {
        const createInstance = (cls: { prototype: any }) => Object.create(cls.prototype);
        const result = b.let(b.call(createInstance, b.lit(classRef)));

        // Apply default values
        for (const property of clazz.getProperties()) {
            const prop = property.property;
            if (prop.kind === ReflectionKind.property && prop.default !== undefined) {
                const defaultFn = prop.default;
                const propNameStr = property.getName();
                const applyDefault = (obj: any, fn: () => any, name: string): number => {
                    obj[name] = fn.apply(obj);
                    return 0;
                };
                b.exec(b.call(applyDefault, result, b.lit(defaultFn), b.lit(propNameStr)));
            }
        }

        // Set properties from input
        for (const member of members) {
            if (!isPropertyMemberType(member)) continue;
            const memberType = member as TypeProperty | TypePropertySignature;
            const propName = memberNameToString(memberType.name);
            if (embeddedPropNames.has(propName)) continue;

            const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
            if (!serializedName) continue;

            const excluded = excludedAnnotation.getAnnotations(memberType.type);
            if (excluded.includes('*') || excluded.includes(state.serializer.name)) continue;

            const propType = memberType.type;
            const propInput = input.get(serializedName);

            b.if_(
                b.has(input, serializedName),
                () => {
                    b.if_(
                        b.not(b.isNullish(propInput)),
                        () => {
                            b.set(result, propName, state.build(propType, propInput));
                        },
                        () => {
                            if (isNullable(memberType)) {
                                b.set(result, propName, b.lit(null));
                            } else if (isOptional(memberType)) {
                                b.set(result, propName, b.lit(undefined));
                            }
                        },
                    );
                },
                () => {
                    if (isNullable(memberType)) {
                        b.set(result, propName, b.lit(null));
                    }
                },
            );
        }

        processEmbeddedProps(result);
        processIndexSignatureOnResult(result);
        return result;
    }

    // Handle constructor
    const constructorInfo = clazz.getConstructorOrUndefined();

    if (constructorInfo) {
        const constructorArgs: Ref<any>[] = [];
        const parameters = constructorInfo.getParameters();
        const deepConstructorProps = getDeepConstructorProperties(classType);

        for (const prop of deepConstructorProps) {
            constructorPropNames.add(String(prop.name));
        }

        for (const param of parameters) {
            if (!param.isProperty()) {
                constructorArgs.push(b.lit(undefined));
                continue;
            }

            const property = clazz.getPropertyOrUndefined(param.getName());
            if (!property) {
                constructorArgs.push(b.lit(undefined));
                continue;
            }

            if (property.isSerializerExcluded(state.serializer.name)) {
                constructorArgs.push(b.lit(undefined));
                continue;
            }

            // Check if this is an embedded property
            const paramEmbedded = embeddedAnnotation.getFirst(property.type);
            const propType = property.type;

            if (
                paramEmbedded &&
                (propType.kind === ReflectionKind.class || propType.kind === ReflectionKind.objectLiteral)
            ) {
                const embeddedType = propType as TypeClass | TypeObjectLiteral;
                const embeddedMembers = resolveTypeMembers(embeddedType);
                const embeddedProperties = embeddedMembers.filter(isPropertyMemberType);
                const isSingleProp = embeddedProperties.length === 1;
                const hasExplicitPrefix = paramEmbedded.prefix !== undefined;

                if (hasExplicitPrefix || !isSingleProp) {
                    const prefix = paramEmbedded.prefix !== undefined ? paramEmbedded.prefix : param.getName() + '_';
                    const prefixedKeys = collectPrefixedPropertyNames(embeddedMembers, prefix, state);
                    const argValue = b.var_<any>(b.lit(undefined));

                    const buildEmbeddedArg = () => {
                        if (propType.kind === ReflectionKind.class) {
                            const embClass = propType as TypeClass;
                            const ctorProps = getDeepConstructorProperties(embClass);
                            if (ctorProps.length > 0) {
                                const args: Ref[] = [];
                                for (const ctorProp of ctorProps) {
                                    const subPropName = memberNameToString(ctorProp.name);
                                    const serializedName =
                                        state.namingStrategy.getPropertyName(ctorProp, state.serializer.name) ||
                                        subPropName;
                                    const prefixedName = prefix + serializedName;
                                    const propInput = input.get(prefixedName);
                                    args.push(state.forProperty(subPropName).build(ctorProp.type, propInput));
                                }
                                b.setVar(argValue, b.new_(embClass.classType, ...args));
                            } else {
                                const instance = b.let(b.new_(embClass.classType));
                                for (const m of embeddedMembers) {
                                    if (!isPropertyMemberType(m)) continue;
                                    const mProp = m as TypeProperty | TypePropertySignature;
                                    const subPropName = memberNameToString(mProp.name);
                                    const serializedName =
                                        state.namingStrategy.getPropertyName(mProp, state.serializer.name) ||
                                        subPropName;
                                    const prefixedName = prefix + serializedName;
                                    const propInput = input.get(prefixedName);
                                    b.set(
                                        instance,
                                        subPropName,
                                        state.forProperty(subPropName).build(mProp.type, propInput),
                                    );
                                }
                                b.setVar(argValue, instance);
                            }
                        } else {
                            const obj = b.let(b.emptyObj());
                            for (const m of embeddedMembers) {
                                if (!isPropertyMemberType(m)) continue;
                                const mProp = m as TypeProperty | TypePropertySignature;
                                const subPropName = memberNameToString(mProp.name);
                                const serializedName =
                                    state.namingStrategy.getPropertyName(mProp, state.serializer.name) || subPropName;
                                const prefixedName = prefix + serializedName;
                                const propInput = input.get(prefixedName);
                                b.set(obj, subPropName, state.forProperty(subPropName).build(mProp.type, propInput));
                            }
                            b.setVar(argValue, obj);
                        }
                    };

                    const isOpt = isOptional(property.property);
                    if (isOpt && prefixedKeys.length > 0) {
                        const hasAny = b.call(
                            (obj: any, keys: string[]) => keys.some(k => k in obj && obj[k] !== undefined),
                            input,
                            b.lit(prefixedKeys),
                        );
                        b.if_(hasAny, buildEmbeddedArg);
                    } else {
                        buildEmbeddedArg();
                    }

                    constructorArgs.push(b.getVar(argValue));
                    continue;
                }
            }

            const serializedName = state.namingStrategy.getPropertyName(property.property, state.serializer.name);
            const inputKey = serializedName || param.getName();
            const propInput = input.get(inputKey);

            const argValue = b.var_(b.lit(undefined));
            b.if_(b.has(input, inputKey), () => {
                b.if_(
                    b.not(b.isNullish(propInput)),
                    () => {
                        b.setVar(argValue, state.build(property.type, propInput));
                    },
                    () => {
                        if (isNullable(property.property)) {
                            b.setVar(argValue, b.lit(null));
                        }
                    },
                );
            });

            constructorArgs.push(b.getVar(argValue));
        }

        const result = b.let(b.new_(classRef, ...constructorArgs));

        // Set non-constructor properties
        for (const member of members) {
            if (!isPropertyMemberType(member)) continue;
            const memberType = member as TypeProperty | TypePropertySignature;
            const propName = memberNameToString(memberType.name);
            if (constructorPropNames.has(propName)) continue;
            if (embeddedPropNames.has(propName)) continue;

            const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
            if (!serializedName) continue;

            const excluded = excludedAnnotation.getAnnotations(memberType.type);
            if (excluded.includes('*') || excluded.includes(state.serializer.name)) continue;

            const propType = memberType.type;
            const propInput = input.get(serializedName);

            b.if_(
                b.has(input, serializedName),
                () => {
                    b.if_(
                        b.not(b.isNullish(propInput)),
                        () => {
                            b.set(result, propName, state.build(propType, propInput));
                        },
                        () => {
                            if (isNullable(memberType)) {
                                b.set(result, propName, b.lit(null));
                            } else if (isOptional(memberType)) {
                                b.set(result, propName, b.lit(undefined));
                            }
                        },
                    );
                },
                () => {
                    if (isNullable(memberType)) {
                        b.set(result, propName, b.lit(null));
                    }
                },
            );
        }

        processEmbeddedProps(result);
        processIndexSignatureOnResult(result);
        return result;
    }

    // No constructor - use simple new classRef()
    const result = b.let(b.new_(classRef));

    for (const member of members) {
        if (!isPropertyMemberType(member)) continue;
        const memberType = member as TypeProperty | TypePropertySignature;
        const propName = memberNameToString(memberType.name);
        if (embeddedPropNames.has(propName)) continue;

        const serializedName = state.namingStrategy.getPropertyName(memberType, state.serializer.name);
        if (!serializedName) continue;

        const excluded = excludedAnnotation.getAnnotations(memberType.type);
        if (excluded.includes('*') || excluded.includes(state.serializer.name)) continue;

        const propType = memberType.type;
        const propInput = input.get(serializedName);

        b.if_(
            b.has(input, serializedName),
            () => {
                b.if_(
                    b.not(b.isNullish(propInput)),
                    () => {
                        b.set(result, propName, state.build(propType, propInput));
                    },
                    () => {
                        if (isNullable(memberType)) {
                            b.set(result, propName, b.lit(null));
                        } else if (isOptional(memberType)) {
                            b.set(result, propName, b.lit(undefined));
                        }
                    },
                );
            },
            () => {
                if (isNullable(memberType)) {
                    b.set(result, propName, b.lit(null));
                }
            },
        );
    }

    processEmbeddedProps(result);
    processIndexSignatureOnResult(result);
    return result;
};

// ============================================================================
// Reference Handlers
// ============================================================================

/**
 * Serialize a reference type (FK relationship).
 */
export const serializeReference: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const clazz = ReflectionClass.from(classType.classType);
    const pkProperty = clazz.getPrimary();

    if (!pkProperty) {
        // No primary key - fall back to full serialization
        return handleObjectLiteral(type, input, b, state);
    }

    const pkName = pkProperty.getName();
    const pkType = pkProperty.type;

    // Check if input is a reference instance
    const result = b.var_<any>(undefined);

    b.if_(
        b.call(isReferenceInstance, input),
        () => {
            // It's a reference - get the primary key value
            const pkValue = input.get(pkName);
            b.setVar(result, state.build(pkType, pkValue));
        },
        () => {
            // Full object - serialize the primary key
            const pkValue = input.get(pkName);
            b.setVar(result, state.build(pkType, pkValue));
        },
    );

    return b.getVar(result);
};

/**
 * Deserialize a reference type (FK relationship).
 */
export const deserializeReference: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const clazz = ReflectionClass.from(classType.classType);
    const pkProperty = clazz.getPrimary();

    if (!pkProperty) {
        // No primary key - fall back to full deserialization
        return deserializeClass(type, input, b, state);
    }

    const pkName = String(pkProperty.getName());
    const pkType = pkProperty.type;
    const result = b.var_<any>(undefined);

    // Runtime function to check if an object has only the primary key property
    const isPkOnlyObject = (obj: any, pkPropertyName: string): boolean => {
        const keys = Object.keys(obj);
        return keys.length === 1 && keys[0] === pkPropertyName;
    };

    // Runtime function to create a reference from a primary key value
    const createReferenceFromPk = (
        pkValue: any,
        classRef: any,
        pkPropertyName: string,
        createReferenceFn: typeof createReference,
    ): any => {
        return createReferenceFn(classRef, { [pkPropertyName]: pkValue });
    };

    const isObj = b.and(b.isType(input, 'object'), b.not(b.isNull(input)));

    b.if_(
        isObj,
        () => {
            // Check if the object has only the primary key (reference shorthand like { id: 34 })
            const isPkOnly = b.call(isPkOnlyObject, input, b.lit(pkName));
            b.if_(
                isPkOnly,
                () => {
                    // Create reference from the PK-only object
                    const pkValue = input.get(pkName);
                    b.setVar(
                        result,
                        b.call(
                            createReferenceFromPk,
                            state.build(pkType, pkValue),
                            b.lit(classType.classType),
                            b.lit(pkName),
                            b.lit(createReference),
                        ),
                    );
                },
                () => {
                    // Deserialize as full class
                    b.setVar(result, deserializeClass(type, input, b, state));
                },
            );
        },
        () => {
            // Input is a primitive (PK value) - create a reference
            b.setVar(
                result,
                b.call(
                    createReferenceFromPk,
                    state.build(pkType, input),
                    b.lit(classType.classType),
                    b.lit(pkName),
                    b.lit(createReference),
                ),
            );
        },
    );

    return b.getVar(result);
};

/**
 * Serialize an inline (embedded) reference.
 */
export const serializeInlineReference: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const referenceOptions = referenceAnnotation.getFirst(classType);

    // Check if reference is loaded
    const result = b.var_<any>(undefined);

    b.if_(
        b.eq(input, b.lit(unpopulatedSymbol)),
        () => {
            // Not loaded - return undefined (will be omitted)
            b.setVar(result, b.lit(undefined));
        },
        () => {
            // Loaded - serialize the full object
            b.setVar(result, handleObjectLiteral(type, input, b, state));
        },
    );

    return b.getVar(result);
};

/**
 * Deserialize an inline (embedded) reference.
 */
export const deserializeInlineReference: JsonTypeHandler = (type, input, b, state) => {
    // Inline references are deserialized as full objects
    return deserializeClass(type, input, b, state);
};

// ============================================================================
// Reference Guards
// ============================================================================

/**
 * Guard for reference types (score-based).
 */
export const guardReferenceScore: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const clazz = ReflectionClass.from(classType.classType);
    const pkProperty = clazz.getPrimary();

    if (!pkProperty) {
        // No primary key - use object guard
        return guardObjectScore(type, input, b, state);
    }

    const pkType = pkProperty.type;
    const pkName = String(pkProperty.getName());

    // Accept either:
    // 1. Primary key value directly
    // 2. Object with primary key property
    const score = b.var_(b.lit(0));

    b.if_(
        b.and(b.isType(input, 'object'), b.not(b.isNull(input))),
        () => {
            // Object - check the PK property
            const pkInput = input.get(pkName);
            const pkScore = state.forProperty(pkName).build(pkType, pkInput);
            b.setVar(score, pkScore);
        },
        () => {
            // Primitive - check if it matches PK type
            const pkScore = state.build(pkType, input);
            b.setVar(score, pkScore);
        },
    );

    return b.getVar(score);
};

/**
 * Guard for reference types (fast/boolean).
 */
export const guardReferenceFast: JsonTypeHandler = (type, input, b, state) => {
    const classType = type as TypeClass;
    const clazz = ReflectionClass.from(classType.classType);

    if (!clazz.hasPrimary()) {
        return guardObjectFast(type, input, b, state);
    }

    const pkProperty = clazz.getPrimary();

    const pkType = pkProperty.type;
    const pkName = String(pkProperty.getName());

    const isObj = b.and(b.isType(input, 'object'), b.not(b.isNull(input)));
    const pkInput = input.get(pkName);
    const pkCheck = state.forProperty(pkName).build(pkType, pkInput) as Ref<boolean>;
    const directCheck = state.build(pkType, input) as Ref<boolean>;

    return b.ternary(isObj, pkCheck, directCheck);
};

// ============================================================================
// Exported Helper Functions
// ============================================================================

export {
    isPlainObject,
    isPureTypeGuard,
    getTypeMismatchMessage,
    collectPrefixedPropertyNames,
    findTupleRest,
    pushTypeErrorWhen,
    guardWithError,
    guardWithTypeError,
    isSignedNumericString,
    isSignedIntegerString,
    getBinaryBigIntMode,
    validateMultipleIndexSignatures,
    callClassValidator,
    validateIndexSignatureValue,
    buildObjectLiteralBody,
};

// ============================================================================
// Type Guard Helpers
// ============================================================================

/**
 * Check if a type is a branded number (integer, int8, float32, etc.)
 */
export function isBrandedNumber(type: Type): boolean {
    return type.kind === ReflectionKind.number && (type as TypeNumber).brand !== undefined;
}

/**
 * Branded number type guard - alias to guardNumberFast (which handles brands).
 */
export const guardNumberBrandedFast = guardNumberFast;

// ============================================================================
// Union Type Guard
// ============================================================================

/**
 * Get the base type kind for a type (unwrapping annotations/intersections).
 * For `string & MinLength<3>`, returns ReflectionKind.string.
 */
function getBaseTypeKind(type: Type): ReflectionKind {
    // Validation annotations are added as intersection types by the type compiler
    if (type.kind === ReflectionKind.intersection) {
        for (const t of (type as any).types) {
            const kind = getBaseTypeKind(t);
            // Skip never/unknown/intersection - find the real base type
            if (
                kind !== ReflectionKind.never &&
                kind !== ReflectionKind.unknown &&
                kind !== ReflectionKind.intersection
            ) {
                return kind;
            }
        }
        return ReflectionKind.never;
    }
    return type.kind;
}

/**
 * Check if a value's runtime type matches a type's expected base type.
 */
function valueMatchesBaseType(value: any, type: Type): boolean {
    const baseKind = getBaseTypeKind(type);

    switch (baseKind) {
        case ReflectionKind.string:
            return typeof value === 'string';
        case ReflectionKind.number:
            return typeof value === 'number';
        case ReflectionKind.boolean:
            return typeof value === 'boolean';
        case ReflectionKind.bigint:
            return typeof value === 'bigint';
        case ReflectionKind.null:
            return value === null;
        case ReflectionKind.undefined:
            return value === undefined;
        case ReflectionKind.array:
            return Array.isArray(value);
        case ReflectionKind.objectLiteral:
        case ReflectionKind.class:
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        case ReflectionKind.literal:
            return value === (type as TypeLiteral).literal;
        default:
            return true; // For complex types, let the full validator handle it
    }
}

/**
 * Get a display name for a type (used for error path prefixing).
 */
function getTypeName(t: Type): string {
    if (t.kind === ReflectionKind.objectLiteral && (t as TypeObjectLiteral).typeName) {
        return (t as TypeObjectLiteral).typeName!;
    }
    if (t.kind === ReflectionKind.class && (t as TypeClass).classType) {
        return (t as TypeClass).classType.name;
    }
    return '';
}

/**
 * Runtime validation for discriminated unions with error collection.
 * Uses the discriminator to validate only the matching member (O(1) lookup),
 * then collects detailed per-field errors with type name prefixing.
 */
function validateDiscriminatedUnionWithErrors(
    value: any,
    discriminatorProperty: string,
    valueToMember: Map<any, Type>,
    serializer: Serializer,
    guardCache: Map<Type, Function>,
    errors: ValidationErrorItem[],
    path: string,
    typeDescription: string,
): boolean {
    const discValue = value?.[discriminatorProperty];
    const matchedMember = valueToMember.get(discValue);

    if (matchedMember) {
        let validator = guardCache.get(matchedMember);
        if (!validator) {
            validator = serializer.buildTypeGuard(matchedMember, false);
            guardCache.set(matchedMember, validator);
        }
        const memberErrors: ValidationErrorItem[] = [];
        if (validator(value, { errors: memberErrors })) return true;

        const typeName = getTypeName(matchedMember);
        let hasConstraintErrors = false;
        const processed: ValidationErrorItem[] = [];

        for (const err of memberErrors) {
            if (err.code !== 'type') {
                hasConstraintErrors = true;
                const fullPath = path && err.path ? path + '.' + err.path : path || err.path;
                processed.push(new ValidationErrorItem(fullPath, err.code, err.message, err.value));
            } else if (err.path && err.path.length > 0) {
                const prefixedPath = typeName ? typeName + '.' + err.path : err.path;
                const fullPath = path && prefixedPath ? path + '.' + prefixedPath : path || prefixedPath;
                processed.push(new ValidationErrorItem(fullPath, err.code, err.message, err.value));
            }
        }

        if (hasConstraintErrors) {
            for (const e of processed) if (e.code !== 'type') errors.push(e);
        } else if (processed.length > 0) {
            for (const e of processed) errors.push(e);
        } else {
            errors.push(
                new ValidationErrorItem(
                    path,
                    'type',
                    `Cannot convert ${stringifyValueWithType(value)} to ${typeDescription}`,
                    value,
                ),
            );
        }

        return false;
    }

    // Discriminant doesn't match any member — point error at discriminant property
    const discPath = path ? path + '.' + discriminatorProperty : discriminatorProperty;
    errors.push(
        new ValidationErrorItem(
            discPath,
            'type',
            `Cannot convert ${stringifyValueWithType(value)} to ${typeDescription}`,
            value,
        ),
    );
    return false;
}

/**
 * Runtime validation function for unions that:
 * 1. First tries fast validation (find any member that validates)
 * 2. If failed, collects constraint-specific errors (#577)
 * 3. Returns boolean result
 *
 * This is called at runtime (not JIT build time) to avoid deeply nested expression trees.
 *
 * @param value - The value being validated
 * @param members - The union member types
 * @param serializer - The serializer to use for building type guards
 * @param errors - The errors array to push errors to (may be undefined)
 * @param path - The current path in the object being validated
 * @param typeDescription - Human-readable description of the union type
 * @returns true if validation passed, false otherwise
 */
function validateUnionWithErrorsRuntime(
    value: any,
    members: Type[],
    serializer: Serializer,
    guardCache: Map<Type, Function>,
    errors: ValidationErrorItem[] | undefined,
    path: string,
    typeDescription: string,
): boolean {
    // First pass: try to find a member that fully validates (fast path)
    for (const member of members) {
        try {
            let validator = guardCache.get(member);
            if (!validator) {
                validator = serializer.buildTypeGuard(member, false);
                guardCache.set(member, validator);
            }
            if (validator(value, {})) return true;
        } catch {
            // Validation threw (e.g., accessing property on undefined), treat as non-match
        }
    }

    // Second pass: find members whose base type matches and collect all errors
    const matchingMemberErrors: ValidationErrorItem[] = [];
    let hasConstraintErrors = false;

    for (const member of members) {
        if (valueMatchesBaseType(value, member)) {
            const memberErrors: ValidationErrorItem[] = [];
            try {
                const validator = guardCache.get(member)!;
                validator(value, { errors: memberErrors });
            } catch {
                continue;
            }

            const typeName = getTypeName(member);

            for (const err of memberErrors) {
                // Constraint errors (non-"type") are prioritized
                if (err.code !== 'type') {
                    hasConstraintErrors = true;
                    const fullPath = path && err.path ? path + '.' + err.path : path || err.path;
                    matchingMemberErrors.push(new ValidationErrorItem(fullPath, err.code, err.message, err.value));
                } else if (err.path && err.path.length > 0) {
                    // Type errors with a path get the type name prefix
                    const prefixedPath = typeName ? typeName + '.' + err.path : err.path;
                    const fullPath = path && prefixedPath ? path + '.' + prefixedPath : path || prefixedPath;
                    matchingMemberErrors.push(new ValidationErrorItem(fullPath, err.code, err.message, err.value));
                }
            }
        }
    }

    // If there are constraint errors, only show those (more specific)
    if (hasConstraintErrors && errors) {
        for (const err of matchingMemberErrors) {
            if (err.code !== 'type') {
                errors.push(err);
            }
        }
        return false;
    }

    // Otherwise show all collected errors
    if (matchingMemberErrors.length > 0 && errors) {
        for (const err of matchingMemberErrors) {
            errors.push(err);
        }
        return false;
    }

    // No matching base type - add generic error
    if (errors) {
        errors.push(
            new ValidationErrorItem(
                path,
                'type',
                `Cannot convert ${stringifyValueWithType(value)} to ${typeDescription}`,
                value,
            ),
        );
    }
    return false;
}

/**
 * Union type guard (fast/boolean).
 *
 * Has 3 code paths to avoid stack overflow for large unions:
 * 1. Large literal union: Set.has() for O(1) lookup
 * 2. Error-collecting: Uses runtime validateUnion function with constraint-specific errors (#577)
 * 3. Non-error-collecting: Builds || chain (only used for small unions when no errors needed)
 */
export const guardUnionFast: JsonTypeHandler = (type, input, b, state) => {
    const unionType = type as TypeUnion;
    const members = unionType.types;

    // Path 1: Large literal union optimization using Set.has()
    const isAllLiterals = members.every(t => t.kind === ReflectionKind.literal);
    if (isAllLiterals && members.length >= UNION_LITERAL_THRESHOLD) {
        const literals = members.map(t => (t as TypeLiteral).literal);
        const literalSet = new Set(literals);

        const hasCheck = b.call((set: Set<any>, value: any) => set.has(value), b.lit(literalSet), input);

        if (state.collectErrors && !state.inUnionContext) {
            const errorsRef = state.optionsRef.get('errors' as any);
            const resultVar = b.var_(hasCheck);
            b.if_(b.and(errorsRef, b.not(b.getVar(resultVar))), () => {
                const expectedType = stringifyType(type).replace(/\n/g, '').replace(/\s+/g, ' ').trim();
                const valueStr = b.call(stringifyValueWithType, input);
                const errorMsg = b.concat(b.lit('Cannot convert '), valueStr, b.lit(' to '), b.lit(expectedType));
                const errorItem = b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), errorMsg, input);
                b.push(errorsRef, errorItem);
            });
            return b.getVar(resultVar);
        }

        return hasCheck;
    }

    // Path 2: Discriminator detection — O(1) switch on discriminant property
    const disc = detectDiscriminator(unionType);
    if (disc) {
        // Fast JIT switch for both error and non-error paths
        const discValue = b.get(input, b.lit(disc.property));
        const resultVar = b.var_<boolean>(false);

        const cases: Array<[any, () => void]> = [];
        for (const [literal, memberType] of disc.valueToMember) {
            cases.push([
                literal,
                () => {
                    const memberCheck = state.forUnionMember().build(memberType, input) as Ref<boolean>;
                    b.setVar(resultVar, memberCheck);
                },
            ]);
        }

        b.switch_(discValue, cases, () => {
            b.setVar(resultVar, b.lit(false));
        });

        const result = b.getVar(resultVar);

        // When validation fails and errors are requested, collect detailed per-field errors
        if (state.collectErrors && !state.inUnionContext) {
            const errorsRef = state.optionsRef.get('errors' as any);
            const typeStr = stringifyType(type).replace(/\n/g, '').replace(/\s+/g, ' ').trim();

            // Lazy cache: populated on first runtime use (not JIT time) to avoid
            // infinite recursion for recursive union types like JSONValue
            const discGuardCache = new Map<Type, Function>();

            b.if_(b.and(errorsRef, b.not(result)), () => {
                b.exec(
                    b.call(
                        validateDiscriminatedUnionWithErrors,
                        input,
                        b.lit(disc.property),
                        b.lit(disc.valueToMember),
                        b.lit(state.serializer),
                        b.lit(discGuardCache),
                        errorsRef,
                        state.pathRef(),
                        b.lit(typeStr),
                    ),
                );
            });
        }

        return result;
    }

    // Path 3: Error-collecting validation with constraint-specific errors (#577)
    // Uses runtime function to avoid deeply nested expression trees
    if (state.collectErrors && !state.inUnionContext) {
        const errorsRef = state.optionsRef.get('errors' as any);
        const typeStr = stringifyType(type).replace(/\n/g, '').replace(/\s+/g, ' ').trim();

        // Lazy cache: populated on first runtime use (not JIT time) to avoid
        // infinite recursion for recursive union types like JSONValue
        const unionGuardCache = new Map<Type, Function>();

        // Use runtime validateUnionWithErrors which does validation and error collection
        const result = b.call(
            validateUnionWithErrorsRuntime,
            input,
            b.lit(members),
            b.lit(state.serializer),
            b.lit(unionGuardCache),
            errorsRef,
            state.pathRef(),
            b.lit(typeStr),
        );

        return result;
    }

    // Path 4: Non-error-collecting fast validation - build || chain
    // Only used when not collecting errors (safe for small unions)
    const memberState = state.forUnionMember();
    let result: Ref<boolean> = b.lit(false);
    for (const member of members) {
        const memberCheck = memberState.build(member, input) as Ref<boolean>;
        result = b.or(result, memberCheck);
    }

    return result;
};

// ============================================================================
// Registration Functions
// ============================================================================

/**
 * Register default serialization/deserialization handlers.
 */
export function registerDefaultHandlers(serializer: Serializer): void {
    const serializeRegistry = serializer.serializeRegistry;
    const deserializeRegistry = serializer.deserializeRegistry;

    // Primitives
    serializeRegistry.register(ReflectionKind.string, handleString);
    deserializeRegistry.register(ReflectionKind.string, deserializeString);
    serializeRegistry.register(ReflectionKind.number, handleNumber);
    deserializeRegistry.register(ReflectionKind.number, deserializeNumber);
    serializeRegistry.register(ReflectionKind.boolean, handleBoolean);
    deserializeRegistry.register(ReflectionKind.boolean, deserializeBoolean);
    serializeRegistry.register(ReflectionKind.bigint, handleBigInt);
    deserializeRegistry.register(ReflectionKind.bigint, deserializeBigInt);
    serializeRegistry.register(ReflectionKind.null, handleNull);
    deserializeRegistry.register(ReflectionKind.null, handleNull);
    serializeRegistry.register(ReflectionKind.undefined, serializeUndefined);
    deserializeRegistry.register(ReflectionKind.undefined, handleUndefined);
    serializeRegistry.register(ReflectionKind.any, handleAny);
    deserializeRegistry.register(ReflectionKind.any, handleAny);
    serializeRegistry.register(ReflectionKind.unknown, handleUnknown);
    deserializeRegistry.register(ReflectionKind.unknown, handleUnknown);

    // Collections
    serializeRegistry.register(ReflectionKind.array, handleArray);
    deserializeRegistry.register(ReflectionKind.array, handleArray);
    serializeRegistry.register(ReflectionKind.tuple, handleTuple);
    deserializeRegistry.register(ReflectionKind.tuple, handleTuple);

    // Objects and classes
    serializeRegistry.register(ReflectionKind.objectLiteral, handleObjectLiteral);
    deserializeRegistry.register(ReflectionKind.objectLiteral, handleObjectLiteral);
    serializeRegistry.register(ReflectionKind.class, handleObjectLiteral);
    deserializeRegistry.register(ReflectionKind.class, deserializeClass);

    // Literal, enum, promise
    serializeRegistry.register(ReflectionKind.literal, handleLiteral);
    deserializeRegistry.register(ReflectionKind.literal, handleLiteral);
    serializeRegistry.register(ReflectionKind.enum, handleEnum);
    deserializeRegistry.register(ReflectionKind.enum, deserializeEnum);
    serializeRegistry.register(ReflectionKind.promise, handlePromise);
    deserializeRegistry.register(ReflectionKind.promise, handlePromise);

    // Built-in class types
    serializeRegistry.registerClass(Date, serializeDate);
    deserializeRegistry.registerClass(Date, deserializeDate);
    serializeRegistry.register(ReflectionKind.regexp, serializeRegExp);
    deserializeRegistry.register(ReflectionKind.regexp, deserializeRegExp);
    serializeRegistry.registerClass(Set, serializeSet);
    deserializeRegistry.registerClass(Set, deserializeSet);
    serializeRegistry.registerClass(Map, serializeMap);
    deserializeRegistry.registerClass(Map, deserializeMap);

    // Binary types
    serializeRegistry.registerClass(ArrayBuffer, serializeArrayBuffer);
    deserializeRegistry.registerClass(ArrayBuffer, deserializeArrayBuffer);
    for (const binaryType of binaryTypes) {
        if (binaryType === ArrayBuffer) continue;
        serializeRegistry.registerClass(binaryType, serializeTypedArray);
        deserializeRegistry.registerClass(binaryType, deserializeTypedArray);
    }

    // Decorators
    serializeRegistry.addDecorator(isReferenceType, serializeReference);
    deserializeRegistry.addDecorator(isReferenceType, deserializeReference);

    // Binary BigInt types
    serializeRegistry.addDecorator(type => getBinaryBigIntMode(type) !== undefined, serializeBinaryBigInt);
    deserializeRegistry.addDecorator(type => getBinaryBigIntMode(type) !== undefined, deserializeBinaryBigInt);

    // Special string types
    deserializeRegistry.addDecorator(isNanoIdType, deserializeNanoId);
    deserializeRegistry.addDecorator(isUUIDType, deserializeUUID);
    deserializeRegistry.addDecorator(isMongoIdType, deserializeMongoId);
}

/**
 * Register type guards for the serializer.
 */
export function registerTypeGuards(serializer: Serializer): void {
    const reg = serializer.typeGuards;

    // Primitives
    reg.register(ReflectionKind.string, guardStringFast);
    reg.register(ReflectionKind.number, guardNumberFast);
    reg.register(ReflectionKind.boolean, guardBooleanFast);
    reg.register(ReflectionKind.bigint, guardBigIntFast);
    reg.register(ReflectionKind.null, guardNullFast);
    reg.register(ReflectionKind.undefined, guardUndefinedFast);
    reg.register(ReflectionKind.any, guardAnyFast);
    reg.register(ReflectionKind.literal, guardLiteralFast);

    // Compound types
    reg.register(ReflectionKind.array, guardArrayFast);
    reg.register(ReflectionKind.union, guardUnionFast);
    reg.register(ReflectionKind.objectLiteral, guardObjectFast);
    reg.register(ReflectionKind.class, guardObjectFast);
    reg.register(ReflectionKind.enum, guardEnumFast);
    reg.register(ReflectionKind.tuple, guardTupleFast);
    reg.register(ReflectionKind.function, guardFunctionFast);
    reg.register(ReflectionKind.method, guardFunctionFast);
    reg.register(ReflectionKind.methodSignature, guardFunctionFast);
    reg.register(ReflectionKind.regexp, guardRegExpFast);
    reg.register(ReflectionKind.templateLiteral, guardTemplateLiteralFast);

    // Class types
    reg.registerClass(Date, guardDateFast);
    reg.registerClass(Set, guardSetFast);
    reg.registerClass(Map, guardMapFast);

    // Binary type guards
    reg.registerBinary(guardTypedArrayFast);

    // Decorators
    reg.addDecorator(isReferenceType, guardReferenceFast);
    reg.addDecorator(isBrandedNumber, guardNumberBrandedFast);
    reg.addDecorator(isNanoIdType, guardNanoIdFast);
    reg.addDecorator(isUUIDType, guardUUIDFast);
    reg.addDecorator(isMongoIdType, guardMongoIdFast);

    // Post-hook for error collection
    reg.addPostHook((type, input, b, state, next) => {
        // If not collecting errors, just run the handler
        if (!state.collectErrors) {
            return next();
        }

        // If inside a union context, skip error adding
        if (state.inUnionContext && !state.collectUnionMemberErrors) {
            return next();
        }

        // Skip compound types that handle their own error collection
        if (
            type.kind === ReflectionKind.union ||
            type.kind === ReflectionKind.array ||
            type.kind === ReflectionKind.tuple ||
            type.kind === ReflectionKind.objectLiteral
        ) {
            return next();
        }

        // For class types, only skip user-defined classes
        if (type.kind === ReflectionKind.class) {
            const classType = (type as TypeClass).classType;
            const builtinClasses = [Date, Set, Map, RegExp, ArrayBuffer, ...binaryTypes];
            const isBuiltinClass = builtinClasses.includes(classType);
            if (!isBuiltinClass) {
                return next();
            }
        }

        // Track error count before running the handler
        const errorsRef = state.optionsRef.get('errors' as any);
        const errorCountBefore = b.var_(b.ternary(errorsRef, errorsRef.get('length' as any), b.lit(0)));

        // Run the handler
        const result = next() as Ref<boolean>;

        // Add error if validation failed and no errors were added by child handlers
        b.if_(b.and(errorsRef, b.not(result)), () => {
            const errorCountAfter = errorsRef.get('length' as any);
            b.if_(b.eq(b.getVar(errorCountBefore), errorCountAfter), () => {
                // Generate appropriate error message
                if (isNanoIdType(type)) {
                    b.push(
                        errorsRef,
                        b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not a valid NanoId'), input),
                    );
                    return;
                }
                if (isUUIDType(type)) {
                    b.push(
                        errorsRef,
                        b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), b.lit('Not a valid UUID'), input),
                    );
                    return;
                }
                if (isMongoIdType(type)) {
                    b.push(
                        errorsRef,
                        b.new_(
                            ValidationErrorItem,
                            state.pathRef(),
                            b.lit('type'),
                            b.lit('Not a valid MongoId'),
                            input,
                        ),
                    );
                    return;
                }

                const expectedType = stringifyType(type).replace(/\n/g, '').replace(/\s+/g, ' ').trim();
                const isDateType = type.kind === ReflectionKind.class && (type as TypeClass).classType === Date;
                const useSimpleMessage =
                    type.kind === ReflectionKind.string ||
                    type.kind === ReflectionKind.boolean ||
                    type.kind === ReflectionKind.bigint ||
                    isDateType;

                if (useSimpleMessage) {
                    b.push(
                        errorsRef,
                        b.new_(
                            ValidationErrorItem,
                            state.pathRef(),
                            b.lit('type'),
                            b.lit(`Not a ${expectedType}`),
                            input,
                        ),
                    );
                } else if (type.kind === ReflectionKind.number) {
                    b.if_(
                        b.eq(input, b.lit(undefined)),
                        () => {
                            b.push(
                                errorsRef,
                                b.new_(
                                    ValidationErrorItem,
                                    state.pathRef(),
                                    b.lit('type'),
                                    b.lit(`Not a ${expectedType}`),
                                    input,
                                ),
                            );
                        },
                        () => {
                            const valueStr = b.call(stringifyValueWithType, input);
                            const errorMsg = b.concat(
                                b.lit('Cannot convert '),
                                valueStr,
                                b.lit(' to '),
                                b.lit(expectedType),
                            );
                            b.push(
                                errorsRef,
                                b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), errorMsg, input),
                            );
                        },
                    );
                } else {
                    b.if_(
                        b.eq(input, b.lit(undefined)),
                        () => {
                            b.push(
                                errorsRef,
                                b.new_(
                                    ValidationErrorItem,
                                    state.pathRef(),
                                    b.lit('type'),
                                    b.lit(`Not a ${expectedType}`),
                                    input,
                                ),
                            );
                        },
                        () => {
                            const valueStr = b.call(stringifyValueWithType, input);
                            const errorMsg = b.concat(
                                b.lit('Cannot convert '),
                                valueStr,
                                b.lit(' to '),
                                b.lit(expectedType),
                            );
                            b.push(
                                errorsRef,
                                b.new_(ValidationErrorItem, state.pathRef(), b.lit('type'), errorMsg, input),
                            );
                        },
                    );
                }
            });
        });

        return result;
    });
}
