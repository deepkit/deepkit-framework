/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BenchSuite } from '@deepkit/bench';

/**
 * Array type checking benchmark - compares different methods to check if a value is an array
 */

export default async function () {
    const suite = new BenchSuite('debug/language-is-array');

    const array = ['a', 'b', 'c'];

    // Custom isArray implementation for comparison
    function isArray(v: any): v is any[] {
        return Array.isArray(v);
    }

    const isArrayLocal = isArray; // local assign needed to avoid import measurement

    suite.add('Array.isArray()', () => {
        Array.isArray(array);
    });

    suite.add('custom isArray() (local)', () => {
        isArrayLocal(array);
    });

    suite.add('custom isArray() (function)', () => {
        isArray(array);
    });

    suite.add('instanceof Array', () => {
        let is = false;
        if (array instanceof Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('constructor === Array', () => {
        let is = false;
        if (array && array.constructor === Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('.length check', () => {
        let is = false;
        if (array.length >= 0) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('.length && typeof slice', () => {
        let is = false;
        if (array.length >= 0 && 'function' === typeof array.slice && 'string' !== typeof array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('!.length || !slice (negative check)', () => {
        let is = true;
        if ((array as any).length === undefined || 'string' === typeof array || 'function' !== typeof array.slice) {
            is = false;
        }
        if (!is) throw Error('invalid');
    });

    return suite;
}
