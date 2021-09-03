/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isArray } from '@deepkit/core';
import { PropertyValidatorError } from './jit-validation';

export const validators = {
    pattern(regex: RegExp) {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (regex.exec(value)) return;
            throw new PropertyValidatorError('pattern', `Pattern ${regex.source} does not match`);
        };
    },

    alpha() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[A-Z]+$/i.test(value)) return;
            throw new PropertyValidatorError('alpha', 'Not alpha');
        };
    },

    alphanumeric() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[0-9A-Z]+$/i.test(value)) return;
            throw new PropertyValidatorError('alphanumeric', 'Not alphanumeric');
        };
    },

    ascii() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (value.length === 0) return;
            if (/^[\x00-\x7F]+$/.test(value)) return;
            throw new PropertyValidatorError('ascii', 'Not ASCII');
        };
    },

    dataURI() {
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (/^(data:)([\w\/\+-]*)(;charset=[\w-]+|;base64){0,1},(.*)/gi.test(value)) return;
            throw new PropertyValidatorError('dataURI', 'Not a data URI');
        };
    },

    decimal(minDigits: number = 1, maxDigits: number = 100) {
        const regexp = new RegExp('^-?\\d+\\.\\d{' + minDigits + ',' + maxDigits + '}$');
        return (value: any) => {
            if ('string' !== typeof value) return;
            if (regexp.test(value)) return;
            throw new PropertyValidatorError('decimal', `Not a decimal(x.${minDigits}-${maxDigits})`);
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
