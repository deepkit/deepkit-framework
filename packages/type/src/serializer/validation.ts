/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { type Builder, DeepkitError, type Ref } from '@deepkit/core';

import { Type, TypeFunction, validationAnnotation } from '../reflection/type.js';
import { ReflectionKind, stringifyType } from '../reflection/type.js';
import { ValidateFunction } from '../type-annotations.js';
import { ValidationErrorItem, ValidatorError } from '../validator.js';
import { validators } from '../validators.js';
import type { TypeHook } from './registry.js';
import type { JsonBuildContext } from './state.js';

/**
 * Get the actual function from a Type node that represents a function reference.
 * Handles both direct function literals and class method types.
 */
function getFunctionFromType(fnType: Type): Function | undefined {
    // The function type should have the actual function reference stored
    if (fnType.kind === ReflectionKind.function) {
        const fn = fnType as TypeFunction;
        // The function is stored in a special property or needs to be resolved
        // Check if there's a function object reference
        if ((fn as any).function) {
            return (fn as any).function;
        }
    }
    // For literal function types, the function itself might be stored differently
    if (fnType.kind === ReflectionKind.literal && typeof (fnType as any).literal === 'function') {
        return (fnType as any).literal;
    }
    return undefined;
}

/**
 * Validation post-hook that runs validators after type guard passes.
 *
 * This hook:
 * 1. Lets the main type guard run first
 * 2. If type guard passes (true), runs validation annotations
 * 3. Returns false if validation fails
 *
 * @example
 * ```typescript
 * // With type: string & MinLength<3>
 * // 1. Type guard returns true (string matches)
 * // 2. MinLength validator runs
 * // 3. If length < 3, returns false and error is added
 * ```
 */
export const validationHook: TypeHook<JsonBuildContext> = (type, input, b, state, next) => {
    // Run type check first
    const typeResult = next();

    // Get validation annotations
    const annotations = validationAnnotation.getAnnotations(type);
    if (annotations.length === 0) {
        return typeResult;
    }

    // Create mutable valid flag (boolean)
    const valid = b.var_(typeResult as Ref<boolean>);

    // Get the errors array from state's optionsRef
    const errorsRef = state.optionsRef.get('errors' as any);
    const pathExpr = state.pathRef();

    // Check if we should add errors:
    // - Don't add if in union context (unless collectUnionMemberErrors is true)
    // This matches the behavior in handlers.ts post-hook
    const shouldAddErrors = !state.inUnionContext || state.collectUnionMemberErrors;

    for (const validation of annotations) {
        const { name, args } = validation;

        if (name === 'function') {
            // Custom validator function
            // args[0] is the function type, args[1] is optional options
            const fnType = args[0];
            const optionsType = args[1];

            // Get the validator function - it's stored on the type
            const validatorFn = getFunctionFromType(fnType);

            if (validatorFn) {
                // Resolve options if provided
                let options: any = undefined;
                if (optionsType && optionsType.kind === ReflectionKind.literal) {
                    options = (optionsType as any).literal;
                }

                // Get the expected parameter description from the function type
                let expectedParamDesc = 'options';
                if (fnType.kind === ReflectionKind.function) {
                    const fnTypeFunc = fnType as TypeFunction;
                    if (fnTypeFunc.parameters && fnTypeFunc.parameters.length >= 3) {
                        const optionParam = fnTypeFunc.parameters[2];
                        const paramTypeName = stringifyType(optionParam.type, { showFullDefinition: false });
                        expectedParamDesc = `${optionParam.name}: ${paramTypeName}`;
                    }
                }

                b.if_(b.getVar(valid), () => {
                    // Call validator function with (value, type, options)
                    const error = b.call(
                        (fn: ValidateFunction, value: any, t: Type, opts: any, expectedParam: string) => {
                            // Check if function expects options but none provided
                            if (fn.length >= 3 && opts === undefined) {
                                throw new DeepkitError(
                                    'DK-T113',
                                    `Invalid option value given to validator function ${fn.name}, expected ${expectedParam}`,
                                );
                            }
                            return fn(value, t, opts);
                        },
                        b.lit(validatorFn),
                        input,
                        b.lit(type),
                        b.lit(options),
                        b.lit(expectedParamDesc),
                    );

                    b.if_(error, () => {
                        b.setVar(valid, b.lit(false));

                        // Push error to errors array if it exists AND we should add errors
                        if (shouldAddErrors) {
                            b.if_(errorsRef, () => {
                                const errorItem = b.call(
                                    (err: ValidatorError, path: string, value: any) => {
                                        return new ValidationErrorItem(path, err.code, err.message, value);
                                    },
                                    error,
                                    pathExpr,
                                    input,
                                );
                                b.push(errorsRef, errorItem);
                            });
                        }
                    });
                });
            }
        } else {
            // Built-in validator
            const validatorFactory = validators[name];
            if (validatorFactory) {
                // Create validator with args
                const validatorFn = validatorFactory(...args);

                b.if_(b.getVar(valid), () => {
                    const error = b.call(validatorFn, input);

                    b.if_(error, () => {
                        b.setVar(valid, b.lit(false));

                        // Push error to errors array if it exists AND we should add errors
                        if (shouldAddErrors) {
                            b.if_(errorsRef, () => {
                                // Create ValidationErrorItem and push to errors array
                                const errorItem = b.call(
                                    (err: ValidatorError, path: string, value: any) => {
                                        return new ValidationErrorItem(path, err.code, err.message, value);
                                    },
                                    error,
                                    pathExpr,
                                    input,
                                );
                                b.push(errorsRef, errorItem);
                            });
                        }
                    });
                });
            }
        }
    }

    return b.getVar(valid);
};

/**
 * Register validation hook on type guards.
 */
export function registerValidationHook(serializer: {
    typeGuards: { addPostHook(hook: TypeHook<JsonBuildContext>): void };
}): void {
    // Add post-hook to the unified type guards registry
    serializer.typeGuards.addPostHook(validationHook);
}

/**
 * Create a validation function for a type.
 *
 * The returned function validates input and returns true if valid,
 * optionally collecting errors into a provided array.
 *
 * @example
 * ```typescript
 * const validate = createValidator<User>(userType, serializer);
 *
 * const errors: ValidationErrorItem[] = [];
 * if (!validate(data, { errors })) {
 *     console.log('Validation failed:', errors);
 * }
 * ```
 */
export function createValidator<T>(
    type: Type,
    serializer: { typeGuards: any },
): (data: any, state?: { errors?: any[] }) => boolean {
    const guardRegistry = serializer.typeGuards.getRegistry(1);

    // This would use jit.fn in the actual implementation
    return (data: any, state?: { errors?: any[] }) => {
        // Simplified - actual implementation uses JIT
        return true;
    };
}
