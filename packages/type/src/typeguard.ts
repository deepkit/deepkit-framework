/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ReceiveType, resolveReceiveType, visit } from './reflection/reflection.js';
import { Type, getTypeJitContainer, validationAnnotation } from './reflection/type.js';
import { Guard, Serializer, serializer } from './serializer/serializer.js';
import { NoTypeReceived } from './utils.js';
import { ValidationError, ValidationErrorItem } from './validator.js';

// ============================================================================
// Fast Type Guards (new API)
// ============================================================================

/**
 * Fast type guard. Returns true if data matches type T.
 * Ignores extra/unknown keys. No error details.
 *
 * Generated code uses pure && chain: `return typeof s0 === "object" && ...`
 *
 * @example
 * ```typescript
 * if (is<User>(data)) {
 *     console.log(data.name); // data is User
 * }
 * ```
 *
 * @deprecated signature: `is(data, serializer, errors, type)` - use `is(data, type)` instead
 */
export function is<T>(data: unknown, receiveType?: ReceiveType<T>): data is T;
/**
 * @deprecated Use `is(data, type)` for fast type guard, or use `validate()` from validator.ts for error collection.
 */
export function is<T>(
    data: unknown,
    serializerToUse?: Serializer,
    errors?: ValidationErrorItem[],
    receiveType?: ReceiveType<T>,
): data is T;
export function is<T>(
    data: unknown,
    serializerOrType?: Serializer | ReceiveType<T>,
    errors?: ValidationErrorItem[],
    receiveType?: ReceiveType<T>,
): data is T {
    // Detect which overload is being used
    // Note: We only check serializerOrType instanceof Serializer and errors !== undefined
    // because the type compiler injects types into ALL ReceiveType<T> parameters,
    // so receiveType is always defined when using is<T>(data) syntax.
    if (serializerOrType instanceof Serializer || errors !== undefined) {
        // Old API: is(data, serializer, errors, type)
        const ser = serializerOrType instanceof Serializer ? serializerOrType : serializer;
        const type = receiveType || (serializerOrType instanceof Serializer ? undefined : serializerOrType);
        if (!type) throw new NoTypeReceived('is() called without type parameter');
        const resolved = resolveReceiveType(type);
        const jit = getTypeJitContainer(resolved);
        if (!jit.__is) {
            jit.__is = ser.buildTypeGuard(resolved, false);
        }
        return jit.__is(data, { errors: errors || [] });
    }

    // New API: is(data, type) - type guard with loose mode (allows extra keys)
    const type = serializerOrType as ReceiveType<T> | undefined;
    if (!type) throw new NoTypeReceived('is() called without type parameter');
    const resolved = resolveReceiveType(type);
    const jit = getTypeJitContainer(resolved);
    if (!jit.__isLoose) {
        // Use buildTypeGuard with loose mode: validates constraints but allows extra keys
        jit.__isLoose = serializer.buildTypeGuard(resolved, true);
    }
    return jit.__isLoose(data, {});
}

/**
 * Pre-compiled fast type guard for repeated use.
 *
 * @example
 * ```typescript
 * const isUser = typeGuard<User>();
 * items.filter(isUser); // Fast filtering
 * ```
 */
export function typeGuard<T>(receiveType?: ReceiveType<T>): (data: unknown) => data is T {
    if (!receiveType) throw new NoTypeReceived('typeGuard() called without type parameter');
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (!jit.__isFast) {
        jit.__isFast = serializer.buildFastTypeGuard(type);
    }
    return jit.__isFast;
}

// ============================================================================
// Strict Type Guards (reject unknown keys)
// ============================================================================

/**
 * Strict type guard. Returns true only if data matches type T exactly.
 * Rejects extra/unknown keys. No error details.
 *
 * This corresponds to "assertStrict" in typescript-runtime-type-benchmarks.
 *
 * @example
 * ```typescript
 * isStrict<{ name: string }>({ name: 'John' });        // true
 * isStrict<{ name: string }>({ name: 'John', x: 1 }); // false (unknown key 'x')
 * ```
 */
export function isStrict<T>(data: unknown, receiveType?: ReceiveType<T>): data is T {
    if (!receiveType) throw new NoTypeReceived('isStrict() called without type parameter');
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (!jit.__isStrict) {
        jit.__isStrict = serializer.buildStrictTypeGuard(type);
    }
    return jit.__isStrict(data);
}

/**
 * Pre-compiled strict type guard for repeated use.
 * Rejects extra/unknown keys.
 *
 * @example
 * ```typescript
 * const isUserStrict = typeGuardStrict<User>();
 * isUserStrict({ name: 'John', age: 30 });        // true
 * isUserStrict({ name: 'John', age: 30, x: 1 }); // false
 * ```
 */
export function typeGuardStrict<T>(receiveType?: ReceiveType<T>): (data: unknown) => data is T {
    if (!receiveType) throw new NoTypeReceived('typeGuardStrict() called without type parameter');
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (!jit.__isStrict) {
        jit.__isStrict = serializer.buildStrictTypeGuard(type);
    }
    return jit.__isStrict;
}

// ============================================================================
// Weak Type Guards (maximum performance, no NaN checks)
// ============================================================================

/**
 * Weak type guard. Returns true if data matches type T.
 * Skips NaN checks for maximum performance. Allows extra/unknown keys.
 *
 * This is the fastest validation mode - use when you trust your data won't
 * contain NaN values, or when NaN is acceptable for number fields.
 *
 * Generated code uses pure && chain without NaN checks:
 * `return typeof s0 === "object" && typeof s0.age === "number" && ...`
 *
 * @example
 * ```typescript
 * isWeak<{ age: number }>({ age: 30 });   // true
 * isWeak<{ age: number }>({ age: NaN });  // true (NaN not rejected!)
 * is<{ age: number }>({ age: NaN });      // false (regular is() rejects NaN)
 * ```
 */
export function isWeak<T>(data: unknown, receiveType?: ReceiveType<T>): data is T {
    if (!receiveType) throw new NoTypeReceived('isWeak() called without type parameter');
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (!jit.__isWeak) {
        jit.__isWeak = serializer.buildWeakTypeGuard(type);
    }
    return jit.__isWeak(data);
}

/**
 * Pre-compiled weak type guard for repeated use.
 * Skips NaN checks for maximum performance.
 *
 * @example
 * ```typescript
 * const isUserWeak = typeGuardWeak<User>();
 * items.filter(isUserWeak); // Fastest filtering, but NaN passes
 * ```
 */
export function typeGuardWeak<T>(receiveType?: ReceiveType<T>): (data: unknown) => data is T {
    if (!receiveType) throw new NoTypeReceived('typeGuardWeak() called without type parameter');
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (!jit.__isWeak) {
        jit.__isWeak = serializer.buildWeakTypeGuard(type);
    }
    return jit.__isWeak;
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert that data is of type T, throw ValidationError if not.
 * Uses fast check first, then collects detailed errors on failure.
 *
 * @throws ValidationError with detailed error information
 *
 * @example
 * ```typescript
 * assert<User>(data); // throws if not User
 * console.log(data.name); // data is User
 * ```
 *
 * @deprecated signature: `assert(data, serializer, type)` - use `assert(data, type)` instead
 */

/**
 * Check if a type or any of its nested members have validation annotations.
 * Uses the visit() function to traverse the type tree.
 */
function hasValidatorsDeep(type: Type): boolean {
    let found = false;
    visit(type, t => {
        if (validationAnnotation.getAnnotations(t).length > 0) {
            found = true;
            return false; // Stop visiting
        }
    });
    return found;
}

export function assert<T>(data: unknown, receiveType?: ReceiveType<T>): asserts data is T;
/**
 * @deprecated Use `assert(data, type)` instead.
 */
export function assert<T>(data: unknown, serializerToUse?: Serializer, receiveType?: ReceiveType<T>): asserts data is T;
export function assert<T>(
    data: unknown,
    serializerOrType?: Serializer | ReceiveType<T>,
    receiveType?: ReceiveType<T>,
): asserts data is T {
    // Detect which overload is being used
    let type: ReceiveType<T> | undefined;
    let ser: Serializer = serializer;

    if (serializerOrType instanceof Serializer) {
        // Old API: assert(data, serializer, type)
        ser = serializerOrType;
        type = receiveType;
    } else if (receiveType !== undefined) {
        // Old API: assert(data, undefined, type) - serializer explicitly undefined
        type = receiveType;
    } else {
        // New API: assert(data, type)
        type = serializerOrType;
    }

    if (!type) throw new NoTypeReceived('assert() called without type parameter');

    const resolved = resolveReceiveType(type);
    const jit = getTypeJitContainer(resolved);

    // Check if type has validators anywhere in the structure - if so, skip fast path
    // since fast guards don't run validators
    const hasValidators = hasValidatorsDeep(resolved);

    if (!hasValidators) {
        // Fast path: use fast type guard (no validators to run)
        if (!jit.__isFast) {
            jit.__isFast = ser.buildFastTypeGuard(resolved);
        }

        if (jit.__isFast(data)) {
            return; // Valid, no validators to run
        }
    }

    // Slow path: use regular type guard with validators and error collection
    if (!jit.__is) {
        jit.__is = ser.buildTypeGuard(resolved, false);
    }
    const errors: ValidationErrorItem[] = [];
    if (!jit.__is(data, { errors })) {
        throw new ValidationError(errors, resolved);
    }
}

// ============================================================================
// Backwards Compatibility (deprecated)
// ============================================================================

/**
 * @deprecated Use `is<T>()` for fast type guard, or `validate<T>()` from validator.ts for error collection.
 *
 * ```typescript
 * // Old:
 * const validator = getValidatorFunction<MyType>();
 * const valid = validator(data, {errors});
 *
 * // New (fast type guard):
 * const valid = is<MyType>(data);
 *
 * // New (with error collection):
 * import { validate } from '@deepkit/type';
 * const errors = validate<MyType>(data);
 * const valid = errors.length === 0;
 * ```
 */
export function getValidatorFunction<T>(
    serializerToUse: Serializer = serializer,
    receiveType?: ReceiveType<T>,
): Guard<T> {
    if (!receiveType) throw new NoTypeReceived('getValidatorFunction called without type parameter');
    const type = resolveReceiveType(receiveType);
    return serializerToUse.buildTypeGuard(type, false);
}

/**
 * @deprecated Use `typeGuard<T>()` instead.
 */
export function guard<T>(serializerToUse: Serializer = serializer, receiveType?: ReceiveType<T>): Guard<T> {
    if (!receiveType) throw new NoTypeReceived('guard() called without type parameter');
    const fn = getValidatorFunction(serializerToUse, receiveType);
    return ((data: any) => fn(data, { errors: [] })) as Guard<T>;
}
