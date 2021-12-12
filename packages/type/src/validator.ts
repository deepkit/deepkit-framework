import { ReceiveType } from './reflection/reflection';
import { is } from './typeguard';

export type Validator<Name extends string, Args extends [...args: any[]] = []> = { __meta?: { id: 'validator', name: Name, args: Args } }

export type Validate<T extends Function> = Validator<'function', [T]>;
export type Pattern<T extends RegExp> = Validator<'pattern', [T]>;
export type Alpha = Validator<'alpha'>;
export type Alphanumeric = Validator<'alphanumeric'>;
export type Ascii = Validator<'ascii'>;
export type Decimal<MinDigits extends number = 1, MaxDigits extends number = 100> = Validator<'decimal', [MinDigits, MaxDigits]>;
export type MultipleOf<Num extends number> = Validator<'multipleOf', [Num]>;
export type MinLength<Length extends number> = Validator<'minLength', [Length]>;
export type MaxLength<Length extends number> = Validator<'maxLength', [Length]>;

export type Includes<T extends string|number|boolean> = Validator<'includes', [T]>;
export type Excludes<T extends string|number|boolean> = Validator<'excludes', [T]>;

export type Minimum<T extends number | bigint> = Validator<'minimum', [T]>;
export type Maximum<T extends number | bigint> = Validator<'maximum', [T]>;

export type Positive = Validator<'positive', [true]>;
export type Negative = Validator<'negative', [true]>;

export type PositiveNoZero = Validator<'positive', [false]>;
export type NegativeNoZero = Validator<'negative', [false]>;

export type ExclusiveMinimum<T extends number | bigint> = Validator<'exclusiveMinimum', [T]>;
export type ExclusiveMaximum<T extends number | bigint> = Validator<'exclusiveMaximum', [T]>;

export type BeforeDate<T extends number> = Validator<'beforeDate', [T]>;
export type AfterDate<T extends number> = Validator<'afterDate', [T]>;
export type BeforeNow = Validator<'beforeNow'>;
export type AfterNow = Validator<'afterNow'>;

export const EMAIL_REGEX = /^\S+@\S+$/;
export type Email = string & Pattern<typeof EMAIL_REGEX>;

/**
 * The structure of a validation error.
 *
 * Path defines the shallow or deep path (using dots).
 * Message is an arbitrary message in english.
 *
 * In validators please use and return `new ValidatorError('code', 'message')` instead.
 */
export class ValidationFailedItem {
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
    ) {
    }

    toString(prefix: string = '') {
        return `${(prefix ? prefix + '.' : '') + this.path}(${this.code}): ${this.message}`;
    }
}

export class ValidatorError {
    constructor(
        public readonly code: string,
        public readonly message: string,
    ) {
    }
}

/**
 * Returns empty array when valid, or ValidationFailedItem[] with detailed error messages if not valid.
 */
export function validate<T>(data: any, type?: ReceiveType<T>): ValidationFailedItem[] {
    const errors: ValidationFailedItem[] = [];
    is(data, undefined, errors, type!);
    return errors;
}
