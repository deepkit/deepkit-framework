import { isArray } from '@deepkit/core';

import { TypeLiteral } from './reflection/type.js';
import { ValidatorError } from './validator.js';

export const validators: { [name in string]?: (...args: any[]) => (value: any) => ValidatorError | undefined } = {
    pattern(type: TypeLiteral) {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (type.literal instanceof RegExp) {
                if (type.literal.exec(value)) return;
                return new ValidatorError('pattern', `Pattern ${type.literal.source} does not match`);
            }
            return;
        };
    },

    alpha() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[A-Z]+$/i.test(value)) return;
            return new ValidatorError('alpha', 'Not alpha');
        };
    },

    alphanumeric() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[0-9A-Z]+$/i.test(value)) return;
            return new ValidatorError('alphanumeric', 'Not alphanumeric');
        };
    },

    ascii() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[\x00-\x7F]+$/.test(value)) return;
            return new ValidatorError('ascii', 'Not ASCII');
        };
    },

    dataURI() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (/^(data:)([\w\/\+-]*)(;charset=[\w-]+|;base64){0,1},(.*)/gi.test(value)) return;
            return new ValidatorError('dataURI', 'Not a data URI');
        };
    },

    decimal(minDigits: TypeLiteral & { literal: number }, maxDigits: TypeLiteral & { literal: number }) {
        const regexp = new RegExp('^-?\\d+\\.\\d{' + minDigits.literal + ',' + maxDigits.literal + '}$');
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (regexp.test(value)) return;
            return new ValidatorError('decimal', `Not a decimal(x.${minDigits.literal}-${maxDigits.literal})`);
        };
    },

    multipleOf(num: TypeLiteral & { literal: number }) {
        return (value: any) => {
            if ('number' !== typeof value) return;
            if (value % num.literal === 0) return;
            return new ValidatorError('multipleOf', 'Not a multiple of ' + num.literal);
        };
    },

    minLength(length: TypeLiteral & { literal: number }) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length >= length.literal) return;

            return new ValidatorError('minLength', 'Min length is ' + length.literal);
        };
    },

    maxLength(length: TypeLiteral & { literal: number }) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length <= length.literal) return;

            return new ValidatorError('maxLength', 'Max length is ' + length.literal);
        };
    },

    includes(include: TypeLiteral) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.includes(include.literal as any)) return;

            return new ValidatorError('includes', `Needs to include '${String(include.literal)}'`);
        };
    },

    excludes(excludes: TypeLiteral) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (!value.includes(excludes.literal as any)) return;
            return new ValidatorError('excludes', `Needs to exclude '${String(excludes.literal)}'`);
        };
    },

    minimum(min: TypeLiteral & { literal: number | bigint }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value < min.literal)
                return new ValidatorError('minimum', 'Number needs to be greater than or equal to ' + min.literal);
            return;
        };
    },

    exclusiveMinimum(min: TypeLiteral & { literal: number | bigint }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value <= min.literal)
                return new ValidatorError('minimum', 'Number needs to be greater than ' + min.literal);
            return;
        };
    },

    maximum(max: TypeLiteral & { literal: number | bigint }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value > max.literal)
                return new ValidatorError('maximum', 'Number needs to be smaller than or equal to ' + max.literal);
            return;
        };
    },

    exclusiveMaximum(max: TypeLiteral & { literal: number | bigint }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value >= max.literal)
                return new ValidatorError('maximum', 'Number needs to be smaller than ' + max.literal);
            return;
        };
    },

    positive(includingZero: TypeLiteral & { literal: boolean }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value > 0) return;
            if (includingZero.literal && value === 0) return;

            return new ValidatorError('positive', 'Number needs to be positive');
        };
    },

    negative(includingZero: TypeLiteral & { literal: boolean }) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value < 0) return;
            if (includingZero.literal && value === 0) return;

            return new ValidatorError('negative', 'Number needs to be negative');
        };
    },

    beforeDate(date: TypeLiteral & { literal: number }) {
        return (value: any) => {
            if (!(value instanceof Date)) return;
            if (value.getTime() < date.literal) return;

            return new ValidatorError('beforeDate', `Dates needs to be before ${date.literal}`);
        };
    },

    afterDate(date: TypeLiteral & { literal: number }) {
        return (value: any) => {
            if (!(value instanceof Date)) return;
            if (value.getTime() > date.literal) return;

            return new ValidatorError('beforeDate', `Dates needs to be after ${date.literal}`);
        };
    },

    beforeNow() {
        return (value: any) => {
            if (!(value instanceof Date)) return;
            if (value.getTime() < Date.now()) return;

            return new ValidatorError('beforeDate', `Dates needs to be in the past`);
        };
    },

    afterNow() {
        return (value: any) => {
            if (!(value instanceof Date)) return;
            if (value.getTime() > Date.now()) return;

            return new ValidatorError('beforeDate', `Dates needs to be in the future`);
        };
    },
};
