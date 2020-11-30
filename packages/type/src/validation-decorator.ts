/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {isArray} from '@deepkit/core';
import {PropertyValidatorError} from './jit-validation';
import validator from 'validator';

export const validators = {
    pattern(regex: RegExp) {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (regex.exec(value)) return;
            throw new PropertyValidatorError('pattern', `Pattern ${regex.source} does not match`);
        };
    },

    alpha(locale: validator.AlphaLocale = 'en-US') {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAlpha(value, locale)) return;
            throw new PropertyValidatorError('alpha', 'Not alpha');
        };
    },

    alphanumeric(locale: validator.AlphanumericLocale = 'en-US') {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAlphanumeric(value, locale)) return;
            throw new PropertyValidatorError('alphanumeric', 'Not alphanumeric');
        };
    },

    ascii() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAscii(value)) return;
            throw new PropertyValidatorError('ascii', 'Not ASCII');
        };
    },

    dataURI() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isDataURI(value)) return;
            throw new PropertyValidatorError('dataURI', 'Not a data URI');
        };
    },

    decimal(options?: validator.IsDecimalOptions) {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isDecimal(value, options)) return;
            throw new PropertyValidatorError('decimal', 'Not a decimal');
        };
    },

    multipleOf(num: any) {
        return (value: any) => {
            if ('number' !== typeof value) return;
            if (value % num === 0) return;
            throw new PropertyValidatorError('multipleOf', 'Not a multiple of ' + num);
        };
    },

    minLength(length: number) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length >= length) return;

            throw new PropertyValidatorError('minLength', 'Min length is ' + length);
        };
    },

    maxLength(length: number) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length <= length) return;

            throw new PropertyValidatorError('maxLength', 'Max length is ' + length);
        };
    },

    includes(include: any) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.includes(include)) return;

            throw new PropertyValidatorError('includes', `Needs to include '${include}'`);
        };
    },

    excludes(excludes: any) {
        return (value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (!value.includes(excludes)) return;
            throw new PropertyValidatorError('excludes', `Needs to exclude '${excludes}'`);
        };
    },

    minimum(min: number) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value < min) throw new PropertyValidatorError('minimum', 'Number needs to be greater than or equal to ' + min);
        };
    },

    exclusiveMinimum(min: number) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value <= min) throw new PropertyValidatorError('minimum', 'Number needs to be greater than ' + min);
        };
    },

    maximum(max: number) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value > max) throw new PropertyValidatorError('maximum', 'Number needs to be smaller than or equal to ' + max);
        };
    },

    exclusiveMaximum(max: number) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value >= max) throw new PropertyValidatorError('maximum', 'Number needs to be smaller than ' + max);
        };
    },

    positive(includingZero: boolean = true) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value > 0) return;
            if (includingZero && value === 0) return;

            throw new PropertyValidatorError('positive', 'Number needs to be positive');
        };
    },

    negative(includingZero: boolean = true) {
        return (value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value < 0) return;
            if (includingZero && value === 0) return;

            throw new PropertyValidatorError('negative', 'Number needs to be negative');
        };
    },
};
