import { DeepkitError, stringifyValueWithType } from '@deepkit/core';

import { entity } from './decorator.js';
import { ReceiveType } from './reflection/reflection.js';
import { Type, stringifyType } from './reflection/type.js';
import { Serializer, serializer } from './serializer/serializer.js';
import { getValidatorFunction, is } from './typeguard.js';

/**
 * Used in validator functions.
 */
export class ValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
        public readonly path?: string,
    ) {}
}

/**
 * The structure of a validation error.
 *
 * Path defines the shallow or deep path (using dots).
 * Message is an arbitrary message in english.
 *
 * In validators please use and return `new ValidatorError('code', 'message')` instead.
 */
export class ValidationErrorItem {
    constructor(
        /**
         * The path to the property. Might be a deep path separated by dot.
         */
        public readonly path: string,
        /**
         * A lower cased error code that can be used to identify this error and translate.
         */
        public readonly code: string,
        /**
         * Free text of the error.
         */
        public readonly message: string,
        /**
         * Optional value that caused the error.
         */
        public readonly value?: any,
    ) {
        this.path = path && path[0] === '.' ? path.slice(1) : path;
    }

    toString(prefix: string = '') {
        let messagedCausedBy = '';
        if (this.value !== undefined) {
            //serialise the value and trim to 100 chars max
            let serialisedValue: string;
            try {
                serialisedValue = JSON.stringify(this.value);
            } catch {
                // Fallback for circular references or other JSON.stringify failures
                serialisedValue = stringifyValueWithType(this.value);
            }
            if (serialisedValue.length > 100) serialisedValue = serialisedValue.slice(0, 100) + '...';
            messagedCausedBy = ` caused by value ${serialisedValue}`;
        }

        return `${(prefix ? prefix + '.' : '') + this.path}(${this.code}): ${this.message}${messagedCausedBy}`;
    }
}

@entity.name('@error:validation')
export class ValidationError extends DeepkitError {
    constructor(
        public readonly errors: ValidationErrorItem[],
        type?: Type,
    ) {
        super(
            'DK-T300',
            `Validation error${type ? ` for type ${stringifyType(type)}` : ''}:\n${errors.map(v => v.toString()).join(',\n')}`,
        );
    }

    static from(errors: { path: string; message: string; code?: string; value?: any }[]) {
        return new ValidationError(errors.map(v => new ValidationErrorItem(v.path, v.code || '', v.message, v.value)));
    }
}

/**
 * Returns empty array when valid, or ValidationErrorItem[] with detailed error messages if not valid.
 *
 * Returns validation error items when failed. If successful returns an empty array.
 */
export function validate<T>(data: any, type?: ReceiveType<T>): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    is(data, undefined, errors, type);
    return errors;
}

export function validateFunction<T>(
    serializerToUse: Serializer = serializer,
    type?: ReceiveType<T>,
): (data: T) => ValidationErrorItem[] {
    const fn = getValidatorFunction(serializerToUse, type);
    return (data: T) => {
        const errors: ValidationErrorItem[] = [];
        fn(data, { errors });
        return errors;
    };
}

/**
 * Returns true when valid, and false if not.
 */
export function validates<T>(data: any, type?: ReceiveType<T>): boolean {
    const errors = validate(data, type);
    return errors.length === 0;
}
